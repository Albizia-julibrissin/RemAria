"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishExploration, type FinishExplorationSummary } from "@/server/actions/exploration";

type Props = {
  themeName: string;
  areaName: string;
  isWiped: boolean;
};

export function ExplorationFinishClient({ themeName, areaName, isWiped }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<FinishExplorationSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      // ダッシュボードの状態も更新しておきたいのでリフレッシュ
      router.refresh();
    });
  };

  return (
    <div className="mt-4 rounded-lg border border-base-border bg-base-elevated p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-text-primary">
          {themeName} / {areaName}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {isWiped
            ? "敗北しましたが、ここまでの結果に応じた報酬を受け取ることができます。"
            : "探索をクリアしました。ここまでの結果に応じた報酬を受け取ることができます。"}
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
        <div className="mt-3 space-y-2">
          <h3 className="text-sm font-medium text-text-muted">今回の探索結果（仮サマリ）</h3>
          <p className="text-xs text-text-muted">
            結果: {summary.result === "cleared" ? "クリア" : "敗北"} / 勝利数: {summary.battleWins} / 技能成功:
            {summary.skillSuccessCount} / 獲得予定 Exp 合計: {summary.totalExpGained}
          </p>
          <div className="mt-2">
            <p className="text-xs font-medium text-text-muted">ドロップ枠の内訳（由来ごと）</p>
            <ul className="mt-1 space-y-1 text-xs text-text-primary">
              {summary.dropSlots.map((slot, idx) => (
                <li key={idx} className="flex items-center justify-between">
                  <span>
                    {slot.label}
                    <span className="ml-1 text-[10px] text-text-muted">
                      (
                      {slot.origin === "base"
                        ? "基本"
                        : slot.origin === "battle"
                        ? "戦闘"
                        : slot.origin === "skill"
                        ? "技能"
                        : slot.origin === "mid_boss"
                        ? "中ボス"
                        : "大ボス専用"}
                      )
                    </span>
                  </span>
                  {/* 将来的にここに実際の item 名やアイコンを表示する */}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

