from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response as RawResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Response, ResponseStatus
from ..schemas import ResponseList, ResponseOut
from ..services import ai
from ..services import results as svc
from ..services.forms import load_form

router = APIRouter(prefix="/api", tags=["results"])


@router.get("/forms/{form_id}/responses", response_model=ResponseList)
def list_responses(
    form_id: int,
    status_: ResponseStatus | None = Query(default=ResponseStatus.completed, alias="status"),
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    form = load_form(db, form_id)
    total, items = svc.list_responses(db, form, status_, q, limit, offset)
    return ResponseList(total=total, items=items)


@router.get("/forms/{form_id}/responses/export.csv")
def export_csv(form_id: int, db: Session = Depends(get_db)):
    form = load_form(db, form_id)
    safe = "".join(ch if ch.isalnum() else "_" for ch in form.title)[:40] or "responses"
    return RawResponse(
        content=svc.export_csv(db, form),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{safe}_responses.csv"'},
    )


def _get_response(db: Session, form_id: int, response_id: int) -> Response:
    resp = db.scalar(
        select(Response).where(Response.id == response_id, Response.form_id == form_id)
        .options(selectinload(Response.answers))
    )
    if not resp:
        raise HTTPException(404, "Response not found")
    return resp


@router.get("/forms/{form_id}/responses/{response_id}", response_model=ResponseOut)
def get_response(form_id: int, response_id: int, db: Session = Depends(get_db)):
    form = load_form(db, form_id)
    return svc.serialize_response(_get_response(db, form_id, response_id), form.questions)


@router.delete("/forms/{form_id}/responses/{response_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_response(form_id: int, response_id: int, db: Session = Depends(get_db)):
    db.delete(_get_response(db, form_id, response_id))
    db.commit()


@router.get("/forms/{form_id}/summary")
def summary(form_id: int, db: Session = Depends(get_db)):
    form = load_form(db, form_id)
    return {
        "metrics": svc.form_metrics(db, form),
        "drop_off": svc.drop_off(db, form),
        "questions": svc.question_summary(db, form),
    }


@router.post("/forms/{form_id}/insights")
def insights(form_id: int, question_id: str | None = None, db: Session = Depends(get_db)):
    """AI summary of open-text answers (Typeform 'Insights')."""
    form = load_form(db, form_id)
    texts = svc.text_answers(db, form, question_id)
    titles = {q.id: q.title for q in form.questions}
    return {
        "items": [
            {"question_id": qid, "title": titles.get(qid, ""), "count": len(ans), **ai.summarize_answers(titles.get(qid, ""), ans)}
            for qid, ans in texts.items()
        ]
    }
