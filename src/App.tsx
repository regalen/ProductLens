import * as React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { PipelineManager } from "./pages/PipelineManager";
import { WorkflowView } from "./pages/WorkflowView";
import { UserManagement } from "./pages/UserManagement";
import { ChangePassword } from "./pages/ChangePassword";
import { Reporting } from "./pages/Reporting";
import { ReportDetail } from "./pages/ReportDetail";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import { Layout } from "./components/Layout";

function ProtectedRoute({ children, requireAdmin }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/change-password" 
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/users" 
              element={
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/pipelines" 
              element={
                <ProtectedRoute>
                  <PipelineManager />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/workflow/:id"
              element={
                <ProtectedRoute>
                  <WorkflowView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reporting"
              element={
                <ProtectedRoute>
                  <Reporting />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reporting/:reportType"
              element={
                <ProtectedRoute>
                  <ReportDetail />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </TooltipProvider>
    </AuthProvider>
  );
}
