/**
 * spec/045: 装備スロット定数。
 * 主人公・仲間の装備枠 6 種。DB・API ではコード値で統一する。
 */
export const EQUIPMENT_SLOTS = [
  "main_weapon",
  "sub_weapon",
  "head",
  "body",
  "arm",
  "leg",
] as const;

export type EquipmentSlotCode = (typeof EQUIPMENT_SLOTS)[number];

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlotCode, string> = {
  main_weapon: "主武器",
  sub_weapon: "副武器",
  head: "頭",
  body: "胴",
  arm: "腕",
  leg: "脚",
};

export function isEquipmentSlot(s: string): s is EquipmentSlotCode {
  return EQUIPMENT_SLOTS.includes(s as EquipmentSlotCode);
}
