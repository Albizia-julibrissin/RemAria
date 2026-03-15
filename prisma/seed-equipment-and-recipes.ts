/**
 * 装備型（EquipmentType）とクラフトレシピ（CraftRecipe）を 1:1 で一括生成するスクリプト。
 *
 * シリーズ:
 * - 石材: CAP 500-1000, HP多め・物理防御高め. 材料: stone x20
 * - 木材: CAP 500-1000, HP多め・魔法防御高め. 材料: timber x20
 * - 鉄:   CAP 1000-1800, 物理防御・物理攻撃高め・速度遅め. 材料: iron x10, iron_equip_part x20
 * - 綿:   CAP 1000-1800, 魔法防御高め・速度早め・物理防御低め. 材料: cotton x10, cotton_equip_part x20（武器なし）
 *
 * 前提: Item マスタに code が stone, timber, iron, iron_equip_part, cotton, cotton_equip_part のアイテムが存在すること。
 *
 * 実行: npx tsx prisma/seed-equipment-and-recipes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type EquipmentStatKey =
  | "HP"
  | "MP"
  | "PATK"
  | "MATK"
  | "PDEF"
  | "MDEF"
  | "HIT"
  | "EVA"
  | "LUCK";

type WeightDef = { key: EquipmentStatKey; weightMin: number; weightMax: number };

type StatGenConfig = {
  capMin: number;
  capMax: number;
  weights: WeightDef[];
};

const SLOTS = [
  "main_weapon",
  "sub_weapon",
  "head",
  "body",
  "arm",
  "leg",
] as const;

/** シリーズごとの装備名（スロット → 複数可）。主・副武器は2種、他は1種 */
const SERIES_EQUIPMENT: Record<
  string,
  Partial<Record<(typeof SLOTS)[number], { codeSuffix: string; name: string }[]>>
> = {
  stone: {
    main_weapon: [
      { codeSuffix: "rock_blade", name: "ロックブレード" },
      { codeSuffix: "stone_staff", name: "石の杖" },
    ],
    sub_weapon: [
      { codeSuffix: "stone_shield", name: "石の盾" },
      { codeSuffix: "stone_dagger", name: "石の短剣" },
    ],
    head: [{ codeSuffix: "helm", name: "石の兜" }],
    body: [{ codeSuffix: "armor", name: "石の鎧" }],
    arm: [{ codeSuffix: "gauntlets", name: "石の篭手" }],
    leg: [{ codeSuffix: "greaves", name: "石の脚甲" }],
  },
  wood: {
    main_weapon: [
      { codeSuffix: "staff", name: "木の杖" },
      { codeSuffix: "bow", name: "木の弓" },
    ],
    sub_weapon: [
      { codeSuffix: "shield", name: "木の盾" },
      { codeSuffix: "dagger", name: "木の短剣" },
    ],
    head: [{ codeSuffix: "hat", name: "木の帽子" }],
    body: [{ codeSuffix: "robe", name: "木のローブ" }],
    arm: [{ codeSuffix: "gauntlets", name: "木の篭手" }],
    leg: [{ codeSuffix: "greaves", name: "木の脚甲" }],
  },
  iron: {
    main_weapon: [
      { codeSuffix: "blade", name: "アイアンブレード" },
      { codeSuffix: "spear", name: "鉄の槍" },
    ],
    sub_weapon: [
      { codeSuffix: "shield", name: "鉄の盾" },
      { codeSuffix: "dagger", name: "鉄の短剣" },
    ],
    head: [{ codeSuffix: "helm", name: "鉄の兜" }],
    body: [{ codeSuffix: "armor", name: "鉄の鎧" }],
    arm: [{ codeSuffix: "gauntlets", name: "鉄の篭手" }],
    leg: [{ codeSuffix: "greaves", name: "鉄の脚甲" }],
  },
  cotton: {
    // 綿は武器なし
    head: [{ codeSuffix: "hood", name: "コットンフード" }],
    body: [{ codeSuffix: "robe", name: "コットンローブ" }],
    arm: [{ codeSuffix: "gloves", name: "コットングローブ" }],
    leg: [{ codeSuffix: "boots", name: "コットンブーツ" }],
  },
};

/** シリーズごとの statGenConfig（CAP・重み）。全種 HP をわずかでも含める */
const SERIES_STAT_CONFIG: Record<string, StatGenConfig> = {
  stone: {
    capMin: 500,
    capMax: 1000,
    weights: [
      { key: "HP", weightMin: 3, weightMax: 8 },
      { key: "PDEF", weightMin: 5, weightMax: 12 },
      { key: "PATK", weightMin: 1, weightMax: 4 },
    ],
  },
  wood: {
    capMin: 500,
    capMax: 1000,
    weights: [
      { key: "HP", weightMin: 3, weightMax: 8 },
      { key: "MDEF", weightMin: 5, weightMax: 12 },
      { key: "MATK", weightMin: 1, weightMax: 4 },
    ],
  },
  iron: {
    capMin: 1000,
    capMax: 1800,
    weights: [
      { key: "HP", weightMin: 2, weightMax: 6 },
      { key: "PDEF", weightMin: 4, weightMax: 10 },
      { key: "PATK", weightMin: 4, weightMax: 10 },
      { key: "EVA", weightMin: 1, weightMax: 3 },
    ],
  },
  cotton: {
    capMin: 1000,
    capMax: 1800,
    weights: [
      { key: "HP", weightMin: 2, weightMax: 6 },
      { key: "MDEF", weightMin: 4, weightMax: 10 },
      { key: "EVA", weightMin: 4, weightMax: 10 },
      { key: "PDEF", weightMin: 1, weightMax: 3 },
    ],
  },
};

/** シリーズごとのレシピ材料（item code → 個数） */
const SERIES_MATERIALS: Record<string, Record<string, number>> = {
  stone: { stone: 20 },
  wood: { timber: 20 },
  iron: { iron: 10, iron_equip_part: 20 },
  cotton: { cotton: 10, cotton_equip_part: 20 },
};

async function resolveItemIds(
  codes: string[]
): Promise<Map<string, string>> {
  const items = await prisma.item.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const map = new Map<string, string>();
  for (const it of items) map.set(it.code, it.id);
  return map;
}

async function main(): Promise<void> {
  const allCodes = new Set<string>();
  for (const mat of Object.values(SERIES_MATERIALS)) {
    for (const code of Object.keys(mat)) allCodes.add(code);
  }
  const itemIds = await resolveItemIds([...allCodes]);
  const missing = [...allCodes].filter((c) => !itemIds.has(c));
  if (missing.length > 0) {
    console.error(
      `以下のアイテムが Item マスタに存在しません。先に登録してください: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  let equipmentCount = 0;
  let recipeCount = 0;

  for (const [seriesKey, config] of Object.entries(SERIES_STAT_CONFIG)) {
    const equipmentDefs = SERIES_EQUIPMENT[seriesKey];
    if (!equipmentDefs) continue;
    const materials = SERIES_MATERIALS[seriesKey] ?? {};

    const slotsToProcess = (Object.keys(equipmentDefs) as (typeof SLOTS)[number][]).filter((s) =>
      SLOTS.includes(s)
    );

    for (const slot of slotsToProcess) {
      const list = equipmentDefs[slot];
      if (!list) continue;

      for (const eq of list) {
        const equipCode = `equip_${seriesKey}_${eq.codeSuffix}`;
        const recipeCode = `craft_${seriesKey}_${eq.codeSuffix}`;

        const existingEt = await prisma.equipmentType.findUnique({
          where: { code: equipCode },
        });
        let equipmentTypeId: string;
        if (existingEt) {
          equipmentTypeId = existingEt.id;
          await prisma.equipmentType.update({
            where: { id: existingEt.id },
            data: {
              name: eq.name,
              slot,
              statGenConfig: config as object,
            },
          });
          console.log(`  update EquipmentType: ${equipCode} ${eq.name}`);
        } else {
          const created = await prisma.equipmentType.create({
            data: {
              code: equipCode,
              name: eq.name,
              slot,
              statGenConfig: config as object,
            },
          });
          equipmentTypeId = created.id;
          equipmentCount++;
          console.log(`  create EquipmentType: ${equipCode} ${eq.name}`);
        }

        const existingRecipe = await prisma.craftRecipe.findUnique({
          where: { code: recipeCode },
        });
        if (existingRecipe) {
          await prisma.craftRecipe.update({
            where: { id: existingRecipe.id },
            data: {
              name: eq.name,
              outputKind: "equipment",
              outputEquipmentTypeId: equipmentTypeId,
              outputMechaPartTypeId: null,
              outputItemId: null,
            },
          });
          await prisma.craftRecipeInput.deleteMany({
            where: { craftRecipeId: existingRecipe.id },
          });
          for (const [itemCode, amount] of Object.entries(materials)) {
            const itemId = itemIds.get(itemCode)!;
            await prisma.craftRecipeInput.create({
              data: {
                craftRecipeId: existingRecipe.id,
                itemId,
                amount,
              },
            });
          }
          console.log(`  update CraftRecipe: ${recipeCode}`);
        } else {
          const created = await prisma.craftRecipe.create({
            data: {
              code: recipeCode,
              name: eq.name,
              outputKind: "equipment",
              outputEquipmentTypeId: equipmentTypeId,
              inputs: {
                create: Object.entries(materials).map(([itemCode, amount]) => ({
                  itemId: itemIds.get(itemCode)!,
                  amount,
                })),
              },
            },
          });
          recipeCount++;
          console.log(`  create CraftRecipe: ${recipeCode} ${eq.name}`);
        }
      }
    }
  }

  console.log(`\n完了: 装備型 新規 ${equipmentCount} 件, レシピ 新規 ${recipeCount} 件（既存は更新済み）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
