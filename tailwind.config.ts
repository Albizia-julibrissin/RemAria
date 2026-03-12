import type { Config } from "tailwindcss";
import { addIconSelectors } from "@iconify/tailwind";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // 動的クラス名のアイコンが purge されないよう、使用するアイコン名を明示
  safelist: [
    "game-icons--gear-stick", // 既存用途（必要なら残す）
    "game-icons--big-gear", // 通貨アイコン
    "game-icons--three-friends", // 居住区
    "game-icons--scroll-quill", // 人材局
    "game-icons--ringing-bell", // 通知
    "game-icons--factory", // 機工区
    "game-icons--microscope", // 研究局
    "game-icons--anvil-impact", // 工房
    "game-icons--wooden-crate", // 物資庫
    "game-icons--feather", // 開拓任務
    "game-icons--battle-gear", // 作戦室
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
        // GRA（課金通貨）表示用ネオン青
        gra: {
          DEFAULT: "#00d4ff",
          hover: "#33ddff",
        },
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
