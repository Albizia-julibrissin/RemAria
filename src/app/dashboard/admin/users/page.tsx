// 登録済みユーザ一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUserList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminUserListClient } from "./admin-user-list-client";

export default async function AdminUsersPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const users = await getAdminUserList();
  if (!users) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/content"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← コンテンツ管理
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">登録済みユーザ一覧</h1>
      <p className="mt-2 text-sm text-text-muted">
        登録されているアカウント一覧です。テストユーザー1でログイン中のみ表示されます。列ヘッダーをクリックでソートできます。
      </p>

      <AdminUserListClient users={users} />
    </main>
  );
}
