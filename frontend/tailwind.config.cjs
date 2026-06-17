/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        slate: {
          950: "rgb(var(--slate-950) / <alpha-value>)",
          900: "rgb(var(--slate-900) / <alpha-value>)",
          800: "rgb(var(--slate-800) / <alpha-value>)",
          700: "rgb(var(--slate-700) / <alpha-value>)",
          600: "rgb(var(--slate-600) / <alpha-value>)",
          500: "rgb(var(--slate-500) / <alpha-value>)",
          400: "rgb(var(--slate-400) / <alpha-value>)",
          300: "rgb(var(--slate-300) / <alpha-value>)",
          200: "rgb(var(--slate-200) / <alpha-value>)",
          100: "rgb(var(--slate-100) / <alpha-value>)",
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
