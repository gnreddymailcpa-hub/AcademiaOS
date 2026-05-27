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
import AIUseCases from "./pages/AIUseCases";
import ContentStudio from "./pages/ContentStudio";
import AIInstructor from "./pages/AIInstructor";
import AIAdvisor from "./pages/AIAdvisor";
import StudentAssistant from "./pages/StudentAssistant";

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
        <Route path="/ai-use-cases" element={<AIUseCases />} />
        <Route path="/content-studio" element={<ContentStudio />} />
        <Route path="/ai-instructor" element={<AIInstructor />} />
        <Route path="/ai-advisor" element={<AIAdvisor />} />
        <Route path="/student-assistant" element={<StudentAssistant />} />
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
