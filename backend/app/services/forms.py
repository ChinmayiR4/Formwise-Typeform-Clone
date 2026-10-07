"""Form domain logic: creation, content sync, duplication and serialisation."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..models import (
    CHOICE_TYPES,
    Choice,
    Form,
    FormStatus,
    LogicOperator,
    LogicRule,
    Question,
    QuestionType,
    Response,
    ResponseStatus,
    User,
    Workspace,
)
from ..schemas import ChoiceIn, FormSettings, LogicRuleIn, QuestionIn, ScreenConfig, ThemeConfig
from .ids import new_id, new_slug

DEFAULT_THANKYOU = ScreenConfig(
    title="Thanks for completing this form!",
    description="Your answers have been recorded.",
    button_text=None,
).model_dump()
DEFAULT_WELCOME = ScreenConfig(enabled=False, title="", description=None, button_text="Start").model_dump()


def default_user(db: Session) -> User:
    """Auth is out of scope: everything belongs to a single default creator."""
    user = db.scalar(select(User).order_by(User.id).limit(1))
    if user is None:
        user = User(name="Alex Creator", email="creator@formwise.app")
        db.add(user)
        db.flush()
        db.add(Workspace(owner_id=user.id, name="My workspace"))
        db.commit()
    return user


def default_workspace(db: Session) -> Workspace:
    user = default_user(db)
    ws = db.scalar(select(Workspace).where(Workspace.owner_id == user.id).order_by(Workspace.id).limit(1))
    if ws is None:
        ws = Workspace(owner_id=user.id, name="My workspace")
        db.add(ws)
        db.commit()
    return ws


def unique_slug(db: Session) -> str:
    while True:
        slug = new_slug()
        if not db.scalar(select(Form.id).where(Form.slug == slug)):
            return slug


def load_form(db: Session, form_id: int) -> Form:
    form = db.scalar(
        select(Form)
        .where(Form.id == form_id)
        .options(selectinload(Form.questions).selectinload(Question.choices),
                 selectinload(Form.questions).selectinload(Question.logic_rules))
    )
    if form is None:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


def load_published_form(db: Session, slug: str) -> Form:
    form = db.scalar(
        select(Form)
        .where(Form.slug == slug)
        .options(selectinload(Form.questions).selectinload(Question.choices),
                 selectinload(Form.questions).selectinload(Question.logic_rules))
    )
    if form is None or form.status != FormStatus.published:
        raise HTTPException(status_code=404, detail="This form is not accepting responses")
    return form


def new_form(db: Session, title: str, workspace_id: int | None = None,
             questions: list[QuestionIn] | None = None) -> Form:
    ws_id = workspace_id or default_workspace(db).id
    if not db.get(Workspace, ws_id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    form = Form(
        workspace_id=ws_id,
        title=title,
        slug=unique_slug(db),
        status=FormStatus.draft,
        theme=ThemeConfig().model_dump(),
        welcome_screen=dict(DEFAULT_WELCOME),
        thankyou_screen=dict(DEFAULT_THANKYOU),
        settings=FormSettings().model_dump(),
    )
    db.add(form)
    db.flush()
    if questions:
        sync_questions(db, form, questions)
    db.commit()
    return load_form(db, form.id)


def _clean_properties(qtype: QuestionType, props: dict) -> dict:
    allowed = {
        QuestionType.short_text: {"placeholder", "max_length"},
        QuestionType.long_text: {"placeholder", "max_length"},
        QuestionType.email: {"placeholder"},
        QuestionType.number: {"placeholder", "min", "max"},
        QuestionType.multiple_choice: {"allow_multiple", "randomize", "vertical"},
        QuestionType.dropdown: {"placeholder", "alphabetical"},
        QuestionType.yes_no: set(),
        QuestionType.rating: {"steps", "shape"},
    }[qtype]
    out = {k: v for k, v in (props or {}).items() if k in allowed}
    if qtype == QuestionType.rating:
        steps = int(out.get("steps") or 5)
        out["steps"] = max(3, min(10, steps))
        out.setdefault("shape", "star")
    return out


def sync_questions(db: Session, form: Form, incoming: list[QuestionIn]) -> None:
    """Replace a form's questions with `incoming` (ordered), keeping ids stable.

    - Existing questions (matched by id) are updated in place, so their answers survive.
    - Missing questions are deleted (cascading their answers / rules).
    - Logic rules are validated to only jump *forward* (prevents loops).
    """
    existing = {q.id: q for q in form.questions}
    id_map: dict[str, str] = {}  # client id -> persisted id

    # Pass 1: resolve ids (a client id colliding with another form's question gets a fresh one)
    for qin in incoming:
        cid = qin.id or new_id()
        if cid in id_map:
            raise HTTPException(status_code=422, detail=f"Duplicate question id {cid}")
        if cid not in existing and db.get(Question, cid) is not None:
            id_map[cid] = new_id()
        else:
            id_map[cid] = cid
        qin.id = cid

    keep = set(id_map.values())
    for qid, q in list(existing.items()):
        if qid not in keep:
            form.questions.remove(q)
            db.delete(q)
    db.flush()

    ordered: list[Question] = []
    choice_maps: dict[str, dict[str, str]] = {}
    for pos, qin in enumerate(incoming):
        qid = id_map[qin.id]  # type: ignore[index]
        q = existing.get(qid)
        if q is None:
            q = Question(id=qid, form_id=form.id)
            form.questions.append(q)
        q.position = pos
        q.type = qin.type
        q.title = qin.title
        q.description = qin.description or None
        q.required = qin.required
        q.properties = _clean_properties(qin.type, qin.properties)

        # choices
        cmap: dict[str, str] = {}
        old_choices = {c.id: c for c in q.choices}
        new_choices: list[Choice] = []
        if qin.type in CHOICE_TYPES:
            for cpos, cin in enumerate(qin.choices):
                cid = cin.id or new_id()
                if cid in old_choices:
                    c = old_choices.pop(cid)
                elif db.get(Choice, cid) is not None or cid in cmap.values():
                    c = Choice(id=new_id())
                else:
                    c = Choice(id=cid)
                c.position, c.label = cpos, cin.label
                cmap[cid] = c.id
                new_choices.append(c)
        q.choices = new_choices
        choice_maps[qid] = cmap
        ordered.append(q)
    form.questions.sort(key=lambda x: x.position)
    db.flush()

    # Pass 2: logic rules
    positions = {q.id: q.position for q in ordered}
    for qin, q in zip(incoming, ordered):
        rules: list[LogicRule] = []
        for rpos, rin in enumerate(qin.logic):
            target = id_map.get(rin.target_question_id) if rin.target_question_id else None
            if rin.target_question_id and target is None:
                raise HTTPException(status_code=422, detail="Logic jump targets an unknown question")
            if target is not None and positions[target] <= q.position:
                raise HTTPException(status_code=422, detail="Logic jumps can only go to a later question")
            value = rin.value
            if q.type in CHOICE_TYPES and rin.operator != LogicOperator.always:
                value = choice_maps[q.id].get(value or "", value)
                if value not in {c.id for c in q.choices}:
                    continue  # rule points at a removed choice: drop it silently
            rules.append(LogicRule(id=new_id(), position=rpos, operator=rin.operator,
                                   value=value, target_question_id=target))
        q.logic_rules = rules
    db.flush()


def publish_errors(form: Form) -> list[str]:
    errs = []
    if not form.questions:
        errs.append("Add at least one question before publishing")
    for i, q in enumerate(form.questions, 1):
        if not q.title.strip():
            errs.append(f"Question {i} needs a title")
        if q.type in CHOICE_TYPES and len(q.choices) < 1:
            errs.append(f"Question {i} needs at least one choice")
    return errs


def set_status(db: Session, form: Form, status: FormStatus) -> Form:
    if status == FormStatus.published:
        errs = publish_errors(form)
        if errs:
            raise HTTPException(status_code=422, detail="; ".join(errs))
        form.published_at = datetime.now(timezone.utc)
    form.status = status
    db.commit()
    return load_form(db, form.id)


def duplicate_form(db: Session, src: Form) -> Form:
    """Deep-copy a form's content with fresh ids (responses are not copied)."""
    q_map = {q.id: new_id() for q in src.questions}
    questions: list[QuestionIn] = []
    for q in src.questions:
        c_map = {c.id: new_id() for c in q.choices}
        questions.append(QuestionIn(
            id=q_map[q.id],
            type=q.type,
            title=q.title,
            description=q.description,
            required=q.required,
            properties=dict(q.properties or {}),
            choices=[ChoiceIn(id=c_map[c.id], label=c.label) for c in q.choices],
            logic=[
                LogicRuleIn(
                    operator=r.operator,
                    value=c_map.get(r.value or "", r.value),
                    target_question_id=q_map.get(r.target_question_id) if r.target_question_id else None,
                )
                for r in q.logic_rules
            ],
        ))
    form = new_form(db, f"{src.title} (copy)", src.workspace_id, questions)
    form.theme = dict(src.theme or {})
    form.welcome_screen = dict(src.welcome_screen or {})
    form.thankyou_screen = dict(src.thankyou_screen or {})
    form.settings = dict(src.settings or {})
    db.commit()
    return load_form(db, form.id)


def response_counts(db: Session, form_ids: list[int]) -> dict[int, int]:
    if not form_ids:
        return {}
    rows = db.execute(
        select(Response.form_id, func.count(Response.id))
        .where(Response.form_id.in_(form_ids), Response.status == ResponseStatus.completed)
        .group_by(Response.form_id)
    ).all()
    return {fid: n for fid, n in rows}


def question_counts(db: Session, form_ids: list[int]) -> dict[int, int]:
    if not form_ids:
        return {}
    rows = db.execute(
        select(Question.form_id, func.count(Question.id)).where(Question.form_id.in_(form_ids)).group_by(Question.form_id)
    ).all()
    return {fid: n for fid, n in rows}
