// 研究グループ一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminBackButton } from "../admin-back-button";
import { getAdminResearchGroupList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

export default async function AdminResearchGroupsPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const list = await getAdminResearchGroupList();
  if (!list) {
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
          <h1 className="text-2xl font-bold text-text-primary">研究グループ編集</h1>
          <p className="mt-2 text-sm text-text-muted">
            docs/054。研究解放のグループ・解放対象（設備型/クラフトレシピ）・消費アイテムを編集します。
          </p>
        </div>
        <Link
          href="/dashboard/admin/research-groups/new"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass"
        >
          新規作成
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                code
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                name
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                表示順
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                対象数
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium max-w-[120px]">
                前提グループ
              </th>
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                  {row.code}
                </td>
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.displayOrder}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.itemCount}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {row.prerequisiteGroupCode ?? "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <Link
                    href={`/dashboard/admin/research-groups/${row.id}`}
                    className="text-brass hover:text-brass-hover"
                  >
                    編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">計 {list.length} 件</p>
    </main>
  );
}
