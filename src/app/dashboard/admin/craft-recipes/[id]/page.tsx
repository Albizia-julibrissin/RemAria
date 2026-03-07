// クラフトレシピ 1件編集（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminCraftRecipe, getAdminCraftRecipeOptions } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminCraftRecipeEditForm } from "./admin-craft-recipe-edit-form";

export default async function AdminCraftRecipeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const [recipe, options] = await Promise.all([
    getAdminCraftRecipe(id),
    getAdminCraftRecipeOptions(),
  ]);

  if (!recipe) {
    notFound();
  }
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

      <h1 className="text-2xl font-bold text-text-primary">クラフトレシピ編集</h1>
      <p className="mt-2 text-sm text-text-muted">
        {recipe.code} — {recipe.name}
      </p>

      <AdminCraftRecipeEditForm recipe={recipe} options={options} />
    </main>
  );
}
