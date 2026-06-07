"""
Claros Learn — Learning Management System.

Depends on `courses` (institution_id-keyed) and `students` (tenant_id-keyed)
from Claros Core. Adds:
  - course_enrollments (student↔course)
  - course_content (lecture notes, assignments, quizzes, links)
  - student_submissions (assignment submissions, AI-gradable)
  - quizzes / quiz_questions / quiz_attempts (AI-generated quizzes)
  - learning_progress (per-student per-course completion counts)

All endpoints under /api/v1/learn/*. File uploads land in
/app/backend/uploads/learn/. Faculty role family includes
faculty, instructor, hod, dean.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ai_service import generate_text, DEFAULT_PROVIDER, DEFAULT_MODEL

logger = logging.getLogger("academiaos.learn")

UPLOAD_DIR = "/app/backend/uploads/learn"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Role families
FACULTY_ROLES = {"faculty", "instructor", "hod", "dean"}
ADMIN_ROLES = {"super_admin", "institution_admin"}
STAFF_ROLES = FACULTY_ROLES | ADMIN_ROLES

VALID_CONTENT_TYPES = {
    "LECTURE_NOTES", "ASSIGNMENT", "QUIZ", "VIDEO_LINK",
    "READING", "ANNOUNCEMENT",
}
DIFFICULTIES = {"EASY", "MEDIUM", "HARD"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_filename(name: str) -> str:
    n = "".join(ch for ch in (name or "file") if ch.isalnum() or ch in "._-")
    return n or "file"


def _tenant_of(user: dict) -> str:
    iid = user.get("institution_id")
    if not iid:
        raise HTTPException(403, "User has no institution_id")
    return iid


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class ContentBody(BaseModel):
    course_id: str
    title: str = Field(min_length=1, max_length=300)
    content_type: str
    content_body: str = ""
    file_url: Optional[str] = None
    due_date: Optional[str] = None
    max_marks: Optional[int] = None
    sequence_order: int = 0
    is_visible: bool = True


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    content_body: Optional[str] = None
    file_url: Optional[str] = None
    due_date: Optional[str] = None
    max_marks: Optional[int] = None
    sequence_order: Optional[int] = None
    is_visible: Optional[bool] = None


class SubmitBody(BaseModel):
    content_id: str
    submission_text: str = ""
    file_url: Optional[str] = None


class GenerateQuizBody(BaseModel):
    course_id: str
    num_questions: int = 5
    difficulty: str = "MEDIUM"
    title: Optional[str] = None


class QuizAttemptBody(BaseModel):
    answers: dict  # {question_id: "a"|"b"|"c"|"d"}


class ManualGradeBody(BaseModel):
    marks_obtained: int
    feedback: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _student_of(db, user) -> Optional[dict]:
    if user["role"] != "student":
        return None
    return await db.students.find_one({"user_id": user["id"]}, {"_id": 0})


async def _enrolled_course_ids(db, student_id: str, iid: str) -> List[str]:
    rows = await db.course_enrollments.find(
        {"tenant_id": iid, "student_id": student_id}, {"_id": 0, "course_id": 1}
    ).to_list(500)
    return [r["course_id"] for r in rows]


async def _faculty_course_ids(db, user_id: str, iid: str) -> List[str]:
    rows = await db.courses.find(
        {"institution_id": iid, "faculty_user_id": user_id}, {"_id": 0, "id": 1}
    ).to_list(500)
    return [r["id"] for r in rows]


async def _ensure_course_access(db, user: dict, course_id: str):
    """Throw 403 unless user is admin / faculty-of-course / enrolled student."""
    iid = _tenant_of(user)
    course = await db.courses.find_one(
        {"id": course_id, "institution_id": iid}, {"_id": 0})
    if not course:
        raise HTTPException(404, "Course not found")
    if user["role"] in ADMIN_ROLES:
        return course
    if user["role"] in FACULTY_ROLES:
        if course.get("faculty_user_id") == user["id"] or user["role"] in {"hod", "dean"}:
            return course
        raise HTTPException(403, "Not assigned to this course")
    if user["role"] == "student":
        st = await _student_of(db, user)
        if not st:
            raise HTTPException(403, "Student record missing")
        eids = await _enrolled_course_ids(db, st["id"], iid)
        if course_id in eids:
            return course
        raise HTTPException(403, "Not enrolled in this course")
    raise HTTPException(403, "No access")


async def _recompute_progress(db, iid: str, student_id: str, course_id: str):
    total = await db.course_content.count_documents(
        {"tenant_id": iid, "course_id": course_id, "is_visible": True})
    # Count submissions + quiz attempts as "completed items"
    sub_count = await db.student_submissions.count_documents(
        {"tenant_id": iid, "student_id": student_id})
    quiz_attempt_count = await db.quiz_attempts.count_documents(
        {"tenant_id": iid, "student_id": student_id})
    completed = min(total, sub_count + quiz_attempt_count)
    now = _now_iso()
    await db.learning_progress.update_one(
        {"tenant_id": iid, "student_id": student_id, "course_id": course_id},
        {"$set": {"completed_items": completed, "total_items": total,
                  "last_activity": now},
         "$setOnInsert": {"id": str(uuid.uuid4()),
                          "tenant_id": iid, "student_id": student_id,
                          "course_id": course_id}},
        upsert=True,
    )


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
def build_claros_learn_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/v1/learn", tags=["claros-learn"])

    # ============================================================ COURSES
    @router.get("/courses/me")
    async def my_courses(user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        if user["role"] == "student":
            st = await _student_of(db, user)
            if not st:
                return []
            cids = await _enrolled_course_ids(db, st["id"], iid)
            if not cids:
                return []
            courses = await db.courses.find(
                {"institution_id": iid, "id": {"$in": cids}}, {"_id": 0}
            ).to_list(500)
            # attach progress
            progs = {p["course_id"]: p async for p in db.learning_progress.find(
                {"tenant_id": iid, "student_id": st["id"], "course_id": {"$in": cids}},
                {"_id": 0})}
            for c in courses:
                p = progs.get(c["id"], {})
                total = p.get("total_items", 0)
                done = p.get("completed_items", 0)
                c["progress_pct"] = round((done / total) * 100, 1) if total else 0.0
                c["last_activity"] = p.get("last_activity")
            return courses
        if user["role"] in FACULTY_ROLES:
            # Faculty courses they teach (or all for HOD/Dean)
            flt = {"institution_id": iid}
            if user["role"] in {"faculty", "instructor"}:
                flt["faculty_user_id"] = user["id"]
            courses = await db.courses.find(flt, {"_id": 0}).to_list(500)
            for c in courses:
                c["enrollment_count"] = await db.course_enrollments.count_documents(
                    {"tenant_id": iid, "course_id": c["id"]})
            return courses
        if user["role"] in ADMIN_ROLES:
            return await db.courses.find(
                {"institution_id": iid}, {"_id": 0}).to_list(500)
        raise HTTPException(403, "No access")

    # ============================================================ CONTENT
    @router.get("/courses/{course_id}/content")
    async def list_content(course_id: str, user: dict = Depends(get_current_user)):
        db = get_db()
        await _ensure_course_access(db, user, course_id)
        iid = _tenant_of(user)
        flt = {"tenant_id": iid, "course_id": course_id}
        if user["role"] == "student":
            flt["is_visible"] = True
        rows = await db.course_content.find(flt, {"_id": 0}).sort(
            [("sequence_order", 1), ("created_at", 1)]).to_list(500)
        return rows

    @router.post("/content")
    async def create_content(body: ContentBody,
                              user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        if body.content_type not in VALID_CONTENT_TYPES:
            raise HTTPException(400, f"content_type must be one of {sorted(VALID_CONTENT_TYPES)}")
        db = get_db()
        await _ensure_course_access(db, user, body.course_id)
        iid = _tenant_of(user)
        doc = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "course_id": body.course_id,
            "title": body.title.strip(),
            "content_type": body.content_type,
            "content_body": body.content_body,
            "file_url": body.file_url,
            "due_date": body.due_date,
            "max_marks": body.max_marks,
            "sequence_order": body.sequence_order,
            "is_visible": body.is_visible,
            "created_by": user["id"],
            "created_at": _now_iso(),
        }
        await db.course_content.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.put("/content/{content_id}")
    async def update_content(content_id: str, body: ContentUpdate,
                              user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        iid = _tenant_of(user)
        existing = await db.course_content.find_one(
            {"id": content_id, "tenant_id": iid}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Content not found")
        if user["role"] in FACULTY_ROLES and existing.get("created_by") != user["id"] \
                and user["role"] not in {"hod", "dean"}:
            raise HTTPException(403, "Only the owner faculty may edit")
        updates = {k: v for k, v in body.dict().items() if v is not None}
        if not updates:
            return existing
        updates["updated_at"] = _now_iso()
        await db.course_content.update_one({"id": content_id}, {"$set": updates})
        return await db.course_content.find_one({"id": content_id}, {"_id": 0})

    @router.delete("/content/{content_id}")
    async def delete_content(content_id: str,
                              user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        iid = _tenant_of(user)
        existing = await db.course_content.find_one(
            {"id": content_id, "tenant_id": iid}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Content not found")
        if user["role"] in FACULTY_ROLES and existing.get("created_by") != user["id"] \
                and user["role"] not in {"hod", "dean"}:
            raise HTTPException(403, "Only the owner faculty may delete")
        await db.course_content.delete_one({"id": content_id})
        return {"ok": True}

    # ============================================================ FILES
    @router.post("/files/upload")
    async def upload_file(file: UploadFile = File(...),
                          user: dict = Depends(get_current_user)):
        """Generic file upload for assignments / content. Returns file_url."""
        iid = _tenant_of(user)
        fid = str(uuid.uuid4())
        safe = _safe_filename(file.filename or "file")
        path = os.path.join(UPLOAD_DIR, f"{iid}_{fid}_{safe}")
        with open(path, "wb") as fp:
            fp.write(await file.read())
        # Token that downloads also need
        return {"file_url": f"/api/v1/learn/files/{fid}_{safe}",
                "filename": safe, "id": fid}

    @router.get("/files/{token}")
    async def download_file(token: str,
                            user: dict = Depends(get_current_user)):
        iid = _tenant_of(user)
        # Token format: {fid}_{safe_filename}. Disk path: {iid}_{token}
        path = os.path.join(UPLOAD_DIR, f"{iid}_{token}")
        if not os.path.exists(path):
            # Try also files belonging to other tenants if user is super_admin
            if user["role"] == "super_admin":
                for fname in os.listdir(UPLOAD_DIR):
                    if fname.endswith(token):
                        return FileResponse(os.path.join(UPLOAD_DIR, fname))
            raise HTTPException(404, "File not found")
        return FileResponse(path)

    # ============================================================ SUBMISSIONS
    @router.post("/submissions")
    async def submit_assignment(body: SubmitBody,
                                 user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        iid = _tenant_of(user)
        st = await _student_of(db, user)
        if not st:
            raise HTTPException(403, "No student record")
        content = await db.course_content.find_one(
            {"id": body.content_id, "tenant_id": iid}, {"_id": 0})
        if not content:
            raise HTTPException(404, "Content not found")
        if content["content_type"] != "ASSIGNMENT":
            raise HTTPException(400, "Not an assignment")
        await _ensure_course_access(db, user, content["course_id"])
        is_late = False
        if content.get("due_date"):
            try:
                due = datetime.fromisoformat(content["due_date"].replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > due:
                    is_late = True
            except Exception:
                pass
        sub = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "student_id": st["id"], "content_id": body.content_id,
            "course_id": content["course_id"],
            "submission_text": body.submission_text,
            "file_url": body.file_url,
            "submitted_at": _now_iso(),
            "is_late": is_late,
            "marks_obtained": None, "ai_marks": None,
            "feedback": None, "graded_at": None, "graded_by": None,
        }
        # Upsert: one submission per (student, content)
        await db.student_submissions.update_one(
            {"tenant_id": iid, "student_id": st["id"], "content_id": body.content_id},
            {"$set": sub}, upsert=True,
        )
        await _recompute_progress(db, iid, st["id"], content["course_id"])
        sub.pop("_id", None)
        return sub

    @router.get("/submissions/me")
    async def my_submissions(user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        iid = _tenant_of(user)
        st = await _student_of(db, user)
        if not st:
            return []
        return await db.student_submissions.find(
            {"tenant_id": iid, "student_id": st["id"]}, {"_id": 0}
        ).sort("submitted_at", -1).to_list(500)

    @router.get("/submissions")
    async def submissions_for_content(content_id: str,
                                       user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        iid = _tenant_of(user)
        content = await db.course_content.find_one(
            {"id": content_id, "tenant_id": iid}, {"_id": 0})
        if not content:
            raise HTTPException(404, "Content not found")
        await _ensure_course_access(db, user, content["course_id"])
        rows = await db.student_submissions.find(
            {"tenant_id": iid, "content_id": content_id}, {"_id": 0}
        ).sort("submitted_at", -1).to_list(500)
        # Attach student display_name
        sids = list({r["student_id"] for r in rows})
        students = await db.students.find(
            {"id": {"$in": sids}}, {"_id": 0, "id": 1, "display_name": 1, "roll_number": 1}
        ).to_list(500)
        smap = {s["id"]: s for s in students}
        for r in rows:
            s = smap.get(r["student_id"], {})
            r["student_name"] = s.get("display_name") or s.get("roll_number") or "Student"
            r["roll_number"] = s.get("roll_number")
        return rows

    @router.post("/submissions/{submission_id}/ai-grade")
    async def ai_grade(submission_id: str,
                       user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        iid = _tenant_of(user)
        sub = await db.student_submissions.find_one(
            {"id": submission_id, "tenant_id": iid}, {"_id": 0})
        if not sub:
            raise HTTPException(404, "Submission not found")
        content = await db.course_content.find_one(
            {"id": sub["content_id"], "tenant_id": iid}, {"_id": 0})
        if not content:
            raise HTTPException(404, "Linked content not found")
        max_marks = int(content.get("max_marks") or 10)
        prompt = (
            f"Grade this assignment submission on a scale of 0 to {max_marks}.\n"
            f"Assignment: {content['title']} — {content.get('content_body') or ''}\n"
            f"Student submission: {sub.get('submission_text') or '(file-only submission)'}\n\n"
            "Return ONLY valid JSON, no markdown fences, with shape: "
            "{\"score\": int, \"feedback\": \"...max 150 words...\", "
            "\"strengths\": [\"...\", \"...\"], \"improvements\": [\"...\", \"...\"]}"
        )
        try:
            raw = await generate_text(
                system_message="You are a fair, detailed academic grader. "
                               "Always reply with strict JSON only.",
                user_text=prompt,
                provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"learn-grade-{submission_id}",
                max_tokens=800,
            )
            data = _safe_json(raw)
            score = int(max(0, min(max_marks, int(data.get("score") or 0))))
            feedback = (data.get("feedback") or "")[:1200]
            strengths = data.get("strengths") or []
            improvements = data.get("improvements") or []
        except Exception as e:
            logger.warning("AI grade failed: %s", e)
            # Deterministic fallback: half marks + generic feedback
            score = max_marks // 2
            feedback = (
                "Submission received. AI grading service unavailable — please "
                "review manually. Default provisional score applied."
            )
            strengths, improvements = [], []
        await db.student_submissions.update_one(
            {"id": submission_id},
            {"$set": {"ai_marks": score, "feedback": feedback,
                      "graded_at": _now_iso(), "graded_by": user["id"],
                      "ai_strengths": strengths, "ai_improvements": improvements}},
        )
        return {"score": score, "feedback": feedback,
                "strengths": strengths, "improvements": improvements,
                "max_marks": max_marks}

    @router.post("/submissions/{submission_id}/grade")
    async def manual_grade(submission_id: str, body: ManualGradeBody,
                           user: dict = Depends(get_current_user)):
        """Persist a faculty's manual marks_obtained on a submission."""
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        db = get_db()
        iid = _tenant_of(user)
        sub = await db.student_submissions.find_one(
            {"id": submission_id, "tenant_id": iid}, {"_id": 0})
        if not sub:
            raise HTTPException(404, "Submission not found")
        await db.student_submissions.update_one(
            {"id": submission_id},
            {"$set": {"marks_obtained": int(body.marks_obtained),
                      "feedback": body.feedback or sub.get("feedback"),
                      "graded_at": _now_iso(), "graded_by": user["id"]}},
        )
        return await db.student_submissions.find_one(
            {"id": submission_id}, {"_id": 0})

    # ============================================================ QUIZZES
    @router.post("/quizzes/generate")
    async def generate_quiz(body: GenerateQuizBody,
                             user: dict = Depends(get_current_user)):
        if user["role"] not in STAFF_ROLES:
            raise HTTPException(403, "Faculty/Admin only")
        if body.num_questions not in (5, 10, 15):
            raise HTTPException(400, "num_questions must be 5, 10 or 15")
        if body.difficulty not in DIFFICULTIES:
            raise HTTPException(400, f"difficulty must be one of {sorted(DIFFICULTIES)}")
        db = get_db()
        iid = _tenant_of(user)
        course = await _ensure_course_access(db, user, body.course_id)
        notes = await db.course_content.find(
            {"tenant_id": iid, "course_id": body.course_id,
             "content_type": "LECTURE_NOTES"}, {"_id": 0}
        ).sort("sequence_order", 1).to_list(50)
        notes_text = "\n\n".join(
            f"### {n['title']}\n{n.get('content_body') or ''}"
            for n in notes
        )[:8000] or f"Course: {course.get('title', '')}"

        prompt = (
            f"Create {body.num_questions} multiple choice questions from these "
            f"course notes.\nCourse: {course.get('title', '')}. "
            f"Difficulty: {body.difficulty}.\n\n"
            "RETURN ONLY a valid JSON array (no markdown, no extra text), with "
            "each element of shape: "
            "{\"question_text\":\"...\",\"option_a\":\"...\",\"option_b\":\"...\","
            "\"option_c\":\"...\",\"option_d\":\"...\",\"correct_option\":\"a|b|c|d\","
            "\"explanation\":\"...\"}\n\n"
            f"Course notes:\n{notes_text}"
        )
        try:
            raw = await generate_text(
                system_message="You are an academic quiz writer. Return strict JSON only.",
                user_text=prompt,
                provider=DEFAULT_PROVIDER, model=DEFAULT_MODEL,
                session_id=f"learn-quiz-{body.course_id}",
                max_tokens=3000,
            )
            qs = _safe_json(raw)
            if not isinstance(qs, list):
                raise ValueError("Expected JSON array")
        except Exception as e:
            logger.warning("Quiz generation LLM failed: %s — using deterministic fallback", e)
            qs = _fallback_questions(course.get("title", "Course"), body.num_questions)

        qs = qs[:body.num_questions]
        quiz_id = str(uuid.uuid4())
        total_marks = len(qs)
        quiz_doc = {
            "id": quiz_id, "tenant_id": iid, "course_id": body.course_id,
            "title": body.title or f"AI Quiz — {course.get('title', 'Course')} ({body.difficulty})",
            "instructions": f"{body.num_questions} multiple-choice questions. "
                            f"Difficulty: {body.difficulty}.",
            "time_limit_minutes": 30,
            "total_marks": total_marks,
            "is_ai_generated": True,
            "start_datetime": None, "end_datetime": None,
            "created_by": user["id"], "created_at": _now_iso(),
        }
        await db.quizzes.insert_one(quiz_doc)
        for i, q in enumerate(qs):
            opt = (q.get("correct_option") or "a").strip().lower()
            if opt not in ("a", "b", "c", "d"):
                opt = "a"
            await db.quiz_questions.insert_one({
                "id": str(uuid.uuid4()), "tenant_id": iid, "quiz_id": quiz_id,
                "question_text": q.get("question_text") or f"Question {i+1}",
                "option_a": q.get("option_a") or "Option A",
                "option_b": q.get("option_b") or "Option B",
                "option_c": q.get("option_c") or "Option C",
                "option_d": q.get("option_d") or "Option D",
                "correct_option": opt,
                "marks": 1,
                "explanation": q.get("explanation") or "",
                "question_order": i + 1,
            })
        return {"quiz_id": quiz_id, "questions_created": len(qs),
                "title": quiz_doc["title"]}

    @router.get("/courses/{course_id}/quizzes")
    async def list_quizzes(course_id: str,
                           user: dict = Depends(get_current_user)):
        db = get_db()
        await _ensure_course_access(db, user, course_id)
        iid = _tenant_of(user)
        quizzes = await db.quizzes.find(
            {"tenant_id": iid, "course_id": course_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(200)
        # Attach question count + (for student) attempt status
        st = await _student_of(db, user) if user["role"] == "student" else None
        for q in quizzes:
            q["question_count"] = await db.quiz_questions.count_documents(
                {"tenant_id": iid, "quiz_id": q["id"]})
            if st:
                attempt = await db.quiz_attempts.find_one(
                    {"tenant_id": iid, "student_id": st["id"], "quiz_id": q["id"]},
                    {"_id": 0})
                q["my_attempt"] = attempt
            else:
                q["attempt_count"] = await db.quiz_attempts.count_documents(
                    {"tenant_id": iid, "quiz_id": q["id"]})
        return quizzes

    @router.get("/quizzes/{quiz_id}")
    async def get_quiz(quiz_id: str,
                       user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        quiz = await db.quizzes.find_one(
            {"id": quiz_id, "tenant_id": iid}, {"_id": 0})
        if not quiz:
            raise HTTPException(404, "Quiz not found")
        await _ensure_course_access(db, user, quiz["course_id"])
        questions = await db.quiz_questions.find(
            {"tenant_id": iid, "quiz_id": quiz_id}, {"_id": 0}
        ).sort("question_order", 1).to_list(100)
        # For students, hide correct_option + explanation until they finish
        if user["role"] == "student":
            st = await _student_of(db, user)
            attempted = False
            if st:
                attempt = await db.quiz_attempts.find_one(
                    {"tenant_id": iid, "quiz_id": quiz_id, "student_id": st["id"]},
                    {"_id": 0})
                attempted = bool(attempt)
            if not attempted:
                for q in questions:
                    q.pop("correct_option", None)
                    q.pop("explanation", None)
        return {"quiz": quiz, "questions": questions}

    @router.post("/quizzes/{quiz_id}/attempt")
    async def submit_attempt(quiz_id: str, body: QuizAttemptBody,
                              user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        iid = _tenant_of(user)
        quiz = await db.quizzes.find_one(
            {"id": quiz_id, "tenant_id": iid}, {"_id": 0})
        if not quiz:
            raise HTTPException(404, "Quiz not found")
        await _ensure_course_access(db, user, quiz["course_id"])
        st = await _student_of(db, user)
        if not st:
            raise HTTPException(403, "No student record")
        questions = await db.quiz_questions.find(
            {"tenant_id": iid, "quiz_id": quiz_id}, {"_id": 0}
        ).to_list(100)
        if not questions:
            raise HTTPException(400, "Quiz has no questions")
        # Score
        ans = {str(k): str(v).lower() for k, v in (body.answers or {}).items()}
        score = 0
        for q in questions:
            if ans.get(q["id"]) == q["correct_option"]:
                score += q.get("marks", 1)
        total_marks = sum(q.get("marks", 1) for q in questions)
        now = _now_iso()
        existing = await db.quiz_attempts.find_one(
            {"tenant_id": iid, "quiz_id": quiz_id, "student_id": st["id"]},
            {"_id": 0})
        if existing:
            raise HTTPException(400, "Quiz already attempted")
        attempt = {
            "id": str(uuid.uuid4()), "tenant_id": iid,
            "student_id": st["id"], "quiz_id": quiz_id,
            "answers": ans, "score": score, "total_marks": total_marks,
            "started_at": now, "submitted_at": now, "time_taken_seconds": 0,
        }
        await db.quiz_attempts.insert_one(attempt)
        await _recompute_progress(db, iid, st["id"], quiz["course_id"])
        attempt.pop("_id", None)
        return {"attempt_id": attempt["id"], "score": score, "total_marks": total_marks}

    @router.get("/quizzes/{quiz_id}/results/{attempt_id}")
    async def quiz_results(quiz_id: str, attempt_id: str,
                            user: dict = Depends(get_current_user)):
        db = get_db()
        iid = _tenant_of(user)
        attempt = await db.quiz_attempts.find_one(
            {"id": attempt_id, "tenant_id": iid, "quiz_id": quiz_id}, {"_id": 0})
        if not attempt:
            raise HTTPException(404, "Attempt not found")
        # Student can only see own attempt
        if user["role"] == "student":
            st = await _student_of(db, user)
            if not st or attempt["student_id"] != st["id"]:
                raise HTTPException(403, "Cannot view this attempt")
        questions = await db.quiz_questions.find(
            {"tenant_id": iid, "quiz_id": quiz_id}, {"_id": 0}
        ).sort("question_order", 1).to_list(100)
        return {"attempt": attempt, "questions": questions}

    # ============================================================ PROGRESS
    @router.get("/progress/me")
    async def my_progress(user: dict = Depends(get_current_user)):
        if user["role"] != "student":
            raise HTTPException(403, "Students only")
        db = get_db()
        iid = _tenant_of(user)
        st = await _student_of(db, user)
        if not st:
            return []
        cids = await _enrolled_course_ids(db, st["id"], iid)
        if not cids:
            return []
        # Refresh progress numbers on the fly
        for cid in cids:
            await _recompute_progress(db, iid, st["id"], cid)
        progs = await db.learning_progress.find(
            {"tenant_id": iid, "student_id": st["id"],
             "course_id": {"$in": cids}}, {"_id": 0}
        ).to_list(200)
        cmap = {c["id"]: c for c in await db.courses.find(
            {"institution_id": iid, "id": {"$in": cids}}, {"_id": 0}).to_list(500)}
        out = []
        for p in progs:
            c = cmap.get(p["course_id"], {})
            total = p.get("total_items", 0)
            done = p.get("completed_items", 0)
            out.append({
                "course_id": p["course_id"],
                "course_name": c.get("title") or c.get("code") or "Course",
                "completed_items": done,
                "total_items": total,
                "completion_pct": round((done / total) * 100, 1) if total else 0.0,
                "last_activity": p.get("last_activity"),
            })
        return out

    return router


# ---------------------------------------------------------------------------
# JSON parsing utilities
# ---------------------------------------------------------------------------
def _safe_json(raw: str):
    """Best-effort: strip code-fences, extract first JSON value."""
    if raw is None:
        raise ValueError("empty LLM response")
    s = raw.strip()
    # Strip ```json ... ``` fences
    m = re.search(r"```(?:json)?\s*(.*?)```", s, flags=re.DOTALL | re.IGNORECASE)
    if m:
        s = m.group(1).strip()
    # Try direct parse first
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    # Fallback: extract outermost JSON object OR array
    start = -1
    for i, ch in enumerate(s):
        if ch in "{[":
            start = i
            break
    if start == -1:
        raise ValueError("No JSON value found")
    end_char = "}" if s[start] == "{" else "]"
    depth = 0
    for i in range(start, len(s)):
        if s[i] == s[start]:
            depth += 1
        elif s[i] == end_char:
            depth -= 1
            if depth == 0:
                return json.loads(s[start:i + 1])
    raise ValueError("Unbalanced JSON")


def _fallback_questions(course_title: str, n: int) -> List[dict]:
    """Deterministic fallback when LLM is unavailable — gives the seed a
    workable quiz so the UI is never blank."""
    base = [
        {"q": f"What is the primary subject area of {course_title}?",
         "options": [course_title, "Astronomy", "Marine biology", "Pottery"],
         "correct": "a",
         "explanation": f"The course is explicitly titled '{course_title}'."},
        {"q": "Which of the following is a study habit recommended for this course?",
         "options": ["Skipping lectures", "Active reading + practice", "Memorising only", "Avoiding feedback"],
         "correct": "b",
         "explanation": "Active reading and practice are universally recommended."},
        {"q": "Which artefact best demonstrates understanding of a concept?",
         "options": ["A blank page", "A worked example with explanation", "Random keywords", "An empty diagram"],
         "correct": "b",
         "explanation": "Worked examples show applied understanding."},
        {"q": "What is the best response when stuck on a topic?",
         "options": ["Give up", "Re-read the notes and ask the instructor", "Wait for the exam", "Change the course"],
         "correct": "b",
         "explanation": "Re-reading and asking are evidence-based study strategies."},
        {"q": "Which assessment format requires applying knowledge rather than recall?",
         "options": ["True/False trivia", "Case-study analysis", "Spelling test", "Multiple-choice trivia"],
         "correct": "b",
         "explanation": "Case studies require applied reasoning."},
    ]
    out = []
    for i in range(n):
        b = base[i % len(base)]
        out.append({
            "question_text": b["q"],
            "option_a": b["options"][0], "option_b": b["options"][1],
            "option_c": b["options"][2], "option_d": b["options"][3],
            "correct_option": b["correct"], "explanation": b["explanation"],
        })
    return out
