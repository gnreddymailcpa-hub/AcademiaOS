"""
Seed data for 3 demo institutions: ISB India, EAIC UAE, University of Bradford UK.
All IDs are deterministic UUIDs so seed is idempotent.
"""
import uuid

ISB_ID = "11111111-1111-1111-1111-111111111111"
EAIC_ID = "22222222-2222-2222-2222-222222222222"
UOB_ID = "33333333-3333-3333-3333-333333333333"


SEED_INSTITUTIONS = [
    {
        "id": ISB_ID,
        "name": "Indian School of Business",
        "short_name": "ISB",
        "type": "Business School",
        "country": "India",
        "primary_language": "en",
        "secondary_language": "hi",
        "timezone": "Asia/Kolkata",
        "data_residency": "India",
        "compliance_framework": "AACSB · EQUIS · AMBA",
        "logo_url": "https://static.prod-images.emergentagent.com/jobs/3df0a28a-599b-41d8-ba79-c6c0851c9972/images/3889659f819e3f109dfa63f668810352e589b0135b1dd36a854afc887d487ef1.png",
        "theme_key": "isb-theme",
        "theme": {
            "primary": "hsl(222.2, 47.4%, 11.2%)",
            "primary_foreground": "hsl(210, 40%, 98%)",
            "accent": "hsl(43, 74%, 49%)",
            "accent_foreground": "hsl(222.2, 47.4%, 11.2%)",
            "background": "hsl(220, 14%, 96%)",
            "surface": "hsl(0, 0%, 100%)",
            "border": "hsl(214.3, 31.8%, 91.4%)",
            "ring": "hsl(222.2, 47.4%, 11.2%)",
        },
        "description": "India's premier business school — Hyderabad and Mohali campuses.",
        "metrics": {
            "students": 920,
            "programmes": 6,
            "courses": 42,
            "faculty": 85,
            "completion_rate": 87,
            "at_risk": 34,
            "ai_sessions": 2480,
            "workforce_readiness": 89,
        },
    },
    {
        "id": EAIC_ID,
        "name": "Emirates Academy for Identity and Citizenship",
        "short_name": "EAIC",
        "type": "Government Academy",
        "country": "United Arab Emirates",
        "primary_language": "ar",
        "secondary_language": "en",
        "timezone": "Asia/Dubai",
        "data_residency": "UAE-only",
        "compliance_framework": "UAE Federal · ICA · TDRA",
        "logo_url": "https://static.prod-images.emergentagent.com/jobs/3df0a28a-599b-41d8-ba79-c6c0851c9972/images/10ab27e1588fccb49a7c2e7bd1cd22dec4b242f3dd15331498131da570e89540.png",
        "theme_key": "eaic-theme",
        "theme": {
            "primary": "hsl(220, 60%, 20%)",
            "primary_foreground": "hsl(0, 0%, 100%)",
            "accent": "hsl(39, 85%, 55%)",
            "accent_foreground": "hsl(220, 60%, 12%)",
            "background": "hsl(210, 20%, 98%)",
            "surface": "hsl(0, 0%, 100%)",
            "border": "hsl(220, 13%, 91%)",
            "ring": "hsl(183, 72%, 37%)",
        },
        "description": "Hawiaty platform · Federal Authority for Identity, Citizenship, Customs & Port Security.",
        "metrics": {
            "learners": 1450,
            "programmes": 8,
            "courses": 56,
            "instructors": 64,
            "certification_compliance": 91,
            "workforce_readiness": 84,
            "expiring_certs": 73,
            "ai_sessions": 4800,
        },
    },
    {
        "id": UOB_ID,
        "name": "University of Bradford",
        "short_name": "UoB",
        "type": "University",
        "country": "United Kingdom",
        "primary_language": "en",
        "secondary_language": None,
        "timezone": "Europe/London",
        "data_residency": "UK / EEA",
        "compliance_framework": "OfS · QAA · GDPR",
        "logo_url": "https://static.prod-images.emergentagent.com/jobs/3df0a28a-599b-41d8-ba79-c6c0851c9972/images/eaa7ea1a1a1ff1413a9abc40ff7f617d574da20e871cd2d02d3653a259834672.png",
        "theme_key": "bradford-theme",
        "theme": {
            "primary": "hsl(270, 50%, 40%)",
            "primary_foreground": "hsl(0, 0%, 100%)",
            "accent": "hsl(45, 93%, 47%)",
            "accent_foreground": "hsl(270, 50%, 20%)",
            "background": "hsl(270, 20%, 98%)",
            "surface": "hsl(0, 0%, 100%)",
            "border": "hsl(270, 10%, 90%)",
            "ring": "hsl(270, 50%, 40%)",
        },
        "description": "Research-intensive UK university — Faculty of Management, Law and Social Sciences.",
        "metrics": {
            "students": 12400,
            "programmes": 14,
            "courses": 187,
            "faculty": 612,
            "completion_rate": 82,
            "international_pct": 38,
            "ai_sessions": 9420,
            "workforce_readiness": 78,
        },
    },
]


SEED_ROLES = [
    # Platform
    {"key": "super_admin", "name": "Super Admin", "scope": "global", "category": "platform",
     "permissions": ["*"], "description": "Full platform control across all tenants."},
    {"key": "institution_admin", "name": "Institution Admin", "scope": "institution", "category": "platform",
     "permissions": ["institution.*", "users.*", "roles.*", "academic.*", "ai.config"], "description": "Configures and operates a single tenant."},
    {"key": "ai_governance_admin", "name": "AI Governance Admin", "scope": "institution", "category": "platform",
     "permissions": ["ai.governance.*", "audit.read", "compliance.read"], "description": "Owns AI TRiSM, policy and prompt approvals."},
    {"key": "compliance_officer", "name": "Compliance Officer", "scope": "institution", "category": "platform",
     "permissions": ["compliance.*", "audit.*"], "description": "Reviews audit trails and compliance posture."},
    # Academic
    {"key": "dean", "name": "Dean", "scope": "institution", "category": "academic",
     "permissions": ["analytics.read", "programmes.read", "faculty.read"], "description": "Faculty leadership and strategic oversight."},
    {"key": "programme_manager", "name": "Programme Manager", "scope": "programme", "category": "academic",
     "permissions": ["programmes.*", "cohorts.*", "courses.read"], "description": "Operational owner of programmes and cohorts."},
    {"key": "faculty", "name": "Faculty", "scope": "course", "category": "academic",
     "permissions": ["courses.read", "content.*", "assessments.*"], "description": "Teaches and reviews AI-generated content."},
    {"key": "registrar", "name": "Registrar", "scope": "institution", "category": "academic",
     "permissions": ["enrolments.*", "certificates.*"], "description": "Manages enrolment and certification."},
    {"key": "student", "name": "Student / Learner", "scope": "institution", "category": "academic",
     "permissions": ["self.read", "courses.read"], "description": "Consumes learning and assistant services."},
    {"key": "career_services", "name": "Career Services Officer", "scope": "institution", "category": "academic",
     "permissions": ["advisor.read", "placement.*"], "description": "Owns career and placement workflows."},
    # Government / corporate academy
    {"key": "executive_leadership", "name": "Executive Leadership", "scope": "institution", "category": "government",
     "permissions": ["analytics.read", "compliance.read"], "description": "Government academy senior leadership."},
    {"key": "training_manager", "name": "Training Manager", "scope": "programme", "category": "government",
     "permissions": ["programmes.*", "cohorts.*"], "description": "Owns training delivery and scheduling."},
    {"key": "hr_workforce_planner", "name": "HR Workforce Planner", "scope": "institution", "category": "government",
     "permissions": ["analytics.read", "workforce.*"], "description": "Workforce readiness and skills planning."},
    {"key": "line_manager", "name": "Line Manager", "scope": "institution", "category": "government",
     "permissions": ["team.read", "approvals.write"], "description": "Approves training for direct reports."},
    {"key": "instructor", "name": "Instructor", "scope": "course", "category": "government",
     "permissions": ["courses.read", "content.read", "assessments.write"], "description": "Delivers instructor-led training."},
]


SEED_USERS = [
    # ISB
    {"id": "u-isb-admin", "email": "rajiv.admin@isb.edu", "password": "Demo@2026",
     "name": "Rajiv Menon", "title": "Institution Admin · ISB", "role": "institution_admin",
     "institution_id": ISB_ID, "avatar_url": None},
    {"id": "u-isb-dean", "email": "shankar.dean@isb.edu", "password": "Demo@2026",
     "name": "Dr. Shankar Iyer", "title": "Dean · Strategy & Leadership", "role": "dean",
     "institution_id": ISB_ID, "avatar_url": None},
    {"id": "u-isb-faculty", "email": "ananya.faculty@isb.edu", "password": "Demo@2026",
     "name": "Prof. Ananya Rao", "title": "Faculty · Digital Transformation", "role": "faculty",
     "institution_id": ISB_ID, "avatar_url": None},
    {"id": "u-isb-student", "email": "vikram.pgp@isb.edu", "password": "Demo@2026",
     "name": "Vikram Singh", "title": "PGP Batch 2026", "role": "student",
     "institution_id": ISB_ID, "avatar_url": None},
    # EAIC
    {"id": "u-eaic-admin", "email": "fatima.admin@eaic.gov.ae", "password": "Demo@2026",
     "name": "Fatima Al Mansoori", "title": "Institution Admin · EAIC", "role": "institution_admin",
     "institution_id": EAIC_ID, "avatar_url": None},
    {"id": "u-eaic-exec", "email": "khalid.exec@eaic.gov.ae", "password": "Demo@2026",
     "name": "Brig. Khalid Al Hammadi", "title": "Executive Leadership", "role": "executive_leadership",
     "institution_id": EAIC_ID, "avatar_url": None},
    {"id": "u-eaic-instructor", "email": "noura.instructor@eaic.gov.ae", "password": "Demo@2026",
     "name": "Capt. Noura Al Suwaidi", "title": "Senior Instructor", "role": "instructor",
     "institution_id": EAIC_ID, "avatar_url": None},
    {"id": "u-eaic-cadet", "email": "saif.cadet@eaic.gov.ae", "password": "Demo@2026",
     "name": "Cadet Saif Al Marri", "title": "Cadet · Border Security", "role": "student",
     "institution_id": EAIC_ID, "avatar_url": None},
    # UoB
    {"id": "u-uob-admin", "email": "emma.admin@bradford.ac.uk", "password": "Demo@2026",
     "name": "Emma Whitaker", "title": "Institution Admin · UoB", "role": "institution_admin",
     "institution_id": UOB_ID, "avatar_url": None},
    {"id": "u-uob-faculty", "email": "james.faculty@bradford.ac.uk", "password": "Demo@2026",
     "name": "Dr. James Holloway", "title": "Senior Lecturer · Analytics", "role": "faculty",
     "institution_id": UOB_ID, "avatar_url": None},
]


# Academic structure per institution
def _id(prefix, n):
    return f"{prefix}-{n}"


SEED_ACADEMIC = {
    ISB_ID: {
        "campuses": [
            {"id": _id("isb-camp", 1), "institution_id": ISB_ID, "name": "Hyderabad Campus", "city": "Hyderabad", "country": "India"},
            {"id": _id("isb-camp", 2), "institution_id": ISB_ID, "name": "Mohali Campus", "city": "Mohali", "country": "India"},
        ],
        "departments": [
            {"id": _id("isb-dept", k), "institution_id": ISB_ID, "name": n, "head": h}
            for k, (n, h) in enumerate([
                ("Strategy", "Prof. R. Bhatnagar"),
                ("Finance", "Prof. P. Subramanian"),
                ("Marketing", "Prof. S. Khurana"),
                ("Operations", "Prof. A. Goyal"),
                ("Analytics", "Prof. V. Kumar"),
                ("Leadership", "Prof. M. Ramachandran"),
                ("Entrepreneurship", "Prof. N. Bansal"),
                ("Digital Transformation", "Prof. Ananya Rao"),
            ], start=1)
        ],
        "programmes": [
            {"id": "isb-prog-pgp", "institution_id": ISB_ID, "name": "Post Graduate Programme in Management", "code": "PGP",
             "duration": "12 months", "department_id": _id("isb-dept", 1), "enrolled": 412, "completion_rate": 92},
            {"id": "isb-prog-pgppro", "institution_id": ISB_ID, "name": "PGP PRO", "code": "PGP-PRO",
             "duration": "15 months", "department_id": _id("isb-dept", 2), "enrolled": 156, "completion_rate": 88},
            {"id": "isb-prog-pgpmax", "institution_id": ISB_ID, "name": "PGP MAX (Senior Executives)", "code": "PGP-MAX",
             "duration": "18 months", "department_id": _id("isb-dept", 6), "enrolled": 84, "completion_rate": 95},
            {"id": "isb-prog-pgpmfab", "institution_id": ISB_ID, "name": "PGP MFAB (Family Business)", "code": "PGP-MFAB",
             "duration": "15 months", "department_id": _id("isb-dept", 7), "enrolled": 62, "completion_rate": 90},
            {"id": "isb-prog-pgpyl", "institution_id": ISB_ID, "name": "PGP YL (Young Leaders)", "code": "PGP-YL",
             "duration": "12 months", "department_id": _id("isb-dept", 6), "enrolled": 110, "completion_rate": 86},
            {"id": "isb-prog-exec", "institution_id": ISB_ID, "name": "Executive Education", "code": "EXEC",
             "duration": "Modular", "department_id": _id("isb-dept", 6), "enrolled": 96, "completion_rate": 83},
        ],
        "courses": [
            {"id": f"isb-course-{i}", "institution_id": ISB_ID, "programme_id": "isb-prog-pgp",
             "code": f"PGP-{100+i}", "title": t, "credits": 3, "faculty": f, "modules": m}
            for i, (t, f, m) in enumerate([
                ("Competitive Strategy", "Prof. R. Bhatnagar", 8),
                ("Corporate Finance", "Prof. P. Subramanian", 10),
                ("Digital Marketing & Brands", "Prof. S. Khurana", 7),
                ("Operations & Supply Chain", "Prof. A. Goyal", 8),
                ("Business Analytics", "Prof. V. Kumar", 9),
                ("Leading Organisations", "Prof. M. Ramachandran", 6),
                ("Innovation & New Ventures", "Prof. N. Bansal", 7),
                ("AI for Business Leaders", "Prof. Ananya Rao", 9),
            ], start=1)
        ],
        "cohorts": [
            {"id": "isb-cohort-pgp26", "institution_id": ISB_ID, "programme_id": "isb-prog-pgp",
             "name": "PGP Co'26", "start_date": "2025-04-15", "end_date": "2026-04-10", "size": 412},
            {"id": "isb-cohort-pgppro26", "institution_id": ISB_ID, "programme_id": "isb-prog-pgppro",
             "name": "PGP PRO Co'26", "start_date": "2025-08-01", "end_date": "2026-11-30", "size": 156},
        ],
    },
    EAIC_ID: {
        "campuses": [
            {"id": "eaic-camp-1", "institution_id": EAIC_ID, "name": "Abu Dhabi HQ", "city": "Abu Dhabi", "country": "UAE"},
            {"id": "eaic-camp-2", "institution_id": EAIC_ID, "name": "Dubai Training Wing", "city": "Dubai", "country": "UAE"},
            {"id": "eaic-camp-3", "institution_id": EAIC_ID, "name": "Sharjah Field School", "city": "Sharjah", "country": "UAE"},
        ],
        "departments": [
            {"id": f"eaic-dept-{k}", "institution_id": EAIC_ID, "name": n, "head": h}
            for k, (n, h) in enumerate([
                ("Border Security", "Col. Y. Al Falasi"),
                ("Immigration", "Lt. Col. M. Al Zaabi"),
                ("Customs", "Lt. Col. H. Al Shamsi"),
                ("Document Verification", "Maj. R. Al Mazrouei"),
                ("Crisis Response", "Brig. K. Al Hammadi"),
                ("Cargo Inspection", "Maj. F. Al Suwaidi"),
            ], start=1)
        ],
        "programmes": [
            {"id": "eaic-prog-border", "institution_id": EAIC_ID, "name": "Border Security Officer", "code": "BSO",
             "duration": "9 months", "department_id": "eaic-dept-1", "enrolled": 240, "completion_rate": 94},
            {"id": "eaic-prog-imm", "institution_id": EAIC_ID, "name": "Immigration Operations", "code": "IMM",
             "duration": "6 months", "department_id": "eaic-dept-2", "enrolled": 180, "completion_rate": 92},
            {"id": "eaic-prog-customs", "institution_id": EAIC_ID, "name": "Customs Investigation", "code": "CUS",
             "duration": "6 months", "department_id": "eaic-dept-3", "enrolled": 165, "completion_rate": 90},
            {"id": "eaic-prog-crisis", "institution_id": EAIC_ID, "name": "Crisis Response Command", "code": "CRC",
             "duration": "4 months", "department_id": "eaic-dept-5", "enrolled": 95, "completion_rate": 89},
            {"id": "eaic-prog-lead", "institution_id": EAIC_ID, "name": "Leadership Development", "code": "LDP",
             "duration": "12 months", "department_id": "eaic-dept-5", "enrolled": 120, "completion_rate": 91},
            {"id": "eaic-prog-doc", "institution_id": EAIC_ID, "name": "Document Verification Specialist", "code": "DVS",
             "duration": "3 months", "department_id": "eaic-dept-4", "enrolled": 220, "completion_rate": 95},
            {"id": "eaic-prog-risk", "institution_id": EAIC_ID, "name": "Risk Profiling", "code": "RPF",
             "duration": "3 months", "department_id": "eaic-dept-1", "enrolled": 210, "completion_rate": 88},
            {"id": "eaic-prog-cargo", "institution_id": EAIC_ID, "name": "Cargo Inspection", "code": "CGI",
             "duration": "5 months", "department_id": "eaic-dept-6", "enrolled": 220, "completion_rate": 90},
        ],
        "courses": [
            {"id": f"eaic-course-{i}", "institution_id": EAIC_ID, "programme_id": "eaic-prog-border",
             "code": f"BSO-{200+i}", "title": t, "credits": 4, "faculty": f, "modules": m}
            for i, (t, f, m) in enumerate([
                ("Border Protocols & UAE Federal Law", "Col. Y. Al Falasi", 10),
                ("Biometric Identification Systems", "Capt. Noura Al Suwaidi", 8),
                ("Threat & Risk Assessment", "Maj. R. Al Mazrouei", 9),
                ("Arabic Tactical Communication", "Lt. M. Al Hosani", 7),
                ("Ethics & Citizen Rights", "Dr. A. Al Tunaiji", 6),
                ("Field Operations Simulation", "Brig. K. Al Hammadi", 12),
            ], start=1)
        ],
        "cohorts": [
            {"id": "eaic-cohort-bso26", "institution_id": EAIC_ID, "programme_id": "eaic-prog-border",
             "name": "BSO Batch 26", "start_date": "2025-09-01", "end_date": "2026-05-30", "size": 240},
        ],
    },
    UOB_ID: {
        "campuses": [
            {"id": "uob-camp-1", "institution_id": UOB_ID, "name": "Bradford Main Campus", "city": "Bradford", "country": "UK"},
        ],
        "departments": [
            {"id": f"uob-dept-{k}", "institution_id": UOB_ID, "name": n, "head": h}
            for k, (n, h) in enumerate([
                ("School of Management", "Prof. C. Whitfield"),
                ("School of Engineering", "Prof. R. Patel"),
                ("School of Health Studies", "Prof. M. Ahmed"),
                ("School of Social Sciences", "Prof. L. O'Connor"),
            ], start=1)
        ],
        "programmes": [
            {"id": "uob-prog-mba", "institution_id": UOB_ID, "name": "Executive MBA", "code": "EMBA",
             "duration": "24 months", "department_id": "uob-dept-1", "enrolled": 220, "completion_rate": 86},
            {"id": "uob-prog-msc-ai", "institution_id": UOB_ID, "name": "MSc AI & Data Analytics", "code": "MSC-AI",
             "duration": "12 months", "department_id": "uob-dept-2", "enrolled": 340, "completion_rate": 81},
            {"id": "uob-prog-bsc-cs", "institution_id": UOB_ID, "name": "BSc Computer Science", "code": "BSC-CS",
             "duration": "36 months", "department_id": "uob-dept-2", "enrolled": 980, "completion_rate": 79},
        ],
        "courses": [
            {"id": f"uob-course-{i}", "institution_id": UOB_ID, "programme_id": "uob-prog-msc-ai",
             "code": f"AI-{300+i}", "title": t, "credits": 15, "faculty": "Dr. James Holloway", "modules": m}
            for i, (t, m) in enumerate([
                ("Machine Learning Foundations", 10),
                ("Deep Learning & NLP", 12),
                ("Responsible AI & Ethics", 8),
                ("Data Engineering at Scale", 10),
            ], start=1)
        ],
        "cohorts": [
            {"id": "uob-cohort-mba26", "institution_id": UOB_ID, "programme_id": "uob-prog-mba",
             "name": "EMBA 2026", "start_date": "2025-09-15", "end_date": "2027-09-15", "size": 220},
        ],
    },
}
