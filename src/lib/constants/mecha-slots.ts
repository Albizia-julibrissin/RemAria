/**
 * spec/044: メカパーツ部位（スロット）定数。
 * DB・API ではコード値で統一する。
 */
export const MECHA_SLOTS = [
  "frame",
  "core",
  "head",
  "rightArm",
  "leftArm",
  "legs",
] as const;

export type MechaSlotCode = (typeof MECHA_SLOTS)[number];

export const MECHA_SLOT_LABELS: Record<MechaSlotCode, string> = {
  frame: "フレーム",
  core: "コア",
  head: "頭部",
  rightArm: "右腕",
  leftArm: "左腕",
  legs: "脚部",
};

export function isMechaSlot(s: string): s is MechaSlotCode {
  return (MECHA_SLOTS as readonly string[]).includes(s);
}
