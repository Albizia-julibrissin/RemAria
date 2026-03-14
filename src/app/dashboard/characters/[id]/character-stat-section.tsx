"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { allocateCharacterStats } from "@/server/actions/character-stats";

const BASE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK", "CAP"] as const;
const ALLOCATABLE_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

type BaseStatsRow = Record<(typeof BASE_STAT_KEYS)[number], number>;

type Props = {
  characterId: string;
  character: BaseStatsRow;
  isMech: boolean;
  relicBonus: Record<string, number>;
  mechaEquipmentBonus: Record<string, number> | null;
};

const buttonClass =
  "rounded border border-base-border bg-base px-2 py-1 text-sm text-text-muted hover:border-brass hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

export function CharacterStatSection({
  characterId,
  character,
  isMech,
  relicBonus,
  mechaEquipmentBonus,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<"display" | "allocation">("display");
  const [deltas, setDeltas] = useState<Record<(typeof ALLOCATABLE_KEYS)[number], number>>({
    STR: 0,
    INT: 0,
    VIT: 0,
    WIS: 0,
    DEX: 0,
    AGI: 0,
    LUK: 0,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [showAllocationHelp, setShowAllocationHelp] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const confirmModalRef = useRef<HTMLDivElement>(null);

  const cap = character.CAP;
  const currentSum = ALLOCATABLE_KEYS.reduce((acc, k) => acc + character[k], 0);
  const deltaSum = ALLOCATABLE_KEYS.reduce((acc, k) => acc + deltas[k], 0);
  const available = Math.max(0, cap - currentSum);
  const minPerStat = Math.floor(cap * 0.1);
  const maxPerStat = Math.floor(cap * 0.3);

  const handleDeltaChange = (key: (typeof ALLOCATABLE_KEYS)[number], value: number) => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    const prevDelta = deltas[key];
    const otherSum = deltaSum - prevDelta;
    const maxThis = Math.min(maxPerStat - character[key], Math.max(0, available - otherSum));
    const newVal = Math.min(n, maxThis);
    setDeltas((prev) => ({ ...prev, [key]: newVal }));
    setMessage(null);
  };

  const doSubmitAllocation = async () => {
    if (deltaSum <= 0 || isPending) return;
    setMessage(null);
    setIsPending(true);
    setShowConfirmModal(false);
    const newValues = {
      characterId,
      STR: character.STR + deltas.STR,
      INT: character.INT + deltas.INT,
      VIT: character.VIT + deltas.VIT,
      WIS: character.WIS + deltas.WIS,
      DEX: character.DEX + deltas.DEX,
      AGI: character.AGI + deltas.AGI,
      LUK: character.LUK + deltas.LUK,
    };
    const result = await allocateCharacterStats(newValues);
    setIsPending(false);
    if (result.success) {
      setMessage("保存しました。");
      setIsError(false);
      setDeltas({ STR: 0, INT: 0, VIT: 0, WIS: 0, DEX: 0, AGI: 0, LUK: 0 });
      router.refresh();
    } else {
      setMessage(result.message);
      setIsError(true);
    }
  };

  useEffect(() => {
    if (!showConfirmModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowConfirmModal(false);
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [showConfirmModal]);

  return (
    <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
      <div className="flex flex-wrap items-center gap-2">
        {view === "display" ? (
          <>
            <h2 className="text-lg font-medium text-text-primary">ステータス</h2>
            {!isMech && (
              <button
                type="button"
                onClick={() => setView("allocation")}
                className={buttonClass}
              >
                配分
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setView("display")}
              className={buttonClass}
            >
              ステータス
            </button>
            <span className="text-lg font-medium text-text-primary">配分</span>
            <button
              type="button"
              onClick={() => setShowAllocationHelp((v) => !v)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-base-border bg-base-elevated text-sm text-text-muted transition-colors hover:border-brass hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
              aria-label="配分の説明"
              title="説明"
            >
              !
            </button>
          </>
        )}
      </div>

      {view === "display" && (
        <table className="mt-3 w-full min-w-[200px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-base-border text-left text-text-muted">
              <th className="py-1 pr-4 font-medium"></th>
              <th className="w-14 py-1 text-right font-medium tabular-nums">基礎</th>
              {isMech && (
                <th className="w-14 py-1 text-right font-medium tabular-nums">パーツ</th>
              )}
              <th className="w-14 py-1 text-right font-medium tabular-nums">遺物</th>
            </tr>
          </thead>
          <tbody>
            {BASE_STAT_KEYS.map((key) => {
              const baseVal = character[key];
              const relAdd = key === "CAP" ? 0 : (relicBonus[key] ?? 0);
              const partsAdd =
                isMech && key !== "CAP" ? (mechaEquipmentBonus?.[key] ?? 0) : 0;
              if (key === "CAP") {
                return (
                  <tr key={key} className="border-b border-base-border/70">
                    <td className="py-1 pr-4 text-text-muted">{key}</td>
                    <td className="py-1 text-right font-medium tabular-nums text-text-primary">
                      {baseVal}
                    </td>
                    {isMech && (
                      <td className="py-1 text-right tabular-nums text-text-muted">—</td>
                    )}
                    <td className="py-1 text-right tabular-nums text-text-muted">—</td>
                  </tr>
                );
              }
              return (
                <tr key={key} className="border-b border-base-border/70">
                  <td className="py-1 pr-4 text-text-muted">{key}</td>
                  <td className="py-1 text-right font-medium tabular-nums text-text-primary">
                    {baseVal}
                  </td>
                  {isMech && (
                    <td className="py-1 text-right tabular-nums text-text-primary">
                      {partsAdd > 0 ? (
                        <span className="text-green-600 dark:text-green-400">
                          +{partsAdd}
                        </span>
                      ) : (
                        "+0"
                      )}
                    </td>
                  )}
                  <td className="py-1 text-right tabular-nums text-text-primary">
                    {relAdd > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">+{relAdd}</span>
                    ) : (
                      "+0"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {view === "allocation" && !isMech && (
        <div className="mt-3 space-y-3">
          {showAllocationHelp && (
            <p className="text-xs text-text-muted">
              割り振り数値を入力。1つのステータスの最大値はCAPの30％。
            </p>
          )}
          <p className="text-sm tabular-nums text-text-muted">
            現在合計: {currentSum} / {cap}　追加: {deltaSum}　残り: {available - deltaSum}
          </p>
          {message != null && (
            <p
              className={`text-sm ${isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
              role="alert"
            >
              {message}
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {ALLOCATABLE_KEYS.map((key) => {
              const current = character[key];
              const delta = deltas[key];
              const otherSum = deltaSum - delta;
              const maxAdd = Math.min(
                maxPerStat - current,
                Math.max(0, available - otherSum)
              );
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 border-b border-base-border/70 pb-1"
                >
                  <span className="text-text-muted">{key}</span>
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right tabular-nums text-text-primary">
                      {current}
                    </span>
                    <span className="text-text-muted">+</span>
                    <input
                      type="number"
                      min={0}
                      max={maxAdd}
                      value={delta || ""}
                      onChange={(e) => handleDeltaChange(key, e.target.value)}
                      className="w-14 rounded border border-base-border bg-base px-1 py-0.5 text-right tabular-nums text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
                      aria-label={`${key}に追加する値`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDeltas({
                  STR: 0,
                  INT: 0,
                  VIT: 0,
                  WIS: 0,
                  DEX: 0,
                  AGI: 0,
                  LUK: 0,
                })
              }
              disabled={isPending}
              className={buttonClass}
            >
              リセット
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isPending || deltaSum <= 0 || deltaSum > available}
              className="inline-flex rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
            >
              確定
            </button>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowConfirmModal(false)}
        >
          <div
            ref={confirmModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="allocation-confirm-title"
            className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="allocation-confirm-title" className="text-lg font-medium text-text-primary">
              配分を確定します。
            </h3>
            <p className="mt-4 text-sm text-text-muted">
              特殊なアイテムの利用以外で振り直しが出来ません。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className={buttonClass}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => doSubmitAllocation()}
                disabled={isPending}
                className="inline-flex rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
              >
                {isPending ? "送信中…" : "確定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
