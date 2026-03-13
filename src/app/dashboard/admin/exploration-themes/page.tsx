// 探索テーマ一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminBackButton } from "../admin-back-button";
import { getAdminExplorationThemeList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

export default async function AdminExplorationThemesPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const themes = await getAdminExplorationThemeList();
  if (!themes) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <AdminBackButton />
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">探索テーマ・エリア編集</h1>
          <p className="mt-2 text-sm text-text-muted">
            テーマ名・表示順と、エリアの code/name・敵グループ・体数確率などを編集します。
          </p>
        </div>
        <Link
          href="/dashboard/admin/exploration-themes/new"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass"
        >
          新規テーマ
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className="rounded border border-base-border bg-base-elevated p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-text-muted text-sm">表示順 {theme.displayOrder}</span>
                <h2 className="text-lg font-medium text-text-primary">{theme.name}</h2>
                <p className="font-mono text-xs text-text-muted">{theme.code}</p>
              </div>
              <Link
                href={`/dashboard/admin/exploration-themes/${theme.id}`}
                className="text-brass hover:text-brass-hover text-sm"
              >
                テーマ編集
              </Link>
            </div>
            <ul className="mt-3 space-y-1 border-t border-base-border pt-3">
              {theme.areas.length === 0 ? (
                <li className="text-sm text-text-muted">エリアなし</li>
              ) : (
                theme.areas.map((area) => (
                  <li key={area.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-primary">
                      <span className="font-mono text-xs text-text-muted">{area.code}</span> — {area.name}
                    </span>
                    <Link
                      href={`/dashboard/admin/exploration-areas/${area.id}`}
                      className="text-brass hover:text-brass-hover"
                    >
                      エリア編集
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-text-muted">テーマ {themes.length} 件</p>
    </main>
  );
}
