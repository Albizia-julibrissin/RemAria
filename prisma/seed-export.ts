/**
 * 現在の DB のマスタを「初期シード用」の JSON にエクスポートする。
 * 管理画面で編集したあと、このスクリプトを実行すると prisma/seed-exported.json が更新され、
 * 次回の db:seed:masters でその内容が使われる。
 *
 * 実行: npm run db:seed:export
 *
 * エクスポート対象: Tag, FacilityType, FacilityTypeTag → FACILITY_TYPE_TAG_CODES, Item
 * （今後、CraftRecipe・敵・エリアなども追加可能）
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ExportedSeed = {
  exportedAt: string;
  TAGS: Array<{ code: string; name: string }>;
  FACILITY_TYPES: Array<{
    name: string;
    kind: string;
    description: string | null;
    cost: number;
  }>;
  FACILITY_TYPE_TAG_CODES: Record<string, string[]>;
  ITEMS: Array<{
    code: string;
    name: string;
    category: string;
    skillId?: string | null;
    consumableEffect?: unknown;
    maxCarryPerExpedition?: number | null;
  }>;
};

async function main() {
  const tags = await prisma.tag.findMany({
    orderBy: { code: "asc" },
    select: { code: true, name: true },
  });

  const facilityTypes = await prisma.facilityType.findMany({
    orderBy: { name: "asc" },
    select: { name: true, kind: true, description: true, cost: true },
  });

  const facilityTypeTags = await prisma.facilityTypeTag.findMany({
    include: {
      facilityType: { select: { name: true } },
      tag: { select: { code: true } },
    },
  });

  const facilityTypeTagCodes: Record<string, string[]> = {};
  for (const ft of facilityTypeTags) {
    const name = ft.facilityType.name;
    if (!facilityTypeTagCodes[name]) facilityTypeTagCodes[name] = [];
    facilityTypeTagCodes[name].push(ft.tag.code);
  }

  const items = await prisma.item.findMany({
    orderBy: { code: "asc" },
    select: {
      code: true,
      name: true,
      category: true,
      skillId: true,
      consumableEffect: true,
      maxCarryPerExpedition: true,
    },
  });

  const out: ExportedSeed = {
    exportedAt: new Date().toISOString(),
    TAGS: tags,
    FACILITY_TYPES: facilityTypes.map((f) => ({
      name: f.name,
      kind: f.kind,
      description: f.description ?? null,
      cost: f.cost,
    })),
    FACILITY_TYPE_TAG_CODES: facilityTypeTagCodes,
    ITEMS: items.map((i) => ({
      code: i.code,
      name: i.name,
      category: i.category,
      skillId: i.skillId ?? undefined,
      consumableEffect: i.consumableEffect ?? undefined,
      maxCarryPerExpedition: i.maxCarryPerExpedition ?? undefined,
    })),
  };

  const outPath = path.join(__dirname, "seed-exported.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log(`Exported to ${outPath}`);
  console.log(`  TAGS: ${out.TAGS.length}, FACILITY_TYPES: ${out.FACILITY_TYPES.length}, ITEMS: ${out.ITEMS.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
