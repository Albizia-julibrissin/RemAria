/**
 * マスタデータのみを「ソース DB」から「ターゲット DB（本番など）」へ同期する。
 * ユーザー・キャラ・所持品などは一切触らない。ID はそのままコピーするので、既存のユーザーデータの参照は維持される。
 *
 * 【マイグレーションでマスタ系テーブルを追加・削除した場合】
 * 正本は **src/server/lib/sync-masters.ts** の **MASTER_DELEGATES_IN_ORDER** を更新する。このスクリプトはそれを参照する。
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
import { syncMasters } from "../src/server/lib/sync-masters";

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

async function main() {
  console.log("マスタ同期: ソース → ターゲット");
  console.log("ターゲット:", targetUrl!.replace(/:[^:@]+@/, ":****@"));

  try {
    await source.$connect();
    await target.$connect();
  } catch (e) {
    console.error("DB 接続に失敗しました。", e);
    process.exit(1);
  }

  const result = await syncMasters(source, target);

  for (const r of result.results) {
    console.log(`  ${r.delegateName}: ${r.upserted} 件`);
  }
  if (result.failedAt) {
    console.error(`  failed at ${result.failedAt}: ${result.failureMessage}`);
    await source.$disconnect();
    await target.$disconnect();
    process.exit(1);
  }

  await source.$disconnect();
  await target.$disconnect();
  console.log("完了.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
