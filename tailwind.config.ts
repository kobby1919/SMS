import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter:          ["var(--font-inter)", "sans-serif"],
        nunito:         ["var(--font-nunito)", "sans-serif"],
        clashDisplay:   ['"Clash Display"', "sans-serif"],
        cabinetGrotesk: ['"Cabinet Grotesk"', "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        jaySky:          "#C3EBFA",
        jaySkyLight:     "#EDF9FD",
        jayPurple:       "#CFCEFF",
        jayPurpleLight:  "#F1F0FF",
        jayYellow:       "#FAE27C",
        jayYellowLight:  "#FEFCE8",
        edujay: {
          ink:        "#0F172A",
          primary:    "#1D4ED8",
          primaryDark:"#1E3A8A",
          soft:       "#EFF6FF",
          ring:       "#BFDBFE",
          surface:    "#F8FAFC",
          border:     "#E2E8F0",
          muted:      "#64748B",
          success:    "#059669",
          warning:    "#D97706",
          danger:     "#DC2626",
        },
      },
    },
  },
  plugins: [],
};

export default config;
