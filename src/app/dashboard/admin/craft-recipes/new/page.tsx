// クラフトレシピ新規作成（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminCraftRecipeOptions } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminCraftRecipeCreateForm } from "./admin-craft-recipe-create-form";

export default async function AdminCraftRecipeNewPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const options = await getAdminCraftRecipeOptions();
  if (!options) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/craft-recipes"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← クラフトレシピ一覧
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">クラフトレシピ新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">
        code / name / 出力種別・出力先 / 入力素材を入力して新規レシピを登録します。code はユニークです。
      </p>

      <AdminCraftRecipeCreateForm options={options} />
    </main>
  );
}
