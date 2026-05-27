"""
AcademiaOS Backend API tests — Phase 1 + 2
Covers: health, auth, institutions, academic structure, users, roles, dashboard, multi-tenant scoping
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-academy-phase.preview.emergentagent.com").rstrip("/")

ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"
UOB_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, email, password):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def super_token(session):
    return _login(session, "admin@academiaos.ai", "Admin@2026")


@pytest.fixture(scope="session")
def isb_token(session):
    return _login(session, "rajiv.admin@isb.edu", "Demo@2026")


@pytest.fixture(scope="session")
def eaic_token(session):
    return _login(session, "khalid.exec@eaic.gov.ae", "Demo@2026")


@pytest.fixture(scope="session")
def uob_token(session):
    return _login(session, "emma.admin@bradford.ac.uk", "Demo@2026")


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- Health ----------
def test_root_health(session):
    r = session.get(f"{BASE_URL}/api/", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body.get("app") == "AcademiaOS"


# ---------- Auth ----------
def test_login_super_admin(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": "admin@academiaos.ai", "password": "Admin@2026"}, timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body and isinstance(body["access_token"], str) and len(body["access_token"]) > 10
    assert body["user"]["role"] == "super_admin"
    assert body["user"]["email"] == "admin@academiaos.ai"
    assert "password_hash" not in body["user"]


def test_login_invalid(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": "admin@academiaos.ai", "password": "wrong"}, timeout=20)
    assert r.status_code == 401


def test_auth_me_with_token(session, super_token):
    r = session.get(f"{BASE_URL}/api/auth/me", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    assert r.json()["email"] == "admin@academiaos.ai"


def test_auth_me_without_token(session):
    r = requests.get(f"{BASE_URL}/api/auth/me", timeout=20)
    assert r.status_code == 401


# ---------- Institutions ----------
def test_super_admin_sees_all_institutions(session, super_token):
    r = session.get(f"{BASE_URL}/api/institutions", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 3
    short_names = {i["short_name"] for i in items}
    assert short_names == {"ISB", "EAIC", "UoB"}


def test_institution_admin_sees_only_own(session, isb_token):
    r = session.get(f"{BASE_URL}/api/institutions", headers=hdr(isb_token), timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["id"] == ISB_ID


def test_get_institution_detail(session, super_token):
    r = session.get(f"{BASE_URL}/api/institutions/{ISB_ID}", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == ISB_ID
    assert body["theme_key"] == "isb-theme"
    for k in ("primary", "accent", "background", "border", "ring"):
        assert k in body["theme"]


# ---------- Academic ----------
def test_isb_programmes_count(session, super_token):
    r = session.get(f"{BASE_URL}/api/academic/{ISB_ID}/programmes", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    assert len(r.json()) == 6


def test_isb_courses_count(session, super_token):
    r = session.get(f"{BASE_URL}/api/academic/{ISB_ID}/courses", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    assert len(r.json()) == 8


def test_isb_campuses_count(session, super_token):
    r = session.get(f"{BASE_URL}/api/academic/{ISB_ID}/campuses", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 2
    cities = {c["city"] for c in items}
    assert cities == {"Hyderabad", "Mohali"}


def test_eaic_programmes_count(session, super_token):
    r = session.get(f"{BASE_URL}/api/academic/{EAIC_ID}/programmes", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    assert len(r.json()) == 8


def test_create_programme_and_persist(session, super_token):
    pid = f"TEST-prog-{uuid.uuid4()}"
    payload = {
        "id": pid,
        "institution_id": ISB_ID,
        "name": "TEST Programme",
        "code": "TEST",
        "duration": "6 months",
        "department_id": "isb-dept-1",
        "enrolled": 10,
        "completion_rate": 0.0,
    }
    r = session.post(f"{BASE_URL}/api/academic/{ISB_ID}/programmes",
                     headers=hdr(super_token), json=payload, timeout=20)
    assert r.status_code == 200
    # GET to verify persistence
    r2 = session.get(f"{BASE_URL}/api/academic/{ISB_ID}/programmes",
                     headers=hdr(super_token), timeout=20)
    assert any(p["id"] == pid for p in r2.json())
    # cleanup
    session.delete(f"{BASE_URL}/api/academic/{ISB_ID}/programmes/{pid}",
                   headers=hdr(super_token), timeout=20)


def test_cross_tenant_forbidden(session, isb_token):
    r = session.get(f"{BASE_URL}/api/academic/{EAIC_ID}/programmes",
                    headers=hdr(isb_token), timeout=20)
    assert r.status_code == 403


# ---------- Users & Roles ----------
def test_isb_users_count(session, super_token):
    r = session.get(f"{BASE_URL}/api/users/{ISB_ID}", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 4
    for u in items:
        assert "password_hash" not in u


def test_roles_count(session, super_token):
    r = session.get(f"{BASE_URL}/api/roles", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    assert len(r.json()) == 15


# ---------- Dashboard ----------
def test_dashboard_isb(session, super_token):
    r = session.get(f"{BASE_URL}/api/dashboard/{ISB_ID}", headers=hdr(super_token), timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body["institution"]["id"] == ISB_ID
    assert "counts" in body and "metrics" in body
    assert body["counts"]["programmes"] >= 6
    assert body["counts"]["users"] >= 4
    assert body["metrics"].get("students") == 920


def test_dashboard_cross_tenant_forbidden(session, isb_token):
    r = session.get(f"{BASE_URL}/api/dashboard/{EAIC_ID}", headers=hdr(isb_token), timeout=20)
    assert r.status_code == 403
