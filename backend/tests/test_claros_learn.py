"""Claros Learn (LMS) backend tests — Phase 36.

Covers RBAC, student+faculty flows, AI quiz generation and AI grading.
"""
import os
import time
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

STUDENT = ("manikanta.cse@vaagdevi.edu.in", "Demo@2026")
FACULTY = ("prof.suresh@vaagdevi.edu.in", "Demo@2026")
HOD = ("hod.cse@vaagdevi.edu.in", "Demo@2026")


def _login(email, password):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def student_tok():
    return _login(*STUDENT)


@pytest.fixture(scope="module")
def faculty_tok():
    return _login(*FACULTY)


@pytest.fixture(scope="module")
def hod_tok():
    return _login(*HOD)


# ---------------------------------------------------------------- BASIC ACCESS
def test_health(student_tok):
    r = requests.get(f"{API}/v1/learn/courses/me", headers=_h(student_tok), timeout=30)
    assert r.status_code == 200


def test_student_my_courses(student_tok):
    r = requests.get(f"{API}/v1/learn/courses/me", headers=_h(student_tok), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1, "Student should be enrolled in >=1 course"
    # Should be exactly 3 per problem statement
    assert len(data) == 3, f"Expected 3 enrolled courses, got {len(data)}"
    for c in data:
        assert "id" in c
        assert "progress_pct" in c


def test_faculty_my_courses(faculty_tok):
    r = requests.get(f"{API}/v1/learn/courses/me", headers=_h(faculty_tok), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1, "Faculty should have at least 1 assigned course"
    for c in data:
        assert "enrollment_count" in c


def test_hod_sees_all_courses(hod_tok):
    r = requests.get(f"{API}/v1/learn/courses/me", headers=_h(hod_tok), timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------------------------------------------------------------- CONTENT
def test_student_content_listing(student_tok):
    courses = requests.get(f"{API}/v1/learn/courses/me",
                           headers=_h(student_tok)).json()
    cid = courses[0]["id"]
    r = requests.get(f"{API}/v1/learn/courses/{cid}/content",
                     headers=_h(student_tok), timeout=10)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) >= 2, f"Expected >=2 content rows, got {len(rows)}"
    types = {r["content_type"] for r in rows}
    assert "LECTURE_NOTES" in types
    assert "ASSIGNMENT" in types


# ---------------------------------------------------------------- RBAC
def test_student_cannot_create_content(student_tok):
    courses = requests.get(f"{API}/v1/learn/courses/me",
                           headers=_h(student_tok)).json()
    cid = courses[0]["id"]
    r = requests.post(f"{API}/v1/learn/content",
                      headers=_h(student_tok),
                      json={"course_id": cid, "title": "X",
                            "content_type": "LECTURE_NOTES"}, timeout=10)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


def test_submit_to_bogus_content_404(student_tok):
    r = requests.post(f"{API}/v1/learn/submissions",
                      headers=_h(student_tok),
                      json={"content_id": "does-not-exist-id",
                            "submission_text": "hello"}, timeout=10)
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_quiz_generate_invalid_num(faculty_tok):
    courses = requests.get(f"{API}/v1/learn/courses/me",
                           headers=_h(faculty_tok)).json()
    assert courses, "faculty has no courses"
    cid = courses[0]["id"]
    r = requests.post(f"{API}/v1/learn/quizzes/generate",
                      headers=_h(faculty_tok),
                      json={"course_id": cid, "num_questions": 7,
                            "difficulty": "EASY"}, timeout=10)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"


# ---------------------------------------------------------------- SUBMIT FLOW
def test_student_submit_assignment_and_progress(student_tok):
    courses = requests.get(f"{API}/v1/learn/courses/me",
                           headers=_h(student_tok)).json()
    cid = courses[0]["id"]
    rows = requests.get(f"{API}/v1/learn/courses/{cid}/content",
                        headers=_h(student_tok)).json()
    asg = [r for r in rows if r["content_type"] == "ASSIGNMENT"]
    assert asg, "No assignment in seed"
    content_id = asg[0]["id"]
    payload = {
        "content_id": content_id,
        "submission_text": (
            "I have understood the foundational concepts well. "
            "Concept is the unit of knowledge under study and we apply it "
            "to real-world problems. Evidence supports the claims. "
        ) * 2,
    }
    r = requests.post(f"{API}/v1/learn/submissions",
                      headers=_h(student_tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    sub = r.json()
    assert sub["content_id"] == content_id
    assert sub["submission_text"].startswith("I have understood")

    # GET my submissions verifies persistence
    g = requests.get(f"{API}/v1/learn/submissions/me",
                     headers=_h(student_tok)).json()
    assert any(s["content_id"] == content_id for s in g)

    # Progress reflects an item
    p = requests.get(f"{API}/v1/learn/progress/me",
                     headers=_h(student_tok)).json()
    assert isinstance(p, list) and len(p) >= 1
    for entry in p:
        assert "completion_pct" in entry
        assert "total_items" in entry


# ---------------------------------------------------------------- QUIZ ATTEMPT
def test_student_quiz_listing_and_attempt(student_tok):
    courses = requests.get(f"{API}/v1/learn/courses/me",
                           headers=_h(student_tok)).json()
    # Find a course that has a quiz
    quiz = None
    chosen_cid = None
    for c in courses:
        qs = requests.get(f"{API}/v1/learn/courses/{c['id']}/quizzes",
                          headers=_h(student_tok)).json()
        if qs:
            quiz = qs[0]
            chosen_cid = c["id"]
            break
    assert quiz is not None, "No quiz seeded for any enrolled course"
    quiz_id = quiz["id"]

    g = requests.get(f"{API}/v1/learn/quizzes/{quiz_id}",
                     headers=_h(student_tok)).json()
    assert "questions" in g and len(g["questions"]) == 3
    # Check whether student already attempted
    qlist = requests.get(f"{API}/v1/learn/courses/{chosen_cid}/quizzes",
                        headers=_h(student_tok)).json()
    already = bool(next((q for q in qlist if q["id"] == quiz_id), {}).get("my_attempt"))
    if not already:
        for q in g["questions"]:
            assert "correct_option" not in q, "Pre-attempt should hide correct_option"
    # Submit attempt — pick option a for all to keep deterministic
    answers = {q["id"]: "a" for q in g["questions"]}
    r = requests.post(f"{API}/v1/learn/quizzes/{quiz_id}/attempt",
                      headers=_h(student_tok),
                      json={"answers": answers}, timeout=15)
    if already or (r.status_code == 400 and "already attempted" in r.text.lower()):
        # Second attempt blocked
        assert r.status_code == 400
        return
    assert r.status_code == 200, r.text
    res = r.json()
    assert "score" in res and "total_marks" in res
    assert res["total_marks"] == 3
    # Second attempt blocked
    r2 = requests.post(f"{API}/v1/learn/quizzes/{quiz_id}/attempt",
                       headers=_h(student_tok),
                       json={"answers": answers}, timeout=15)
    assert r2.status_code == 400


# ---------------------------------------------------------------- AI FLOWS
def test_faculty_ai_quiz_generate(faculty_tok):
    courses = requests.get(f"{API}/v1/learn/courses/me",
                           headers=_h(faculty_tok)).json()
    assert courses
    cid = courses[0]["id"]
    r = requests.post(f"{API}/v1/learn/quizzes/generate",
                      headers=_h(faculty_tok),
                      json={"course_id": cid, "num_questions": 5,
                            "difficulty": "EASY"}, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("questions_created") == 5
    assert data.get("quiz_id")


def test_hod_ai_grade(hod_tok, student_tok):
    """HOD grades the student's assignment via AI (HOD has access to all)."""
    s_courses = requests.get(f"{API}/v1/learn/courses/me",
                             headers=_h(student_tok)).json()
    cid = s_courses[0]["id"]
    rows = requests.get(f"{API}/v1/learn/courses/{cid}/content",
                        headers=_h(student_tok)).json()
    asg = next(r for r in rows if r["content_type"] == "ASSIGNMENT")
    subs = requests.get(
        f"{API}/v1/learn/submissions?content_id={asg['id']}",
        headers=_h(hod_tok)).json()
    assert subs, "Expected the student submission to be visible to HOD"
    sub = subs[0]
    r = requests.post(
        f"{API}/v1/learn/submissions/{sub['id']}/ai-grade",
        headers=_h(hod_tok), timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "score" in data
    assert 0 <= int(data["score"]) <= int(data.get("max_marks", 10))
    assert isinstance(data.get("feedback"), str) and len(data["feedback"]) > 0
    # Manual grade override
    rm = requests.post(
        f"{API}/v1/learn/submissions/{sub['id']}/grade",
        headers=_h(hod_tok),
        json={"marks_obtained": 8, "feedback": "Good"}, timeout=15)
    assert rm.status_code == 200
    assert rm.json()["marks_obtained"] == 8


# ---------------------------------------------------------------- FACULTY CREATE
def test_faculty_create_content(faculty_tok):
    courses = requests.get(f"{API}/v1/learn/courses/me",
                           headers=_h(faculty_tok)).json()
    cid = courses[0]["id"]
    payload = {
        "course_id": cid,
        "title": "TEST_Lecture 2 — Pointers",
        "content_type": "LECTURE_NOTES",
        "content_body": "Pointers store memory addresses.",
        "sequence_order": 99,
    }
    r = requests.post(f"{API}/v1/learn/content",
                      headers=_h(faculty_tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["title"] == payload["title"]
    cid_doc = doc["id"]
    # Cleanup
    requests.delete(f"{API}/v1/learn/content/{cid_doc}",
                    headers=_h(faculty_tok))
