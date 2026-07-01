import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { usersApi, type User } from "@/api";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const ROLES = ["admin", "operator", "viewer"] as const;
type Role = typeof ROLES[number];

const roleBadge: Record<Role, string> = {
  admin: "bg-danger/20 text-danger",
  operator: "bg-accent/20 text-accent",
  viewer: "bg-gray-700 text-gray-300",
};

interface UserForm {
  username: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  password: string;
}

const emptyForm = (): UserForm => ({
  username: "",
  email: "",
  full_name: "",
  role: "viewer",
  is_active: true,
  password: "",
});

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: User | null }>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [error, setError] = useState("");

  const load = () => usersApi.list().then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setError("");
    setModal({ open: true, editing: null });
  };

  const openEdit = (u: User) => {
    setForm({ username: u.username, email: u.email, full_name: u.full_name, role: u.role, is_active: u.is_active, password: "" });
    setError("");
    setModal({ open: true, editing: u });
  };

  const handleSave = async () => {
    setError("");
    try {
      if (modal.editing) {
        const payload: Parameters<typeof usersApi.update>[1] = { ...form };
        if (!payload.password) delete payload.password;
        await usersApi.update(modal.editing.id, payload);
      } else {
        if (!form.password) { setError("La contraseña es requerida"); return; }
        await usersApi.create(form);
      }
      setModal({ open: false, editing: null });
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al guardar";
      setError(msg);
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) return;
    if (!confirm(`¿Eliminar usuario "${u.username}"?`)) return;
    await usersApi.delete(u.id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gestión de Usuarios</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="card-glass overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-gray-500 text-left">
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Creado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{u.username}</p>
                    <p className="text-xs text-gray-500">{u.full_name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={cn("px-2 py-0.5 rounded text-xs capitalize", roleBadge[u.role])}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs", u.is_active ? "text-success" : "text-gray-500")}>
                    {u.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {format(new Date(u.created_at), "dd/MM/yyyy")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-gray-400 hover:text-danger transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setModal({ open: false, editing: null })}>
          <div className="card-glass w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">
              {modal.editing ? "Editar usuario" : "Nuevo usuario"}
            </h2>

            {[
              { label: "Nombre completo", key: "full_name", type: "text" },
              { label: "Username", key: "username", type: "text" },
              { label: "Email", key: "email", type: "email" },
              { label: modal.editing ? "Nueva contraseña (opcional)" : "Contraseña", key: "password", type: "password" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-sm text-gray-400 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key as keyof UserForm] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="input-field"
                />
              </div>
            ))}

            <div>
              <label className="block text-sm text-gray-400 mb-1">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                className="input-field"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="accent-accent"
              />
              <span className="text-sm text-gray-400">Usuario activo</span>
            </label>

            {error && <p className="text-sm text-danger bg-danger/10 rounded px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="btn-primary flex-1">Guardar</button>
              <button onClick={() => setModal({ open: false, editing: null })} className="btn-ghost flex-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
