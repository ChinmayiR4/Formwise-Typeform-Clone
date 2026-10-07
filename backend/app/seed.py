"""Seed demo data: a couple of published forms with mixed question types,
logic jumps and existing (complete + partial) responses.

Run manually with `python -m app.seed` (add `--reset` to wipe first).
Also runs automatically on startup when the database is empty.
"""
from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import (Answer, Form, FormStatus, FormView, Response, ResponseStatus, User, Workspace)
from .schemas import ChoiceIn, FormSettings, LogicRuleIn, QuestionIn, ThemeConfig
from .services.forms import DEFAULT_THANKYOU, DEFAULT_WELCOME, sync_questions, unique_slug
from .services.ids import new_token


def _form(db: Session, ws: Workspace, title: str, status: FormStatus, questions: list[QuestionIn],
          theme: dict | None = None, welcome: dict | None = None, thankyou: dict | None = None,
          created_days_ago: int = 10, slug: str | None = None) -> Form:
    created = datetime.now(timezone.utc) - timedelta(days=created_days_ago)
    f = Form(workspace_id=ws.id, title=title, slug=slug or unique_slug(db), status=status,
             theme={**ThemeConfig().model_dump(), **(theme or {})},
             welcome_screen={**DEFAULT_WELCOME, **(welcome or {})},
             thankyou_screen={**DEFAULT_THANKYOU, **(thankyou or {})},
             settings=FormSettings().model_dump(), created_at=created, updated_at=created,
             published_at=created if status == FormStatus.published else None)
    db.add(f)
    db.flush()
    sync_questions(db, f, questions)
    db.flush()
    return f


def _respond(db: Session, form: Form, answers: dict, days_ago: float, complete: bool = True,
             duration: float | None = None) -> None:
    started = datetime.now(timezone.utc) - timedelta(days=days_ago)
    dur = duration or random.uniform(35, 240)
    r = Response(form_id=form.id, token=new_token(),
                 status=ResponseStatus.completed if complete else ResponseStatus.in_progress,
                 started_at=started, updated_at=started,
                 submitted_at=started + timedelta(seconds=dur) if complete else None,
                 duration_seconds=round(dur, 1) if complete else None,
                 user_agent="Mozilla/5.0 (seed)",
                 last_question_id=list(answers)[-1] if answers else None)
    db.add(r)
    db.flush()
    for qid, v in answers.items():
        db.add(Answer(response_id=r.id, question_id=qid, value=v, created_at=started, updated_at=started))


def seed(db: Session) -> None:
    random.seed(42)
    user = User(name="Alex Creator", email="creator@formwise.app")
    db.add(user)
    db.flush()
    ws = Workspace(owner_id=user.id, name="My workspace")
    ws2 = Workspace(owner_id=user.id, name="Marketing team")
    db.add_all([ws, ws2])
    db.flush()

    # ---------------- Form 1: café feedback (with logic jump) ----------------
    fb = _form(db, ws, "Brew & Bean — Customer Feedback", FormStatus.published, [
        QuestionIn(id="fb_name", type="short_text", title="Hey there 👋 What's your first name?", required=True,
                   properties={"placeholder": "Type your answer here..."}),
        QuestionIn(id="fb_visit", type="multiple_choice", title="How often do you visit Brew & Bean, {{fb_name}}?",
                   required=True, choices=[ChoiceIn(id="fb_v1", label="First time!"), ChoiceIn(id="fb_v2", label="Once a month"),
                                           ChoiceIn(id="fb_v3", label="Every week"), ChoiceIn(id="fb_v4", label="Basically every day")]),
        QuestionIn(id="fb_rate", type="rating", title="How would you rate your experience today?", required=True,
                   description="1 = not great, 5 = absolutely loved it", properties={"steps": 5, "shape": "star"},
                   logic=[LogicRuleIn(operator="lte", value="2", target_question_id="fb_wrong")]),
        QuestionIn(id="fb_love", type="multiple_choice", title="Nice! What did you love the most?",
                   description="Choose as many as you like", properties={"allow_multiple": True},
                   choices=[ChoiceIn(id="fb_l1", label="Coffee quality"), ChoiceIn(id="fb_l2", label="Pastries"),
                            ChoiceIn(id="fb_l3", label="Friendly staff"), ChoiceIn(id="fb_l4", label="Cosy vibe"),
                            ChoiceIn(id="fb_l5", label="Fast service")],
                   logic=[LogicRuleIn(operator="always", target_question_id="fb_recommend")]),
        QuestionIn(id="fb_wrong", type="long_text", title="Sorry to hear that. What went wrong?", required=True,
                   description="Your honest feedback helps us improve."),
        QuestionIn(id="fb_recommend", type="yes_no", title="Would you recommend us to a friend?", required=True),
        QuestionIn(id="fb_drink", type="dropdown", title="What's your go-to order?",
                   choices=[ChoiceIn(id=f"fb_d{i}", label=l) for i, l in enumerate(
                       ["Espresso", "Flat white", "Cappuccino", "Latte", "Cold brew", "Matcha latte", "Chai", "Hot chocolate"])]),
        QuestionIn(id="fb_spend", type="number", title="Roughly how much do you spend per visit (₹)?",
                   properties={"min": 0, "max": 5000}),
        QuestionIn(id="fb_better", type="long_text", title="Anything else we could do better?"),
        QuestionIn(id="fb_email", type="email", title="Want a free cookie next time? Leave your email 🍪",
                   description="We'll never spam you."),
    ], welcome={"enabled": True, "title": "Tell us about your visit ☕", "description": "Your answers shape what we brew next.",
                "button_text": "Start"},
        thankyou={"title": "Thanks a latte! 💙", "description": "Your feedback just made our day."},
        created_days_ago=21, slug="brewbean")

    names = ["Aarav", "Priya", "Rohan", "Sneha", "Vikram", "Ananya", "Kabir", "Isha", "Arjun", "Meera", "Dev",
             "Tara", "Nikhil", "Zoya", "Rahul", "Kavya", "Siddharth", "Diya", "Aditya", "Neha", "Yash", "Riya"]
    good = ["Loved the new cold brew, keep it!", "More seating near the window please", "Maybe a loyalty card?",
            "Music was a bit loud but otherwise great", "Oat milk option for every drink would be amazing",
            "Everything was perfect, friendly staff", "Open a bit earlier on weekdays", ""]
    bad = ["The wait was way too long and my order was cold.", "Staff seemed rushed and a bit rude today.",
           "Coffee tasted burnt, and the table was dirty.", "Too expensive for the portion size."]
    for i, n in enumerate(names):
        rating = random.choices([1, 2, 3, 4, 5], weights=[1, 2, 3, 6, 8])[0]
        a: dict = {"fb_name": n, "fb_visit": [random.choice(["fb_v1", "fb_v2", "fb_v3", "fb_v4"])], "fb_rate": rating}
        if rating <= 2:
            a["fb_wrong"] = random.choice(bad)
        else:
            a["fb_love"] = random.sample(["fb_l1", "fb_l2", "fb_l3", "fb_l4", "fb_l5"], k=random.randint(1, 3))
        a["fb_recommend"] = rating >= 3
        a["fb_drink"] = f"fb_d{random.randint(0, 7)}"
        a["fb_spend"] = random.choice([150, 220, 280, 350, 420, 500, 650])
        txt = random.choice(good)
        if txt:
            a["fb_better"] = txt
        if random.random() < 0.6:
            a["fb_email"] = f"{n.lower()}{random.randint(1, 99)}@example.com"
        _respond(db, fb, a, days_ago=random.uniform(0.2, 20))
    for n in ["Ira", "Om", "Pari", "Veer", "Lina"]:  # partial responses (drop-offs)
        _respond(db, fb, {"fb_name": n, "fb_visit": ["fb_v2"]}, days_ago=random.uniform(0.5, 10), complete=False)
    for i in range(48):
        db.add(FormView(form_id=fb.id, visitor_id=f"seed-v{i}",
                        created_at=datetime.now(timezone.utc) - timedelta(days=random.uniform(0, 20))))

    # ---------------- Form 2: event registration ----------------
    ev = _form(db, ws, "Design Meetup 2026 — RSVP", FormStatus.published, [
        QuestionIn(id="ev_name", type="short_text", title="What's your full name?", required=True),
        QuestionIn(id="ev_email", type="email", title="And your email, {{ev_name}}?", required=True,
                   description="Your ticket will be sent here."),
        QuestionIn(id="ev_attend", type="yes_no", title="Will you be joining us in person on Nov 14?", required=True,
                   logic=[LogicRuleIn(operator="is", value="false", target_question_id="ev_notes")]),
        QuestionIn(id="ev_role", type="dropdown", title="What best describes your role?", required=True,
                   choices=[ChoiceIn(id=f"ev_r{i}", label=l) for i, l in enumerate(
                       ["Product designer", "UX researcher", "Developer", "Product manager", "Student", "Other"])]),
        QuestionIn(id="ev_guests", type="number", title="How many guests are you bringing?",
                   description="Max 3 per attendee", properties={"min": 0, "max": 3}),
        QuestionIn(id="ev_topics", type="multiple_choice", title="Which talks are you most excited about?",
                   properties={"allow_multiple": True},
                   choices=[ChoiceIn(id="ev_t1", label="Design systems at scale"), ChoiceIn(id="ev_t2", label="AI in UX"),
                            ChoiceIn(id="ev_t3", label="Accessibility deep-dive"), ChoiceIn(id="ev_t4", label="Portfolio reviews")]),
        QuestionIn(id="ev_excite", type="rating", title="How excited are you, on a scale of 1–10?",
                   properties={"steps": 10, "shape": "star"}),
        QuestionIn(id="ev_notes", type="long_text", title="Anything you'd like the organisers to know?"),
    ], theme={"preset": "ink", "background": "#111318", "question_color": "#F5F6F8",
              "answer_color": "#8EA6FF", "button_color": "#8EA6FF", "button_text_color": "#111318"},
        thankyou={"title": "You're on the list! 🎉", "description": "See you at the meetup. Check your inbox for details."},
        created_days_ago=9, slug="meetup26")
    roles = [f"ev_r{i}" for i in range(6)]
    for i, n in enumerate(["Maya Shah", "Leo Fernandes", "Asha Rao", "Kunal Mehta", "Sara Iyer", "Omar Khan",
                           "Nina Paul", "Jay Patel", "Ritu Das", "Ben Thomas", "Lea Joseph", "Ved Nair"]):
        attend = random.random() > 0.2
        a = {"ev_name": n, "ev_email": n.split()[0].lower() + "@studio.dev", "ev_attend": attend}
        if attend:
            a.update({"ev_role": random.choice(roles), "ev_guests": random.randint(0, 2),
                      "ev_topics": random.sample(["ev_t1", "ev_t2", "ev_t3", "ev_t4"], k=random.randint(1, 3)),
                      "ev_excite": random.randint(6, 10)})
        if random.random() < 0.4:
            a["ev_notes"] = random.choice(["Vegetarian food please!", "Can't wait!", "Will there be a recording?",
                                           "Happy to volunteer", "Need wheelchair access"])
        _respond(db, ev, a, days_ago=random.uniform(0.1, 8))
    _respond(db, ev, {"ev_name": "Partial Pete"}, days_ago=1, complete=False)
    for i in range(25):
        db.add(FormView(form_id=ev.id, visitor_id=f"seed-e{i}",
                        created_at=datetime.now(timezone.utc) - timedelta(days=random.uniform(0, 8))))

    # ---------------- Form 3: draft ----------------
    _form(db, ws, "Frontend Engineer Application", FormStatus.draft, [
        QuestionIn(id="job_name", type="short_text", title="Let's start with your name", required=True),
        QuestionIn(id="job_email", type="email", title="What's the best email to reach you?", required=True),
        QuestionIn(id="job_exp", type="number", title="Years of professional experience?", properties={"min": 0, "max": 40}),
        QuestionIn(id="job_stack", type="multiple_choice", title="Which of these have you shipped to production?",
                   properties={"allow_multiple": True},
                   choices=[ChoiceIn(label="React"), ChoiceIn(label="Next.js"), ChoiceIn(label="TypeScript"),
                            ChoiceIn(label="Python"), ChoiceIn(label="SQL")]),
        QuestionIn(id="job_why", type="long_text", title="Why do you want to join us?"),
    ], created_days_ago=2, slug="fejob001")

    _form(db, ws2, "Newsletter sign-up", FormStatus.draft, [
        QuestionIn(id="nl_email", type="email", title="Where should we send the good stuff?", required=True),
        QuestionIn(id="nl_freq", type="multiple_choice", title="How often would you like to hear from us?",
                   choices=[ChoiceIn(label="Weekly"), ChoiceIn(label="Monthly"), ChoiceIn(label="Only big news")]),
    ], created_days_ago=4, slug="newsltr1")
    db.commit()


def init_db(seed_if_empty: bool = True) -> None:
    Base.metadata.create_all(bind=engine)
    if not seed_if_empty:
        return
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)) is None:
            seed(db)


if __name__ == "__main__":
    if "--reset" in sys.argv:
        Base.metadata.drop_all(bind=engine)
    init_db(seed_if_empty=True)
    print("Database ready.")
