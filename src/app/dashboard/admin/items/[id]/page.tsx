// アイテムマスタ 1件編集（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminItem, getAdminSkillsForItem } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminItemEditForm } from "./admin-item-edit-form";

export default async function AdminItemEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const [item, skills] = await Promise.all([
    getAdminItem(id),
    getAdminSkillsForItem(),
  ]);

  if (!item) {
    notFound();
  }
  if (!skills) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/items"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← アイテム一覧
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">アイテム編集</h1>
      <p className="mt-2 text-sm text-text-muted">
        {item.code} — {item.name}
      </p>

      <AdminItemEditForm item={item} skills={skills} />
    </main>
  );
}
