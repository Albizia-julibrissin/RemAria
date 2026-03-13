"use client";

/**
 * 検証ログ: 探索戦闘トップで各キャラの装備前・装備後の戦闘ステをテーブル表示する。
 * NEXT_PUBLIC_SHOW_VERIFICATION_LOG が true のときのみ表示する想定（呼び出し側で判定）。
 * manage/VERIFICATION_LOG.md 参照。
 */

import { Fragment } from "react";
import type { DerivedStats } from "@/lib/battle/derived-stats";

const DERIVED_STAT_KEYS: (keyof DerivedStats)[] = [
  "HP",
  "MP",
  "PATK",
  "MATK",
  "PDEF",
  "MDEF",
  "HIT",
  "EVA",
  "LUCK",
];

const STAT_LABELS: Record<keyof DerivedStats, string> = {
  HP: "HP",
  MP: "MP",
  PATK: "物攻",
  MATK: "魔攻",
  PDEF: "物防",
  MDEF: "魔防",
  HIT: "命中",
  EVA: "回避",
  LUCK: "運",
};

export type VerificationPartyStatsRow = {
  displayName: string;
  before: DerivedStats;
  after: DerivedStats;
};

export function ExplorationVerificationStatsTable({
  stats,
}: {
  stats: VerificationPartyStatsRow[];
}) {
  if (!stats.length) return null;

  return (
    <div className="mb-6 rounded border border-amber-800/50 bg-amber-950/30 p-3">
      <p className="mb-2 text-xs font-medium text-amber-200/90">検証: パーティ戦闘ステ（装備前 / 装備後）</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-amber-700/50">
              <th className="py-1 pr-3 font-medium text-amber-100">キャラ</th>
              {DERIVED_STAT_KEYS.map((key) => (
                <th key={key} colSpan={2} className="py-1 pr-2 text-center font-medium text-amber-100">
                  {STAT_LABELS[key]}
                </th>
              ))}
            </tr>
            <tr className="border-b border-amber-700/30 text-xs text-amber-200/70">
              <th className="py-0.5 pr-3" />
              {DERIVED_STAT_KEYS.map((key) => (
                <Fragment key={key}>
                  <th className="w-12 py-0.5 pr-1 text-right">装備前</th>
                  <th className="w-12 py-0.5 pr-1 text-right">装備後</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((row, i) => (
              <tr key={row.displayName + i} className="border-b border-amber-800/30">
                <td className="py-1 pr-3 font-medium text-amber-50">{row.displayName}</td>
                {DERIVED_STAT_KEYS.map((key) => (
                  <Fragment key={key}>
                    <td className="w-12 py-1 pr-1 text-right tabular-nums text-amber-100/90">
                      {row.before[key]}
                    </td>
                    <td className="w-12 py-1 pr-1 text-right tabular-nums text-amber-100">
                      {row.after[key]}
                    </td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
