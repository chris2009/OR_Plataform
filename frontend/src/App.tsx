import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useAuthInit } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import CamerasPage from "@/pages/CamerasPage";
import LivePage from "@/pages/LivePage";
import EventsPage from "@/pages/EventsPage";
import UsersPage from "@/pages/UsersPage";
import SettingsPage from "@/pages/SettingsPage";
import type { UserRole } from "@/store/authStore";

function PrivateRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, accessToken } = useAuthStore();

  if (!accessToken && !user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/live" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  useAuthInit();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/live" replace />} />
        <Route path="cameras" element={<CamerasPage />} />
        <Route path="live" element={<LivePage />} />
        <Route path="events" element={<EventsPage />} />
        <Route
          path="users"
          element={
            <PrivateRoute roles={["admin"]}>
              <UsersPage />
            </PrivateRoute>
          }
        />
        <Route
          path="settings"
          element={
            <PrivateRoute roles={["admin"]}>
              <SettingsPage />
            </PrivateRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/live" replace />} />
    </Routes>
  );
}
