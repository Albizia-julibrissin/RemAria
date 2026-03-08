"use client";

/**
 * 課金通貨 GRA（グラ）の表示。
 * 通常は合算を表示し、クリックで無償・有償の内訳を表示する。
 * manage/ECONOMY_DESIGN.md, src/lib/constants/currency.ts
 */

import { useState } from "react";
import { GameIcon } from "@/components/icons/game-icon";
import {
  PREMIUM_CURRENCY_DISPLAY_NAME,
  PREMIUM_CURRENCY_ICON_NAME,
} from "@/lib/constants/currency";

type Props = {
  /** 無償分 */
  free: number;
  /** 有償分 */
  paid: number;
  /** 見た目をコンパクトにする（例: ヘッダー用） */
  compact?: boolean;
  /** 通貨名「GRA」を数値の前に表示するか */
  showLabel?: boolean;
};

export function GraDisplay({ free, paid, compact = false, showLabel = true }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const total = free + paid;

  const iconSize = compact ? "w-4 h-4" : "w-5 h-5";
  const textSize = compact ? "text-sm" : "text-base";

  return (
    <div className="inline-flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setShowBreakdown((b) => !b)}
        className="inline-flex items-center gap-1.5 rounded p-1 -m-1 text-gra hover:text-gra-hover hover:bg-base-border/50 focus:outline-none focus:ring-2 focus:ring-gra focus:ring-offset-1 focus:ring-offset-base transition-colors"
        title="クリックで無償・有償の内訳を表示"
      >
        <GameIcon
          name={PREMIUM_CURRENCY_ICON_NAME}
          className={`${iconSize} text-gra`}
          ariaHidden={false}
        />
        <span className={`font-medium tabular-nums ${textSize} text-gra`}>
          {showLabel ? (
            <>
              <span className="font-normal mr-1">{PREMIUM_CURRENCY_DISPLAY_NAME}</span>
              {total.toLocaleString()}
            </>
          ) : (
            total.toLocaleString()
          )}
        </span>
      </button>
      {showBreakdown && (
        <div className="text-xs text-text-muted pl-6 space-y-0.5">
          <div className="tabular-nums">無償: {free.toLocaleString()}</div>
          <div className="tabular-nums">有償: {paid.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
