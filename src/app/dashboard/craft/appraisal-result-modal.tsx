"use client";

// 鑑定完了後、作成された遺物のステータスを表示するモーダル（鍛錬結果モーダルを参考）

import type { RelicInstanceSummary } from "@/server/actions/relic";
import { ATTRIBUTE_RESISTANCE_LABELS } from "@/lib/constants/relic";

type Props = {
  relic: RelicInstanceSummary;
  onClose: () => void;
};

function formatResistValue(value: number): string {
  if (value === 1) return "—";
  if (value < 1) return `${Math.round((1 - value) * 100)}%軽減`;
  return `${Math.round((value - 1) * 100)}%弱体`;
}

export function AppraisalResultModal({ relic, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appraisal-result-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="appraisal-result-title" className="text-lg font-medium text-text-primary">
          鑑定結果
        </h2>
        <p className="mt-1 text-sm text-brass">遺物を鑑定しました。</p>

        <div className="mt-4 pt-4 border-t border-base-border space-y-3 text-sm">
          <div>
            <p className="font-medium text-text-primary">{relic.relicTypeName}</p>
            {relic.relicPassiveEffectName && (
              <p className="mt-0.5 text-text-muted">{relic.relicPassiveEffectName}</p>
            )}
          </div>

          {(relic.statBonus1 || relic.statBonus2) && (
            <div className="space-y-1">
              <p className="font-medium text-text-muted">基礎ステータス補正</p>
              <ul className="space-y-0.5">
                {relic.statBonus1 && (
                  <li className="flex justify-between">
                    <span className="text-text-muted">{relic.statBonus1.stat}</span>
                    <span className="text-text-primary">+{relic.statBonus1.percent}%</span>
                  </li>
                )}
                {relic.statBonus2 && (
                  <li className="flex justify-between">
                    <span className="text-text-muted">{relic.statBonus2.stat}</span>
                    <span className="text-text-primary">+{relic.statBonus2.percent}%</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {relic.attributeResistances && Object.keys(relic.attributeResistances).length > 0 && (
            <div className="space-y-1">
              <p className="font-medium text-text-muted">属性耐性</p>
              <ul className="space-y-0.5">
                {Object.entries(relic.attributeResistances).map(([key, value]) => {
                  if (typeof value !== "number") return null;
                  const label = ATTRIBUTE_RESISTANCE_LABELS[key as keyof typeof ATTRIBUTE_RESISTANCE_LABELS] ?? key;
                  return (
                    <li key={key} className="flex justify-between">
                      <span className="text-text-muted">{label}</span>
                      <span className="text-text-primary">{formatResistValue(value)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          >
            中止
          </button>
        </div>
      </div>
    </div>
  );
}
