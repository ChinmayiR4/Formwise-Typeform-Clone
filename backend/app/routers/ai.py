from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import AIGenerateIn, AIRewriteIn, AISuggestIn, QuestionIn
from ..services import ai
from ..services.forms import new_form
from .forms import to_detail

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/status")
def status_():
    return ai.ai_status()


@router.post("/generate-form", status_code=status.HTTP_201_CREATED)
def generate_form(body: AIGenerateIn, db: Session = Depends(get_db)):
    """'Create with AI': turn a prompt into a full draft form."""
    draft = ai.generate_form(body.prompt)
    if not body.create:
        return draft
    form = new_form(db, draft["title"], None, [QuestionIn(**q) for q in draft["questions"]])
    return {"form": to_detail(db, form), "source": draft["source"]}


@router.post("/rewrite-question")
def rewrite(body: AIRewriteIn):
    return ai.rewrite_question(body.title, body.type.value, body.tone)


@router.post("/suggest-questions")
def suggest(body: AISuggestIn):
    return ai.suggest_questions(body.form_title, body.existing)
