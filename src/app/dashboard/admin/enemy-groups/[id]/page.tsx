// 敵グループ 1件編集（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminEnemyGroupEditData } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminEnemyGroupEditForm } from "./admin-enemy-group-edit-form";

export default async function AdminEnemyGroupEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const data = await getAdminEnemyGroupEditData(id);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/enemy-groups"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← グループ一覧
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">敵グループ編集</h1>
      <p className="mt-2 text-sm text-text-muted font-mono">{data.group.code}</p>

      <AdminEnemyGroupEditForm data={data} />
    </main>
  );
}
