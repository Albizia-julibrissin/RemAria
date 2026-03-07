// 設備生産レシピ一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminRecipeList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

const KIND_LABELS: Record<string, string> = {
  resource_exploration: "資源探索",
  industrial: "工業",
  training: "訓練",
};

export default async function AdminRecipesPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const recipes = await getAdminRecipeList();
  if (!recipes) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← ダッシュボード
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">設備生産レシピ編集</h1>
          <p className="mt-2 text-sm text-text-muted">
            設備種別ごとの生産レシピ（Recipe）。周期・出力・入力素材を編集します。
          </p>
        </div>
        <Link
          href="/dashboard/admin/recipes/new"
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
                設備
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-24">
                種別
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                周期(分)
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                出力
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-16">
                入力数
              </th>
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5">{row.facilityName}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {KIND_LABELS[row.facilityKind] ?? row.facilityKind}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.cycleMinutes}
                </td>
                <td className="border border-base-border px-2 py-1.5">
                  {row.outputItemName} ×{row.outputAmount}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.inputCount}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <Link
                    href={`/dashboard/admin/recipes/${row.id}`}
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
      <p className="mt-2 text-xs text-text-muted">計 {recipes.length} 件</p>
    </main>
  );
}
