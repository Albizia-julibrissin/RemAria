"use client";

// docs/087: 遺物の調律。遺物の欠片77個でパッシブ以外をリロール。確定/取消で反映または返却。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RelicInstanceSummary } from "@/server/actions/relic";
import type { RelicTemperStats } from "@/server/actions/relic";
import {
  getRelicTemperPending,
  startRelicTemper,
  confirmRelicTemper,
  cancelRelicTemper,
} from "@/server/actions/relic";
import { ATTRIBUTE_RESISTANCE_LABELS, RELIC_TEMPER_SHARD_COST } from "@/lib/constants/relic";

type Props = {
  relic: RelicInstanceSummary;
  relicShardQuantity: number;
  onClose: () => void;
};

function formatResistValue(value: number): string {
  if (value === 1) return "—";
  if (value < 1) return `${Math.round((1 - value) * 100)}%軽減`;
  return `${Math.round((value - 1) * 100)}%弱体`;
}

function TemperStatsBlock({
  title,
  stats,
}: {
  title: string;
  stats: RelicTemperStats;
}) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-text-muted">{title}</p>
      <ul className="space-y-0.5">
        {stats.statBonus1 && (
          <li className="flex justify-between">
            <span className="text-text-muted">{stats.statBonus1.stat}</span>
            <span className="text-text-primary">+{stats.statBonus1.percent}%</span>
          </li>
        )}
        {stats.statBonus2 && (
          <li className="flex justify-between">
            <span className="text-text-muted">{stats.statBonus2.stat}</span>
            <span className="text-text-primary">+{stats.statBonus2.percent}%</span>
          </li>
        )}
        {stats.attributeResistances && Object.keys(stats.attributeResistances).length > 0 && (
          <>
            {Object.entries(stats.attributeResistances).map(([key, value]) => {
              if (typeof value !== "number") return null;
              const attrLabel = ATTRIBUTE_RESISTANCE_LABELS[key as keyof typeof ATTRIBUTE_RESISTANCE_LABELS] ?? key;
              return (
                <li key={key} className="flex justify-between">
                  <span className="text-text-muted">{attrLabel}</span>
                  <span className="text-text-primary">{formatResistValue(value)}</span>
                </li>
              );
            })}
          </>
        )}
      </ul>
    </div>
  );
}

export function RelicTemperPrepareModal({
  relic,
  relicShardQuantity,
  onClose,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [temperResult, setTemperResult] = useState<{
    before: RelicTemperStats;
    after: RelicTemperStats;
  } | null>(null);
  const [tempering, setTempering] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRelicTemperPending(relic.id).then((res) => {
      if (cancelled || !res.success) {
        setLoading(false);
        return;
      }
      if (res.pending) {
        const before: RelicTemperStats = {
          statBonus1: relic.statBonus1,
          statBonus2: relic.statBonus2,
          attributeResistances: relic.attributeResistances,
        };
        setTemperResult({ before, after: res.pending.after });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [relic.id, relic.statBonus1, relic.statBonus2, relic.attributeResistances]);

  const canTemper = relicShardQuantity >= RELIC_TEMPER_SHARD_COST;

  async function handleTemper() {
    if (!canTemper || tempering) return;
    if (!window.confirm("本当に実行しますか？\n遺物の欠片77個を消費し、調律確定・取消に関わらず戻りません。")) return;
    setTempering(true);
    const result = await startRelicTemper(relic.id);
    setTempering(false);
    if (result.success) {
      setTemperResult({ before: result.before, after: result.after });
      router.refresh();
    } else {
      alert(result.message ?? "調律に失敗しました");
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    const result = await confirmRelicTemper(relic.id);
    setConfirming(false);
    if (result.success) {
      router.refresh();
      onClose();
    } else {
      alert(result.message ?? "確定に失敗しました");
    }
  }

  async function handleCancel() {
    setCancelling(true);
    const result = await cancelRelicTemper(relic.id);
    setCancelling(false);
    if (result.success) {
      router.refresh();
      onClose();
    } else {
      alert(result.message ?? "取消に失敗しました");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relic-temper-title"
      onClick={temperResult ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="relic-temper-title" className="text-lg font-medium text-text-primary">
          {relic.relicTypeName} の調律
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          <span
            title={relic.relicPassiveEffectDescription ?? undefined}
            className={relic.relicPassiveEffectDescription ? "cursor-help border-b border-dotted border-text-muted" : ""}
          >
            {relic.relicPassiveEffectName ?? "効果なし"}
          </span>
          （基幹効果は調律できません）
        </p>

        {!temperResult && (
          <div className="mt-4 border-t border-base-border pt-4">
            <TemperStatsBlock
              title="調律前"
              stats={{
                statBonus1: relic.statBonus1,
                statBonus2: relic.statBonus2,
                attributeResistances: relic.attributeResistances,
              }}
            />
          </div>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-text-muted">読み込み中…</p>
        ) : temperResult ? (
          <div className="mt-4 space-y-4 border-t border-base-border pt-4">
            <div className="grid grid-cols-2 gap-4">
              <TemperStatsBlock title="調律前" stats={temperResult.before} />
              <TemperStatsBlock title="調律後" stats={temperResult.after} />
            </div>
            <p className="text-sm text-text-muted">
              必要: 遺物の欠片 <span className="font-medium text-text-primary">{RELIC_TEMPER_SHARD_COST}</span> 個
              / 所持: <span className="font-medium text-text-primary">{relicShardQuantity}</span> 個
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border disabled:opacity-50"
              >
                {cancelling ? "取消中…" : "調律取消"}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
              >
                {confirming ? "確定中…" : "調律確定"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-text-muted">
              必要: 遺物の欠片 <span className="font-medium text-text-primary">{RELIC_TEMPER_SHARD_COST}</span> 個
              / 所持: <span className="font-medium text-text-primary">{relicShardQuantity}</span> 個
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border"
              >
                中止
              </button>
              <button
                type="button"
                onClick={handleTemper}
                disabled={tempering || !canTemper}
                className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
              >
                {tempering ? "調律中…" : "調律"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
