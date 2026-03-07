/** spec/045: Item.category の取り得る値 */
export const ITEM_CATEGORIES = [
  "material",
  "consumable",
  "blueprint",
  "skill_book",
  "paid",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
