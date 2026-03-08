// 探索エリア新規作成（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAdminExplorationThemeList,
  getAdminEnemyGroupCodeList,
  getAdminEnemyList,
} from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminExplorationAreaCreateForm } from "./admin-exploration-area-create-form";

export default async function AdminExplorationAreaNewPage({
  searchParams,
}: {
  searchParams: Promise<{ themeId?: string }>;
}) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const themeId = params.themeId ?? null;

  const [themes, enemyGroupCodes, enemies] = await Promise.all([
    getAdminExplorationThemeList(),
    getAdminEnemyGroupCodeList(),
    getAdminEnemyList(),
  ]);

  if (!themes) redirect("/dashboard");
  const enemyList = enemies ?? [];

  const theme = themeId ? themes.find((t) => t.id === themeId) : null;

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/exploration-themes"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← テーマ一覧
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">探索エリア新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">
        {theme
          ? `テーマ「${theme.name}」にエリアを追加します。`
          : "テーマを選んでから、code / name 等を入力してください。"}
      </p>

      <AdminExplorationAreaCreateForm
        themes={themes}
        initialThemeId={themeId}
        enemyGroupCodes={(enemyGroupCodes ?? []).map((g) => g.code)}
        enemies={enemyList.map((e) => ({ id: e.id, code: e.code, name: e.name }))}
      />
    </main>
  );
}
