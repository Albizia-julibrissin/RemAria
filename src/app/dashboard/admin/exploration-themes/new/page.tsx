// 探索テーマ新規作成（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminExplorationThemeCreateForm } from "./admin-exploration-theme-create-form";

export default async function AdminExplorationThemeNewPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
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

      <h1 className="text-2xl font-bold text-text-primary">探索テーマ新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">
        code / name はユニークです。作成後にエリアを追加する場合はエリア編集で新規作成してください。
      </p>

      <AdminExplorationThemeCreateForm />
    </main>
  );
}
