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
    "game-icons--mailbox", // 郵便（ヘッダー・郵便画面）
    "game-icons--coins", // 郵便・無償GRA
    "game-icons--gem", // 郵便・有償GRA
    "game-icons--book-cover", // 郵便・研究記録書
    "game-icons--backpack", // 郵便・アイテム
    "game-icons--medal", // 郵便・称号
    "game-icons--gift", // 郵便・受け取るボタン
    "game-icons--factory", // 機工区
    "game-icons--microscope", // 研究局
    "game-icons--anvil-impact", // 工房
    "game-icons--wooden-crate", // 物資庫
    "game-icons--feather", // 開拓任務
    "game-icons--flag", // チャット・任務達成システムメッセージ（spec/094）
    "game-icons--battle-gear", // 作戦室
    "game-icons--hand-bag", // 市場・購入
    "game-icons--shop", // 市場・出品
    "game-icons--weight-scale", // 市場・ダッシュボード（天秤・旧）
    "game-icons--life-in-the-balance", // 市場・開拓拠点
    "game-icons--hourglass", // 市場・履歴
    "game-icons--clockwise-rotation", // 市場・購入一覧更新
    "game-icons--person", // 開拓者証
    "game-icons--gold-bar", // 研究・設備コスト拡張
    "game-icons--expanded-rays", // 研究局・グループ名
    "game-icons--black-bar", // 開拓拠点・闇市
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
