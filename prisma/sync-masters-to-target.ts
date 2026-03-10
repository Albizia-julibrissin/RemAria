/**
 * マスタデータのみを「ソース DB」から「ターゲット DB（本番など）」へ同期する。
 * ユーザー・キャラ・所持品などは一切触らない。ID はそのままコピーするので、既存のユーザーデータの参照は維持される。
 *
 * 【マイグレーションでマスタ系テーブルを追加・削除した場合】
 * このスクリプトの MASTER_DELEGATES_IN_ORDER の手入れが必要。
 * - 新規マスタテーブル → 依存順（親→子）の適切な位置に delegate 名を追加
 * - マスタテーブル削除 → 一覧から削除
 *
 * 実行例:
 *   SOURCE_DATABASE_URL="postgresql://..." TARGET_DATABASE_URL="postgresql://..." npx tsx prisma/sync-masters-to-target.ts
 *   （.env に SOURCE_DATABASE_URL と TARGET_DATABASE_URL を書いても可。未設定なら DATABASE_URL をソースとする）
 *
 * 前提:
 *   - ターゲットは本番など、既にユーザーがいる DB。
 *   - ソースはローカルなど、編集済みマスタが入っている DB。
 *   - 同じマイグレーションが両方に適用済みであること（スキーマが一致していること）。
 */
import { PrismaClient } from "@prisma/client";

const sourceUrl = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  console.error(
    "SOURCE_DATABASE_URL と TARGET_DATABASE_URL を設定してください。\n" +
      "（SOURCE 未設定時は DATABASE_URL をソースとして使います）"
  );
  process.exit(1);
}

if (sourceUrl === targetUrl) {
  console.error("ソースとターゲットが同じ DB です。本番では別 URL を指定してください。");
  process.exit(1);
}

const source = new PrismaClient({ datasourceUrl: sourceUrl });
const target = new PrismaClient({ datasourceUrl: targetUrl });

/** 同期するマスタモデルを依存順（親→子）で並べる。DropTable と ExplorationArea は循環参照のため特別扱い。 */
const MASTER_DELEGATES_IN_ORDER = [
  "tag",
  "facilityType",
  "skill",
  "item",
  "equipmentType",
  "title",
  "relicType",
  "relicPassiveEffect",
  "relicGroupConfig",
  "researchGroup",
  "quest",
  "explorationTheme",
  "enemy",
  "enemyGroup",
  "mechaPartType",
  "dropTable", // 1回目: areaId を null で同期（後で戻す）
  "explorationArea",
  "facilityVariant",
  "facilityTypeTag",
  "craftRecipe",
  "craftRecipeInput",
  "researchGroupItem",
  "researchUnlockCost",
  "relicGroupPassiveEffect",
  "recipe",
  "recipeInput",
  "dropTableEntry",
  "enemyTacticSlot",
  "enemySkill",
  "enemyGroupEntry",
  "facilityConstructionRecipeInput",
  "skillEffect",
  "mechaPartTypeSkill",
] as const;

type DelegateName = (typeof MASTER_DELEGATES_IN_ORDER)[number];

async function syncTable(delegateName: DelegateName, clearAreaIdOnDropTable: boolean): Promise<void> {
  const src = source as unknown as Record<string, { findMany: () => Promise<unknown[]> }>;
  const tgt = target as unknown as Record<
    string,
    { upsert: (arg: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown> }
  >;
  const srcDelegate = src[delegateName];
  const tgtDelegate = tgt[delegateName];
  if (!srcDelegate?.findMany || !tgtDelegate?.upsert) {
    console.warn(`  skip (no delegate): ${delegateName}`);
    return;
  }

  const rows = (await srcDelegate.findMany()) as Record<string, unknown>[];
  if (rows.length === 0) {
    console.log(`  ${delegateName}: 0 件`);
    return;
  }

  let upserted = 0;
  for (const row of rows) {
    const id = row.id as string;
    if (!id) continue;
    let data = { ...row } as Record<string, unknown>;
    if (delegateName === "dropTable" && clearAreaIdOnDropTable && "areaId" in data) {
      data = { ...data, areaId: null };
    }
    await tgtDelegate.upsert({
      where: { id },
      create: data,
      update: data,
    });
    upserted++;
  }
  console.log(`  ${delegateName}: ${upserted} 件`);
}

async function fixDropTableAreaId(): Promise<void> {
  const rows = (await (source as { dropTable: { findMany: (arg: unknown) => Promise<unknown[]> } }).dropTable.findMany({
    select: { id: true, areaId: true },
  })) as { id: string; areaId: string | null }[];
  if (rows.length === 0) return;
  const withArea = rows.filter((r) => r.areaId != null);
  if (withArea.length === 0) return;
  const tgt = target as unknown as Record<
    string,
    { update: (arg: { where: { id: string }; data: { areaId: string | null } }) => Promise<unknown> }
  >;
  for (const row of withArea) {
    await tgt.dropTable.update({ where: { id: row.id }, data: { areaId: row.areaId } });
  }
  console.log(`  dropTable.areaId を ${withArea.length} 件反映`);
}

async function main() {
  console.log("マスタ同期: ソース → ターゲット");
  console.log("ターゲット:", targetUrl.replace(/:[^:@]+@/, ":****@"));

  try {
    await source.$connect();
    await target.$connect();
  } catch (e) {
    console.error("DB 接続に失敗しました。", e);
    process.exit(1);
  }

  const order = [...MASTER_DELEGATES_IN_ORDER];
  const dropTableIndex = order.indexOf("dropTable");
  const explorationAreaIndex = order.indexOf("explorationArea");

  for (let i = 0; i < order.length; i++) {
    const name = order[i];
    const clearAreaId = name === "dropTable" && explorationAreaIndex > i;
    await syncTable(name as DelegateName, clearAreaId);
  }

  await fixDropTableAreaId();

  await source.$disconnect();
  await target.$disconnect();
  console.log("完了.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
