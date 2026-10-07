"""Logic jumps (conditional branching).

The same algorithm is mirrored in the frontend (`src/lib/logic.ts`) so the
respondent sees the right next question instantly, while the server uses it to
work out which questions were actually on the respondent's path (only those
are subject to `required` validation).
"""
from __future__ import annotations

from typing import Any

from ..models import LogicOperator, Question, QuestionType

END = None  # sentinel target meaning "go to the thank-you screen"


def _to_float(v: Any) -> float | None:
    try:
        if isinstance(v, bool):
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _is_empty(v: Any) -> bool:
    return v is None or v == "" or v == []


def rule_matches(question: Question, operator: LogicOperator, rule_value: str | None, answer: Any) -> bool:
    op = LogicOperator(operator)
    if op == LogicOperator.always:
        return True
    if _is_empty(answer):
        return False

    qtype = QuestionType(question.type)
    rv = "" if rule_value is None else str(rule_value)

    if qtype == QuestionType.yes_no:
        target = rv.lower() in ("true", "yes", "1")
        if op == LogicOperator.is_:
            return bool(answer) == target
        if op == LogicOperator.is_not:
            return bool(answer) != target
        return False

    if qtype == QuestionType.multiple_choice:
        selected = answer if isinstance(answer, list) else [answer]
        if op in (LogicOperator.is_, LogicOperator.contains):
            return rv in selected
        if op in (LogicOperator.is_not, LogicOperator.not_contains):
            return rv not in selected
        return False

    if qtype == QuestionType.dropdown:
        if op == LogicOperator.is_:
            return answer == rv
        if op == LogicOperator.is_not:
            return answer != rv
        return False

    if qtype in (QuestionType.number, QuestionType.rating):
        a, b = _to_float(answer), _to_float(rv)
        if a is None or b is None:
            return False
        return {
            LogicOperator.eq: a == b,
            LogicOperator.is_: a == b,
            LogicOperator.neq: a != b,
            LogicOperator.is_not: a != b,
            LogicOperator.gt: a > b,
            LogicOperator.gte: a >= b,
            LogicOperator.lt: a < b,
            LogicOperator.lte: a <= b,
        }.get(op, False)

    # text-like: short_text, long_text, email
    a, b = str(answer).strip().lower(), rv.strip().lower()
    return {
        LogicOperator.is_: a == b,
        LogicOperator.eq: a == b,
        LogicOperator.is_not: a != b,
        LogicOperator.neq: a != b,
        LogicOperator.contains: b in a,
        LogicOperator.not_contains: b not in a,
    }.get(op, False)


def next_question_id(questions: list[Question], current: Question, answer: Any) -> str | None:
    """Return the id of the question that follows `current`, or None for the end."""
    for rule in current.logic_rules:
        if rule_matches(current, rule.operator, rule.value, answer):
            return rule.target_question_id  # may be None => end
    idx = next(i for i, q in enumerate(questions) if q.id == current.id)
    return questions[idx + 1].id if idx + 1 < len(questions) else END


def compute_path(questions: list[Question], answers: dict[str, Any]) -> list[Question]:
    """Walk the form from the first question following logic, given the answers."""
    if not questions:
        return []
    by_id = {q.id: q for q in questions}
    path: list[Question] = []
    seen: set[str] = set()
    current: Question | None = questions[0]
    while current is not None and current.id not in seen:
        seen.add(current.id)
        path.append(current)
        nxt = next_question_id(questions, current, answers.get(current.id))
        current = by_id.get(nxt) if nxt else None
    return path
