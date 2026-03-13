// 設備種別一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminBackButton } from "../admin-back-button";
import { getAdminFacilityTypeList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

const KIND_LABELS: Record<string, string> = {
  resource_exploration: "資源探索",
  industrial: "工業",
  training: "訓練",
};

export default async function AdminFacilitiesPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const facilities = await getAdminFacilityTypeList();
  if (!facilities) {
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
          <h1 className="text-2xl font-bold text-text-primary">設備種別編集</h1>
          <p className="mt-2 text-sm text-text-muted">
            FacilityType の name / kind / description / cost を編集します。行の「編集」で編集画面へ。
          </p>
        </div>
        <Link
          href="/dashboard/admin/facilities/new"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass"
        >
          新規作成
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                name
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-28">
                kind
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium max-w-[200px]">
                description
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-16">
                cost
              </th>
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {KIND_LABELS[row.kind] ?? row.kind}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted truncate max-w-[200px]">
                  {row.description ?? "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.cost}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <Link
                    href={`/dashboard/admin/facilities/${row.id}`}
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
      <p className="mt-2 text-xs text-text-muted">計 {facilities.length} 件</p>
    </main>
  );
}
