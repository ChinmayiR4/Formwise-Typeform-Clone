"""AI features backed by the Hugging Face Inference router (OpenAI-compatible).

Mirrors Typeform's AI features:
  * Create a form from a prompt
  * Rewrite / improve a question's wording
  * Suggest the next questions for a form
  * Summarise open-text answers into themes + sentiment (Results > Insights)

Every function degrades gracefully: when HF_TOKEN is not set, or the model
call fails / returns junk, a deterministic heuristic fallback is used so the
feature still works in the demo. Responses include `source: "hf" | "fallback"`.
"""
from __future__ import annotations

import json
import logging
import re
from collections import Counter
from typing import Any

import httpx

from ..config import get_settings
from ..models import QuestionType
from .ids import new_id

log = logging.getLogger("formwise.ai")

VALID_TYPES = {t.value for t in QuestionType}


# ---------------------------------------------------------------- HF client

def _chat(system: str, user: str, max_tokens: int = 900, temperature: float = 0.4) -> str | None:
    s = get_settings()
    if not s.hf_token:
        return None
    try:
        r = httpx.post(
            f"{s.hf_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {s.hf_token}"},
            json={
                "model": s.hf_model,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=s.hf_timeout,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except Exception as e:  # network, auth, quota, schema...
        log.warning("HF inference failed: %s", e)
        return None


def _extract_json(text: str | None) -> Any:
    if not text:
        return None
    text = re.sub(r"```(?:json)?", "", text)
    for opener, closer in (("{", "}"), ("[", "]")):
        start, end = text.find(opener), text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                continue
    return None


def ai_status() -> dict[str, Any]:
    s = get_settings()
    return {"enabled": bool(s.hf_token), "model": s.hf_model if s.hf_token else None}


# ---------------------------------------------------------------- helpers

def _q(type_: str, title: str, required: bool = False, description: str | None = None,
       choices: list[str] | None = None, properties: dict | None = None) -> dict[str, Any]:
    return {
        "id": new_id(),
        "type": type_,
        "title": title,
        "description": description,
        "required": required,
        "properties": properties or ({"steps": 5, "shape": "star"} if type_ == "rating" else {}),
        "choices": [{"id": new_id(), "label": c} for c in (choices or [])],
        "logic": [],
    }


def _sanitize_questions(raw: Any) -> list[dict[str, Any]]:
    out = []
    if not isinstance(raw, list):
        return out
    for item in raw[:15]:
        if not isinstance(item, dict):
            continue
        t = str(item.get("type", "short_text")).strip().lower().replace(" ", "_").replace("-", "_")
        t = {"text": "short_text", "paragraph": "long_text", "choice": "multiple_choice",
             "select": "dropdown", "boolean": "yes_no", "yesno": "yes_no", "scale": "rating",
             "opinion_scale": "rating", "nps": "rating"}.get(t, t)
        if t not in VALID_TYPES:
            t = "short_text"
        title = str(item.get("title") or item.get("question") or "").strip()[:300]
        if not title:
            continue
        choices = [str(c)[:120] for c in (item.get("choices") or item.get("options") or []) if str(c).strip()]
        if t in ("multiple_choice", "dropdown") and len(choices) < 2:
            t = "short_text"
            choices = []
        props: dict[str, Any] = {}
        if t == "rating":
            props = {"steps": 10 if "nps" in str(item.get("type", "")).lower() else int(item.get("steps") or 5),
                     "shape": "star"}
            props["steps"] = max(3, min(10, props["steps"]))
        if t == "multiple_choice" and item.get("allow_multiple"):
            props["allow_multiple"] = True
        out.append(_q(t, title, bool(item.get("required", False)),
                      (str(item["description"])[:300] if item.get("description") else None),
                      choices[:10], props))
    return out


# ---------------------------------------------------------------- generate form

_TEMPLATES: list[tuple[tuple[str, ...], str, list[dict[str, Any]]]] = []


def _templates():
    if _TEMPLATES:
        return _TEMPLATES
    _TEMPLATES.extend([
        (("feedback", "review", "satisfaction", "customer", "restaurant", "cafe", "product", "service"),
         "Customer feedback", [
             _q("short_text", "First things first, what's your name?", True),
             _q("rating", "Overall, how would you rate your experience with {topic}?", True),
             _q("multiple_choice", "What did you enjoy most?", False, None,
                ["Quality", "Price", "Speed", "Friendly staff", "Something else"], {"allow_multiple": True}),
             _q("long_text", "What's one thing we could do better?", False,
                "Be as honest as you like — we read every answer."),
             _q("yes_no", "Would you recommend {topic} to a friend?", True),
             _q("email", "Can we follow up with you? Drop your email (optional)."),
         ]),
        (("event", "registration", "rsvp", "workshop", "conference", "webinar", "meetup", "party", "wedding"),
         "Event registration", [
             _q("short_text", "What's your full name?", True),
             _q("email", "And your email address?", True, "We'll send your ticket here."),
             _q("yes_no", "Will you be attending {topic}?", True),
             _q("number", "How many guests are you bringing?", False, None, None, {"min": 0, "max": 10}),
             _q("dropdown", "Any dietary requirements?", False, None,
                ["None", "Vegetarian", "Vegan", "Gluten-free", "Halal", "Other"]),
             _q("long_text", "Anything else we should know?"),
         ]),
        (("job", "application", "hiring", "candidate", "recruit", "career", "intern"),
         "Job application", [
             _q("short_text", "Let's start with your name.", True),
             _q("email", "What's the best email to reach you?", True),
             _q("dropdown", "Which role are you applying for?", True, None,
                ["Software Engineer", "Product Designer", "Product Manager", "Data Analyst", "Other"]),
             _q("number", "How many years of relevant experience do you have?", True, None, None, {"min": 0, "max": 50}),
             _q("short_text", "Link to your portfolio, GitHub or LinkedIn"),
             _q("long_text", "Why do you want to join us?", True, "A few sentences is perfect."),
             _q("yes_no", "Are you able to start within the next month?"),
         ]),
        (("contact", "lead", "sales", "inquiry", "enquiry", "quote", "demo"),
         "Contact us", [
             _q("short_text", "Hi there 👋 What's your name?", True),
             _q("email", "What's your work email?", True),
             _q("short_text", "Which company are you with?"),
             _q("multiple_choice", "What can we help you with?", True, None,
                ["Pricing", "A product demo", "Partnerships", "Support", "Something else"]),
             _q("long_text", "Tell us a bit more", False),
         ]),
        (("quiz", "trivia", "test", "knowledge"),
         "Quick quiz", [
             _q("short_text", "What's your name, quiz master?", True),
             _q("multiple_choice", "Question 1: pick the right answer about {topic}", True, None,
                ["Option A", "Option B", "Option C", "Option D"]),
             _q("multiple_choice", "Question 2: which of these is true?", True, None,
                ["Statement A", "Statement B", "Statement C"]),
             _q("yes_no", "True or false: {topic} is fun?", True),
             _q("rating", "How hard was this quiz?", False),
         ]),
        (("employee", "team", "engagement", "hr", "workplace", "staff", "onboarding"),
         "Employee engagement survey", [
             _q("dropdown", "Which team are you on?", True, None, ["Engineering", "Design", "Sales", "Marketing", "Operations", "Other"]),
             _q("rating", "How happy are you at work these days?", True, None, None, {"steps": 10, "shape": "star"}),
             _q("yes_no", "Do you feel your work is recognised?", True),
             _q("multiple_choice", "What would improve your week the most?", False, None,
                ["Fewer meetings", "Clearer goals", "Better tools", "More feedback", "Flexible hours"], {"allow_multiple": True}),
             _q("long_text", "Anything on your mind you'd like leadership to hear?", False, "This survey is anonymous."),
         ]),
    ])
    return _TEMPLATES


def _topic_from_prompt(prompt: str) -> str:
    m = re.search(r"\b(?:for|about|on)\s+(?:an?\s+|the\s+|my\s+|our\s+)?(.+?)(?:[.,!?]|$)", prompt, re.I)
    topic = (m.group(1) if m else prompt).strip()
    return topic[:60] or "us"


def _fallback_form(prompt: str) -> dict[str, Any]:
    p = prompt.lower()
    topic = _topic_from_prompt(prompt)
    best, best_score = None, 0
    for keywords, title, questions in _templates():
        score = sum(1 for k in keywords if k in p)
        if score > best_score:
            best, best_score = (title, questions), score
    if best is None:
        title = f"{topic[:1].upper()}{topic[1:]} survey"
        questions = [
            _q("short_text", "Hey! What's your name?", True),
            _q("email", "What's your email address?", False),
            _q("rating", f"How would you rate {topic}?", True),
            _q("multiple_choice", f"How often do you think about {topic}?", False, None,
               ["Every day", "Every week", "Every month", "Rarely"]),
            _q("long_text", f"What's one thing you'd change about {topic}?"),
            _q("yes_no", "Can we contact you about your answers?"),
        ]
    else:
        title, questions = best
        title = f"{title} — {topic}" if topic and topic.lower() not in title.lower() else title
    # Fresh ids + topic substitution on every call
    fresh = []
    for q in questions:
        nq = json.loads(json.dumps(q))
        nq["id"] = new_id()
        nq["title"] = nq["title"].replace("{topic}", topic)
        for c in nq["choices"]:
            c["id"] = new_id()
        fresh.append(nq)
    return {"title": title[:120], "questions": fresh}


GEN_SYSTEM = (
    "You design concise, conversational online forms in the style of Typeform. "
    "Reply with ONLY a JSON object: {\"title\": str, \"questions\": [ {\"type\": one of "
    "short_text|long_text|multiple_choice|dropdown|email|number|yes_no|rating, \"title\": str, "
    "\"description\": str|null, \"required\": bool, \"choices\": [str] (only for multiple_choice/dropdown), "
    "\"allow_multiple\": bool (multiple_choice only), \"steps\": int (rating only, 5 or 10)} ] }. "
    "Use 5-8 questions, friendly second-person wording, one idea per question."
)


def generate_form(prompt: str) -> dict[str, Any]:
    data = _extract_json(_chat(GEN_SYSTEM, f"Create a form for: {prompt}"))
    if isinstance(data, dict):
        questions = _sanitize_questions(data.get("questions"))
        if len(questions) >= 2:
            return {"title": str(data.get("title") or _topic_from_prompt(prompt))[:120],
                    "questions": questions, "source": "hf"}
    return {**_fallback_form(prompt), "source": "fallback"}


# ---------------------------------------------------------------- rewrite

_QWORDS = ("what", "how", "which", "who", "when", "where", "why", "do", "does", "did", "are", "is",
           "can", "could", "would", "will", "have", "has", "should")


def _fallback_rewrite(title: str, qtype: str) -> list[str]:
    t = title.strip().rstrip("?.!:")
    if not t:
        return ["Tell us a little more"]
    lower = t[:1].lower() + t[1:]
    upper = t[:1].upper() + t[1:]
    if lower.split()[0] in _QWORDS:
        variants = [f"{upper}?", f"Quick one: {lower}?", f"We'd love to know, {lower}?"]
    else:  # a noun phrase like "your name" or "email"
        variants = [f"What's {lower}?", f"Could you share {lower}?", f"Tell us {lower}"]
    if qtype == "email":
        variants[1] = "What's the best email to reach you?"
    elif qtype == "rating":
        variants[2] = f"On a scale of 1 to 5, {lower if lower.split()[0] in _QWORDS else 'how would you rate ' + lower}?"
    elif qtype == "yes_no" and lower.split()[0] not in _QWORDS:
        variants[0] = f"Is {lower} something you'd want?"
    return list(dict.fromkeys(variants))


def rewrite_question(title: str, qtype: str, tone: str = "friendly") -> dict[str, Any]:
    data = _extract_json(_chat(
        "You rewrite form questions to be clear, short and conversational. "
        "Reply with ONLY a JSON array of 3 alternative question strings.",
        f"Question type: {qtype}. Tone: {tone}. Original: {title}",
        max_tokens=250, temperature=0.7,
    ))
    if isinstance(data, list):
        opts = [str(x).strip()[:300] for x in data if str(x).strip()][:3]
        if opts:
            return {"suggestions": opts, "source": "hf"}
    return {"suggestions": _fallback_rewrite(title, qtype), "source": "fallback"}


# ---------------------------------------------------------------- suggest next questions

def suggest_questions(form_title: str, existing: list[str]) -> dict[str, Any]:
    data = _extract_json(_chat(
        GEN_SYSTEM.replace("5-8 questions", "exactly 3 NEW questions that are not already in the form"),
        f"Form title: {form_title}\nExisting questions:\n" + "\n".join(f"- {e}" for e in existing),
        max_tokens=600,
    ))
    if isinstance(data, dict):
        qs = _sanitize_questions(data.get("questions"))
        if qs:
            return {"questions": qs[:3], "source": "hf"}
    have = {e.lower() for e in existing}
    pool = _fallback_form(form_title or "this form")["questions"]
    qs = [q for q in pool if q["title"].lower() not in have][:3]
    return {"questions": qs, "source": "fallback"}


# ---------------------------------------------------------------- insights

_POS = {"love", "great", "amazing", "excellent", "good", "fast", "friendly", "easy", "helpful", "awesome",
        "nice", "perfect", "happy", "best", "enjoy", "enjoyed", "clean", "delicious", "smooth", "recommend"}
_NEG = {"bad", "slow", "poor", "terrible", "hate", "expensive", "rude", "confusing", "hard", "bug", "bugs",
        "broken", "worst", "dirty", "cold", "late", "difficult", "annoying", "crash", "missing", "noisy", "wait"}
_STOP = set("""a an the and or but if then so to of in on for with at by from is are was were be been it this that
these those i me my we our you your they them their he she his her its as not no do does did have has had just
very really more most much can could would should will there here what which who when where how all any some
too also than into about up out over only own same s t don im it's i'm i've get got like one bit every option maybe please thing things""".split())


def _fallback_insight(answers: list[str]) -> dict[str, Any]:
    words = [w for a in answers for w in re.findall(r"[a-z']+", a.lower())]
    pos = sum(w in _POS for w in words)
    neg = sum(w in _NEG for w in words)
    sentiment = "positive" if pos > neg * 1.3 else "negative" if neg > pos * 1.3 else "mixed"
    common = [w for w, _ in Counter(w for w in words if w not in _STOP and len(w) > 2).most_common(5)]
    return {
        "summary": (f"{len(answers)} answers. Overall tone looks {sentiment}"
                    + (f"; people mention {', '.join(common[:3])} most often." if common else ".")),
        "themes": common,
        "sentiment": sentiment,
    }


def summarize_answers(question_title: str, answers: list[str]) -> dict[str, Any]:
    if not answers:
        return {"summary": "No answers yet.", "themes": [], "sentiment": "neutral", "source": "fallback"}
    sample = "\n".join(f"- {a[:300]}" for a in answers[:80])
    data = _extract_json(_chat(
        "You analyse survey answers. Reply with ONLY JSON: {\"summary\": str (2 sentences), "
        "\"themes\": [up to 5 short theme labels], \"sentiment\": positive|negative|mixed|neutral}.",
        f"Question: {question_title}\nAnswers:\n{sample}",
        max_tokens=350, temperature=0.2,
    ))
    if isinstance(data, dict) and data.get("summary"):
        return {
            "summary": str(data["summary"])[:800],
            "themes": [str(t)[:60] for t in (data.get("themes") or [])][:5],
            "sentiment": str(data.get("sentiment", "mixed")).lower(),
            "source": "hf",
        }
    return {**_fallback_insight(answers), "source": "fallback"}
