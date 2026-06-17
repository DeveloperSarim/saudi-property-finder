/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        slate: {
          950: "var(--slate-950)",
          900: "var(--slate-900)",
          800: "var(--slate-800)",
          700: "var(--slate-700)",
          600: "var(--slate-600)",
          500: "var(--slate-500)",
          400: "var(--slate-400)",
          300: "var(--slate-300)",
          200: "var(--slate-200)",
          100: "var(--slate-100)",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
      },
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
        body: ["'DM Sans'", "sans-serif"],
      },
      animation: {
        "scan-line": "scan 2.4s ease-in-out infinite",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
        "fade-up": "fadeUp 0.5s ease forwards",
        "slide-in": "slideIn 0.4s ease forwards",
        shimmer: "shimmer 1.8s infinite linear",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(0%)", opacity: "0.9" },
          "50%": { transform: "translateY(100%)", opacity: "0.4" },
          "100%": { transform: "translateY(0%)", opacity: "0.9" },
        },
        pulseDot: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.6)", opacity: "0.4" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
