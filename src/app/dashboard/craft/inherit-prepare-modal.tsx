"use client";

// 継承準備モーダル：対象装備を表示し、消費装備を選択して継承を実行。結果を追記表示。

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InheritTargetRow, InheritConsumeOptionRow } from "@/server/actions/craft";
import { inheritEquipmentCap } from "@/server/actions/craft";

const INHERIT_COOLDOWN_MS = 1500;

function successRateColorClass(percent: number): string {
  if (percent >= 100) return "bg-[linear-gradient(to_right,red,orange,yellow,lime,cyan,blue,violet)] bg-clip-text text-transparent font-semibold";
  if (percent >= 70) return "text-green-600 dark:text-green-400";
  if (percent >= 40) return "text-blue-600 dark:text-blue-400";
  return "text-red-600 dark:text-red-400";
}

type Props = {
  target: InheritTargetRow;
  targetLabel: string;
  consumeOptions: InheritConsumeOptionRow[];
  onClose: () => void;
};

export function InheritPrepareModal({
  target,
  targetLabel,
  consumeOptions,
  onClose,
}: Props) {
  const router = useRouter();
  const [displaySuccessRate, setDisplaySuccessRate] = useState(target.nextSuccessRatePercent);
  const [selectedConsumeId, setSelectedConsumeId] = useState<string>("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultCap, setResultCap] = useState<{ statCap: number; capCeiling: number } | null>(null);
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDisplaySuccessRate(target.nextSuccessRatePercent);
  }, [target.id, target.nextSuccessRatePercent]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  function handleInherit() {
    if (!selectedConsumeId || isOnCooldown) return;
    setIsOnCooldown(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      cooldownTimerRef.current = null;
      setIsOnCooldown(false);
    }, INHERIT_COOLDOWN_MS);

    startTransition(async () => {
      const result = await inheritEquipmentCap(target.id, selectedConsumeId);
      if (result.success) {
        router.refresh();
        setResultMessage(result.message);
        setResultCap({ statCap: result.statCap, capCeiling: result.capCeiling });
      } else {
        setResultMessage(result.message);
        if (result.nextSuccessRatePercent != null) {
          setDisplaySuccessRate(result.nextSuccessRatePercent);
        }
      }
    });
  }

  const canExecute = selectedConsumeId !== "" && !isPending && !isOnCooldown;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inherit-prepare-title"
    >
      <div className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 id="inherit-prepare-title" className="text-lg font-medium text-text-primary">
          {targetLabel} の継承
        </h2>

        <div className="mt-4 text-sm space-y-1">
          <p className="text-text-primary">対象上限　{target.capCeiling}</p>
          <p>
            成功率　<span className={`font-medium ${successRateColorClass(displaySuccessRate)}`}>
              {displaySuccessRate}％
            </span>
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-text-primary mb-1">
            消費装備
          </label>
          <select
            value={selectedConsumeId}
            onChange={(e) => setSelectedConsumeId(e.target.value)}
            className="w-full rounded border border-base-border bg-base px-3 py-2 text-sm text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
          >
            <option value="">選択してください</option>
            {consumeOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.equipmentTypeName} 上限 {c.capCeiling}
              </option>
            ))}
          </select>
          {consumeOptions.length === 0 && (
            <p className="mt-1 text-sm text-text-muted">対象より上限が高い装備がありません。</p>
          )}
        </div>

        {resultMessage != null && (
          <div className="mt-4 pt-4 border-t border-base-border text-sm">
            <p className={resultCap != null ? "text-brass" : "text-text-primary"}>{resultMessage}</p>
            {resultCap != null && (
              <p className="mt-1 text-brass">
                新しい上限　{resultCap.capCeiling}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={handleInherit}
            disabled={!canExecute}
            className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          >
            {isPending ? "継承中…" : isOnCooldown ? "クール中…" : "継承"}
          </button>
        </div>
      </div>
    </div>
  );
}
