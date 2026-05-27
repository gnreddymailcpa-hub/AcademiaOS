"""
Phase 4 seed data — assessments, item bank, psychometric rules + sample events.
"""
import uuid
from datetime import datetime, timezone, timedelta

from seed_data import ISB_ID, EAIC_ID, UOB_ID


def _iso(d):
    return d.replace(tzinfo=timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Assessments + items per institution
# ---------------------------------------------------------------------------
def _item(prefix, n, stem, options, correct, difficulty, bloom, explanation=""):
    return {
        "id": f"item-{prefix}-{n}",
        "stem": stem,
        "options": options,
        "correct_index": correct,
        "type": "mcq",
        "difficulty": difficulty,
        "bloom": bloom,
        "explanation": explanation,
        "created_at": _iso(datetime.now(timezone.utc)),
    }


ISB_BUSINESS_ITEMS = [
    _item("isb-strategy", 1,
          "Which of Porter's Five Forces is most weakened by strong two-sided network effects?",
          ["Rivalry among existing firms", "Threat of new entrants", "Bargaining power of buyers", "Threat of substitutes"],
          1, "intermediate", "Analyse",
          "Strong network effects raise switching costs and create data moats, sharply reducing the threat of new entrants."),
    _item("isb-strategy", 2,
          "What is the primary purpose of the bias-variance trade-off in ML model design?",
          ["Maximise training accuracy", "Balance underfitting and overfitting", "Reduce training time", "Ensure data quality"],
          1, "intermediate", "Understand",
          "High-bias models underfit; high-variance models overfit. Regularisation helps balance."),
    _item("isb-strategy", 3,
          "Which AI category PRIMARILY produces new content like text and images?",
          ["Predictive AI", "Generative AI", "Agentic AI", "Reinforcement AI"],
          1, "easy", "Remember",
          "Generative AI synthesises new artifacts; predictive AI forecasts numeric outcomes."),
    _item("isb-strategy", 4,
          "Under Gartner's AI TRiSM framework, which is NOT one of the four pillars?",
          ["Trustworthiness", "Risk management", "Cost optimisation", "Monitoring"],
          2, "intermediate", "Remember",
          "TRiSM = Trust, Risk, Security, Monitoring. Cost is a different pillar."),
    _item("isb-strategy", 5,
          "A board should evaluate AI investment portfolios across which three horizons?",
          ["1, 2, 3 years", "0–6, 6–18, 18–36 months", "Quarterly, annual, multi-year", "Sprint, release, programme"],
          1, "intermediate", "Apply",
          "Standard 3-horizon adoption model for enterprise AI."),
    _item("isb-strategy", 6,
          "Which is the MOST common failure mode of enterprise AI programmes?",
          ["Excessive model accuracy", "Unclear KPIs and missing HITL controls", "Too many vendors", "Overfit to validation set"],
          1, "hard", "Evaluate",
          "Strategic failures dominate over technical ones."),
    _item("isb-strategy", 7,
          "L1 (Lasso) regularisation primarily achieves which effect?",
          ["Quadratic penalty", "Feature selection via sparsity", "Bias toward zero variance", "Higher learning rate"],
          1, "hard", "Analyse",
          "L1 drives coefficients to zero, performing implicit feature selection."),
    _item("isb-strategy", 8,
          "Cross-validation provides which advantage over a single train-test split?",
          ["Faster training", "More robust generalisation estimate", "Lower model complexity", "Smaller dataset requirement"],
          1, "easy", "Understand",
          "k-fold CV averages over multiple splits to reduce variance of the estimate."),
]


EAIC_BORDER_ITEMS = [
    _item("eaic-border", 1,
          "Under UAE Federal Decree No. 45, the FIRST stage of the standard border inspection workflow is:",
          ["Risk assessment", "Identity verification", "Outcome logging", "Document verification"],
          1, "easy", "Remember",
          "The four stages are: identity → document → risk → outcome logging."),
    _item("eaic-border", 2,
          "What is the federal threshold for single-modal biometric acceptance?",
          ["95.0%", "97.5%", "99.5%", "99.95%"],
          2, "intermediate", "Remember",
          "Single-modal acceptance must be ≥99.5%; below that, multi-modal cross-verification is mandatory."),
    _item("eaic-border", 3,
          "Every inspection outcome MUST be recorded with:",
          ["Timestamp only", "Timestamp, officer ID and reason code", "Officer ID only", "Reason code only"],
          1, "intermediate", "Apply",
          "Full audit triplet is required per the federal handbook."),
    _item("eaic-border", 4,
          "When single-modal biometric confidence falls below the federal threshold, the operator MUST:",
          ["Refuse entry", "Apply multi-modal cross-verification", "Wait 24 hours", "Use facial recognition only"],
          1, "intermediate", "Apply",
          "Multi-modal cross-verification is mandatory below the single-modal threshold."),
    _item("eaic-border", 5,
          "Bias audits run on every shift's outcome distribution to:",
          ["Maximise inspection volume", "Detect protected-characteristic disparities", "Reduce officer workload", "Track officer ratings"],
          1, "hard", "Analyse",
          "The National AI Governance Framework mandates demographic disparity monitoring."),
    _item("eaic-border", 6,
          "Biometric data is retained per which residency policy?",
          ["GCC-wide", "GDPR (EU)", "UAE-only", "Internationally distributed"],
          2, "easy", "Remember",
          "EAIC data residency is UAE-only by federal mandate."),
    _item("eaic-border", 7,
          "Which is NOT a modality used in multi-modal biometrics?",
          ["Facial recognition", "Fingerprint matching", "Iris scanning", "Handwriting analysis"],
          3, "easy", "Remember",
          "FAR/FRR vary by modality; handwriting is not in scope."),
    _item("eaic-border", 8,
          "An officer making a decision partly based on a protected characteristic is:",
          ["Encouraged", "Permitted with documentation", "Prohibited", "Logged and approved"],
          2, "intermediate", "Evaluate",
          "Prohibited under Federal Decree No. 45 and the UAE AI Governance Framework."),
]


UOB_ML_ITEMS = [
    _item("uob-ml", 1, "Supervised learning learns a mapping from:",
          ["Unlabeled data to clusters", "Inputs to labels", "States to actions", "Documents to embeddings"],
          1, "easy", "Remember", ""),
    _item("uob-ml", 2, "Which is NOT a regularisation technique?",
          ["L1 (Lasso)", "L2 (Ridge)", "Dropout", "Linear scaling"],
          3, "intermediate", "Understand", ""),
    _item("uob-ml", 3, "Cross-validation primarily reduces:",
          ["Bias only", "Variance of generalisation estimate", "Compute cost", "Number of parameters"],
          1, "intermediate", "Apply", ""),
    _item("uob-ml", 4, "A high-variance model typically:",
          ["Underfits training data", "Overfits training data", "Has high bias", "Has low complexity"],
          1, "easy", "Remember", ""),
]


def _assessment(prefix, inst_id, course_id, title, description, items):
    return {
        "id": f"asm-{prefix}",
        "institution_id": inst_id,
        "course_id": course_id,
        "title": title,
        "description": description,
        "type": "mcq",
        "time_limit_minutes": 30,
        "adaptive": True,
        "randomise": True,
        "retake_allowed": False,
        "faculty_review_required": False,
        "pass_score": 60,
        "status": "published",
        "created_by": "Seed",
        "created_at": _iso(datetime.now(timezone.utc)),
        "published_at": _iso(datetime.now(timezone.utc)),
        "_items": items,  # processed at seed time
    }


SEED_ASSESSMENTS = [
    _assessment("isb-strategy-w1", ISB_ID, "isb-course-8",
                "AI for Business Leaders · Foundations Assessment",
                "Adaptive MCQ assessment grounded in approved course material.",
                ISB_BUSINESS_ITEMS),
    _assessment("eaic-border-w1", EAIC_ID, "eaic-course-1",
                "Border Security Officer · Foundations",
                "Adaptive MCQ assessment on UAE federal border protocols.",
                EAIC_BORDER_ITEMS),
    _assessment("uob-ml-w1", UOB_ID, "uob-course-1",
                "Machine Learning Foundations · Week 1 Quiz",
                "Quick check on supervised learning, regularisation and CV.",
                UOB_ML_ITEMS),
]


# ---------------------------------------------------------------------------
# Psychometric rules per institution
# ---------------------------------------------------------------------------
def _rule(prefix, n, inst_id, name, sc, threshold, intervention, description):
    return {
        "id": f"rule-{prefix}-{n}",
        "institution_id": inst_id,
        "name": name,
        "signal_class": sc,
        "threshold": threshold,
        "intervention": intervention,
        "enabled": True,
        "consent_required": True,
        "human_review": True,
        "description": description,
        "created_by": "Seed",
        "created_at": _iso(datetime.now(timezone.utc)),
    }


def _rules_for(inst_id, prefix):
    return [
        _rule(prefix, 1, inst_id, "Slow average response time",
              "response_time_ms_avg", 45000, "easier_explanation",
              "If average response time exceeds 45s, surface an easier explanation."),
        _rule(prefix, 2, inst_id, "Consecutive wrong answers",
              "wrong_streak", 3, "microlearning_suggested",
              "Three wrong answers in a row triggers a microlearning suggestion."),
        _rule(prefix, 3, inst_id, "Excess hint usage",
              "hint_usage", 4, "faculty_alert",
              "Four or more hint uses in one attempt alerts the faculty."),
        _rule(prefix, 4, inst_id, "Inactivity detected",
              "inactivity", 2, "break_recommended",
              "Two inactivity events recommend a short break."),
    ]


SEED_PSYCH_RULES = (
    _rules_for(ISB_ID, "isb")
    + _rules_for(EAIC_ID, "eaic")
    + _rules_for(UOB_ID, "uob")
)


# ---------------------------------------------------------------------------
# Sample psychometric events (so the queue is not empty on first load)
# ---------------------------------------------------------------------------
def _evt(prefix, n, inst_id, user_id, user_name, signal, value, threshold, intervention, status, age_hours):
    ts = datetime.now(timezone.utc) - timedelta(hours=age_hours)
    return {
        "id": f"evt-{prefix}-{n}",
        "institution_id": inst_id,
        "user_id": user_id,
        "user_name": user_name,
        "assessment_id": None,
        "attempt_id": None,
        "rule_id": None,
        "signal_class": signal,
        "value": value,
        "threshold": threshold,
        "intervention": intervention,
        "status": status,
        "created_at": _iso(ts),
    }


SEED_PSYCH_EVENTS = [
    _evt("isb", 1, ISB_ID, "u-isb-student", "Vikram Singh", "wrong_streak", 4, 3, "microlearning_suggested", "pending_review", 2),
    _evt("isb", 2, ISB_ID, "u-isb-student", "Vikram Singh", "response_time_ms_avg", 62000, 45000, "easier_explanation", "approved", 26),
    _evt("isb", 3, ISB_ID, "u-isb-faculty", "Prof. Ananya Rao", "hint_usage", 5, 4, "faculty_alert", "approved", 50),
    _evt("eaic", 1, EAIC_ID, "u-eaic-cadet", "Cadet Saif Al Marri", "wrong_streak", 3, 3, "microlearning_suggested", "pending_review", 4),
    _evt("eaic", 2, EAIC_ID, "u-eaic-cadet", "Cadet Saif Al Marri", "inactivity", 3, 2, "break_recommended", "approved", 30),
    _evt("eaic", 3, EAIC_ID, "u-eaic-cadet", "Cadet Saif Al Marri", "response_time_ms_avg", 55000, 45000, "easier_explanation", "pending_review", 1),
    _evt("uob", 1, UOB_ID, "u-uob-faculty", "Dr. James Holloway", "wrong_streak", 3, 3, "microlearning_suggested", "rejected", 70),
]
