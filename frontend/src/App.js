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
import Assessments from "./pages/Assessments";
import Psychometrics from "./pages/Psychometrics";
import Analytics from "./pages/Analytics";
import Workflows from "./pages/Workflows";
import Compliance from "./pages/Compliance";
import Governance from "./pages/Governance";
import AdminGuide from "./pages/AdminGuide";
import ProductBrief from "./pages/ProductBrief";
import Admissions from "./pages/Admissions";
import PlatformModules from "./pages/PlatformModules";
import Nexus from "./pages/Nexus";
import CompassAQAR from "./pages/CompassAQAR";
import Placements from "./pages/Placements";
import CommandCentre from "./pages/CommandCentre";
import Illuminate from "./pages/Illuminate";
import Prism from "./pages/Prism";
import Alumni from "./pages/Alumni";
import FacultyPlus from "./pages/FacultyPlus";
import Guardian from "./pages/Guardian";
import GreenIQ from "./pages/GreenIQ";
import ExecBriefing from "./pages/ExecBriefing";
import Onboarding from "./pages/Onboarding";
import Phase1Complete from "./pages/Phase1Complete";
import Phase2Complete from "./pages/Phase2Complete";
import AuthCallback from "./pages/AuthCallback";
import ModuleGate from "./components/layout/ModuleGate";

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
        <Route path="/academic-structure" element={<ModuleGate module="NEXUS"><AcademicStructure /></ModuleGate>} />
        <Route path="/users-roles" element={<UsersRoles />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ai-use-cases" element={<AIUseCases />} />
        <Route path="/content-studio" element={<ModuleGate module="ILLUMINATE"><ContentStudio /></ModuleGate>} />
        <Route path="/ai-instructor" element={<ModuleGate module="VEDA"><AIInstructor /></ModuleGate>} />
        <Route path="/ai-advisor" element={<ModuleGate module="VEDA"><AIAdvisor /></ModuleGate>} />
        <Route path="/student-assistant" element={<ModuleGate module="PATHFINDER"><StudentAssistant /></ModuleGate>} />
        <Route path="/assessments" element={<ModuleGate module="ILLUMINATE"><Assessments /></ModuleGate>} />
        <Route path="/psychometrics" element={<Psychometrics />} />
        <Route path="/analytics" element={<ModuleGate module="COMMAND"><Analytics /></ModuleGate>} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/admin-guide" element={<AdminGuide />} />
        <Route path="/product-brief" element={<ProductBrief />} />
        <Route path="/admissions" element={<ModuleGate module="ARISE"><Admissions /></ModuleGate>} />
        <Route path="/nexus" element={<ModuleGate module="NEXUS"><Nexus /></ModuleGate>} />
        <Route path="/compass-aqar" element={<ModuleGate module="COMPASS"><CompassAQAR /></ModuleGate>} />
        <Route path="/placements" element={<ModuleGate module="PATHFINDER"><Placements /></ModuleGate>} />
        <Route path="/command" element={<ModuleGate module="COMMAND"><CommandCentre /></ModuleGate>} />
        <Route path="/illuminate" element={<ModuleGate module="ILLUMINATE"><Illuminate /></ModuleGate>} />
        <Route path="/prism" element={<ModuleGate module="PRISM"><Prism /></ModuleGate>} />
        <Route path="/alumni" element={<ModuleGate module="ALUMNI360"><Alumni /></ModuleGate>} />
        <Route path="/faculty-plus" element={<ModuleGate module="FACULTY"><FacultyPlus /></ModuleGate>} />
        <Route path="/guardian" element={<ModuleGate module="GUARDIAN"><Guardian /></ModuleGate>} />
        <Route path="/greeniq" element={<ModuleGate module="GREENIQ"><GreenIQ /></ModuleGate>} />
        <Route path="/exec-briefing" element={<ExecBriefing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/phase1-complete" element={<Phase1Complete />} />
        <Route path="/phase2-complete" element={<Phase2Complete />} />
        <Route path="/admin/modules" element={<PlatformModules />} />
        <Route path="/compliance" element={<ModuleGate module="COMPASS"><Compliance /></ModuleGate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  // Synchronously detect OAuth callback BEFORE ProtectedRoute runs.
  // Emergent OAuth returns the user to {redirect}#session_id=...
  if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
    return (
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <InstitutionProvider>
              <AuthCallback />
              <Toaster position="top-right" richColors />
            </InstitutionProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    );
  }
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
