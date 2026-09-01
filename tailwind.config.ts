import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deeper, more "corporate SaaS" blue than the original electric
        // #1c3ff5 — same family, tuned for a calmer, higher-contrast dark
        // sidebar + light-surface dashboard look.
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        ink: {
          // Sidebar/header surface — near-black slate, distinct from the
          // slate-* grays used for light-surface text/borders elsewhere.
          900: "#0b1120",
          800: "#111827",
          700: "#1b2436",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        "card-hover": "0 4px 8px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
        popover: "0 12px 32px -8px rgb(15 23 42 / 0.18)",
      },
      maxWidth: {
        "screen-2xl": "1536px",
      },
    },
  },
  plugins: [],
};

export default config;
