/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#c0c1ff",
        "on-primary": "#1000a9",
        "primary-container": "#8083ff",
        secondary: "#4edea3",
        "on-secondary": "#003824",
        tertiary: "#ff516a",
        error: "#ffb4ab",
        "on-error": "#690005",
        background: "#10131a",
        "surface-dim": "#10131a",
        "surface-container-lowest": "#0b0e14",
        "surface-container-low": "#191c22",
        "surface-container": "#1d2026",
        "surface-container-high": "#272a31",
        "surface-variant": "#32353c",
        "on-surface": "#e1e2eb",
        "on-surface-variant": "#c7c4d7",
        outline: "#464554"
      },
      fontFamily: {
        sans: ["Geist", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem"
      }
    }
  },
  plugins: []
};
