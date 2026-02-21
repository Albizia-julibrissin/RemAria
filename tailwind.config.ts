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
        base: {
          DEFAULT: "#1e1915",
          elevated: "#2a2420",
          border: "#3d3530",
        },
        brass: {
          DEFAULT: "#b8860b",
          hover: "#c9a227",
        },
        "text-primary": "#e8e0d5",
        "text-muted": "#b5a99a",
      },
    },
  },
  plugins: [],
};

export default config;
