"""Database schema.

    users 1──* workspaces 1──* forms 1──* questions 1──* choices
                                   │          └──* logic_rules ──> questions (target)
                                   ├──* form_views
                                   └──* responses 1──* answers ──> questions

Questions, choices and logic rules use short string ids that the builder may
generate on the client. That lets the builder save the whole form in one
"sync" request while keeping ids stable, so existing answers and logic jumps
keep pointing at the right question after an edit.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FormStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class QuestionType(str, enum.Enum):
    short_text = "short_text"
    long_text = "long_text"
    multiple_choice = "multiple_choice"
    dropdown = "dropdown"
    email = "email"
    number = "number"
    yes_no = "yes_no"
    rating = "rating"
    # Placeholders surfaced as "coming soon" in the builder, never accepted by the API.
    # file_upload / payment intentionally not in the enum.


CHOICE_TYPES = {QuestionType.multiple_choice, QuestionType.dropdown}


class ResponseStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"


class LogicOperator(str, enum.Enum):
    always = "always"
    is_ = "is"
    is_not = "is_not"
    contains = "contains"
    not_contains = "not_contains"
    eq = "eq"
    neq = "neq"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    workspaces: Mapped[list[Workspace]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped[User] = relationship(back_populates="workspaces")
    forms: Mapped[list[Form]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class Form(Base):
    __tablename__ = "forms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="My new form")
    # Public identifier used in the shareable link: /to/<slug>
    slug: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    status: Mapped[FormStatus] = mapped_column(Enum(FormStatus), default=FormStatus.draft, index=True)
    # Presentation config stored as JSON documents (schemaless by nature, validated by Pydantic).
    theme: Mapped[dict] = mapped_column(JSON, default=dict)
    welcome_screen: Mapped[dict] = mapped_column(JSON, default=dict)
    thankyou_screen: Mapped[dict] = mapped_column(JSON, default=dict)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    workspace: Mapped[Workspace] = relationship(back_populates="forms")
    questions: Mapped[list[Question]] = relationship(
        back_populates="form", cascade="all, delete-orphan", order_by="Question.position"
    )
    responses: Mapped[list[Response]] = relationship(back_populates="form", cascade="all, delete-orphan")
    views: Mapped[list[FormView]] = relationship(back_populates="form", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (Index("ix_questions_form_position", "form_id", "position"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType))
    title: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    # Type-specific options, e.g. {"allow_multiple": true}, {"steps": 5, "shape": "star"},
    # {"min": 0, "max": 100}, {"placeholder": "..."}
    properties: Mapped[dict] = mapped_column(JSON, default=dict)

    form: Mapped[Form] = relationship(back_populates="questions")
    choices: Mapped[list[Choice]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="Choice.position"
    )
    logic_rules: Mapped[list[LogicRule]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="LogicRule.position",
        foreign_keys="LogicRule.question_id",
    )


class Choice(Base):
    __tablename__ = "choices"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(500))

    question: Mapped[Question] = relationship(back_populates="choices")


class LogicRule(Base):
    """'If <answer to question> <operator> <value> then jump to <target>'.

    Rules are evaluated in `position` order after the source question is answered;
    the first match wins. A NULL `target_question_id` means "jump to the end".
    """

    __tablename__ = "logic_rules"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    operator: Mapped[LogicOperator] = mapped_column(Enum(LogicOperator, values_callable=lambda e: [m.value for m in e]))
    value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_question_id: Mapped[str | None] = mapped_column(
        ForeignKey("questions.id", ondelete="SET NULL"), nullable=True
    )

    question: Mapped[Question] = relationship(back_populates="logic_rules", foreign_keys=[question_id])


class FormView(Base):
    """One row per landing on a published form (used for completion-rate metrics)."""

    __tablename__ = "form_views"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    visitor_id: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    form: Mapped[Form] = relationship(back_populates="views")


class Response(Base):
    """A respondent's submission. Created as `in_progress` on the first answer (partial
    response tracking) and flipped to `completed` on a validated submit."""

    __tablename__ = "responses"
    __table_args__ = (Index("ix_responses_form_status", "form_id", "status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    # Opaque public token handed to the respondent's browser to resume / submit.
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[ResponseStatus] = mapped_column(Enum(ResponseStatus), default=ResponseStatus.in_progress)
    last_question_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    form: Mapped[Form] = relationship(back_populates="responses")
    answers: Mapped[list[Answer]] = relationship(back_populates="response", cascade="all, delete-orphan")


class Answer(Base):
    """One answer per (response, question).

    `value` holds the typed JSON value: str for text/email/dropdown(choice id),
    number for number/rating, bool for yes/no, list[str] of choice ids for
    multiple choice. Choice answers store ids (not labels) so renaming an option
    keeps historical stats intact.
    """

    __tablename__ = "answers"
    __table_args__ = (UniqueConstraint("response_id", "question_id", name="uq_answer_response_question"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    value: Mapped[object] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    response: Mapped[Response] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship()
