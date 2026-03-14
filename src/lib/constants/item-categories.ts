/** spec/045, docs/079: Item.category の取り得る値。special＝特別（闇市・黒市で取り扱う課金系アイテム）。旧 paid を special に差し替え。 */
export const ITEM_CATEGORIES = [
  "material",
  "consumable",
  "blueprint",
  "skill_book",
  "special",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
