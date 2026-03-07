/**
 * docs/053: DB の statGenConfig をパース。不正なら null。
 * craft 実行・管理画面の両方から利用する。
 */

import type { EquipmentStatGenConfig } from "@/lib/craft/equipment-stat-gen";
import { EQUIPMENT_STAT_KEYS } from "@/lib/craft/equipment-stat-gen";
import type { MechaPartStatGenConfig } from "@/lib/craft/mecha-part-stat-gen";
import { MECHA_PART_BASE_STAT_KEYS } from "@/lib/craft/mecha-part-stat-gen";

export function parseEquipmentStatGenConfig(raw: unknown): EquipmentStatGenConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const capMin = typeof o.capMin === "number" ? o.capMin : null;
  const capMax = typeof o.capMax === "number" ? o.capMax : null;
  if (capMin == null || capMax == null || capMin > capMax) return null;
  const weights = Array.isArray(o.weights) ? o.weights : null;
  if (!weights || weights.length === 0) return null;
  const validKeys = new Set(EQUIPMENT_STAT_KEYS);
  const parsedWeights: EquipmentStatGenConfig["weights"] = [];
  for (const w of weights) {
    if (!w || typeof w !== "object") continue;
    const row = w as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key : "";
    const rawMin = row.weightMin;
    const rawMax = row.weightMax;
    const weightMin = typeof rawMin === "number" ? rawMin : NaN;
    const weightMax = typeof rawMax === "number" ? rawMax : NaN;
    if (
      !validKeys.has(key as (typeof EQUIPMENT_STAT_KEYS)[number]) ||
      !Number.isInteger(weightMin) ||
      !Number.isInteger(weightMax) ||
      weightMin < 0 ||
      weightMax < weightMin
    )
      continue;
    parsedWeights.push({
      key: key as EquipmentStatGenConfig["weights"][0]["key"],
      weightMin,
      weightMax,
    });
  }
  if (parsedWeights.length === 0) return null;
  return { capMin, capMax, weights: parsedWeights };
}

export function parseMechaPartStatGenConfig(raw: unknown): MechaPartStatGenConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const capMin = typeof o.capMin === "number" ? o.capMin : null;
  const capMax = typeof o.capMax === "number" ? o.capMax : null;
  if (capMin == null || capMax == null || capMin > capMax) return null;
  const weights = Array.isArray(o.weights) ? o.weights : null;
  if (!weights || weights.length === 0) return null;
  const validKeys = new Set(MECHA_PART_BASE_STAT_KEYS);
  const parsedWeights: MechaPartStatGenConfig["weights"] = [];
  for (const w of weights) {
    if (!w || typeof w !== "object") continue;
    const row = w as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key : "";
    const rawMin = row.weightMin;
    const rawMax = row.weightMax;
    const weightMin = typeof rawMin === "number" ? rawMin : NaN;
    const weightMax = typeof rawMax === "number" ? rawMax : NaN;
    if (
      !validKeys.has(key as (typeof MECHA_PART_BASE_STAT_KEYS)[number]) ||
      !Number.isInteger(weightMin) ||
      !Number.isInteger(weightMax) ||
      weightMin < 0 ||
      weightMax < weightMin
    )
      continue;
    parsedWeights.push({
      key: key as MechaPartStatGenConfig["weights"][0]["key"],
      weightMin,
      weightMax,
    });
  }
  if (parsedWeights.length === 0) return null;
  return { capMin, capMax, weights: parsedWeights };
}
