// 登録済みユーザ一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUserList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

function formatDate(d: Date): string {
  return new Date(d).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
        登録されているアカウント一覧です。テストユーザー1でログイン中のみ表示されます。
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                email
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                accountId
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                表示名
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-24">
                状態
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                登録日時
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                最終ログイン
              </th>
              <th className="border border-base-border px-2 py-1.5 text-center text-text-muted font-medium w-20">
                主人公
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5">{row.email}</td>
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                  {row.accountId}
                </td>
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.accountStatus}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {formatDate(row.createdAt)}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {row.lastLoginAt ? formatDate(row.lastLoginAt) : "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center text-text-muted">
                  {row.hasProtagonist ? "済" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">計 {users.length} 件</p>
    </main>
  );
}
