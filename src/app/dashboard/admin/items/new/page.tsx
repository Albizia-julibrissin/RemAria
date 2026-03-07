// アイテム新規作成（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSkillsForItem } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminItemCreateForm } from "./admin-item-create-form";

export default async function AdminItemNewPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const skills = await getAdminSkillsForItem();
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

      <h1 className="text-2xl font-bold text-text-primary">アイテム新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">
        code / name / category 等を入力して新規アイテムを登録します。code はユニークです。
      </p>

      <AdminItemCreateForm skills={skills} />
    </main>
  );
}
