/**
 * マスタ同期の正本。
 * - MASTER_DELEGATES_IN_ORDER: このゲームのマスタテーブル一覧（依存順）。
 * - syncMasters: ソース Prisma からターゲット Prisma へ選択したマスタを upsert する。
 * CLI (prisma/sync-masters-to-target.ts) と管理画面 (spec/095) の両方がこのモジュールを参照する。
 */
import type { PrismaClient } from "@prisma/client";

/** 同期するマスタモデルを依存順（親→子）で並べる。DropTable と ExplorationArea は循環参照のため特別扱い。 */
export const MASTER_DELEGATES_IN_ORDER = [
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
  "facilityTypeConstructionInput",
  "skillEffect",
  "mechaPartTypeSkill",
] as const;

export type MasterDelegateName = (typeof MASTER_DELEGATES_IN_ORDER)[number];

export function isMasterDelegate(name: string): name is MasterDelegateName {
  return (MASTER_DELEGATES_IN_ORDER as readonly string[]).includes(name);
}

const delegateSet = new Set<string>(MASTER_DELEGATES_IN_ORDER);

export function getOrderedDelegates(onlyDelegates?: string[]): MasterDelegateName[] {
  const filter = onlyDelegates?.length
    ? (name: string) => delegateSet.has(name) && onlyDelegates.includes(name)
    : (name: string) => delegateSet.has(name);
  return MASTER_DELEGATES_IN_ORDER.filter((name) => filter(name));
}

export interface SyncMastersResult {
  results: Array<{ delegateName: string; upserted: number }>;
  failedAt?: string;
  failureMessage?: string;
}

type PrismaLike = Record<
  string,
  | { findMany: (arg?: unknown) => Promise<unknown[]> }
  | { upsert: (arg: {
      where: { id: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown> }
  | { update: (arg: { where: { id: string }; data: { areaId: string | null } }) => Promise<unknown> }
>;

/**
 * ソース DB のマスタをターゲット DB に upsert する。
 * onlyDelegates を渡した場合、その delegate のみを MASTER_DELEGATES_IN_ORDER の順で処理する。
 */
export async function syncMasters(
  source: PrismaClient,
  target: PrismaClient,
  options?: { onlyDelegates?: string[] }
): Promise<SyncMastersResult> {
  const order = getOrderedDelegates(options?.onlyDelegates);
  const dropTableIndex = order.indexOf("dropTable" as MasterDelegateName);
  const explorationAreaIndex = order.indexOf("explorationArea" as MasterDelegateName);

  const results: Array<{ delegateName: string; upserted: number }> = [];
  const src = source as unknown as PrismaLike;
  const tgt = target as unknown as PrismaLike;

  for (let i = 0; i < order.length; i++) {
    const delegateName = order[i];
    const clearAreaId =
      delegateName === "dropTable" && explorationAreaIndex > dropTableIndex;

    try {
      const upserted = await syncTable(src, tgt, delegateName, clearAreaId);
      results.push({ delegateName, upserted });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        results,
        failedAt: delegateName,
        failureMessage: message,
      };
    }
  }

  // dropTable を同期した場合のみ areaId を後から反映
  if (order.includes("dropTable" as MasterDelegateName)) {
    try {
      await fixDropTableAreaId(source as PrismaClient, target as PrismaClient);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        results,
        failedAt: "dropTable.areaId",
        failureMessage: message,
      };
    }
  }

  return { results };
}

async function syncTable(
  src: PrismaLike,
  tgt: PrismaLike,
  delegateName: string,
  clearAreaIdOnDropTable: boolean
): Promise<number> {
  const srcDelegate = src[delegateName] as { findMany: () => Promise<unknown[]> } | undefined;
  const tgtDelegate = tgt[delegateName] as {
    upsert: (arg: {
      where: { id: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown>;
  } | undefined;

  if (!srcDelegate?.findMany || !tgtDelegate?.upsert) {
    return 0;
  }

  const rows = (await srcDelegate.findMany()) as Record<string, unknown>[];
  if (rows.length === 0) return 0;

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
  return upserted;
}

async function fixDropTableAreaId(source: PrismaClient, target: PrismaClient): Promise<void> {
  const rows = await (source as { dropTable: { findMany: (arg: unknown) => Promise<unknown[]> } }).dropTable.findMany({
    select: { id: true, areaId: true },
  });
  const typed = rows as { id: string; areaId: string | null }[];
  if (typed.length === 0) return;
  const withArea = typed.filter((r) => r.areaId != null);
  if (withArea.length === 0) return;
  const tgt = target as unknown as Record<
    string,
    { update: (arg: { where: { id: string }; data: { areaId: string | null } }) => Promise<unknown> }
  >;
  for (const row of withArea) {
    await tgt.dropTable.update({ where: { id: row.id }, data: { areaId: row.areaId } });
  }
}
