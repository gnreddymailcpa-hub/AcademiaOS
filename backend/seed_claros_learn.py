"""Claros Learn — idempotent seed.

Sets up:
  - course_enrollments — each VCE / ISB student enrolled in 3-4 courses
  - faculty_user_id field set on existing course docs
  - 2 sample course_content rows per course (1 LECTURE_NOTES + 1 ASSIGNMENT)
  - 1 sample quiz with 3 questions per VCE course
"""
from datetime import datetime, timezone, timedelta
import hashlib


VCE_ID = "44444444-4444-4444-4444-444444444444"
ISB_ID = "11111111-1111-1111-1111-111111111111"


def _det_uuid(*parts: str) -> str:
    h = hashlib.md5(":".join(parts).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


SAMPLE_LECTURE = (
    "## Overview\n"
    "This unit introduces the foundational concepts covered in the course. "
    "Each topic links theory with at least one applied example.\n\n"
    "### Key terms\n"
    "- **Concept** — the unit of knowledge under study.\n"
    "- **Application** — using a concept to solve a problem.\n"
    "- **Evidence** — observable result that supports or refutes a claim.\n\n"
    "### Recommended practice\n"
    "Work through the worked example below and attempt the practice question "
    "in your own notebook before checking the solution."
)

SAMPLE_ASSIGNMENT = (
    "## Assignment 1 — Concept Application\n\n"
    "Write a short response (300–500 words) demonstrating your understanding "
    "of the key terms introduced in Lecture 1. Include:\n\n"
    "1. A definition in your own words.\n"
    "2. One real-world example you have observed.\n"
    "3. One question you still have about the topic.\n\n"
    "Submit as plain text. AI grader will score on a 0–10 scale based on "
    "clarity, accuracy, and depth of reflection."
)


async def seed_claros_learn(db, logger):
    counts = {
        "faculty_assigned": 0, "enrollments": 0,
        "content": 0, "quizzes": 0, "questions": 0,
    }
    for iid in [VCE_ID, ISB_ID]:
        # Pull all faculty-family users; round-robin assign courses across them
        faculty_users = await db.users.find(
            {"institution_id": iid,
             "role": {"$in": ["faculty", "instructor", "hod", "dean"]}},
            {"_id": 0, "id": 1, "display_name": 1},
        ).to_list(50)
        if not faculty_users:
            continue
        faculty_uids = [u["id"] for u in faculty_users]

        courses = await db.courses.find(
            {"institution_id": iid}, {"_id": 0}).to_list(500)
        if not courses:
            continue

        # 1) Assign faculty_user_id to every course (round-robin)
        for idx, c in enumerate(courses):
            assigned = faculty_uids[idx % len(faculty_uids)]
            if c.get("faculty_user_id") != assigned:
                await db.courses.update_one(
                    {"id": c["id"]},
                    {"$set": {"faculty_user_id": assigned}},
                )
                c["faculty_user_id"] = assigned
                counts["faculty_assigned"] += 1

        # 2) Enroll students. Each student gets first 3 courses of their
        # programme; if no programme match, fall back to first 3 courses.
        students = await db.students.find(
            {"tenant_id": iid, "status": {"$ne": "INACTIVE"}}, {"_id": 0}
        ).to_list(500)
        for st in students:
            # Pick courses — try matching programme code first
            matched = [c for c in courses
                       if str(c.get("programme_id") or "").lower().find(
                           str(st.get("program_id") or "").lower()[-6:]) >= 0]
            cohort_courses = (matched or courses)[:3]
            for c in cohort_courses:
                eid = _det_uuid("enroll", iid, st["id"], c["id"])
                await db.course_enrollments.update_one(
                    {"id": eid},
                    {"$setOnInsert": {
                        "id": eid, "tenant_id": iid,
                        "course_id": c["id"], "student_id": st["id"],
                        "enrolled_at": _iso(),
                    }},
                    upsert=True,
                )
                counts["enrollments"] += 1

        # 3) For each course, seed 1 LECTURE_NOTES + 1 ASSIGNMENT (idempotent)
        due_iso = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        for c in courses:
            lec_id = _det_uuid("content", iid, c["id"], "lecture-1")
            await db.course_content.update_one(
                {"id": lec_id},
                {"$setOnInsert": {
                    "id": lec_id, "tenant_id": iid, "course_id": c["id"],
                    "title": f"Lecture 1 — Introduction to {c.get('title', 'the course')}",
                    "content_type": "LECTURE_NOTES",
                    "content_body": SAMPLE_LECTURE,
                    "file_url": None, "due_date": None, "max_marks": None,
                    "sequence_order": 1, "is_visible": True,
                    "created_by": faculty_uids[0],
                    "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["content"] += 1
            asg_id = _det_uuid("content", iid, c["id"], "assignment-1")
            await db.course_content.update_one(
                {"id": asg_id},
                {"$setOnInsert": {
                    "id": asg_id, "tenant_id": iid, "course_id": c["id"],
                    "title": f"Assignment 1 — {c.get('title', 'Course')}",
                    "content_type": "ASSIGNMENT",
                    "content_body": SAMPLE_ASSIGNMENT,
                    "file_url": None, "due_date": due_iso, "max_marks": 10,
                    "sequence_order": 2, "is_visible": True,
                    "created_by": faculty_uids[0],
                    "created_at": _iso(),
                }},
                upsert=True,
            )
            counts["content"] += 1

        # 4) For VCE first 3 courses, seed a sample quiz with 3 questions each
        if iid == VCE_ID:
            for c in courses[:3]:
                quiz_id = _det_uuid("quiz", iid, c["id"], "starter")
                already = await db.quizzes.find_one({"id": quiz_id})
                if already:
                    continue
                await db.quizzes.insert_one({
                    "id": quiz_id, "tenant_id": iid, "course_id": c["id"],
                    "title": f"Starter Quiz — {c.get('title', 'Course')}",
                    "instructions": "3 multiple-choice questions. Difficulty: EASY.",
                    "time_limit_minutes": 15,
                    "total_marks": 3,
                    "is_ai_generated": False,
                    "start_datetime": None, "end_datetime": None,
                    "created_by": faculty_uids[0],
                    "created_at": _iso(),
                })
                counts["quizzes"] += 1
                qs = [
                    {"q": f"What is the title of this course?",
                     "a": c.get("title", "Course"), "b": "Random topic A",
                     "c": "Random topic B", "d": "Random topic C",
                     "correct": "a",
                     "explanation": f"The course is titled '{c.get('title', '')}'."},
                    {"q": "Which study habit is most effective?",
                     "a": "Avoiding practice",
                     "b": "Spaced repetition with practice problems",
                     "c": "Memorising only", "d": "Skipping lectures",
                     "correct": "b",
                     "explanation": "Spaced repetition with practice is evidence-based."},
                    {"q": "What is the recommended response when confused?",
                     "a": "Wait until exam day", "b": "Ask the instructor and re-read notes",
                     "c": "Skip the topic", "d": "Memorise random sections",
                     "correct": "b",
                     "explanation": "Asking and re-reading clarify understanding."},
                ]
                for i, q in enumerate(qs):
                    qid = _det_uuid("quizq", quiz_id, str(i))
                    await db.quiz_questions.update_one(
                        {"id": qid},
                        {"$setOnInsert": {
                            "id": qid, "tenant_id": iid, "quiz_id": quiz_id,
                            "question_text": q["q"],
                            "option_a": q["a"], "option_b": q["b"],
                            "option_c": q["c"], "option_d": q["d"],
                            "correct_option": q["correct"], "marks": 1,
                            "explanation": q["explanation"],
                            "question_order": i + 1,
                        }},
                        upsert=True,
                    )
                    counts["questions"] += 1

    logger.info("Claros Learn seeded · %s", counts)
