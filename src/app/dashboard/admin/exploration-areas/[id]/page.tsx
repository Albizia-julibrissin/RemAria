// 探索エリア 1件編集（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminExplorationAreaEditData } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminExplorationAreaEditForm } from "./admin-exploration-area-edit-form";

export default async function AdminExplorationAreaEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const data = await getAdminExplorationAreaEditData(id);

  if (!data) {
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

      <h1 className="text-2xl font-bold text-text-primary">探索エリア編集</h1>
      <p className="mt-2 text-sm text-text-muted">
        {data.area.themeName} — {data.area.name}（{data.area.code}）
      </p>
      <p className="mt-1 text-xs text-text-muted">
        ドロップテーブルは
        <Link
          href={`/dashboard/admin/drops?areaId=${encodeURIComponent(id)}`}
          className="text-brass hover:text-brass-hover ml-1"
        >
          エリアドロップ編集
        </Link>
        で設定します。
      </p>

      <AdminExplorationAreaEditForm data={data} />
    </main>
  );
}
