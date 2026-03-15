/**
 * ドロップテーブルが未紐づけの探索エリアについて、不足している枠のみドロップテーブルを作成して紐づける。
 * 5 枠（基本・戦闘ボーナス・技能・強敵・領域主）のうち、未設定のものだけ作成する。
 *
 * 実行: npx tsx prisma/seed-area-drop-tables-missing.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DROP_TABLE_KINDS = [
  { kind: "base", nameSuffix: "基本ドロップ", codeSuffix: "base", areaKey: "baseDropTableId" as const },
  { kind: "battle_bonus", nameSuffix: "戦闘ボーナス", codeSuffix: "battle", areaKey: "battleDropTableId" as const },
  { kind: "skill", nameSuffix: "技能イベント枠", codeSuffix: "skill", areaKey: "skillDropTableId" as const },
  { kind: "strong_enemy", nameSuffix: "強敵", codeSuffix: "strong_enemy", areaKey: "strongEnemyDropTableId" as const },
  { kind: "area_lord_special", nameSuffix: "領域主専用", codeSuffix: "area_lord", areaKey: "areaLordDropTableId" as const },
];

async function main(): Promise<void> {
  const areas = await prisma.explorationArea.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      baseDropTableId: true,
      battleDropTableId: true,
      skillDropTableId: true,
      strongEnemyDropTableId: true,
      areaLordDropTableId: true,
    },
    orderBy: [{ theme: { displayOrder: "asc" } }, { displayOrder: "asc" }, { code: "asc" }],
  });

  let areasWithAdditions = 0;
  let areasSkipped = 0;

  for (const area of areas) {
    const missing = DROP_TABLE_KINDS.filter((k) => !(area[k.areaKey] ?? null));
    if (missing.length === 0) {
      areasSkipped++;
      continue;
    }

    const codePrefix = `drop_${area.code}_`;
    const existingCodes = await prisma.dropTable.findMany({
      where: { code: { in: missing.map((k) => `${codePrefix}${k.codeSuffix}`) } },
      select: { code: true, id: true },
    });
    const existingBySuffix = new Map(
      existingCodes.map((dt) => {
        const suffix = dt.code.replace(codePrefix, "");
        return [suffix, dt.id];
      })
    );

    const updates: Record<string, string> = {};
    for (const k of missing) {
      const existingId = existingBySuffix.get(k.codeSuffix);
      if (existingId) {
        updates[k.areaKey] = existingId;
        continue;
      }
      const dt = await prisma.dropTable.create({
        data: {
          code: `${codePrefix}${k.codeSuffix}`,
          name: `${area.name} ${k.nameSuffix}`,
          kind: k.kind,
          areaId: area.id,
        },
        select: { id: true },
      });
      updates[k.areaKey] = dt.id;
    }

    await prisma.explorationArea.update({
      where: { id: area.id },
      data: {
        baseDropTableId: updates.baseDropTableId ?? area.baseDropTableId,
        battleDropTableId: updates.battleDropTableId ?? area.battleDropTableId,
        skillDropTableId: updates.skillDropTableId ?? area.skillDropTableId,
        strongEnemyDropTableId: updates.strongEnemyDropTableId ?? area.strongEnemyDropTableId,
        areaLordDropTableId: updates.areaLordDropTableId ?? area.areaLordDropTableId,
      },
    });
    areasWithAdditions++;
    console.log(`  [${area.code}] ${area.name}: 不足 ${missing.length} 枠のドロップテーブルを作成・紐づけ`);
  }

  console.log(`\n完了: ドロップテーブルを追加したエリア ${areasWithAdditions} 件, 5枠揃っていてスキップ ${areasSkipped} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
