import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#030712",
        card: "rgba(17, 24, 39, 0.7)",
        primary: {
          DEFAULT: "#06b6d4", // Cyan
          dark: "#0891b2"
        },
        secondary: {
          DEFAULT: "#6366f1", // Indigo
          dark: "#4f46e5"
        },
        accent: {
          DEFAULT: "#a855f7", // Purple
          dark: "#9333ea"
        },
        muted: "#9ca3af",
        border: "rgba(255, 255, 255, 0.08)"
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "cyan-glow": "0 0 15px rgba(6, 182, 212, 0.4)",
        "indigo-glow": "0 0 15px rgba(99, 102, 241, 0.4)"
      }
    },
  },
  plugins: [],
};

export default config;
