/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        display: ["'Sora'", "'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        brand: {
          50:  "#f0f7ff",
          100: "#dceeff",
          200: "#b2d9ff",
          300: "#6db9ff",
          400: "#2194ff",
          500: "#0072f5",
          600: "#0057d9",
          700: "#0043b0",
          800: "#003890",
          900: "#002f76",
        },
        surface: {
          DEFAULT: "#0d1117",
          card:    "#161b22",
          input:   "#1c2430",
          border:  "#30363d",
          hover:   "#21262d",
        },
      },
      animation: {
        "fade-in":     "fadeIn 0.4s ease both",
        "slide-up":    "slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-dot":   "pulseDot 1.4s ease-in-out infinite",
        "spin-slow":   "spin 2s linear infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        pulseDot: { "0%,100%": { opacity: 0.3, transform: "scale(0.8)" }, "50%": { opacity: 1, transform: "scale(1)" } },
      },
    },
  },
  plugins: [],
};
