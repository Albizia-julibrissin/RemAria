/**
 * 遺物パッシブ効果の管理画面用：effectType 一覧とタイプ別の param 設定。
 * 戦闘側の参照は run-battle-with-party.ts（final_physical_damage_pct, final_magic_damage_pct, final_attribute_damage_pct, hp_regen_per_turn）。
 */

import { ATTRIBUTE_RESISTANCE_KEYS, ATTRIBUTE_RESISTANCE_LABELS } from "@/lib/constants/relic";

/** 管理画面で選択可能なエフェクトタイプ */
export const RELIC_PASSIVE_EFFECT_TYPES = [
  { value: "", label: "（効果なし）" },
  { value: "final_physical_damage_pct", label: "物理ダメージ割合増加" },
  { value: "final_magic_damage_pct", label: "魔法ダメージ割合増加" },
  { value: "final_attribute_damage_pct", label: "属性ダメージ割合増加" },
  { value: "hp_regen_per_turn", label: "毎ターンHP回復" },
] as const;

export type RelicPassiveEffectTypeValue =
  (typeof RELIC_PASSIVE_EFFECT_TYPES)[number]["value"];

/** 属性ダメージ用の属性選択肢。表示名は ATTRIBUTE_RESISTANCE_LABELS（正本）に合わせる。 */
export const RELIC_ATTRIBUTE_OPTIONS = ATTRIBUTE_RESISTANCE_KEYS.map((value) => ({
  value,
  label: ATTRIBUTE_RESISTANCE_LABELS[value],
})) as { value: (typeof ATTRIBUTE_RESISTANCE_KEYS)[number]; label: string }[];

/** タイプごとに必要な param の種類 */
export type RelicPassiveParamKind = "pct" | "attribute" | "amount";

const EFFECT_TYPE_PARAM_KINDS: Record<string, RelicPassiveParamKind[]> = {
  final_physical_damage_pct: ["pct"],
  final_magic_damage_pct: ["pct"],
  final_attribute_damage_pct: ["attribute", "pct"],
  hp_regen_per_turn: ["amount"],
};

export function getParamKindsForEffectType(effectType: string): RelicPassiveParamKind[] {
  return EFFECT_TYPE_PARAM_KINDS[effectType] ?? [];
}

export function needsAttribute(effectType: string): boolean {
  return getParamKindsForEffectType(effectType).includes("attribute");
}

export function needsPct(effectType: string): boolean {
  return getParamKindsForEffectType(effectType).includes("pct");
}

export function needsAmount(effectType: string): boolean {
  return getParamKindsForEffectType(effectType).includes("amount");
}

/** 一覧用：effectType + param の短い説明を返す */
export function formatRelicPassiveEffectSummary(
  effectType: string | null,
  param: Record<string, unknown> | null
): string {
  if (!effectType) return "—";
  const p = param ?? {};
  switch (effectType) {
    case "final_physical_damage_pct":
      return `物理 ${Number(p.pct) >= 0 ? "+" : ""}${p.pct ?? 0}%`;
    case "final_magic_damage_pct":
      return `魔法 ${Number(p.pct) >= 0 ? "+" : ""}${p.pct ?? 0}%`;
    case "final_attribute_damage_pct":
      return `${String(p.attribute || "—")} ${Number(p.pct) >= 0 ? "+" : ""}${p.pct ?? 0}%`;
    case "hp_regen_per_turn":
      return `HP回復/ターン ${p.amount ?? 0}`;
    default:
      return effectType;
  }
}
