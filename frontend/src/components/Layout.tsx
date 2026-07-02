import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Camera,
  Play,
  Bell,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  Shield,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { authApi } from "@/api";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/live", icon: Play, label: "En Vivo" },
  { to: "/cameras", icon: Camera, label: "Fuentes", title: "Fuentes: Cámara IP, Imagen o Video" },
  { to: "/events", icon: Bell, label: "Eventos" },
];
const adminItems = [
  { to: "/users", icon: Users, label: "Usuarios" },
  { to: "/settings", icon: Settings, label: "Configuración" },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r transition-all duration-300",
          collapsed ? "w-16" : "w-56",
          "border-white/5 bg-surface"
        )}
        style={{ background: "var(--surface)" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-white/5">
          {!collapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <Shield className="text-accent shrink-0" size={22} />
              <span className="font-semibold text-sm tracking-wide truncate">Surveillance</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "p-1.5 shrink-0 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors",
              collapsed && "mx-auto"
            )}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(({ to, icon: Icon, label, title }) => (
            <NavLink
              key={to}
              to={to}
              title={title}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-accent/20 text-accent"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}

          {user?.role === "admin" && (
            <>
              <div className="pt-2 pb-1 px-3">
                {!collapsed && (
                  <span className="text-xs text-gray-600 uppercase tracking-widest">Admin</span>
                )}
              </div>
              {adminItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-accent/20 text-accent"
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                    )
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="relative flex items-center justify-between px-6 py-3 border-b border-white/5"
          style={{ background: "var(--surface)" }}
        >
          <div />
          <span className="absolute left-1/2 -translate-x-1/2 font-semibold text-sm tracking-wide hidden sm:block">
            YOLO Surveillance
          </span>
          <div className="flex items-center gap-4">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* User info */}
            <div className="flex items-center gap-2 text-sm">
              <div className="text-right hidden sm:block">
                <p className="text-white font-medium">{user?.full_name || user?.username}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium text-sm">
                {(user?.full_name || user?.username || "?")[0].toUpperCase()}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-danger rounded-md hover:bg-white/5 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
