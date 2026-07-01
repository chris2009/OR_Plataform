import { create } from "zustand";

interface ThemeState {
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  toggle: () => void;
}

const savedTheme = (localStorage.getItem("theme") as "dark" | "light") || "dark";

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: savedTheme,
  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    document.documentElement.className = theme === "light" ? "light" : "";
    set({ theme });
  },
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));

// Aplicar tema inicial
document.documentElement.className = savedTheme === "light" ? "light" : "";
