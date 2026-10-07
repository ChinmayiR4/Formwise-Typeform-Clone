"""Results: response serialisation, per-question summary stats and CSV export."""
from __future__ import annotations

import csv
import io
from collections import Counter
from statistics import mean, median
from typing import Any

from sqlalchemy import String, cast, func, select
from sqlalchemy.orm import Session, selectinload

from ..models import Answer, Form, FormView, Question, QuestionType, Response, ResponseStatus
from ..schemas import AnswerOut, ResponseOut


def display_value(q: Question, value: Any) -> str:
    if value is None:
        return ""
    t = QuestionType(q.type)
    labels = {c.id: c.label for c in q.choices}
    if t == QuestionType.multiple_choice:
        vals = value if isinstance(value, list) else [value]
        return ", ".join(labels.get(v, "(deleted option)") for v in vals)
    if t == QuestionType.dropdown:
        return labels.get(value, "(deleted option)")
    if t == QuestionType.yes_no:
        return "Yes" if value else "No"
    if t == QuestionType.rating:
        return f"{value}/{(q.properties or {}).get('steps', 5)}"
    return str(value)


def serialize_response(resp: Response, questions: list[Question]) -> ResponseOut:
    by_q = {a.question_id: a for a in resp.answers}
    answers = [
        AnswerOut(question_id=q.id, value=by_q[q.id].value, display=display_value(q, by_q[q.id].value))
        for q in questions
        if q.id in by_q
    ]
    return ResponseOut(
        id=resp.id,
        status=resp.status,
        started_at=resp.started_at,
        submitted_at=resp.submitted_at,
        duration_seconds=resp.duration_seconds,
        user_agent=resp.user_agent,
        answers=answers,
    )


def list_responses(db: Session, form: Form, status: ResponseStatus | None, q: str | None,
                   limit: int, offset: int) -> tuple[int, list[ResponseOut]]:
    stmt = select(Response).where(Response.form_id == form.id)
    if status:
        stmt = stmt.where(Response.status == status)
    if q:
        sub = select(Answer.response_id).where(func.lower(cast(Answer.value, String)).like(f"%{q.lower()}%"))
        stmt = stmt.where(Response.id.in_(sub))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.options(selectinload(Response.answers))
        .order_by(Response.submitted_at.desc().nulls_last(), Response.started_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return total, [serialize_response(r, form.questions) for r in rows]


def form_metrics(db: Session, form: Form) -> dict[str, Any]:
    views = db.scalar(select(func.count(FormView.id)).where(FormView.form_id == form.id)) or 0
    unique_views = db.scalar(
        select(func.count(func.distinct(FormView.visitor_id))).where(FormView.form_id == form.id)
    ) or 0
    starts = db.scalar(select(func.count(Response.id)).where(Response.form_id == form.id)) or 0
    completed = db.scalar(
        select(func.count(Response.id)).where(Response.form_id == form.id, Response.status == ResponseStatus.completed)
    ) or 0
    durations = db.scalars(
        select(Response.duration_seconds).where(
            Response.form_id == form.id, Response.status == ResponseStatus.completed,
            Response.duration_seconds.is_not(None))
    ).all()
    return {
        "views": views,
        "unique_views": unique_views,
        "starts": starts,
        "submissions": completed,
        "completion_rate": round(completed / starts * 100, 1) if starts else 0.0,
        "start_rate": round(starts / unique_views * 100, 1) if unique_views else 0.0,
        "avg_duration_seconds": round(mean(durations), 1) if durations else None,
    }


def drop_off(db: Session, form: Form) -> list[dict[str, Any]]:
    """How many respondents (started or finished) answered each question."""
    rows = db.execute(
        select(Answer.question_id, func.count(Answer.id))
        .join(Response, Response.id == Answer.response_id)
        .where(Response.form_id == form.id)
        .group_by(Answer.question_id)
    ).all()
    counts = dict(rows)
    return [{"question_id": q.id, "answered": counts.get(q.id, 0)} for q in form.questions]


def question_summary(db: Session, form: Form) -> list[dict[str, Any]]:
    """Per-question stats computed from completed responses."""
    answers = db.execute(
        select(Answer.question_id, Answer.value)
        .join(Response, Response.id == Answer.response_id)
        .where(Response.form_id == form.id, Response.status == ResponseStatus.completed)
    ).all()
    total = db.scalar(
        select(func.count(Response.id)).where(Response.form_id == form.id, Response.status == ResponseStatus.completed)
    ) or 0
    by_q: dict[str, list[Any]] = {}
    for qid, value in answers:
        by_q.setdefault(qid, []).append(value)

    out = []
    for q in form.questions:
        vals = by_q.get(q.id, [])
        t = QuestionType(q.type)
        item: dict[str, Any] = {
            "question_id": q.id, "type": t, "title": q.title,
            "answered": len(vals), "skipped": max(total - len(vals), 0),
        }
        if t in (QuestionType.multiple_choice, QuestionType.dropdown):
            c: Counter[str] = Counter()
            for v in vals:
                for x in (v if isinstance(v, list) else [v]):
                    c[x] += 1
            item["choices"] = [
                {"id": ch.id, "label": ch.label, "count": c.get(ch.id, 0),
                 "percent": round(c.get(ch.id, 0) / len(vals) * 100, 1) if vals else 0.0}
                for ch in q.choices
            ]
        elif t == QuestionType.yes_no:
            yes = sum(1 for v in vals if v is True)
            no = len(vals) - yes
            item["choices"] = [
                {"id": "yes", "label": "Yes", "count": yes, "percent": round(yes / len(vals) * 100, 1) if vals else 0.0},
                {"id": "no", "label": "No", "count": no, "percent": round(no / len(vals) * 100, 1) if vals else 0.0},
            ]
        elif t in (QuestionType.rating, QuestionType.number):
            nums = [float(v) for v in vals if isinstance(v, (int, float)) and not isinstance(v, bool)]
            item["average"] = round(mean(nums), 2) if nums else None
            item["median"] = median(nums) if nums else None
            item["min"] = min(nums) if nums else None
            item["max"] = max(nums) if nums else None
            if t == QuestionType.rating:
                steps = int((q.properties or {}).get("steps", 5))
                c2 = Counter(int(n) for n in nums)
                item["distribution"] = [
                    {"value": i, "count": c2.get(i, 0),
                     "percent": round(c2.get(i, 0) / len(nums) * 100, 1) if nums else 0.0}
                    for i in range(1, steps + 1)
                ]
        else:
            item["latest"] = [str(v) for v in vals[-5:]][::-1]
        out.append(item)
    return out


def export_csv(db: Session, form: Form) -> str:
    responses = db.scalars(
        select(Response)
        .where(Response.form_id == form.id, Response.status == ResponseStatus.completed)
        .options(selectinload(Response.answers))
        .order_by(Response.submitted_at)
    ).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Response ID", "Submitted at", "Duration (s)"] + [q.title or f"Question {i+1}" for i, q in enumerate(form.questions)])
    for r in responses:
        by_q = {a.question_id: a.value for a in r.answers}
        w.writerow(
            [r.id, r.submitted_at.isoformat() if r.submitted_at else "", r.duration_seconds or ""]
            + [display_value(q, by_q.get(q.id)) for q in form.questions]
        )
    return buf.getvalue()


def text_answers(db: Session, form: Form, question_id: str | None = None, limit: int = 200) -> dict[str, list[str]]:
    """Collect open-text answers per question (for AI insights)."""
    text_qs = {q.id: q for q in form.questions
               if q.type == QuestionType.long_text
               and (question_id is None or q.id == question_id)}
    if not text_qs:
        return {}
    rows = db.execute(
        select(Answer.question_id, Answer.value)
        .join(Response, Response.id == Answer.response_id)
        .where(Response.form_id == form.id, Answer.question_id.in_(text_qs.keys()))
        .order_by(Answer.created_at.desc())
    ).all()
    out: dict[str, list[str]] = {}
    for qid, v in rows:
        if isinstance(v, str) and v.strip() and len(out.setdefault(qid, [])) < limit:
            out[qid].append(v.strip())
    return out
