"use client";

/**
 * spec/020_test_battle.md - 戦闘ログをテキストベースで表示
 * 構成: 作戦スロット発動 → 行動者・スキル名 → スキルメッセージ → ダメージ行（直撃/致命は強調）
 */

import type { RunTestBattleSuccess } from "@/server/actions/test-battle";
import { TEST_ENEMY_NAME } from "@/lib/battle/test-enemy";

const ENEMY_LABEL = TEST_ENEMY_NAME;

/** 属性状態コード → ログ表示用の名前（〇〇状態を付与！） */
const ATTR_STATE_DISPLAY_NAMES: Record<string, string> = {
  crush: "圧縮",
  slash: "切創",
  pierce: "穿孔",
  burn: "焼損",
  freeze: "凍傷",
  corrode: "侵食",
  polarity: "極性",
};

/** デバフコード → ログ表示用の名前（〇〇状態を解除した / 〇〇の継続ダメージ） */
const DEBUFF_DISPLAY_NAMES: Record<string, string> = {
  burning: "燃焼",
  poison: "毒",
  curse: "呪い",
  wither: "萎縮",
  // 未定義は code をそのまま表示
};

type LogEntry = RunTestBattleSuccess["log"][number];

function attackerName(entry: LogEntry, partyDisplayNames: string[]): string {
  if (entry.attacker === "enemy") return `${ENEMY_LABEL}${(entry.attackerEnemyIndex ?? 0) + 1}`;
  const i = entry.attackerPartyIndex ?? 0;
  return partyDisplayNames[i] ?? "味方";
}

function targetName(entry: LogEntry, partyDisplayNames: string[]): string {
  if (entry.target === "enemy") return `${ENEMY_LABEL}${(entry.targetEnemyIndex ?? 0) + 1}`;
  const i = entry.targetPartyIndex ?? 0;
  return partyDisplayNames[i] ?? "味方";
}

/** ヒット詳細から対象名を取得（敵は targetEnemyIndex、味方は targetPartyIndex） */
function targetNameFromHit(
  target: "player" | "enemy",
  targetEnemyIndex?: number,
  targetPartyIndex?: number,
  partyDisplayNames?: string[]
): string {
  if (target === "enemy") return `${ENEMY_LABEL}${(targetEnemyIndex ?? 0) + 1}`;
  const i = targetPartyIndex ?? 0;
  return partyDisplayNames?.[i] ?? "味方";
}

/** 1ヒット分のダメージ行（通常/直撃/致命） */
function DamageLine({
  targetName: t,
  damage,
  direct,
  fatal,
}: {
  targetName: string;
  damage: number;
  direct: boolean;
  fatal: boolean;
}) {
  if (!t) return null;
  if (damage === 0) return <div className="text-text-muted">{t}に0ダメージ。</div>;
  if (fatal)
    return (
      <div>
        <span className="text-red-500 font-bold">致命！！</span>
        <span className="ml-1">
          {t}に<span className="text-red-500 font-bold">{damage}</span>
          ダメージ！！！
        </span>
      </div>
    );
  if (direct)
    return (
      <div>
        <span className="text-amber-500 font-bold">直撃！</span>
        <span className="ml-1">
          {t}に<span className="text-amber-500 font-semibold">{damage}</span>
          ダメージ！！
        </span>
      </div>
    );
  return (
    <div>
      {t}に{damage}ダメージ！
    </div>
  );
}

/** 1 エントリを複数行で表示（作戦スロット・発動・メッセージ・ダメージ）。敵ターンは枠色で区別。BattleFullView のターン内ログでも利用。 */
export function EntryLines({
  entry,
  partyDisplayNames,
}: {
  entry: LogEntry;
  partyDisplayNames: string[];
}) {
  const attacker = attackerName(entry, partyDisplayNames);
  const target = targetName(entry, partyDisplayNames);
  const isPlayer = entry.attacker === "player";
  const actionLabel =
    entry.actionType === "skill" && entry.skillName
      ? entry.skillName
      : "通常攻撃";
  const hasHitDetails = entry.hitDetails && entry.hitDetails.length > 0;

  // Phase 9: 溜め（物理＝溜め、魔法＝詠唱）
  if (entry.actionType === "charge") {
    const skillName = entry.skillName ?? "スキル";
    const isMagic = entry.chargeSkillType === "magic";
    const startText = isMagic ? "詠唱しはじめた。" : "溜め始めた！";
    const ongoingText = isMagic ? "詠唱している…" : "溜めている…";
    return (
      <div className="space-y-0.5 pl-2 border-l-2 border-base-border/50">
        <div className="text-text-primary text-sm">
          {entry.isChargeStart
            ? `${attacker}は${skillName}を${startText}`
            : `${attacker}は${skillName}を${ongoingText}（あと${entry.chargeRemaining ?? 0}）`}
        </div>
      </div>
    );
  }

  // Phase 8: DoT（継続ダメージ）は「そのサイクルでダメージ受ける人のターンがきたら」表示
  if (entry.actionType === "dot") {
    const stateName = entry.dotDebuffCode
      ? DEBUFF_DISPLAY_NAMES[entry.dotDebuffCode] ?? entry.dotDebuffCode
      : "デバフ";
    const dotIsPlayerTurn = entry.attacker === "player";
    return (
      <div
        className={`space-y-0.5 pl-2 border-l-2 ${
          dotIsPlayerTurn ? "border-base-border/50" : "border-amber-600/60 bg-amber-950/15"
        }`}
      >
        <div className="text-text-primary text-sm">
          {target}は{stateName}の継続ダメージで{entry.damage}を受けた。
        </div>
      </div>
    );
  }

  return (
    <div
      className={`space-y-0.5 pl-2 border-l-2 ${
        isPlayer ? "border-base-border/50" : "border-amber-600/60 bg-amber-950/15"
      }`}
    >
      {/* Call Tactical-slot order: No.N Skip To CT...No.M Execute!（味方・スロット採用時のみ） */}
      {isPlayer && (entry.tacticSlotSkippedDueToCt?.length ?? 0) > 0 && (
        <div className="text-text-muted text-xs font-mono">
          Call Tactical-slot order:{" "}
          {entry.tacticSlotSkippedDueToCt!.map((n) => (
            <span key={n}>No.{n} Skip To CT... </span>
          ))}
          {entry.tacticSlotOrder != null ? (
            <>No.{entry.tacticSlotOrder} Execute!</>
          ) : (
            <>Execute!</>
          )}
        </div>
      )}
      {isPlayer && entry.tacticSlotOrder != null && (entry.tacticSlotSkippedDueToCt?.length ?? 0) === 0 && (
        <div className="text-text-muted text-xs font-mono">
          Call Tactical-slot order: No.{entry.tacticSlotOrder} Execute!
        </div>
      )}

      {/* 不発 */}
      {entry.fizzle && entry.skillName && (
        <>
          <div className="text-text-primary">
            {attacker}は
            <span className="text-brass font-semibold">{entry.skillName}</span>
            を発動した！
          </div>
          <div className="text-warning font-medium">MP不足で不発。</div>
        </>
      )}

      {/* 発動＋メッセージ＋ダメージ */}
      {!entry.fizzle && (
        <>
          <div className="text-text-primary">
            {attacker}は
            <span className="text-brass font-semibold">{actionLabel}</span>
            を発動した！
          </div>

          {/* スキルメッセージ（条件達成時はヒット行で「〇〇決壊！」を表示するためここでは通常メッセージのみ） */}
          {entry.logMessage != null && entry.logMessage !== "" && (
            <div className="text-text-muted text-sm">{entry.logMessage}</div>
          )}

          {/* 多ヒット：ヒットごとに表示（条件達成時は左に「〇〇決壊！」→ ダメージ → 状態付与で1行） */}
          {hasHitDetails &&
            entry.hitDetails!.map((h, idx) => {
              const tName = targetNameFromHit(
                entry.target,
                h.targetEnemyIndex,
                h.targetPartyIndex,
                partyDisplayNames
              );
              if (!h.hit)
                return (
                  <div key={idx} className="text-text-muted">
                    {tName}にミス。
                  </div>
                );
              const attrLabel =
                h.attrApplied && (ATTR_STATE_DISPLAY_NAMES[h.attrApplied] ?? h.attrApplied);
              const triggerLabel =
                h.triggeredAttr &&
                (ATTR_STATE_DISPLAY_NAMES[h.triggeredAttr] ?? h.triggeredAttr);
              const debuffLabel =
                h.debuffApplied &&
                (DEBUFF_DISPLAY_NAMES[h.debuffApplied] ?? h.debuffApplied);
              return (
                <div key={idx}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {triggerLabel && (
                      <span className="text-brass font-bold shrink-0">
                        {triggerLabel}決壊！
                      </span>
                    )}
                    <DamageLine
                      targetName={tName}
                      damage={h.damage}
                      direct={h.direct}
                      fatal={h.fatal}
                    />
                    {attrLabel && (
                      <span className="text-text-muted text-sm shrink-0">
                        {attrLabel}状態を付与！
                      </span>
                    )}
                    {debuffLabel && (
                      <span className="text-text-muted text-sm shrink-0">
                        {debuffLabel}状態異常を付与！
                      </span>
                    )}
                  </div>
                  {h.splashDamagePerEnemy?.some((d) => d > 0) && (
                    <div className="mt-0.5 pl-4 text-text-muted text-sm">
                      {h.splashDamagePerEnemy.map((d, i) =>
                        d > 0 ? (
                          <div key={i}>
                            　{ENEMY_LABEL}
                            {i + 1}に{d}追加ダメージ
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {/* 単一ヒット（hitDetails なし）：従来の1行表示（条件達成時は左に「〇〇決壊！」）／回復表示 */}
          {!hasHitDetails && (
            <>
              {entry.noColumnTarget && (
                <div className="text-text-muted">対象範囲に敵がいなかった。</div>
              )}
              {!entry.hit && !entry.noColumnTarget && (
                <div className="text-text-muted">{target}にミス。</div>
              )}
              {entry.hit && entry.damage > 0 && (
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {entry.conditionMet &&
                    entry.triggeredAttr &&
                    (ATTR_STATE_DISPLAY_NAMES[entry.triggeredAttr] ?? entry.triggeredAttr) && (
                      <span className="text-brass font-bold shrink-0">
                        {ATTR_STATE_DISPLAY_NAMES[entry.triggeredAttr] ?? entry.triggeredAttr}
                        決壊！
                      </span>
                    )}
                  <DamageLine
                    targetName={target}
                    damage={entry.damage}
                    direct={entry.direct}
                    fatal={entry.fatal}
                  />
                </div>
              )}
              {entry.hit && entry.healAmount != null && entry.healAmount > 0 && (
                <div className="text-emerald-600 dark:text-emerald-400">
                  {entry.isHealAll
                    ? `味方全体のHPが${entry.healAmount}回復！`
                    : `${target}のHPが${entry.healAmount}回復！`}
                </div>
              )}
              {entry.hit && entry.hadHealEffect && (entry.healAmount == null || entry.healAmount === 0) && (
                <div className="text-text-muted">回復対象がいなかった。</div>
              )}
              {entry.hit &&
                entry.dispelledDebuffs &&
                entry.dispelledDebuffs.length > 0 &&
                entry.dispelledDebuffs.map((d, idx) => {
                  const targetName =
                    partyDisplayNames[d.targetPartyIndex] ?? `味方${d.targetPartyIndex + 1}`;
                  const stateLabels = d.codes.map(
                    (code) => DEBUFF_DISPLAY_NAMES[code] ?? code
                  );
                  const stateText =
                    stateLabels.length > 1
                      ? stateLabels.join("、") + "状態"
                      : stateLabels[0] + "状態";
                  return (
                    <div
                      key={idx}
                      className="text-sky-600 dark:text-sky-400"
                    >
                      {targetName}の{stateText}を解除した。
                    </div>
                  );
                })}
              {entry.hit && entry.hadBuffEffect && (entry.healAmount == null || entry.healAmount === 0) && (!entry.dispelledDebuffs || entry.dispelledDebuffs.length === 0) && (
                <div className="text-sky-600 dark:text-sky-400">ステータスが上昇した。</div>
              )}
              {entry.hit &&
                entry.damage === 0 &&
                (entry.healAmount == null || entry.healAmount === 0) &&
                !entry.hadHealEffect &&
                (!entry.dispelledDebuffs || entry.dispelledDebuffs.length === 0) &&
                !entry.hadBuffEffect && (
                  <div className="text-text-muted">{target}に0ダメージ。</div>
                )}
            </>
          )}

          {/* MP回復（通常攻撃時） */}
          {entry.mpRecovery > 0 && (
            <div className="text-text-muted text-sm">
              {attacker}のMPが{entry.mpRecovery}回復。
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatLogByCycle(
  log: LogEntry[],
  partyDisplayNames: string[]
): { cycle: number; entries: LogEntry[] }[] {
  const byCycle = new Map<number, LogEntry[]>();
  for (const entry of log) {
    const list = byCycle.get(entry.cycle) ?? [];
    list.push(entry);
    byCycle.set(entry.cycle, list);
  }
  return Array.from(byCycle.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cycle, entries]) => ({
      cycle,
      entries: entries.sort((a, b) => a.turn - b.turn),
    }));
}

function resultText(winner: "player" | "enemy" | "draw"): string {
  switch (winner) {
    case "player":
      return "勝利";
    case "enemy":
      return "敗北";
    default:
      return "引き分け（最大サイクル到達）";
  }
}

interface BattleLogViewProps {
  data: RunTestBattleSuccess;
}

export function BattleLogView({ data }: BattleLogViewProps) {
  const partyNames = data.summary.partyDisplayNames ?? ["味方"];
  const cycles = formatLogByCycle(data.log, partyNames);

  return (
    <div className="mt-6 space-y-4">
      <p className="text-text-primary font-medium">
        結果: {resultText(data.summary.winner)}（
        {data.summary.totalCycles} サイクル）
      </p>
      <p className="text-sm text-text-muted">
        味方の最終HP:{" "}
        {(data.summary.partyHpFinals ?? [data.summary.playerHpFinal]).join(
          ", "
        )}{" "}
        / 敵の最終HP: {data.summary.enemyHpFinals.join(", ")}
      </p>
      <div className="bg-base-elevated border border-base-border rounded-lg p-4 text-sm">
        {cycles.map(({ cycle, entries }) => (
          <div key={cycle} className="mb-6 last:mb-0">
            <div className="text-brass font-medium mb-2">
              ——— サイクル {cycle} ———
            </div>
            <div className="space-y-3">
              {entries.map((entry, i) => (
                <EntryLines
                  key={i}
                  entry={entry}
                  partyDisplayNames={partyNames}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
