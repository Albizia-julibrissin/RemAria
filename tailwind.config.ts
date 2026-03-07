import type { Config } from "tailwindcss";
import { addIconSelectors } from "@iconify/tailwind";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // クール・スチームパンク: 青黒ベース
        base: {
          DEFAULT: "#0f1419",
          elevated: "#1a2028",
          border: "#2d3748",
        },
        // アクセント: 銅/ティール（機械・蒸気のイメージ）
        brass: {
          DEFAULT: "#0d9488",
          hover: "#14b8a6",
        },
        "text-primary": "#e2e8f0",
        "text-muted": "#94a3b8",
        error: "#f87171",
        success: "#34d399",
      },
    },
  },
  plugins: [
    // ファンタジー/RPG 向けアイコン（Iconify Game Icons, CC BY 3.0）
    addIconSelectors(["game-icons"]),
  ],
};

export default config;
