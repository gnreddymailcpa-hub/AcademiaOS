"""
AcademiaOS.ai - Backend (Phase 1 + 2)
FastAPI + MongoDB + JWT auth + multi-tenant academic configuration
"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("academiaos")

# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="AcademiaOS API", version="0.1.0")
api = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 7  # 7 days for demo


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str, institution_id: Optional[str]) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "institution_id": institution_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token: Optional[str] = None
    if creds and creds.credentials:
        token = creds.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    institution_id: Optional[str] = None
    avatar_url: Optional[str] = None
    title: Optional[str] = None


class InstitutionTheme(BaseModel):
    primary: str
    primary_foreground: str = "hsl(0, 0%, 100%)"
    accent: str
    accent_foreground: str = "hsl(222.2, 47.4%, 11.2%)"
    background: str
    surface: str = "hsl(0, 0%, 100%)"
    border: str
    ring: str


class Institution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    short_name: str
    type: str  # University | Business School | Government Academy | Corporate Academy | Online Education
    country: str
    primary_language: str
    secondary_language: Optional[str] = None
    locale_arabic_enabled: bool = False
    timezone: str = "UTC"
    data_residency: Optional[str] = None
    compliance_framework: Optional[str] = None
    logo_url: Optional[str] = None
    theme_key: str  # 'isb-theme' | 'eaic-theme' | 'bradford-theme' | custom
    theme: InstitutionTheme
    description: Optional[str] = None
    metrics: dict = Field(default_factory=dict)  # high-level dashboard metrics
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Campus(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    institution_id: str
    name: str
    city: str
    country: str


class Department(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    institution_id: str
    name: str
    head: Optional[str] = None


class Programme(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    institution_id: str
    name: str
    code: str
    duration: str
    department_id: Optional[str] = None
    enrolled: int = 0
    completion_rate: float = 0.0


class Course(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    institution_id: str
    programme_id: str
    code: str
    title: str
    credits: int = 3
    faculty: Optional[str] = None
    modules: int = 0


class Module(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    institution_id: str
    course_id: str
    title: str
    week: int
    duration_hours: int = 2


class Cohort(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    institution_id: str
    programme_id: str
    name: str
    start_date: str
    end_date: str
    size: int


class RoleDef(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    institution_id: Optional[str] = None  # null = global role
    key: str
    name: str
    scope: str  # global | institution | programme | course
    category: str  # platform | academic | government | corporate
    permissions: List[str]
    description: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def doc_clean(d: dict) -> dict:
    if not d:
        return d
    d.pop("_id", None)
    return d


def docs_clean(items: List[dict]) -> List[dict]:
    return [doc_clean(x) for x in items]


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"], user["role"], user.get("institution_id"))
    user_pub = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return TokenResponse(access_token=token, user=user_pub)


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------------------------------------------------------------------------
# Emergent-managed Google Auth (SSO)
# ---------------------------------------------------------------------------
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import httpx


class GoogleSessionRequest(BaseModel):
    session_id: Optional[str] = None


@api.post("/auth/session", response_model=TokenResponse)
async def google_session(
    request: Request,
    body: Optional[GoogleSessionRequest] = None,
):
    """Exchange an Emergent OAuth session_id for our app JWT.

    Accepts the session_id either as request body `{session_id}` or as
    `X-Session-ID` header. Looks up the Google account, maps it to an
    existing demo user by email (multi-tenant SaaS — Google login only
    works for emails pre-provisioned by an Institution Admin).
    """
    sid = (body.session_id if body else None) or request.headers.get("X-Session-ID")
    if not sid:
        raise HTTPException(400, "Missing session_id")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": sid},
            )
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.exception("Emergent OAuth exchange failed: %s", e)
        raise HTTPException(401, "Google authentication failed")

    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(401, "Google account has no email")
    name = data.get("name") or email.split("@")[0].title()
    picture = data.get("picture")
    emergent_token = data.get("session_token")

    # Only allow pre-provisioned users; do NOT auto-create tenants from random Google accounts.
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(
            403,
            "This Google account is not provisioned for any tenant. "
            "Ask an Institution Admin to invite this email first.",
        )
    # update picture / name on first Google login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"picture": picture, "auth_provider": "google", "google_id": data.get("id")}},
    )
    await db.user_sessions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "emergent_session_token": emergent_token,
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    })

    token = create_token(user["id"], user["email"], user["role"], user.get("institution_id"))
    user_pub = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    user_pub["picture"] = picture

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "institution_id": user.get("institution_id"),
        "action": "auth.google_login",
        "target": user["id"],
        "actor": email,
        "ts": datetime.now(timezone.utc).isoformat(),
    })

    from fastapi.responses import JSONResponse
    resp = JSONResponse(content={"access_token": token, "user": user_pub})
    resp.set_cookie(
        "access_token", token, max_age=7 * 24 * 3600, httponly=True,
        secure=True, samesite="none", path="/",
    )
    return resp


# ---------------------------------------------------------------------------
# Admin → Integrations (per-tenant email/webhook config)
# ---------------------------------------------------------------------------
@api.get("/integrations/{institution_id}")
async def get_integrations(institution_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ("super_admin", "institution_admin"):
        raise HTTPException(403, "Forbidden")
    if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
        raise HTTPException(403, "Forbidden")
    doc = await db.tenant_integrations.find_one({"institution_id": institution_id}, {"_id": 0}) or {
        "institution_id": institution_id, "email": None, "webhook": None,
    }
    # Mask API keys in the response
    email_cfg = doc.get("email") or {}
    if email_cfg.get("api_key"):
        k = email_cfg["api_key"]
        email_cfg["api_key_masked"] = f"…{k[-6:]}" if len(k) > 6 else "set"
        email_cfg["api_key"] = None
        doc["email"] = email_cfg
    return doc


class EmailConfig(BaseModel):
    provider: Literal["resend", "smtp", "none"] = "resend"
    api_key: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    enabled: bool = False


@api.patch("/integrations/{institution_id}/email")
async def update_email_integration(
    institution_id: str,
    payload: EmailConfig,
    user: dict = Depends(get_current_user),
):
    if user["role"] not in ("super_admin", "institution_admin"):
        raise HTTPException(403, "Forbidden")
    if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
        raise HTTPException(403, "Forbidden")
    update = {"email": payload.model_dump(exclude_none=False)}
    # never overwrite stored key with a blank/null
    existing = await db.tenant_integrations.find_one({"institution_id": institution_id}) or {}
    existing_key = (existing.get("email") or {}).get("api_key")
    if not payload.api_key and existing_key:
        update["email"]["api_key"] = existing_key
    await db.tenant_integrations.update_one(
        {"institution_id": institution_id},
        {"$set": {**update, "institution_id": institution_id}},
        upsert=True,
    )
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "institution_id": institution_id,
        "action": "integrations.email.update",
        "target": institution_id,
        "actor": user["email"],
        "enabled": payload.enabled,
        "provider": payload.provider,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api.post("/integrations/{institution_id}/email/test")
async def test_email(
    institution_id: str,
    payload: dict = None,
    user: dict = Depends(get_current_user),
):
    if user["role"] not in ("super_admin", "institution_admin"):
        raise HTTPException(403, "Forbidden")
    if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
        raise HTTPException(403, "Forbidden")
    to = (payload or {}).get("to") or user["email"]
    from email_service import send_email
    ok, err = await send_email(
        db, institution_id, to,
        subject="AcademiaOS · Email integration test",
        text="If you see this, your tenant email integration is configured correctly.",
    )
    return {"ok": ok, "error": err}


# ---------------------------------------------------------------------------
# Institution routes
# ---------------------------------------------------------------------------
@api.get("/institutions")
async def list_institutions(user: dict = Depends(get_current_user)):
    items = await db.institutions.find({}, {"_id": 0}).to_list(100)
    # Super admin sees all; others see only their institution
    if user["role"] != "super_admin":
        items = [i for i in items if i["id"] == user.get("institution_id")]
    return items


@api.get("/institutions/{institution_id}")
async def get_institution(institution_id: str, user: dict = Depends(get_current_user)):
    inst = await db.institutions.find_one({"id": institution_id}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Institution not found")
    if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
        raise HTTPException(403, "Forbidden")
    return inst


@api.post("/institutions")
async def create_institution(payload: Institution, user: dict = Depends(get_current_user)):
    if user["role"] not in ("super_admin", "institution_admin"):
        raise HTTPException(403, "Forbidden")
    doc = payload.model_dump()
    doc["created_at"] = doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"]
    await db.institutions.insert_one(doc)
    return doc_clean(doc)


@api.patch("/institutions/{institution_id}")
async def update_institution(institution_id: str, payload: dict, user: dict = Depends(get_current_user)):
    if user["role"] not in ("super_admin", "institution_admin"):
        raise HTTPException(403, "Forbidden")
    if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
        raise HTTPException(403, "Forbidden")
    payload.pop("id", None)
    payload.pop("_id", None)
    res = await db.institutions.update_one({"id": institution_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Institution not found")
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "institution_id": institution_id,
        "action": "institution.update",
        "target": institution_id,
        "actor": user["email"],
        "changes": list(payload.keys()),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    inst = await db.institutions.find_one({"id": institution_id}, {"_id": 0})
    return inst


# ---------------------------------------------------------------------------
# Academic structure routes
# ---------------------------------------------------------------------------
async def _scoped_query(user: dict, institution_id: str) -> dict:
    if user["role"] != "super_admin" and user.get("institution_id") != institution_id:
        raise HTTPException(403, "Forbidden")
    return {"institution_id": institution_id}


async def _audit_academic(
    institution_id: str, action: str, target: str, actor: str, **extra
):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "institution_id": institution_id,
        "action": action,
        "target": target,
        "actor": actor,
        "ts": datetime.now(timezone.utc).isoformat(),
        **extra,
    })


# ---- Campuses ----
@api.get("/academic/{institution_id}/campuses")
async def list_campuses(institution_id: str, user: dict = Depends(get_current_user)):
    q = await _scoped_query(user, institution_id)
    return docs_clean(await db.campuses.find(q, {"_id": 0}).to_list(500))


@api.post("/academic/{institution_id}/campuses")
async def create_campus(institution_id: str, payload: Campus, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.institution_id = institution_id
    doc = payload.model_dump()
    await db.campuses.insert_one(doc)
    await _audit_academic(institution_id, "academic.campus.create", doc["id"], user["email"], name=doc["name"])
    return doc_clean(doc)


@api.patch("/academic/{institution_id}/campuses/{campus_id}")
async def update_campus(institution_id: str, campus_id: str, payload: dict, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.pop("id", None); payload.pop("_id", None); payload.pop("institution_id", None)
    res = await db.campuses.update_one({"id": campus_id, "institution_id": institution_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Campus not found")
    await _audit_academic(institution_id, "academic.campus.update", campus_id, user["email"], changes=payload)
    return await db.campuses.find_one({"id": campus_id}, {"_id": 0})


@api.delete("/academic/{institution_id}/campuses/{campus_id}")
async def delete_campus(institution_id: str, campus_id: str, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    res = await db.campuses.delete_one({"id": campus_id, "institution_id": institution_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Campus not found")
    await _audit_academic(institution_id, "academic.campus.delete", campus_id, user["email"])
    return {"ok": True}


# ---- Departments ----
@api.get("/academic/{institution_id}/departments")
async def list_departments(institution_id: str, user: dict = Depends(get_current_user)):
    q = await _scoped_query(user, institution_id)
    return docs_clean(await db.departments.find(q, {"_id": 0}).to_list(500))


@api.post("/academic/{institution_id}/departments")
async def create_department(institution_id: str, payload: Department, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.institution_id = institution_id
    doc = payload.model_dump()
    await db.departments.insert_one(doc)
    await _audit_academic(institution_id, "academic.department.create", doc["id"], user["email"], name=doc["name"])
    return doc_clean(doc)


@api.patch("/academic/{institution_id}/departments/{department_id}")
async def update_department(institution_id: str, department_id: str, payload: dict, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.pop("id", None); payload.pop("_id", None); payload.pop("institution_id", None)
    res = await db.departments.update_one({"id": department_id, "institution_id": institution_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Department not found")
    await _audit_academic(institution_id, "academic.department.update", department_id, user["email"], changes=payload)
    return await db.departments.find_one({"id": department_id}, {"_id": 0})


@api.delete("/academic/{institution_id}/departments/{department_id}")
async def delete_department(institution_id: str, department_id: str, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    res = await db.departments.delete_one({"id": department_id, "institution_id": institution_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Department not found")
    await _audit_academic(institution_id, "academic.department.delete", department_id, user["email"])
    return {"ok": True}


# ---- Programmes ----
@api.get("/academic/{institution_id}/programmes")
async def list_programmes(institution_id: str, user: dict = Depends(get_current_user)):
    q = await _scoped_query(user, institution_id)
    return docs_clean(await db.programmes.find(q, {"_id": 0}).to_list(500))


@api.post("/academic/{institution_id}/programmes")
async def create_programme(institution_id: str, payload: Programme, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.institution_id = institution_id
    doc = payload.model_dump()
    await db.programmes.insert_one(doc)
    await _audit_academic(institution_id, "academic.programme.create", doc["id"], user["email"], name=doc["name"])
    return doc_clean(doc)


@api.patch("/academic/{institution_id}/programmes/{programme_id}")
async def update_programme(institution_id: str, programme_id: str, payload: dict, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.pop("id", None); payload.pop("_id", None); payload.pop("institution_id", None)
    res = await db.programmes.update_one({"id": programme_id, "institution_id": institution_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Programme not found")
    await _audit_academic(institution_id, "academic.programme.update", programme_id, user["email"], changes=payload)
    return await db.programmes.find_one({"id": programme_id}, {"_id": 0})


@api.delete("/academic/{institution_id}/programmes/{programme_id}")
async def delete_programme(institution_id: str, programme_id: str, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    res = await db.programmes.delete_one({"id": programme_id, "institution_id": institution_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Programme not found")
    await _audit_academic(institution_id, "academic.programme.delete", programme_id, user["email"])
    return {"ok": True}


# ---- Courses ----
@api.get("/academic/{institution_id}/courses")
async def list_courses(institution_id: str, user: dict = Depends(get_current_user)):
    q = await _scoped_query(user, institution_id)
    return docs_clean(await db.courses.find(q, {"_id": 0}).to_list(1000))


@api.post("/academic/{institution_id}/courses")
async def create_course(institution_id: str, payload: Course, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.institution_id = institution_id
    doc = payload.model_dump()
    await db.courses.insert_one(doc)
    await _audit_academic(institution_id, "academic.course.create", doc["id"], user["email"], title=doc["title"])
    return doc_clean(doc)


@api.patch("/academic/{institution_id}/courses/{course_id}")
async def update_course(institution_id: str, course_id: str, payload: dict, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.pop("id", None); payload.pop("_id", None); payload.pop("institution_id", None)
    res = await db.courses.update_one({"id": course_id, "institution_id": institution_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Course not found")
    await _audit_academic(institution_id, "academic.course.update", course_id, user["email"], changes=payload)
    return await db.courses.find_one({"id": course_id}, {"_id": 0})


@api.delete("/academic/{institution_id}/courses/{course_id}")
async def delete_course(institution_id: str, course_id: str, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    res = await db.courses.delete_one({"id": course_id, "institution_id": institution_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Course not found")
    await _audit_academic(institution_id, "academic.course.delete", course_id, user["email"])
    return {"ok": True}


# ---- Cohorts ----
@api.get("/academic/{institution_id}/cohorts")
async def list_cohorts(institution_id: str, user: dict = Depends(get_current_user)):
    q = await _scoped_query(user, institution_id)
    return docs_clean(await db.cohorts.find(q, {"_id": 0}).to_list(500))


@api.post("/academic/{institution_id}/cohorts")
async def create_cohort(institution_id: str, payload: Cohort, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.institution_id = institution_id
    doc = payload.model_dump()
    await db.cohorts.insert_one(doc)
    await _audit_academic(institution_id, "academic.cohort.create", doc["id"], user["email"], name=doc["name"])
    return doc_clean(doc)


@api.patch("/academic/{institution_id}/cohorts/{cohort_id}")
async def update_cohort(institution_id: str, cohort_id: str, payload: dict, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    payload.pop("id", None); payload.pop("_id", None); payload.pop("institution_id", None)
    res = await db.cohorts.update_one({"id": cohort_id, "institution_id": institution_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Cohort not found")
    await _audit_academic(institution_id, "academic.cohort.update", cohort_id, user["email"], changes=payload)
    return await db.cohorts.find_one({"id": cohort_id}, {"_id": 0})


@api.delete("/academic/{institution_id}/cohorts/{cohort_id}")
async def delete_cohort(institution_id: str, cohort_id: str, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    res = await db.cohorts.delete_one({"id": cohort_id, "institution_id": institution_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Cohort not found")
    await _audit_academic(institution_id, "academic.cohort.delete", cohort_id, user["email"])
    return {"ok": True}


# ---------------------------------------------------------------------------
# Users & roles
# ---------------------------------------------------------------------------
@api.get("/users/{institution_id}")
async def list_users(institution_id: str, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    items = await db.users.find(
        {"institution_id": institution_id}, {"_id": 0, "password_hash": 0}
    ).to_list(2000)
    return items


@api.get("/roles")
async def list_roles(user: dict = Depends(get_current_user)):
    items = await db.roles.find({}, {"_id": 0}).to_list(100)
    return items


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------
@api.get("/dashboard/{institution_id}")
async def dashboard(institution_id: str, user: dict = Depends(get_current_user)):
    await _scoped_query(user, institution_id)
    inst = await db.institutions.find_one({"id": institution_id}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Institution not found")
    programmes = await db.programmes.count_documents({"institution_id": institution_id})
    courses = await db.courses.count_documents({"institution_id": institution_id})
    users_count = await db.users.count_documents({"institution_id": institution_id})
    return {
        "institution": inst,
        "counts": {
            "programmes": programmes,
            "courses": courses,
            "users": users_count,
        },
        "metrics": inst.get("metrics", {}),
    }


@api.get("/")
async def root():
    return {"app": "AcademiaOS", "version": "0.1.0", "status": "ok"}


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------
from seed_data import SEED_INSTITUTIONS, SEED_USERS, SEED_ROLES, SEED_ACADEMIC
from seed_ai import SEED_USE_CASES, SEED_DOCUMENTS, SEED_SKILL_FRAMEWORK, SEED_LEARNER_PROFILES
from seed_phase4 import SEED_ASSESSMENTS, SEED_PSYCH_RULES, SEED_PSYCH_EVENTS
from seed_phase6 import SEED_WORKFLOW_TEMPLATES, SEED_WORKFLOW_RUNS
import routes_ai
import routes_assessments
import routes_psychometrics
import routes_analytics
import routes_workflows
import routes_messaging
import routes_modules
import routes_admissions
import routes_nexus
import routes_compass
import routes_pathfinder
import routes_command
import routes_illuminate
import routes_prism
import routes_alumni
import routes_faculty
import routes_guardian
import routes_greeniq
import routes_exec
import routes_phase1_complete
import routes_phase2_complete
from collections import Counter
from ai_service import chunk_text, _tokens


async def seed_database():
    """Idempotent seeding of institutions, users, roles, and academic structure."""
    # Institutions
    for inst in SEED_INSTITUTIONS:
        existing = await db.institutions.find_one({"id": inst["id"]})
        if not existing:
            doc = dict(inst)
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.institutions.insert_one(doc)
            logger.info("Seeded institution %s", inst["short_name"])
        else:
            # Backfill new fields added in later releases (idempotent)
            backfill = {}
            if "locale_arabic_enabled" not in existing:
                backfill["locale_arabic_enabled"] = inst.get("locale_arabic_enabled", False)
            if backfill:
                await db.institutions.update_one({"id": inst["id"]}, {"$set": backfill})
                logger.info("Backfilled %s on %s", list(backfill), inst["short_name"])

    # Roles
    for r in SEED_ROLES:
        existing = await db.roles.find_one({"key": r["key"]})
        if not existing:
            await db.roles.insert_one(dict(r))
    logger.info("Seeded %d roles", len(SEED_ROLES))

    # Users (including admin)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@academiaos.ai").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@2026")
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "email": admin_email,
                "name": "Platform Super Admin",
                "title": "Super Administrator",
                "role": "super_admin",
                "institution_id": None,
                "avatar_url": None,
                "password_hash": hash_password(admin_password),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        logger.info("Seeded super admin %s", admin_email)
    else:
        # ensure password matches env
        if not verify_password(admin_password, existing_admin.get("password_hash", "")):
            await db.users.update_one(
                {"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}}
            )

    for u in SEED_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            doc = dict(u)
            doc["password_hash"] = hash_password(u["password"])
            doc.pop("password", None)
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.users.insert_one(doc)
        else:
            # keep demo password fresh
            await db.users.update_one(
                {"email": u["email"]}, {"$set": {"password_hash": hash_password(u["password"])}}
            )
    logger.info("Seeded %d demo users", len(SEED_USERS))

    # Academic structure
    for inst_id, payload in SEED_ACADEMIC.items():
        for c in payload.get("campuses", []):
            await db.campuses.update_one({"id": c["id"]}, {"$set": c}, upsert=True)
        for d in payload.get("departments", []):
            await db.departments.update_one({"id": d["id"]}, {"$set": d}, upsert=True)
        for p in payload.get("programmes", []):
            await db.programmes.update_one({"id": p["id"]}, {"$set": p}, upsert=True)
        for c in payload.get("courses", []):
            await db.courses.update_one({"id": c["id"]}, {"$set": c}, upsert=True)
        for co in payload.get("cohorts", []):
            await db.cohorts.update_one({"id": co["id"]}, {"$set": co}, upsert=True)
    logger.info("Seeded academic structure for %d institutions", len(SEED_ACADEMIC))

    # AI Use Cases
    for inst_id, ucs in SEED_USE_CASES.items():
        for uc in ucs:
            await db.ai_use_cases.update_one(
                {"institution_id": inst_id, "key": uc["key"]},
                {"$setOnInsert": {**uc, "institution_id": inst_id}},
                upsert=True,
            )
    logger.info("Seeded AI use cases for %d institutions", len(SEED_USE_CASES))

    # Approved knowledge docs + chunked for RAG
    for doc in SEED_DOCUMENTS:
        existing = await db.content_sources.find_one({"id": doc["id"]})
        d = {**doc, "uploaded_at": datetime.now(timezone.utc).isoformat()}
        if not existing:
            await db.content_sources.insert_one(d)
            # chunk + index
            chunks = chunk_text(doc["text"])
            if chunks:
                await db.content_chunks.delete_many({"source_id": doc["id"]})
                await db.content_chunks.insert_many([
                    {
                        "id": str(uuid.uuid4()),
                        "source_id": doc["id"],
                        "institution_id": doc["institution_id"],
                        "course_id": doc.get("course_id"),
                        "title": doc["title"],
                        "ordinal": i,
                        "text": c,
                        "tokens": dict(Counter(_tokens(c))),
                        "approved": True,
                    }
                    for i, c in enumerate(chunks)
                ])
    logger.info("Seeded %d knowledge documents", len(SEED_DOCUMENTS))

    # Platform module status — pre-activate ALL Phase-1, 2, 3 modules for
    # VCE (the showcase tenant). Other tenants fall back to catalog
    # default_status (all 12 active by default post-Phase 18).
    from routes_modules import PLATFORM_CATALOG  # local import to avoid cycles
    from seed_data import VCE_ID
    all_codes = [p["code"] for p in PLATFORM_CATALOG]
    for code in all_codes:
        await db.platform_modules.update_one(
            {"institution_id": VCE_ID, "code": code},
            {"$setOnInsert": {
                "institution_id": VCE_ID,
                "code": code,
                "status": "active",
                "configured_at": datetime.now(timezone.utc).isoformat(),
                "configured_by": "seed@academiaos.ai",
            }},
            upsert=True,
        )
    logger.info("Seeded VCE all 12 modules: %s", all_codes)

    # Phase-2 cross-platform demo data — diverse alumni, PRISM pubs,
    # placement drives, GREENIQ energy readings. Idempotent.
    from seed_phase2 import seed_phase2_demo
    await seed_phase2_demo(db, VCE_ID, logger)

    # Skill frameworks
    for inst_id, fw in SEED_SKILL_FRAMEWORK.items():
        await db.skill_frameworks.update_one(
            {"institution_id": inst_id},
            {"$set": {"institution_id": inst_id, "target_roles": fw["target_roles"]}},
            upsert=True,
        )

    # Learner profiles
    for p in SEED_LEARNER_PROFILES:
        await db.learner_profiles.update_one(
            {"institution_id": p["institution_id"], "user_id": p["user_id"]},
            {"$set": p}, upsert=True,
        )
    logger.info("Seeded skill frameworks + %d learner profiles", len(SEED_LEARNER_PROFILES))

    # Assessments + item bank
    for a in SEED_ASSESSMENTS:
        items = a.pop("_items", [])
        await db.assessments.update_one({"id": a["id"]}, {"$setOnInsert": a}, upsert=True)
        for it in items:
            doc = {**it, "assessment_id": a["id"], "institution_id": a["institution_id"]}
            await db.assessment_items.update_one({"id": it["id"]}, {"$setOnInsert": doc}, upsert=True)
    logger.info("Seeded %d assessments with item bank", len(SEED_ASSESSMENTS))

    # Psychometric rules + sample events
    for r in SEED_PSYCH_RULES:
        await db.psychometric_rules.update_one({"id": r["id"]}, {"$setOnInsert": r}, upsert=True)
    for e in SEED_PSYCH_EVENTS:
        await db.psychometric_events.update_one({"id": e["id"]}, {"$setOnInsert": e}, upsert=True)
    logger.info("Seeded %d psychometric rules + %d events", len(SEED_PSYCH_RULES), len(SEED_PSYCH_EVENTS))

    # Workflow templates (Phase 6) — idempotent on id
    for t in SEED_WORKFLOW_TEMPLATES:
        await db.workflow_templates.update_one(
            {"id": t["id"]}, {"$set": t}, upsert=True,
        )
    # Workflow runs (Phase 6) — only on first seed (preserve user state)
    for r in SEED_WORKFLOW_RUNS:
        await db.workflow_runs.update_one(
            {"id": r["id"]}, {"$setOnInsert": r}, upsert=True,
        )
    logger.info("Seeded %d workflow templates + %d sample runs",
                len(SEED_WORKFLOW_TEMPLATES), len(SEED_WORKFLOW_RUNS))


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.institutions.create_index("id", unique=True)
    await db.programmes.create_index("id", unique=True)
    await db.courses.create_index("id", unique=True)
    try:
        await seed_database()
    except Exception as e:
        logger.exception("Seeding failed: %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------------------------------------------------------------------------
# Mount + CORS
# ---------------------------------------------------------------------------
app.include_router(api)
app.include_router(routes_ai.build_router(lambda: db, get_current_user))
app.include_router(routes_assessments.build_assessments_router(lambda: db, get_current_user))
app.include_router(routes_psychometrics.build_psychometrics_router(lambda: db, get_current_user))
app.include_router(routes_analytics.build_analytics_router(lambda: db, get_current_user))
app.include_router(routes_workflows.build_workflows_router(lambda: db, get_current_user))
app.include_router(routes_workflows.build_audit_router(lambda: db, get_current_user))
app.include_router(routes_messaging.build_notifications_router(lambda: db, get_current_user))
app.include_router(routes_messaging.build_tickets_router(lambda: db, get_current_user))
app.include_router(routes_modules.build_modules_router(lambda: db, get_current_user))
app.include_router(routes_admissions.build_admissions_router(lambda: db, get_current_user))
app.include_router(routes_nexus.build_nexus_router(lambda: db, get_current_user))
app.include_router(routes_compass.build_compass_router(lambda: db, get_current_user))
app.include_router(routes_pathfinder.build_pathfinder_router(lambda: db, get_current_user))
app.include_router(routes_command.build_command_router(lambda: db, get_current_user))
app.include_router(routes_illuminate.build_illuminate_router(lambda: db, get_current_user))
app.include_router(routes_prism.build_prism_router(lambda: db, get_current_user))
app.include_router(routes_alumni.build_alumni_router(lambda: db, get_current_user))
app.include_router(routes_faculty.build_faculty_router(lambda: db, get_current_user))
app.include_router(routes_guardian.build_guardian_router(lambda: db, get_current_user))
app.include_router(routes_greeniq.build_greeniq_router(lambda: db, get_current_user))
app.include_router(routes_exec.build_exec_router(lambda: db, get_current_user))
app.include_router(routes_phase1_complete.build_phase1_router(lambda: db, get_current_user))
app.include_router(routes_phase2_complete.build_phase2_router(lambda: db, get_current_user))
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
