"""Pydantic request/response models (the API contract)."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import FormStatus, LogicOperator, QuestionType, ResponseStatus


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------- Form content ----------

class ChoiceIn(BaseModel):
    id: str | None = Field(default=None, max_length=32)
    label: str = Field(max_length=500)


class ChoiceOut(ORM):
    id: str
    label: str


class LogicRuleIn(BaseModel):
    id: str | None = Field(default=None, max_length=32)
    operator: LogicOperator
    value: str | None = Field(default=None, max_length=500)
    # None => jump to end (thank-you screen)
    target_question_id: str | None = None


class LogicRuleOut(ORM):
    id: str
    operator: LogicOperator
    value: str | None
    target_question_id: str | None


class QuestionIn(BaseModel):
    id: str | None = Field(default=None, max_length=32)
    type: QuestionType
    title: str = Field(default="", max_length=2000)
    description: str | None = Field(default=None, max_length=4000)
    required: bool = False
    properties: dict[str, Any] = Field(default_factory=dict)
    choices: list[ChoiceIn] = Field(default_factory=list)
    logic: list[LogicRuleIn] = Field(default_factory=list)


class QuestionOut(ORM):
    id: str
    position: int
    type: QuestionType
    title: str
    description: str | None
    required: bool
    properties: dict[str, Any]
    choices: list[ChoiceOut]
    logic: list[LogicRuleOut] = Field(default_factory=list, validation_alias="logic_rules")


class ScreenConfig(BaseModel):
    enabled: bool = True
    title: str = ""
    description: str | None = None
    button_text: str | None = None


class ThemeConfig(BaseModel):
    preset: str = "classic"
    background: str = "#FFFFFF"
    question_color: str = "#111318"
    answer_color: str = "#2F54EB"
    button_color: str = "#2F54EB"
    button_text_color: str = "#FFFFFF"
    font: str = "Inter"


class FormSettings(BaseModel):
    show_progress_bar: bool = True
    show_question_numbers: bool = True
    show_artwork: bool = True  # soft glow + dot-grid accents behind questions


class FormCreate(BaseModel):
    title: str = Field(default="My new form", min_length=1, max_length=255)
    workspace_id: int | None = None
    questions: list[QuestionIn] = Field(default_factory=list)


class FormUpdate(BaseModel):
    """Partial update of form metadata (title, presentation)."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    workspace_id: int | None = None
    theme: ThemeConfig | None = None
    welcome_screen: ScreenConfig | None = None
    thankyou_screen: ScreenConfig | None = None
    settings: FormSettings | None = None


class QuestionsSync(BaseModel):
    """Full ordered list of questions; replaces the form's current content."""

    questions: list[QuestionIn]


class FormSummary(ORM):
    id: int
    workspace_id: int
    title: str
    slug: str
    status: FormStatus
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    response_count: int = 0
    question_count: int = 0
    theme: dict[str, Any] = Field(default_factory=dict)


class FormDetail(FormSummary):
    welcome_screen: dict[str, Any]
    thankyou_screen: dict[str, Any]
    settings: dict[str, Any]
    questions: list[QuestionOut]


class PublicForm(BaseModel):
    slug: str
    title: str
    theme: dict[str, Any]
    welcome_screen: dict[str, Any]
    thankyou_screen: dict[str, Any]
    settings: dict[str, Any]
    questions: list[QuestionOut]


# ---------- Workspaces ----------

class WorkspaceOut(ORM):
    id: int
    name: str
    form_count: int = 0


class WorkspaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class MeOut(ORM):
    id: int
    name: str
    email: str


# ---------- Responses ----------

class AnswersIn(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)
    last_question_id: str | None = None


class StartOut(BaseModel):
    token: str


class ViewIn(BaseModel):
    visitor_id: str = Field(min_length=1, max_length=64)

    @field_validator("visitor_id")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()


class AnswerOut(BaseModel):
    question_id: str
    value: Any
    display: str


class ResponseOut(BaseModel):
    id: int
    status: ResponseStatus
    started_at: datetime
    submitted_at: datetime | None
    duration_seconds: float | None
    user_agent: str | None
    answers: list[AnswerOut]


class ResponseList(BaseModel):
    total: int
    items: list[ResponseOut]


class ValidationErrorItem(BaseModel):
    question_id: str
    message: str


# ---------- AI ----------

class AIGenerateIn(BaseModel):
    prompt: str = Field(min_length=3, max_length=1000)
    create: bool = True


class AIRewriteIn(BaseModel):
    title: str = Field(min_length=1, max_length=2000)
    type: QuestionType
    tone: str = Field(default="friendly", max_length=40)


class AISuggestIn(BaseModel):
    form_title: str = Field(max_length=255)
    existing: list[str] = Field(default_factory=list)
