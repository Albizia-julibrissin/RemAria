"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  finishExploration,
  type FinishExplorationSummary,
  type FinishExplorationDropSlot,
  type FinishExplorationDropSlotOrigin,
} from "@/server/actions/exploration";

type Props = {
  themeName: string;
  areaName: string;
  isWiped: boolean;
};

/** 枠の由来ごとの表示用スタイル（銅・銀・金・虹） */
function getSlotStyle(origin: FinishExplorationDropSlotOrigin): string {
  switch (origin) {
    case "base":
      return "border-gray-500/60 bg-gray-800/40 text-gray-200";
    case "battle":
      return "border-amber-600/80 bg-amber-950/50 text-amber-100";
    case "skill":
      return "border-slate-400 bg-slate-700/50 text-slate-100";
    case "strong_enemy":
      return "border-yellow-500/90 bg-yellow-900/40 text-yellow-100";
    case "area_lord_special":
      return "border-transparent bg-gradient-to-r from-purple-600/80 via-pink-500/80 to-amber-500/80 text-white shadow-md";
    default:
      return "border-base-border bg-base-elevated text-text-primary";
  }
}

function SlotCard({ slot }: { slot: FinishExplorationDropSlot }) {
  const style = getSlotStyle(slot.origin);
  return (
    <div className={`rounded-lg border-2 p-2 ${style}`}>
      <p className="text-xs font-medium opacity-90">{slot.label}</p>
      {slot.items.length === 0 ? (
        <p className="mt-1 text-xs opacity-70">（なし）</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-xs">
          {slot.items.map((it, i) => (
            <li key={i}>
              {it.itemName} × {it.quantity}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExplorationFinishClient({ themeName, areaName, isWiped }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<FinishExplorationSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resultAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (summary && resultAreaRef.current) {
      resultAreaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [summary]);

  const handleFinish = () => {
    if (isPending) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await finishExploration();
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setSummary(result.summary);
      // 報酬内容を視認できるよう、ここではリフレッシュしない。「開拓拠点へ戻る」で遷移する
    });
  };

  const handleBackToDashboard = () => {
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="mt-4 rounded-lg border border-base-border bg-base-elevated p-4 space-y-3">
      <div>
        <p className="text-xs text-text-muted">
          {isWiped
            ? `${areaName}の探索で敗北しましたが、ここまでの結果に応じた報酬を受け取ることができます。`
            : `${areaName}の探索をクリアしました。ここまでの結果に応じた報酬を受け取ることができます。`}
        </p>
      </div>

      <button
        type="button"
        onClick={handleFinish}
        disabled={isPending || summary != null}
        className="inline-flex items-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-base shadow-sm disabled:bg-base-border disabled:text-text-muted"
      >
        {summary ? "報酬を受け取りました" : isPending ? "報酬を計算中..." : "報酬を受け取って探索を終了"}
      </button>

      {errorMessage && (
        <p className="text-xs text-error" role="alert">
          {errorMessage}
        </p>
      )}

      {summary && (
        <div ref={resultAreaRef} className="mt-3 space-y-3">
          <h3 className="text-sm font-medium text-text-muted">今回の探索結果</h3>
          <p className="text-xs text-text-muted">
            結果: {summary.result === "cleared" ? "クリア" : "敗北"} / 通常戦闘勝利数{summary.battleWins}、{summary.strongEnemyWon ? "強敵勝利" : "強敵未勝利"}、技能成功数{summary.skillSuccessCount}、{summary.areaLordWon ? "領域主勝利" : "領域主未勝利"}、獲得 Exp: {summary.totalExpGained}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.dropSlots.map((slot, idx) => (
              <SlotCard key={idx} slot={slot} />
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-base-border">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="rounded-md bg-base-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-base hover:opacity-90"
            >
              開拓拠点へ戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

