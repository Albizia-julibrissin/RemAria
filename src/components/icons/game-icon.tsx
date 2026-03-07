"use client";

/**
 * ファンタジー/RPG 向けアイコン（Iconify Game Icons, CC BY 3.0）
 * 各所で <GameIcon name="ancient-sword" /> のように呼び出せる。
 *
 * アイコン一覧: https://icon-sets.iconify.design/game-icons/
 * 名前はケバブケース（例: ancient-sword, health-potion, dragon-head）
 */

export type GameIconName = string;

export interface GameIconProps {
  /** Game Icons のアイコン名（ケバブケース）。例: "ancient-sword", "health-potion" */
  name: GameIconName;
  /** 追加の Tailwind クラス（サイズ・色など）。例: "w-6 h-6 text-brass" */
  className?: string;
  /** アクセシビリティ用の代替テキスト（装飾のみの場合は空でよい） */
  ariaHidden?: boolean;
}

/**
 * Game Icons を表示する。色は className の text-* で指定（デフォルトは currentColor）。
 */
export function GameIcon({ name, className = "", ariaHidden = true }: GameIconProps) {
  // Iconify Tailwind プラグインが i-game-icons-* を生成。名前の . は - に変換される
  const iconClass = `i-game-icons-${name.replace(/\./g, "-")} ${className}`.trim();
  return (
    <span
      className={iconClass}
      style={{ display: "inline-block", width: "1em", height: "1em" }}
      aria-hidden={ariaHidden}
      role={ariaHidden ? undefined : "img"}
    />
  );
}
