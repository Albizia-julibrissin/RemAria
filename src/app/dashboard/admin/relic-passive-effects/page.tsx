// 遺物パッシブ効果一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminRelicPassiveEffectList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

export default async function AdminRelicPassiveEffectsPage() {
  const allowed = await isTestUser1();
  if (!allowed) redirect("/dashboard");

  const list = await getAdminRelicPassiveEffectList();
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
          <h1 className="text-2xl font-bold text-text-primary">遺物パッシブ効果編集</h1>
          <p className="mt-2 text-sm text-text-muted">
            RelicPassiveEffect（code / name / description）。遺物個体に紐づく効果マスタ。
          </p>
        </div>
        <Link
          href="/dashboard/admin/relic-passive-effects/new"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass"
        >
          新規作成
        </Link>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">code</th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">name</th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium max-w-[280px]">description</th>
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">{row.code}</td>
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted truncate max-w-[280px]">{row.description ?? "—"}</td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <Link href={`/dashboard/admin/relic-passive-effects/${row.id}`} className="text-brass hover:text-brass-hover">編集</Link>
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
