"""Public, unauthenticated endpoints used by the respondent flow (/to/<slug>)."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Answer, Form, FormView, Response, ResponseStatus
from ..schemas import AnswersIn, PublicForm, QuestionOut, StartOut, ViewIn
from ..services.forms import load_published_form
from ..services.ids import new_token
from ..services.validation import validate_partial, validate_submission

router = APIRouter(prefix="/api/public", tags=["public"])


class SubmitIn(AnswersIn):
    token: str | None = None


class SubmitOut(BaseModel):
    response_id: int
    status: ResponseStatus


def _validation_error(errors: dict[str, str]) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": {"message": "Some answers need your attention", "errors": errors}},
    )


def _upsert_answers(db: Session, resp: Response, clean: dict[str, Any], replace: bool = False) -> None:
    existing = {a.question_id: a for a in resp.answers}
    if replace:
        for qid, a in list(existing.items()):
            if qid not in clean:
                resp.answers.remove(a)
    for qid, value in clean.items():
        if value is None:
            if qid in existing:
                resp.answers.remove(existing[qid])
            continue
        if qid in existing:
            existing[qid].value = value
        else:
            resp.answers.append(Answer(question_id=qid, value=value))


def _get_by_token(db: Session, form: Form, token: str) -> Response:
    resp = db.scalar(
        select(Response).where(Response.token == token, Response.form_id == form.id)
        .options(selectinload(Response.answers))
    )
    if not resp:
        raise HTTPException(404, "Response not found")
    return resp


@router.get("/forms/{slug}", response_model=PublicForm)
def get_public_form(slug: str, db: Session = Depends(get_db)):
    form = load_published_form(db, slug)
    return PublicForm(
        slug=form.slug, title=form.title, theme=form.theme or {}, welcome_screen=form.welcome_screen or {},
        thankyou_screen=form.thankyou_screen or {}, settings=form.settings or {},
        questions=[QuestionOut.model_validate(q) for q in form.questions],
    )


@router.post("/forms/{slug}/views", status_code=status.HTTP_204_NO_CONTENT)
def record_view(slug: str, body: ViewIn, db: Session = Depends(get_db)):
    form = load_published_form(db, slug)
    db.add(FormView(form_id=form.id, visitor_id=body.visitor_id))
    db.commit()


@router.post("/forms/{slug}/responses", response_model=StartOut, status_code=status.HTTP_201_CREATED)
def start_response(slug: str, body: AnswersIn, user_agent: str | None = Header(default=None),
                   db: Session = Depends(get_db)):
    """Create an in-progress (partial) response. Called after the first answer."""
    form = load_published_form(db, slug)
    clean, errors = validate_partial(form.questions, body.answers)
    if errors:
        return _validation_error(errors)
    resp = Response(form_id=form.id, token=new_token(), status=ResponseStatus.in_progress,
                    last_question_id=body.last_question_id, user_agent=(user_agent or "")[:500])
    db.add(resp)
    db.flush()
    _upsert_answers(db, resp, clean)
    db.commit()
    return StartOut(token=resp.token)


@router.patch("/forms/{slug}/responses/{token}", status_code=status.HTTP_204_NO_CONTENT)
def save_partial(slug: str, token: str, body: AnswersIn, db: Session = Depends(get_db)):
    form = load_published_form(db, slug)
    resp = _get_by_token(db, form, token)
    if resp.status == ResponseStatus.completed:
        raise HTTPException(409, "This response was already submitted")
    clean, errors = validate_partial(form.questions, body.answers)
    if errors:
        return _validation_error(errors)
    _upsert_answers(db, resp, clean)
    if body.last_question_id:
        resp.last_question_id = body.last_question_id
    db.commit()


@router.post("/forms/{slug}/submit", response_model=SubmitOut)
def submit(slug: str, body: SubmitIn, user_agent: str | None = Header(default=None),
           db: Session = Depends(get_db)):
    form = load_published_form(db, slug)
    clean, errors = validate_submission(form.questions, body.answers)
    if errors:
        return _validation_error(errors)

    if body.token:
        resp = _get_by_token(db, form, body.token)
        if resp.status == ResponseStatus.completed:
            raise HTTPException(409, "This response was already submitted")
    else:
        resp = Response(form_id=form.id, token=new_token(), user_agent=(user_agent or "")[:500])
        db.add(resp)
        db.flush()

    _upsert_answers(db, resp, clean, replace=True)
    now = datetime.now(timezone.utc)
    started = resp.started_at if resp.started_at.tzinfo else resp.started_at.replace(tzinfo=timezone.utc)
    resp.status = ResponseStatus.completed
    resp.submitted_at = now
    resp.duration_seconds = round((now - started).total_seconds(), 1)
    db.commit()
    return SubmitOut(response_id=resp.id, status=resp.status)
