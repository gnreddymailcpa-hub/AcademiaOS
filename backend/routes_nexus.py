"""
NEXUS — Campus ERP backend (Phase 1).

Phase-1 MVP scope per build plan:
  - Attendance: daily mark + class-wise % view
  - Fees: term-fee ledger with paid/pending/overdue
  - Certificates: bonafide / TC / conduct certificate issuance with verification code

The collections (`nexus_attendance`, `nexus_fees`, `nexus_certificates`) are
tenant-scoped at every read/write and write to `audit_logs` on mutation.
"""
from datetime import datetime, timezone, date
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc).isoformat()


# ------------ Attendance ------------
class AttendanceMark(BaseModel):
    cohort_id: str
    course_id: str
    date: str  # YYYY-MM-DD
    entries: List[dict]  # [{student_id, status: present|absent|leave}]


# ------------ Fees ------------
class FeeIn(BaseModel):
    student_id: str
    student_name: str
    term: str  # "AY 2025-26 · Sem 1"
    amount: float
    due_date: str  # YYYY-MM-DD


class FeePayment(BaseModel):
    amount: float
    method: str = "online"
    ref: Optional[str] = None


# ------------ Certificates ------------
class CertIssue(BaseModel):
    student_id: str
    student_name: str
    cert_type: str = Field(pattern="^(bonafide|transfer|conduct|study)$")
    purpose: Optional[str] = "Higher studies"


def build_nexus_router(get_db, get_current_user):
    router = APIRouter(prefix="/api/nexus", tags=["nexus"])

    def _guard(user: dict, institution_id: str):
        if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
            raise HTTPException(status_code=403, detail="Cross-tenant denied")

    async def _audit(db, institution_id: str, actor: str, action: str, target: str, details: dict):
        await db.audit_logs.insert_one({
            "id": f"audit-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            "ts": _now(),
            "actor": actor,
            "action": action,
            "target": target,
            "details": details,
        })

    # ---------------- ATTENDANCE ----------------
    @router.post("/{institution_id}/attendance")
    async def mark_attendance(
        institution_id: str,
        payload: AttendanceMark,
        user: dict = Depends(get_current_user),
    ):
        _guard(user, institution_id)
        db = get_db()
        doc = {
            "id": f"att-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            "cohort_id": payload.cohort_id,
            "course_id": payload.course_id,
            "date": payload.date,
            "entries": payload.entries,
            "marked_by": user["email"],
            "created_at": _now(),
        }
        await db.nexus_attendance.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "nexus.attendance.mark", doc["id"],
                     {"cohort": payload.cohort_id, "course": payload.course_id, "date": payload.date,
                      "count": len(payload.entries)})
        return doc

    @router.get("/{institution_id}/attendance")
    async def list_attendance(
        institution_id: str,
        cohort_id: Optional[str] = None,
        course_id: Optional[str] = None,
        user: dict = Depends(get_current_user),
    ):
        _guard(user, institution_id)
        db = get_db()
        q = {"institution_id": institution_id}
        if cohort_id:
            q["cohort_id"] = cohort_id
        if course_id:
            q["course_id"] = course_id
        rows = await db.nexus_attendance.find(q, {"_id": 0}).sort("date", -1).to_list(200)
        # compute per-course percentage summary
        total_marks = 0
        present_marks = 0
        for r in rows:
            for e in r.get("entries", []):
                total_marks += 1
                if e.get("status") == "present":
                    present_marks += 1
        pct = round((present_marks / total_marks) * 100, 1) if total_marks else 0.0
        return {"rows": rows, "summary": {"total_marks": total_marks, "present": present_marks, "pct": pct}}

    # ---------------- FEES ----------------
    @router.post("/{institution_id}/fees")
    async def create_fee(
        institution_id: str,
        payload: FeeIn,
        user: dict = Depends(get_current_user),
    ):
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "registrar"):
            raise HTTPException(status_code=403, detail="Admin / registrar role required")
        db = get_db()
        doc = {
            "id": f"fee-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            **payload.model_dump(),
            "paid": 0.0,
            "status": "pending",
            "payments": [],
            "created_at": _now(),
        }
        await db.nexus_fees.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "nexus.fee.create", doc["id"], {"amount": payload.amount, "term": payload.term})
        return doc

    @router.get("/{institution_id}/fees")
    async def list_fees(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        rows = await db.nexus_fees.find({"institution_id": institution_id}, {"_id": 0}).to_list(500)
        today = date.today().isoformat()
        total_billed = 0.0
        total_collected = 0.0
        overdue = 0
        for r in rows:
            total_billed += r.get("amount", 0)
            total_collected += r.get("paid", 0)
            if r.get("status") != "paid" and r.get("due_date", "9999-12-31") < today:
                overdue += 1
                r["status"] = "overdue"  # transient display flag
        return {
            "rows": rows,
            "summary": {
                "total_billed": round(total_billed, 2),
                "total_collected": round(total_collected, 2),
                "outstanding": round(total_billed - total_collected, 2),
                "overdue": overdue,
                "collection_pct": round((total_collected / total_billed) * 100, 1) if total_billed else 0.0,
            },
        }

    @router.post("/{institution_id}/fees/{fee_id}/pay")
    async def pay_fee(
        institution_id: str,
        fee_id: str,
        payload: FeePayment,
        user: dict = Depends(get_current_user),
    ):
        _guard(user, institution_id)
        db = get_db()
        row = await db.nexus_fees.find_one({"id": fee_id, "institution_id": institution_id}, {"_id": 0})
        if not row:
            raise HTTPException(status_code=404, detail="Fee not found")
        new_paid = round((row.get("paid") or 0) + payload.amount, 2)
        status = "paid" if new_paid >= row["amount"] else "partial"
        payment = {"amount": payload.amount, "method": payload.method, "ref": payload.ref,
                   "by": user["email"], "ts": _now()}
        await db.nexus_fees.update_one(
            {"id": fee_id, "institution_id": institution_id},
            {"$set": {"paid": new_paid, "status": status}, "$push": {"payments": payment}}
        )
        await _audit(db, institution_id, user["email"], "nexus.fee.pay", fee_id,
                     {"amount": payload.amount, "method": payload.method, "new_status": status})
        return {"ok": True, "paid": new_paid, "status": status}

    # ---------------- CERTIFICATES ----------------
    @router.post("/{institution_id}/certificates")
    async def issue_cert(
        institution_id: str,
        payload: CertIssue,
        user: dict = Depends(get_current_user),
    ):
        _guard(user, institution_id)
        if user["role"] not in ("super_admin", "institution_admin", "registrar"):
            raise HTTPException(status_code=403, detail="Registrar role required")
        db = get_db()
        verify_code = uuid4().hex[:12].upper()
        doc = {
            "id": f"crt-{uuid4().hex[:10]}",
            "institution_id": institution_id,
            **payload.model_dump(),
            "verify_code": verify_code,
            "issued_by": user["email"],
            "issued_at": _now(),
            "status": "issued",
        }
        await db.nexus_certificates.insert_one(doc)
        doc.pop("_id", None)
        await _audit(db, institution_id, user["email"], "nexus.certificate.issue", doc["id"],
                     {"type": payload.cert_type, "student": payload.student_name})
        return doc

    @router.get("/{institution_id}/certificates")
    async def list_certs(institution_id: str, user: dict = Depends(get_current_user)):
        _guard(user, institution_id)
        db = get_db()
        rows = await db.nexus_certificates.find(
            {"institution_id": institution_id}, {"_id": 0}
        ).sort("issued_at", -1).to_list(500)
        return rows

    @router.get("/verify/{code}")
    async def verify(code: str):
        # Public endpoint — verify a certificate authenticity by code
        # (no auth so a recruiter can check). Returns minimal info.
        db = get_db()
        row = await db.nexus_certificates.find_one({"verify_code": code.upper()}, {"_id": 0})
        if not row:
            raise HTTPException(status_code=404, detail="Certificate not found")
        return {
            "valid": True,
            "student_name": row["student_name"],
            "cert_type": row["cert_type"],
            "issued_at": row["issued_at"],
            "verify_code": row["verify_code"],
        }

    return router
