"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { allocateCharacterStats } from "@/server/actions/character-stats";
import {
  type ReconstitutionState,
  executePartialReconstitution,
  executeFullReconstitution,
  executeFullReconstitutionBeta,
} from "@/server/actions/reconstitution";
import { POINTS_PER_RECONSTITUTION_ITEM } from "@/lib/constants/level";

const BASE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK", "CAP"] as const;
const ALLOCATABLE_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

type BaseStatsRow = Record<(typeof BASE_STAT_KEYS)[number], number>;

type Props = {
  characterId: string;
  character: BaseStatsRow;
  isMech: boolean;
  relicBonus: Record<string, number>;
  mechaEquipmentBonus: Record<string, number> | null;
  reconstitutionState: ReconstitutionState | null;
};

const buttonClass =
  "rounded border border-base-border bg-base px-2 py-1 text-sm text-text-muted hover:border-brass hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

export function CharacterStatSection({
  characterId,
  character,
  isMech,
  relicBonus,
  mechaEquipmentBonus,
  reconstitutionState,
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

  // 再構築モーダル
  const [reconModal, setReconModal] = useState<"partial" | "full" | "fullBeta" | null>(null);
  const [partialQuantity, setPartialQuantity] = useState(1);
  const [partialRevertDeltas, setPartialRevertDeltas] = useState<Record<(typeof ALLOCATABLE_KEYS)[number], number>>({
    STR: 0,
    INT: 0,
    VIT: 0,
    WIS: 0,
    DEX: 0,
    AGI: 0,
    LUK: 0,
  });

  const openPartialModal = () => {
    setPartialRevertDeltas({ STR: 0, INT: 0, VIT: 0, WIS: 0, DEX: 0, AGI: 0, LUK: 0 });
    setPartialQuantity(1);
    setMessage(null);
    setReconModal("partial");
  };

  const cap = character.CAP;
  const currentSum = ALLOCATABLE_KEYS.reduce((acc, k) => acc + character[k], 0);
  const deltaSum = ALLOCATABLE_KEYS.reduce((acc, k) => acc + deltas[k], 0);
  const available = Math.max(0, cap - currentSum);
  const minPerStat = Math.floor(cap * 0.1);
  const maxPerStat = Math.floor(cap * 0.3);

  const handleDeltaChange = (key: (typeof ALLOCATABLE_KEYS)[number], value: number | string) => {
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

  const doFullReconstitution = async () => {
    if (!reconstitutionState?.canFull || isPending) return;
    setMessage(null);
    setIsPending(true);
    setReconModal(null);
    const result = await executeFullReconstitution(characterId);
    setIsPending(false);
    if (result.success) {
      setMessage("完全再構築を実行しました。");
      setIsError(false);
      router.refresh();
    } else {
      setMessage(result.message);
      setIsError(true);
    }
  };

  const doFullReconstitutionBeta = async () => {
    if (!reconstitutionState?.canFullBeta || isPending) return;
    setMessage(null);
    setIsPending(true);
    setReconModal(null);
    const result = await executeFullReconstitutionBeta(characterId);
    setIsPending(false);
    if (result.success) {
      setMessage("完全再構築βを実行しました。");
      setIsError(false);
      router.refresh();
    } else {
      setMessage(result.message);
      setIsError(true);
    }
  };

  const doPartialReconstitution = async () => {
    if (!reconstitutionState?.canPartial || isPending) return;
    setMessage(null);
    setIsPending(true);
    setReconModal(null);
    const result = await executePartialReconstitution(characterId, partialQuantity, partialRevertDeltas);
    setIsPending(false);
    if (result.success) {
      setMessage("部分再構築を実行しました。振り戻したポイントは未割り振りです。配分で振り直してください。");
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

  useEffect(() => {
    if (!reconModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReconModal(null);
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [reconModal]);

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
            {reconstitutionState && (
              <>
                <button
                  type="button"
                  onClick={openPartialModal}
                  disabled={isPending || !reconstitutionState.canPartial}
                  className={buttonClass}
                  title={reconstitutionState.canPartial ? "再構築アンプルαで一部ポイントを振り直す" : "アンプルαが不足しているか、振り戻し可能ポイントがありません"}
                >
                  部分再構築
                </button>
                <button
                  type="button"
                  onClick={() => setReconModal("full")}
                  disabled={isPending || (reconstitutionState.alphaCount < 1)}
                  className={buttonClass}
                  title={
                    reconstitutionState.fullUnavailableReason === "LEVEL_TOO_LOW"
                      ? "身体への負担が大きく施術不可能です"
                      : "5レベルダウンで全ポイント振り直し"
                  }
                >
                  完全再構築
                </button>
                <button
                  type="button"
                  onClick={() => setReconModal("fullBeta")}
                  disabled={isPending || !reconstitutionState.canFullBeta}
                  className={buttonClass}
                  title={reconstitutionState.canFullBeta ? "アンプルβでレベルダウンなしで全ポイント振り直し" : "アンプルβを所持していません"}
                >
                  完全再構築β
                </button>
              </>
            )}
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
                中止
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

      {reconModal === "full" && reconstitutionState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setReconModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recon-full-title"
            className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="recon-full-title" className="text-lg font-medium text-text-primary">
              完全再構築
            </h3>
            {reconstitutionState.fullUnavailableReason === "LEVEL_TOO_LOW" ? (
              <p className="mt-4 text-sm font-medium text-amber-600 dark:text-amber-400">
                身体への負担が大きく施術不可能です。（レベル6以上で利用できます）
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-text-muted">
                  再構築アンプルαを1個消費し、レベルが5下がります。経験値はそのレベルに合わせてリセットされ、戻した分は消失します。ステータスは下限のみになり、残りは未割り振りです。
                </p>
                <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  実行しますか？
                </p>
              </>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setReconModal(null)} className={buttonClass}>
                {reconstitutionState.fullUnavailableReason === "LEVEL_TOO_LOW" ? "閉じる" : "中止"}
              </button>
              {reconstitutionState.canFull && (
                <button
                  type="button"
                  onClick={() => doFullReconstitution()}
                  disabled={isPending}
                  className="inline-flex rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
                >
                  {isPending ? "実行中…" : "実行"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {reconModal === "fullBeta" && reconstitutionState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setReconModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recon-fullbeta-title"
            className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="recon-fullbeta-title" className="text-lg font-medium text-text-primary">
              完全再構築β
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              再構築アンプルβを1個消費します。レベル・経験値は変わりません。ステータスは下限のみになり、残りは未割り振りです。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setReconModal(null)} className={buttonClass}>
                中止
              </button>
              <button
                type="button"
                onClick={() => doFullReconstitutionBeta()}
                disabled={isPending}
                className="inline-flex rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
              >
                {isPending ? "実行中…" : "実行"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reconModal === "partial" && reconstitutionState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setReconModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recon-partial-title"
            className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="recon-partial-title" className="text-lg font-medium text-text-primary">
              部分再構築
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              再構築アンプルαを消費し、各ステから減らす量を選びます。減らした分は未割り振りになり、あとで配分画面で振り直せます。
            </p>
            <div className="mt-4 flex items-baseline justify-between gap-4">
              <label className="text-sm font-medium text-text-muted">使用個数</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={reconstitutionState.alphaCount}
                  value={partialQuantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const q = Number.isNaN(v) ? 1 : Math.max(1, Math.min(reconstitutionState.alphaCount, v));
                    setPartialQuantity(q);
                  }}
                  className="w-14 shrink-0 rounded border border-base-border bg-base px-1.5 py-1 text-right text-sm tabular-nums text-text-primary"
                  aria-label="使用個数"
                />
                <span className="shrink-0 text-sm text-text-muted">
                  所持{reconstitutionState.alphaCount}（振り戻し必要: {partialQuantity * POINTS_PER_RECONSTITUTION_ITEM}pt）
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm tabular-nums text-text-primary">
              <span className={ALLOCATABLE_KEYS.reduce((a, k) => a + (partialRevertDeltas[k] ?? 0), 0) === partialQuantity * POINTS_PER_RECONSTITUTION_ITEM ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                {ALLOCATABLE_KEYS.reduce((a, k) => a + (partialRevertDeltas[k] ?? 0), 0)} / {partialQuantity * POINTS_PER_RECONSTITUTION_ITEM}
              </span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {ALLOCATABLE_KEYS.map((key) => {
                const minPerStat = Math.floor(reconstitutionState.cap * 0.1);
                const maxRevertForStat = Math.max(0, character[key] - minPerStat);
                const otherSum = ALLOCATABLE_KEYS.reduce((a, k) => (k === key ? a : a + (partialRevertDeltas[k] ?? 0)), 0);
                const requiredRevert = partialQuantity * POINTS_PER_RECONSTITUTION_ITEM;
                const maxAllowed = Math.min(maxRevertForStat, Math.max(0, requiredRevert - otherSum));
                return (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-text-muted">{key}</span>
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-right tabular-nums text-text-muted">{character[key]}</span>
                      <span className="text-text-muted">−</span>
                      <input
                        type="number"
                        min={0}
                        max={maxAllowed}
                        value={partialRevertDeltas[key] ?? ""}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          const n = Number.isNaN(v) ? 0 : Math.max(0, Math.min(maxAllowed, v));
                          setPartialRevertDeltas((prev) => ({ ...prev, [key]: n }));
                        }}
                        className="w-14 rounded border border-base-border bg-base px-1 py-0.5 text-right tabular-nums text-text-primary"
                        aria-label={`${key}から減らす量`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setReconModal(null)} className={buttonClass}>
                中止
              </button>
              <button
                type="button"
                onClick={() => doPartialReconstitution()}
                disabled={
                  isPending ||
                  ALLOCATABLE_KEYS.reduce((a, k) => a + (partialRevertDeltas[k] ?? 0), 0) !== partialQuantity * POINTS_PER_RECONSTITUTION_ITEM
                }
                className="inline-flex rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
              >
                {isPending ? "実行中…" : "実行"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
