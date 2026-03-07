// 遺物グループ設定一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminRelicGroupConfigList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

export default async function AdminRelicGroupsPage() {
  const allowed = await isTestUser1();
  if (!allowed) redirect("/dashboard");

  const list = await getAdminRelicGroupConfigList();
  if (!list) redirect("/dashboard");

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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">遺物グループ編集</h1>
          <p className="mt-2 text-sm text-text-muted">
            RelicGroupConfig。鑑定時のステ補正・耐性幅・抽選対象パッシブをグループごとに設定します。groupCode は RelicType.groupCode およびトークン→グループと一致させてください。
          </p>
        </div>
        <Link
          href="/dashboard/admin/relic-groups/new"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass"
        >
          新規作成
        </Link>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">groupCode</th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">name</th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">ステ1</th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">ステ2</th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">耐性幅</th>
              <th className="border border-base-border px-2 py-1.5 text-center text-text-muted font-medium w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">{row.groupCode}</td>
                <td className="border border-base-border px-2 py-1.5">{row.name ?? "—"}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">{row.statBonus1Min}～{row.statBonus1Max}%</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">{row.statBonus2Min}～{row.statBonus2Max}%</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">{row.attributeResistMin}～{row.attributeResistMax}</td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <Link href={`/dashboard/admin/relic-groups/${row.id}`} className="text-brass hover:text-brass-hover">編集</Link>
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
