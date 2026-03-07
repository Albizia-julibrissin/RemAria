// 設備生産レシピ新規作成（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminRecipeOptions } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminRecipeCreateForm } from "./admin-recipe-create-form";

export default async function AdminRecipeNewPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const options = await getAdminRecipeOptions();
  if (!options) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/recipes"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← レシピ一覧
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">設備生産レシピ新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">
        レシピ未登録の設備を選び、周期・出力・入力素材を登録します。1 設備に 1 レシピまで。
      </p>

      <AdminRecipeCreateForm options={options} />
    </main>
  );
}
