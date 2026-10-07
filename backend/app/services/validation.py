"""Server-side answer validation and normalisation.

Mirrors the client rules in `frontend/src/lib/validation.ts`; the server is the
source of truth.
"""
from __future__ import annotations

import re
from typing import Any

from ..models import Question, QuestionType
from .logic import compute_path

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
SHORT_TEXT_MAX = 1000
LONG_TEXT_MAX = 10000


class AnswerError(ValueError):
    pass


def is_empty(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "") or value == []


def normalize_answer(q: Question, value: Any) -> Any:
    """Validate a single non-empty answer, returning its canonical stored form."""
    t = QuestionType(q.type)
    props = q.properties or {}

    if t in (QuestionType.short_text, QuestionType.long_text):
        if not isinstance(value, str):
            raise AnswerError("Please enter text")
        value = value.strip()
        limit = props.get("max_length") or (SHORT_TEXT_MAX if t == QuestionType.short_text else LONG_TEXT_MAX)
        if len(value) > int(limit):
            raise AnswerError(f"Please keep it under {limit} characters")
        return value

    if t == QuestionType.email:
        if not isinstance(value, str) or not EMAIL_RE.match(value.strip()):
            raise AnswerError("Hmm... that email doesn't look valid")
        return value.strip().lower()

    if t == QuestionType.number:
        if isinstance(value, bool):
            raise AnswerError("Numbers only please")
        try:
            num = float(value)
        except (TypeError, ValueError):
            raise AnswerError("Numbers only please") from None
        if num != num or num in (float("inf"), float("-inf")):
            raise AnswerError("Numbers only please")
        if props.get("min") is not None and num < float(props["min"]):
            raise AnswerError(f"Number must be at least {props['min']}")
        if props.get("max") is not None and num > float(props["max"]):
            raise AnswerError(f"Number must be at most {props['max']}")
        return int(num) if num.is_integer() else num

    if t == QuestionType.yes_no:
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.lower() in ("yes", "true", "no", "false"):
            return value.lower() in ("yes", "true")
        raise AnswerError("Please choose Yes or No")

    if t == QuestionType.rating:
        steps = int(props.get("steps") or 5)
        if isinstance(value, bool):
            raise AnswerError("Please pick a rating")
        try:
            n = int(value)
        except (TypeError, ValueError):
            raise AnswerError("Please pick a rating") from None
        if n != float(value) or not 1 <= n <= steps:
            raise AnswerError(f"Rating must be between 1 and {steps}")
        return n

    valid_ids = {c.id for c in q.choices}
    if t == QuestionType.dropdown:
        if not isinstance(value, str) or value not in valid_ids:
            raise AnswerError("Please select an option from the list")
        return value

    if t == QuestionType.multiple_choice:
        selected = value if isinstance(value, list) else [value]
        if not all(isinstance(s, str) and s in valid_ids for s in selected):
            raise AnswerError("Please select a valid option")
        # de-duplicate while preserving order
        selected = list(dict.fromkeys(selected))
        if not props.get("allow_multiple") and len(selected) > 1:
            raise AnswerError("Please select only one option")
        return selected

    raise AnswerError("Unsupported question type")  # pragma: no cover


def validate_partial(questions: list[Question], answers: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
    """Validate the provided answers only (no required check). Used for autosave."""
    by_id = {q.id: q for q in questions}
    clean: dict[str, Any] = {}
    errors: dict[str, str] = {}
    for qid, value in answers.items():
        q = by_id.get(qid)
        if q is None:
            errors[qid] = "Unknown question"
            continue
        if is_empty(value):
            clean[qid] = None
            continue
        try:
            clean[qid] = normalize_answer(q, value)
        except AnswerError as e:
            errors[qid] = str(e)
    return clean, errors


def validate_submission(questions: list[Question], answers: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
    """Full validation for a final submit.

    Only questions on the logic path are considered: answers to skipped questions
    are dropped, and `required` is enforced on visited questions only.
    """
    clean, errors = validate_partial(questions, answers)
    path = compute_path(questions, {k: v for k, v in clean.items() if k not in errors})
    on_path = {q.id for q in path}
    for q in path:
        if q.required and q.id not in errors and is_empty(clean.get(q.id)):
            errors[q.id] = "Please fill this in"
    clean = {k: v for k, v in clean.items() if k in on_path and not is_empty(v)}
    errors = {k: v for k, v in errors.items() if k in on_path or k not in {q.id for q in questions}}
    return clean, errors
