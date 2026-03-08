// 探索テーマ 1件編集（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminExplorationTheme } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminExplorationThemeEditForm } from "./admin-exploration-theme-edit-form";

export default async function AdminExplorationThemeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const theme = await getAdminExplorationTheme(id);

  if (!theme) {
    notFound();
  }

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

      <h1 className="text-2xl font-bold text-text-primary">探索テーマ編集</h1>
      <p className="mt-2 text-sm text-text-muted">{theme.name}</p>

      <AdminExplorationThemeEditForm theme={theme} />

      <section className="mt-8 rounded border border-base-border bg-base-elevated p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-text-primary">配下のエリア</h2>
          <Link
            href={`/dashboard/admin/exploration-areas/new?themeId=${encodeURIComponent(theme.id)}`}
            className="text-sm text-brass hover:text-brass-hover"
          >
            新規エリア
          </Link>
        </div>
        {theme.areas.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">エリアはありません。「新規エリア」から追加できます。</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {theme.areas.map((area) => (
              <li key={area.id}>
                <Link
                  href={`/dashboard/admin/exploration-areas/${area.id}`}
                  className="text-brass hover:text-brass-hover text-sm"
                >
                  {area.name}（{area.code}）
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
