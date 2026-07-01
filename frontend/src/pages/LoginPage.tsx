import { useState, FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Shield, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/api";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { user, accessToken, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user && accessToken) return <Navigate to="/live" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: tokenData } = await authApi.login(username, password);
      useAuthStore.setState({ accessToken: tokenData.access_token });
      const { data: meData } = await authApi.me();
      setAuth(tokenData.access_token, meData);
      navigate("/live", { replace: true });
    } catch {
      setError("Usuario o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div className="card-glass w-full max-w-sm p-8 space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center">
            <Shield className="text-accent" size={32} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">YOLO Surveillance</h1>
            <p className="text-sm text-gray-500 mt-1">Plataforma de videovigilancia inteligente</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 rounded-md px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn("btn-primary w-full justify-center flex", loading && "opacity-60 cursor-not-allowed")}
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
