import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brq: {
          blue: "#5B2AA8",
          navy: "#15171B",
          cyan: "#B56CFF",
          orange: "#EE7C38",
          purple: "#7F2EC9",
          ink: "#15171B",
          mist: "#EFEFEF",
        },
      },
      boxShadow: {
        executive: "0 14px 40px -20px rgba(5, 43, 96, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
