import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ.pop("HF_TOKEN", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def make_form(client, questions):
    r = client.post("/api/forms", json={"title": "Test form", "questions": questions})
    assert r.status_code == 201, r.text
    return r.json()


QUESTIONS = [
    {"id": "q_name", "type": "short_text", "title": "Name?", "required": True},
    {"id": "q_mail", "type": "email", "title": "Email?", "required": True},
    {"id": "q_like", "type": "yes_no", "title": "Like it?", "required": True,
     "logic": [{"operator": "is", "value": "false", "target_question_id": "q_why"}]},
    {"id": "q_pick", "type": "multiple_choice", "title": "Pick", "required": True,
     "choices": [{"id": "c_a", "label": "A"}, {"id": "c_b", "label": "B"}]},
    {"id": "q_rate", "type": "rating", "title": "Rate", "required": True, "properties": {"steps": 5}},
    {"id": "q_why", "type": "long_text", "title": "Why?", "required": False},
]


def test_seeded_forms_exist(client):
    forms = client.get("/api/forms").json()
    assert any(f["status"] == "published" and f["response_count"] > 0 for f in forms)


def test_crud_and_publish(client):
    f = make_form(client, [])
    # cannot publish an empty form
    assert client.post(f"/api/forms/{f['id']}/publish").status_code == 422
    r = client.put(f"/api/forms/{f['id']}/questions", json={"questions": QUESTIONS})
    assert r.status_code == 200
    assert [q["id"] for q in r.json()["questions"]] == [q["id"] for q in QUESTIONS]
    assert r.json()["questions"][2]["logic"][0]["target_question_id"] == "q_why"
    assert client.patch(f"/api/forms/{f['id']}", json={"title": "Renamed"}).json()["title"] == "Renamed"
    pub = client.post(f"/api/forms/{f['id']}/publish").json()
    assert pub["status"] == "published"
    dup = client.post(f"/api/forms/{f['id']}/duplicate").json()
    assert dup["status"] == "draft" and len(dup["questions"]) == len(QUESTIONS)
    assert dup["questions"][0]["id"] != "q_name"
    assert dup["questions"][2]["logic"][0]["target_question_id"] == dup["questions"][5]["id"]
    assert client.delete(f"/api/forms/{dup['id']}").status_code == 204
    assert client.get(f"/api/forms/{dup['id']}").status_code == 404


def test_backward_logic_rejected(client):
    f = make_form(client, [])
    qs = [
        {"id": "b1", "type": "short_text", "title": "1"},
        {"id": "b2", "type": "short_text", "title": "2", "logic": [{"operator": "always", "target_question_id": "b1"}]},
    ]
    assert client.put(f"/api/forms/{f['id']}/questions", json={"questions": qs}).status_code == 422


def test_respondent_flow_validation_and_logic(client):
    f = make_form(client, [])
    qs = [dict(q, id=q["id"] + "2") for q in QUESTIONS]
    qs[2]["logic"] = [{"operator": "is", "value": "false", "target_question_id": "q_why2"}]
    qs[3]["choices"] = [{"id": "c_a2", "label": "A"}, {"id": "c_b2", "label": "B"}]
    client.put(f"/api/forms/{f['id']}/questions", json={"questions": qs})
    slug = client.get(f"/api/forms/{f['id']}").json()["slug"]

    # draft forms are not public
    assert client.get(f"/api/public/forms/{slug}").status_code == 404
    client.post(f"/api/forms/{f['id']}/publish")
    assert client.get(f"/api/public/forms/{slug}").status_code == 200
    assert client.post(f"/api/public/forms/{slug}/views", json={"visitor_id": "v1"}).status_code == 204

    # bad email + missing required
    r = client.post(f"/api/public/forms/{slug}/submit", json={"answers": {"q_name2": "Ann", "q_mail2": "nope"}})
    assert r.status_code == 422
    errs = r.json()["detail"]["errors"]
    assert "q_mail2" in errs and "q_like2" in errs

    # logic: "No" skips the required pick/rate questions
    r = client.post(f"/api/public/forms/{slug}/submit",
                    json={"answers": {"q_name2": "Ann", "q_mail2": "ann@x.io", "q_like2": False, "q_pick2": ["c_a2"]}})
    assert r.status_code == 200, r.text
    rid = r.json()["response_id"]
    detail = client.get(f"/api/forms/{f['id']}/responses/{rid}").json()
    assert {a["question_id"] for a in detail["answers"]} == {"q_name2", "q_mail2", "q_like2"}  # off-path dropped

    # "Yes" path requires pick + rate; invalid choice and rating rejected
    bad = {"q_name2": "Bo", "q_mail2": "bo@x.io", "q_like2": True, "q_pick2": ["zzz"], "q_rate2": 9}
    errs = client.post(f"/api/public/forms/{slug}/submit", json={"answers": bad}).json()["detail"]["errors"]
    assert set(errs) == {"q_pick2", "q_rate2"}

    # partial -> submit with token
    tok = client.post(f"/api/public/forms/{slug}/responses", json={"answers": {"q_name2": "Cy"}}).json()["token"]
    assert client.patch(f"/api/public/forms/{slug}/responses/{tok}", json={"answers": {"q_mail2": "cy@x.io"}}).status_code == 204
    good = {"q_name2": "Cy", "q_mail2": "cy@x.io", "q_like2": "yes", "q_pick2": "c_b2", "q_rate2": 4}
    r = client.post(f"/api/public/forms/{slug}/submit", json={"answers": good, "token": tok})
    assert r.status_code == 200
    assert client.post(f"/api/public/forms/{slug}/submit", json={"answers": good, "token": tok}).status_code == 409

    s = client.get(f"/api/forms/{f['id']}/summary").json()
    assert s["metrics"]["submissions"] == 2 and s["metrics"]["starts"] == 2
    pick = next(q for q in s["questions"] if q["question_id"] == "q_pick2")
    assert {c["label"]: c["count"] for c in pick["choices"]} == {"A": 0, "B": 1}

    csv = client.get(f"/api/forms/{f['id']}/responses/export.csv")
    assert csv.status_code == 200 and "Name?" in csv.text and "Cy" in csv.text


def test_ai_fallbacks(client):
    r = client.post("/api/ai/generate-form", json={"prompt": "registration for a robotics workshop"})
    assert r.status_code == 201 and r.json()["source"] == "fallback"
    assert len(r.json()["form"]["questions"]) >= 4
    r = client.post("/api/ai/rewrite-question", json={"title": "your name", "type": "short_text"})
    assert len(r.json()["suggestions"]) >= 2
    r = client.post("/api/ai/suggest-questions", json={"form_title": "Customer feedback", "existing": []})
    assert r.json()["questions"]
