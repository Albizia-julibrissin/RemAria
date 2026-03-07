// クラフトレシピ一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminCraftRecipeList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

const OUTPUT_KIND_LABELS: Record<string, string> = {
  equipment: "装備",
  mecha_part: "メカパーツ",
  item: "アイテム",
};

export default async function AdminCraftRecipesPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const recipes = await getAdminCraftRecipeList();
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
          <h1 className="text-2xl font-bold text-text-primary">クラフトレシピ編集</h1>
          <p className="mt-2 text-sm text-text-muted">
            CraftRecipe の code / name / 出力種別・出力先 / 入力素材を編集します。行の「編集」で編集画面へ。
          </p>
        </div>
        <Link
          href="/dashboard/admin/craft-recipes/new"
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
                code
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                name
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-24">
                出力種別
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                出力
              </th>
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                  {row.code}
                </td>
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {OUTPUT_KIND_LABELS[row.outputKind] ?? row.outputKind}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.outputName ?? "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <Link
                    href={`/dashboard/admin/craft-recipes/${row.id}`}
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
