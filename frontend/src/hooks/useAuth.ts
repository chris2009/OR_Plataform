import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/api";

export function useAuthInit() {
  const { logout } = useAuthStore();

  useEffect(() => {
    // Intentar obtener usuario con el refresh token en cookie al cargar la app
    authApi
      .me()
      .then((res) => {
        // Solo actualizamos el user; el token se renueva via interceptor si hace falta
        useAuthStore.getState().setUser(res.data);
      })
      .catch(() => {
        logout();
      });
  }, []);
}
