import React from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { InstitutionProvider } from "./context/InstitutionContext";
import { LanguageProvider } from "./context/LanguageContext";

import ProtectedRoute from "./components/layout/ProtectedRoute";
import Shell from "./components/layout/Shell";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import InstitutionSetup from "./pages/InstitutionSetup";
import AcademicStructure from "./pages/AcademicStructure";
import UsersRoles from "./pages/UsersRoles";
import Settings from "./pages/Settings";
import ComingSoon from "./pages/ComingSoon";

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

function ShellRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/institution-setup" element={<InstitutionSetup />} />
        <Route path="/academic-structure" element={<AcademicStructure />} />
        <Route path="/users-roles" element={<UsersRoles />} />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="/ai-use-cases"
          element={
            <ComingSoon
              eyebrow="AI Layer · Governance"
              title="AI Use Cases"
              phase="Phase 3"
              description="Catalog of activated AI use cases per institution with prompt templates, source grounding and approval rules."
              features={[
                "Use-case catalog with risk score & enablement toggle",
                "Prompt template versioning + diff viewer",
                "Per-use-case provider override (OpenAI / Claude / Jais / on-prem)",
                "Human-in-the-loop policy bindings",
              ]}
            />
          }
        />
        <Route
          path="/content-studio"
          element={
            <ComingSoon
              eyebrow="Module 1"
              title="Content Studio"
              phase="Phase 3"
              description="Upload course material and generate Bloom's-aligned lesson plans, flashcards, quizzes and case guides."
              features={[
                "Upload PDF / PPTX / DOCX / transcripts to Supabase-equivalent storage",
                "Bloom's taxonomy mapping & learning outcome extraction",
                "SME review and approval queue",
                "Versioned publish to course modules",
              ]}
            />
          }
        />
        <Route
          path="/ai-instructor"
          element={
            <ComingSoon
              eyebrow="Module 2"
              title="AI Instructor"
              phase="Phase 3"
              description="Course-grounded teaching assistant with RAG citations, bilingual EN/AR responses and faculty escalation."
              features={[
                "Course-scoped chat (only approved sources)",
                "Bilingual EN / AR responses",
                "Confidence scoring + faculty escalation queue",
                "Session transcripts retained for audit",
              ]}
            />
          }
        />
        <Route
          path="/ai-advisor"
          element={
            <ComingSoon
              eyebrow="Module 3"
              title="AI Advisor"
              phase="Phase 3"
              description="Skill-gap analysis, personalised learning paths and career pathway mapping."
              features={[
                "Skill framework + target role mapping",
                "Gap analysis with proactive alerts",
                "Recommended learning paths (approval-gated)",
                "Career mentor notes",
              ]}
            />
          }
        />
        <Route
          path="/student-assistant"
          element={
            <ComingSoon
              eyebrow="Module 4"
              title="Student Assistant"
              phase="Phase 3"
              description="Self-service academic queries: enrolment, timetable, attendance, deadlines, certificates."
              features={[
                "Configurable service categories",
                "SLA dashboard + escalation routing",
                "Multi-channel: web, mobile, WhatsApp-ready",
              ]}
            />
          }
        />
        <Route
          path="/assessments"
          element={
            <ComingSoon
              eyebrow="Module 5"
              title="Assessments"
              phase="Phase 4"
              description="AI-generated item banks, adaptive testing engine and rubric-based scoring."
              features={[
                "MCQ / scenario / case generation",
                "Adaptive difficulty sequencing",
                "Faculty review queue + competency reports",
              ]}
            />
          }
        />
        <Route
          path="/psychometrics"
          element={
            <ComingSoon
              eyebrow="Module 6 · Highest-risk"
              title="Psychometrics"
              phase="Phase 4"
              description="Behaviour signal capture + intervention rules with mandatory bias and fairness audit."
              features={[
                "Signal classes & thresholds editor",
                "Intervention rule engine",
                "Fairness audit dashboard + model drift monitor",
              ]}
            />
          }
        />
        <Route
          path="/analytics"
          element={
            <ComingSoon
              eyebrow="Module 7"
              title="Executive Analytics"
              phase="Phase 5"
              description="Role-based dashboards and natural-language analytics console for leadership."
              features={[
                "Dean / Faculty / HR / Compliance dashboards",
                "Natural language analytics console (EN / AR)",
                "Workforce readiness & training ROI",
              ]}
            />
          }
        />
        <Route
          path="/workflows"
          element={
            <ComingSoon
              eyebrow="Module 8"
              title="Agentic Workflows"
              phase="Phase 6"
              description="Governed AI agents that automate multi-step academic workflows with explicit approval gates."
              features={[
                "Workflow builder + agent configuration",
                "Approval queue + rollback console",
                "Full audit trail with reasoning chain",
              ]}
            />
          }
        />
        <Route
          path="/compliance"
          element={
            <ComingSoon
              eyebrow="Governance"
              title="Compliance & Audit"
              phase="Phase 6"
              description="Audit log explorer, policy management and prompt guardrail console."
              features={[
                "Filterable audit log + export",
                "Compliance policy editor (versioned)",
                "Prompt injection guardrails",
              ]}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <InstitutionProvider>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <ShellRoutes />
                  </ProtectedRoute>
                }
              />
            </Routes>
            <Toaster position="top-right" richColors />
          </InstitutionProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
