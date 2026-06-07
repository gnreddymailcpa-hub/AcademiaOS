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
import Phase3Complete from "./pages/Phase3Complete";
import VedaConsole from "./pages/VedaConsole";
import AriseConsole from "./pages/AriseConsole";
import NexusConsole from "./pages/NexusConsole";
import RemainingConsole from "./pages/RemainingConsole";
import ClarosAI from "./pages/ClarosAI";
import ClarosKnowledge from "./pages/ClarosKnowledge";
import ClarosCoreDashboard from "./pages/ClarosCoreDashboard";
import ClarosCoreStudents from "./pages/ClarosCoreStudents";
import ClarosCoreNotices from "./pages/ClarosCoreNotices";
import ClarosCoreTimetable from "./pages/ClarosCoreTimetable";
import ClarosCoreFees from "./pages/ClarosCoreFees";
import ClarosCoreAttendance from "./pages/ClarosCoreAttendance";
import ClarosCoreAttendanceReport from "./pages/ClarosCoreAttendanceReport";
import ClarosEnrollKanban from "./pages/ClarosEnrollKanban";
import ClarosEnrollLeadDetail from "./pages/ClarosEnrollLeadDetail";
import ClarosEnrollAnalytics from "./pages/ClarosEnrollAnalytics";
import ClarosComplyDashboard from "./pages/ClarosComplyDashboard";
import ClarosComplyCriterion from "./pages/ClarosComplyCriterion";
import ClarosComplyOBE from "./pages/ClarosComplyOBE";
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
        <Route path="/ai" element={<ModuleGate module="VEDA"><ClarosAI /></ModuleGate>} />
        <Route path="/ai/knowledge" element={<ModuleGate module="VEDA"><ClarosKnowledge /></ModuleGate>} />
        <Route path="/core/dashboard" element={<ModuleGate module="NEXUS"><ClarosCoreDashboard /></ModuleGate>} />
        <Route path="/core/students" element={<ModuleGate module="NEXUS"><ClarosCoreStudents /></ModuleGate>} />
        <Route path="/core/notices" element={<ModuleGate module="NEXUS"><ClarosCoreNotices /></ModuleGate>} />
        <Route path="/core/timetable" element={<ModuleGate module="NEXUS"><ClarosCoreTimetable /></ModuleGate>} />
        <Route path="/core/fees" element={<ModuleGate module="NEXUS"><ClarosCoreFees /></ModuleGate>} />
        <Route path="/core/attendance" element={<ModuleGate module="NEXUS"><ClarosCoreAttendance /></ModuleGate>} />
        <Route path="/core/attendance/report" element={<ModuleGate module="NEXUS"><ClarosCoreAttendanceReport /></ModuleGate>} />
        <Route path="/enroll" element={<ModuleGate module="ARISE"><ClarosEnrollKanban /></ModuleGate>} />
        <Route path="/enroll/analytics" element={<ModuleGate module="ARISE"><ClarosEnrollAnalytics /></ModuleGate>} />
        <Route path="/enroll/leads/:id" element={<ModuleGate module="ARISE"><ClarosEnrollLeadDetail /></ModuleGate>} />
        <Route path="/comply" element={<ModuleGate module="COMPASS"><ClarosComplyDashboard /></ModuleGate>} />
        <Route path="/comply/criteria/:id" element={<ModuleGate module="COMPASS"><ClarosComplyCriterion /></ModuleGate>} />
        <Route path="/comply/obe" element={<ModuleGate module="COMPASS"><ClarosComplyOBE /></ModuleGate>} />
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
        <Route path="/phase3-complete" element={<Phase3Complete />} />
        <Route path="/veda-console" element={<VedaConsole />} />
        <Route path="/arise-console" element={<AriseConsole />} />
        <Route path="/nexus-console" element={<NexusConsole />} />
        <Route path="/closeout-console" element={<RemainingConsole />} />
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
