"""
Seed data for AI Use Cases + sample knowledge documents +
skill framework + advisor target roles per institution.

Each AI use case is now tagged with `canonical_module` (the canonical
Claros module ID — claros-ai / claros-learn / claros-launch …) so the
UI can group cards by Claros module and inherit tenant rebrands.
"""

from seed_data import ISB_ID, EAIC_ID, UOB_ID, VCE_ID


def _uc(key, code, name_en, name_ar, glyph, metric, latency, description, capabilities,
        default_provider, default_model, canonical_module):
    return {
        "key": key,
        "code": code,
        "canonical_module": canonical_module,
        "name_en": name_en,
        "name_ar": name_ar,
        "glyph": glyph,
        "metric": metric,
        "latency": latency,
        "description": description,
        "capabilities": capabilities,
        "provider": default_provider,
        "model": default_model,
        "status": "active" if key in ("content_studio", "ai_instructor", "ai_advisor", "student_assistant") else "coming_soon",
        "risk_score": "medium" if key in ("psychometrics",) else "low",
        "human_in_the_loop": True,
        "citations_required": True,
    }


def use_cases_for(provider: str, model: str):
    return [
        _uc("content_studio", "4.4", "AI Content Generation Engine", "محرك توليد المحتوى",
            "◫", "3-Stage Pipeline", "< 8s",
            "End-to-end intelligent content pipeline: ingest raw materials → structural analysis → multi-format asset generation → faculty approval → AI Instructor delivery.",
            ["PDF / DOCX / transcript ingestion",
             "Bloom's taxonomy mapping",
             "Lesson plans · MCQs · flashcards · case guides",
             "SME review queue + versioned publish"],
            provider, model, canonical_module="claros-learn"),
        _uc("ai_instructor", "4.1", "Virtual AI Instructor", "المعلم الذكي",
            "◈", "Response latency", "< 3s",
            "Adaptive conversational agents delivering structured course content in English and Arabic — adjusting pace, depth and tone in real time, grounded in approved sources.",
            ["Course-grounded RAG with citations",
             "Bilingual EN / AR responses",
             "Confidence-based escalation to faculty",
             "Full session transcript for audit"],
            provider, model, canonical_module="claros-learn"),
        _uc("ai_advisor", "4.2", "AI Educational Advisor", "المرشد الأكاديمي",
            "◉", "Learner profile view", "360°",
            "Personalised career and learning guidance agents analysing full learner profiles and generating actionable NQF-aligned recommendations.",
            ["Skill-gap analysis vs target role",
             "Personalised learning path",
             "Career pathway mapping",
             "Approval-gated visibility"],
            provider, model, canonical_module="claros-launch"),
        _uc("student_assistant", "4.3", "AI Student Assistant", "المساعد الطلابي",
            "◐", "Intent accuracy", "99%+",
            "Fully conversational self-service agents handling enrolment, scheduling, assessment, certification with hybrid NLU and rule-based fallback. Powered by VEDA's multi-pass agentic reasoning chain.",
            ["3-pass reasoning chain (intent → retrieve → verify)",
             "Auto-escalation to human ticket on unresolved",
             "Multi-channel: web · mobile · WhatsApp-ready",
             "SLA dashboard with escalation routing"],
            provider, model, canonical_module="claros-ai"),
        _uc("assessments", "4.7", "Advanced Assessment Engine", "محرك التقييم المتقدم",
            "◬", "Analytics layer", "Real-Time",
            "AI-powered evaluation: psychometric profiling, Ebbinghaus adaptive algorithms, leadership diagnostics and full analytics platform.",
            ["MCQ / scenario / case generation",
             "Adaptive difficulty sequencing",
             "Rubric-assisted scoring",
             "Competency reports"],
            provider, model, canonical_module="claros-learn"),
        _uc("psychometrics", "4.5", "Psychometric & Behaviour Intelligence", "تحليل السلوك",
            "◇", "Signal capture", "Live",
            "Tracks learner behaviour signals — response time, hint usage, inactivity — and recommends interventions with fairness audit.",
            ["Signal classes + threshold editor",
             "Intervention rule engine",
             "Bias and fairness audit dashboard",
             "Model drift monitoring"],
            provider, model, canonical_module="claros-learn"),
        _uc("workforce", "4.6", "Predictive Workforce Planning", "تخطيط القوى العاملة",
            "◳", "Forecast horizon", "12-mo",
            "Forward-looking intelligence on staffing requirements, competency readiness and skill-gap trajectories.",
            ["Workforce readiness index",
             "Skill-gap trajectories",
             "Aligned to national qualifications frameworks"],
            provider, model, canonical_module="claros-people"),
        _uc("workflows", "4.8", "AI Automation Agents", "وكلاء الأتمتة",
            "◎", "Orchestration", "Agentic",
            "Agentic AI orchestrating multi-step administrative workflows across SMS, LMS, Assessment Engine and connected federal systems under full governance.",
            ["Workflow builder + agent configuration",
             "Human-in-the-loop approval queue",
             "Rollback console + full audit trail"],
            provider, model, canonical_module="claros-comply"),
    ]


SEED_USE_CASES = {
    ISB_ID: use_cases_for("openai", "gpt-5.2"),
    EAIC_ID: use_cases_for("anthropic", "claude-sonnet-4.5"),
    UOB_ID: use_cases_for("anthropic", "claude-sonnet-4.5"),
    VCE_ID: use_cases_for("openai", "gpt-4o-mini"),
}


# Sample knowledge documents — these become the AI Instructor's grounded sources.
SEED_DOCUMENTS = [
    # ---- ISB: AI for Business Leaders (course isb-course-8) ----
    {
        "id": "doc-isb-1",
        "institution_id": ISB_ID,
        "course_id": "isb-course-8",
        "programme_id": "isb-prog-pgp",
        "title": "Foundations of AI for Business Leaders",
        "kind": "lecture_notes",
        "approved": True,
        "uploaded_by": "Prof. Ananya Rao",
        "text": (
            "Foundations of AI for Business Leaders. Artificial Intelligence is the capability of "
            "machines to perform tasks that typically require human intelligence — perception, "
            "reasoning, planning and decision making. For business leaders, the relevant taxonomy is "
            "predictive AI, generative AI and agentic AI. Predictive AI forecasts numeric outcomes "
            "such as churn or default; generative AI produces new content such as text, code or "
            "images; agentic AI plans and executes multi-step tasks across tools under governance. "
            "The Gartner AI TRiSM framework recommends governance pillars: trustworthiness, risk "
            "management, security and monitoring. Strategic adoption follows three horizons: "
            "experiment in 0–6 months, scale operations in 6–18 months, and re-architect the "
            "business model in 18–36 months. ROI typically comes from cost takeout in operations, "
            "revenue uplift in sales and marketing, and risk reduction in compliance. Common "
            "failure modes are unclear KPIs, poor data quality, and absent human-in-the-loop "
            "controls on irreversible actions."
        ),
    },
    {
        "id": "doc-isb-2",
        "institution_id": ISB_ID,
        "course_id": "isb-course-8",
        "programme_id": "isb-prog-pgp",
        "title": "Generative AI Use Cases by Function",
        "kind": "case_guide",
        "approved": True,
        "uploaded_by": "Prof. Ananya Rao",
        "text": (
            "Generative AI use cases by function. In marketing, generative models produce campaign "
            "copy, personalised emails and creative variants tested at scale. In finance, they "
            "draft analyst reports, summarise filings and accelerate due diligence. In operations, "
            "they automate incident summaries and SOPs. In HR, they screen resumes, draft job "
            "descriptions and personalise learning paths. The leadership question is no longer "
            "'should we adopt AI?' but 'where does AI shift our competitive advantage?'. Building "
            "a portfolio of bets across horizons protects against single-bet failure."
        ),
    },
    # ---- ISB: Strategy course ----
    {
        "id": "doc-isb-3",
        "institution_id": ISB_ID,
        "course_id": "isb-course-1",
        "programme_id": "isb-prog-pgp",
        "title": "Competitive Strategy: Porter's Five Forces revisited",
        "kind": "lecture_notes",
        "approved": True,
        "uploaded_by": "Prof. R. Bhatnagar",
        "text": (
            "Porter's Five Forces remains a foundational lens. The five forces — rivalry, threat "
            "of new entrants, bargaining power of suppliers, bargaining power of buyers and threat "
            "of substitutes — define industry attractiveness. In digital industries, network "
            "effects and data moats invert several of these forces. A platform with strong "
            "two-sided network effects can simultaneously reduce buyer power and substitute "
            "threats while raising barriers to entry."
        ),
    },
    # ---- EAIC: Border Security ----
    {
        "id": "doc-eaic-1",
        "institution_id": EAIC_ID,
        "course_id": "eaic-course-1",
        "programme_id": "eaic-prog-border",
        "title": "UAE Border Protocols Handbook",
        "kind": "handbook",
        "approved": True,
        "uploaded_by": "Col. Y. Al Falasi",
        "text": (
            "UAE Border Security Protocols. Federal Decree No. 45 establishes the powers, duties "
            "and responsibilities of Border Security Officers operating at UAE ports of entry. "
            "Officers must verify the authenticity of travel documents, conduct biometric matches "
            "against the federal identity database, and apply risk-based profiling consistent with "
            "the National AI Governance Framework. The standard inspection workflow has four "
            "stages: identity verification, document verification, risk assessment and outcome "
            "logging. Every outcome must be recorded in the federal audit log with timestamp, "
            "officer ID and reason code. Officers are prohibited from making decisions based on "
            "protected characteristics; bias audits run on every shift's outcome distribution."
        ),
    },
    {
        "id": "doc-eaic-2",
        "institution_id": EAIC_ID,
        "course_id": "eaic-course-2",
        "programme_id": "eaic-prog-border",
        "title": "Biometric Identification Systems",
        "kind": "lecture_notes",
        "approved": True,
        "uploaded_by": "Capt. Noura Al Suwaidi",
        "text": (
            "Biometric Identification Systems. Modern border control relies on multi-modal "
            "biometrics: facial recognition, fingerprint matching and iris scanning. Each modality "
            "has a False Acceptance Rate and False Rejection Rate that vary by demographic. "
            "Operators must understand the trade-offs and apply secondary verification when "
            "confidence falls below institutional thresholds. The UAE federal threshold for "
            "single-modal acceptance is 99.5 percent; below that, multi-modal cross-verification "
            "is mandatory. All biometric captures are retained per the data residency policy "
            "(UAE-only) and accessible only via role-based access controls."
        ),
    },
    {
        "id": "doc-uob-1",
        "institution_id": UOB_ID,
        "course_id": "uob-course-1",
        "programme_id": "uob-prog-msc-ai",
        "title": "Machine Learning Foundations Week 1",
        "kind": "lecture_notes",
        "approved": True,
        "uploaded_by": "Dr. James Holloway",
        "text": (
            "Machine Learning Foundations Week 1. Supervised learning learns a mapping from "
            "inputs to labels using labelled training data. The bias-variance trade-off describes "
            "how model complexity affects generalisation: high-bias models underfit, high-variance "
            "models overfit. Regularisation techniques such as L1 (Lasso) and L2 (Ridge) penalise "
            "large coefficients and reduce overfitting. Cross-validation provides a more robust "
            "estimate of generalisation error than a single train-test split."
        ),
    },
    # ---- VCE: B.Tech CSE — Machine Learning Foundations ----
    {
        "id": "doc-vce-ml-1",
        "institution_id": VCE_ID,
        "course_id": "vce-course-7",
        "programme_id": "vce-prog-btech-cse",
        "title": "Machine Learning Foundations · JNTUH R25 Syllabus",
        "kind": "lecture_notes",
        "approved": True,
        "uploaded_by": "Dr. Praveen Kumar",
        "text": (
            "Machine Learning Foundations for B.Tech CSE under JNTUH R25 regulation. Course "
            "outcomes (COs): CO1 understand supervised, unsupervised, and reinforcement learning "
            "paradigms; CO2 implement and evaluate linear and logistic regression, decision trees, "
            "and k-nearest neighbours; CO3 apply regularisation, cross-validation, and "
            "hyper-parameter tuning to manage the bias-variance trade-off; CO4 build neural "
            "networks from first principles using NumPy and then PyTorch; CO5 reason about "
            "fairness, explainability and responsible AI as per AICTE model curriculum. "
            "Assessment: 30 marks internal (mid-I + mid-II + assignments), 70 marks external "
            "semester-end exam. Lab: 8 experiments mapped to COs. Recommended text: Mitchell, "
            "Bishop; reference text: Goodfellow, Ng (Coursera). Prerequisite: Probability & "
            "Statistics (B.Tech II year, JNTUH R25)."
        ),
    },
    # ---- VCE: Placement Handbook · Training & Placement Cell ----
    {
        "id": "doc-vce-placement-1",
        "institution_id": VCE_ID,
        "course_id": None,
        "programme_id": "vce-prog-btech-cse",
        "title": "Vaagdevi Placement Handbook 2025–26",
        "kind": "policy_doc",
        "approved": True,
        "uploaded_by": "Anil Kumar Reddy · Training & Placement Officer",
        "text": (
            "Vaagdevi Training & Placement Cell · 2025–26 Handbook. Vaagdevi College of "
            "Engineering, Bollikunta, Warangal achieved a 92 percent placement rate for the "
            "graduating batch of 2025–26 across all seven B.Tech branches and the MBA programme. "
            "Highlights: highest package — Amazon at ₹20 LPA awarded to a B.Tech CSE student "
            "(Manikanta T.); RealPage extended ₹10.08 LPA offers across the CSE and AI&ML "
            "streams; average package across branches stood at ₹6.5 LPA. Over 150 companies "
            "recruited on campus including Infosys, HCL, TCS, Tech Mahindra, Wipro, Cognizant, "
            "FactSet and Celonis. The Celonis Rising Star certification programme produced 465 "
            "certified graduates this academic year. The alumni network now exceeds 30,000 "
            "professionals across the globe since the founding batch of 2002. Placement "
            "preparation includes the four-pillar SEEK programme: skill assessment, "
            "communication training, mock interviews, and aptitude bootcamps — mandatory for "
            "B.Tech V and VI semester students. Eligibility: minimum 60 percent aggregate, no "
            "active backlogs, attendance ≥ 75 percent."
        ),
    },
    # ---- VCE: Vision, Mission & IQAC Quality Policy ----
    {
        "id": "doc-vce-policy-1",
        "institution_id": VCE_ID,
        "course_id": None,
        "programme_id": None,
        "title": "Vaagdevi Vision, Mission & IQAC Quality Policy",
        "kind": "policy_doc",
        "approved": True,
        "uploaded_by": "Dr. Sunita Sharma · IQAC Coordinator",
        "text": (
            "Vaagdevi College of Engineering · Institutional Vision, Mission and Quality Policy. "
            "Vision — Striving continuously for global recognition through academic excellence "
            "in higher education for the betterment of society. Mission — (1) To produce "
            "technically competent and socially responsible engineers with ethical values "
            "through innovative teaching-learning process; (2) To promote research and "
            "entrepreneurship culture among faculty and students. Quality Policy — To ensure "
            "high standards to educate, enrich and excel in imparting professional education by "
            "top-quality faculty who endeavour to mould students into socially responsible "
            "professionals through creative teamwork, innovation and research. Accreditation: "
            "UGC Recognised Autonomous Institution, NAAC 'A' grade, NBA accredited at programme "
            "level (CSE, ECE, EEE, Mech, Civil), affiliated to Jawaharlal Nehru Technological "
            "University Hyderabad (JNTUH). Sponsoring body: Viswambhara Educational Society, "
            "established 1993; college established 1998 at Bollikunta, Warangal Urban district, "
            "Telangana — 506 005. AICTE IDEA Lab, Institution Innovation Council (IIC) and "
            "Internal Quality Assurance Cell (IQAC) drive continuous improvement."
        ),
    },
]


# Skill frameworks per institution (for AI Advisor)
SEED_SKILL_FRAMEWORK = {
    ISB_ID: {
        "target_roles": [
            {
                "key": "product_manager",
                "name": "Product Manager · Tech",
                "skills": [
                    {"name": "Business strategy", "level": 4},
                    {"name": "Customer discovery", "level": 4},
                    {"name": "Data analytics", "level": 4},
                    {"name": "AI fluency", "level": 3},
                    {"name": "Leadership", "level": 3},
                    {"name": "Financial modelling", "level": 3},
                ],
            },
            {
                "key": "consultant",
                "name": "Management Consultant",
                "skills": [
                    {"name": "Business strategy", "level": 5},
                    {"name": "Financial modelling", "level": 4},
                    {"name": "Communication", "level": 4},
                    {"name": "Operations", "level": 3},
                    {"name": "Industry expertise", "level": 3},
                ],
            },
            {
                "key": "founder",
                "name": "Entrepreneur / Founder",
                "skills": [
                    {"name": "Customer discovery", "level": 5},
                    {"name": "AI fluency", "level": 4},
                    {"name": "Business strategy", "level": 4},
                    {"name": "Storytelling", "level": 4},
                    {"name": "Leadership", "level": 4},
                ],
            },
        ],
    },
    EAIC_ID: {
        "target_roles": [
            {
                "key": "border_officer_senior",
                "name": "Senior Border Security Officer",
                "skills": [
                    {"name": "UAE Federal law", "level": 5},
                    {"name": "Biometric systems", "level": 4},
                    {"name": "Risk assessment", "level": 4},
                    {"name": "Arabic tactical comms", "level": 5},
                    {"name": "Leadership", "level": 3},
                    {"name": "Bias-aware decisioning", "level": 4},
                ],
            },
            {
                "key": "crisis_commander",
                "name": "Crisis Response Commander",
                "skills": [
                    {"name": "UAE Federal law", "level": 4},
                    {"name": "Leadership", "level": 5},
                    {"name": "Crisis operations", "level": 5},
                    {"name": "Communications", "level": 4},
                ],
            },
        ],
    },
    UOB_ID: {
        "target_roles": [
            {
                "key": "ml_engineer",
                "name": "Machine Learning Engineer",
                "skills": [
                    {"name": "ML foundations", "level": 5},
                    {"name": "Deep learning", "level": 4},
                    {"name": "MLOps", "level": 4},
                    {"name": "Python / PyTorch", "level": 4},
                    {"name": "Responsible AI", "level": 3},
                ],
            },
        ],
    },
}


# Sample student profiles + their current self-rated skills
SEED_LEARNER_PROFILES = [
    {
        "user_id": "u-isb-student",
        "institution_id": ISB_ID,
        "target_role": "product_manager",
        "skills": [
            {"name": "Business strategy", "level": 3},
            {"name": "Customer discovery", "level": 2},
            {"name": "Data analytics", "level": 4},
            {"name": "AI fluency", "level": 2},
            {"name": "Leadership", "level": 2},
            {"name": "Financial modelling", "level": 3},
        ],
    },
    {
        "user_id": "u-eaic-cadet",
        "institution_id": EAIC_ID,
        "target_role": "border_officer_senior",
        "skills": [
            {"name": "UAE Federal law", "level": 3},
            {"name": "Biometric systems", "level": 2},
            {"name": "Risk assessment", "level": 2},
            {"name": "Arabic tactical comms", "level": 4},
            {"name": "Leadership", "level": 2},
            {"name": "Bias-aware decisioning", "level": 2},
        ],
    },
]
