/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0A0E17",
          light: "#F0F2F7",
        },
        accent: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
        },
        success: "#10B981",
        danger: "#EF4444",
        warning: "#F59E0B",
        surface: {
          DEFAULT: "#111827",
          light: "#FFFFFF",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          light: "rgba(0,0,0,0.1)",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
