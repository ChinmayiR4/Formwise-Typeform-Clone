from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Form, FormStatus, Workspace
from ..schemas import FormCreate, FormDetail, FormSummary, FormUpdate, QuestionOut, QuestionsSync
from ..services import forms as svc

router = APIRouter(prefix="/api/forms", tags=["forms"])


def to_detail(db: Session, form: Form) -> FormDetail:
    counts = svc.response_counts(db, [form.id])
    return FormDetail(
        id=form.id, workspace_id=form.workspace_id, title=form.title, slug=form.slug, status=form.status,
        created_at=form.created_at, updated_at=form.updated_at, published_at=form.published_at,
        response_count=counts.get(form.id, 0), question_count=len(form.questions),
        theme=form.theme or {}, welcome_screen=form.welcome_screen or {},
        thankyou_screen=form.thankyou_screen or {}, settings=form.settings or {},
        questions=[QuestionOut.model_validate(q) for q in form.questions],
    )


@router.get("", response_model=list[FormSummary])
def list_forms(
    workspace_id: int | None = None,
    q: str | None = Query(default=None, max_length=100),
    status_: FormStatus | None = Query(default=None, alias="status"),
    sort: Literal["updated", "created", "title"] = "updated",
    db: Session = Depends(get_db),
):
    user = svc.default_user(db)
    stmt = select(Form).join(Workspace).where(Workspace.owner_id == user.id)
    if workspace_id:
        stmt = stmt.where(Form.workspace_id == workspace_id)
    if q:
        stmt = stmt.where(Form.title.ilike(f"%{q}%"))
    if status_:
        stmt = stmt.where(Form.status == status_)
    order = {"updated": Form.updated_at.desc(), "created": Form.created_at.desc(), "title": Form.title.asc()}[sort]
    forms = db.scalars(stmt.order_by(order)).all()
    ids = [f.id for f in forms]
    rc, qc = svc.response_counts(db, ids), svc.question_counts(db, ids)
    return [
        FormSummary.model_validate(f).model_copy(update={"response_count": rc.get(f.id, 0), "question_count": qc.get(f.id, 0)})
        for f in forms
    ]


@router.post("", response_model=FormDetail, status_code=status.HTTP_201_CREATED)
def create_form(body: FormCreate, db: Session = Depends(get_db)):
    return to_detail(db, svc.new_form(db, body.title.strip(), body.workspace_id, body.questions))


@router.get("/{form_id}", response_model=FormDetail)
def get_form(form_id: int, db: Session = Depends(get_db)):
    return to_detail(db, svc.load_form(db, form_id))


@router.patch("/{form_id}", response_model=FormDetail)
def update_form(form_id: int, body: FormUpdate, db: Session = Depends(get_db)):
    form = svc.load_form(db, form_id)
    data = body.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        form.title = data["title"].strip()
    if data.get("workspace_id"):
        if not db.get(Workspace, data["workspace_id"]):
            raise HTTPException(404, "Workspace not found")
        form.workspace_id = data["workspace_id"]
    for key in ("theme", "welcome_screen", "thankyou_screen", "settings"):
        if data.get(key) is not None:
            setattr(form, key, {**(getattr(form, key) or {}), **data[key]})
    form.updated_at = datetime.now(timezone.utc)
    db.commit()
    return to_detail(db, svc.load_form(db, form_id))


@router.put("/{form_id}/questions", response_model=FormDetail)
def sync_questions(form_id: int, body: QuestionsSync, db: Session = Depends(get_db)):
    form = svc.load_form(db, form_id)
    svc.sync_questions(db, form, body.questions)
    form.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.expire_all()
    return to_detail(db, svc.load_form(db, form_id))


@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form(form_id: int, db: Session = Depends(get_db)):
    form = svc.load_form(db, form_id)
    db.delete(form)
    db.commit()


@router.post("/{form_id}/duplicate", response_model=FormDetail, status_code=status.HTTP_201_CREATED)
def duplicate(form_id: int, db: Session = Depends(get_db)):
    return to_detail(db, svc.duplicate_form(db, svc.load_form(db, form_id)))


@router.post("/{form_id}/publish", response_model=FormDetail)
def publish(form_id: int, db: Session = Depends(get_db)):
    return to_detail(db, svc.set_status(db, svc.load_form(db, form_id), FormStatus.published))


@router.post("/{form_id}/unpublish", response_model=FormDetail)
def unpublish(form_id: int, db: Session = Depends(get_db)):
    return to_detail(db, svc.set_status(db, svc.load_form(db, form_id), FormStatus.draft))
