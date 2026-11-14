import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminRoute } from "./auth/AdminRoute";
import { AuthProvider } from "./auth/AuthContext";
import { AdminLayout } from "./components/AdminLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MapPage } from "./pages/MapPage";
import { CaseDetailPage } from "./pages/CaseDetailPage";
import { CasesPage } from "./pages/CasesPage";
import { CatalogPage } from "./pages/CatalogPage";
import { SurveysPage } from "./pages/SurveysPage";
import { UsersPage } from "./pages/UsersPage";
import { ViolationsPage } from "./pages/ViolationsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<DashboardPage />} />
              <Route path="/admin/map" element={<MapPage />} />
              <Route path="/admin/surveys" element={<SurveysPage />} />
              <Route path="/admin/violations" element={<ViolationsPage />} />
              <Route path="/admin/cases" element={<CasesPage />} />
              <Route path="/admin/cases/:id" element={<CaseDetailPage />} />
              <Route path="/admin/catalog" element={<CatalogPage />} />
              <Route path="/admin/reports" element={<Navigate to="/admin/cases" replace />} />
              <Route path="/admin/users" element={<UsersPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
