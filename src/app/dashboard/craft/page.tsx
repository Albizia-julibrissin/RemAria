// spec/046 - アイテムクラフト

import Link from "next/link";
import { getCraftRecipes } from "@/server/actions/craft";
import { EQUIPMENT_SLOT_LABELS } from "@/lib/constants/equipment-slots";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { CraftExecuteButton } from "./craft-execute-button";

function slotLabel(slot: string): string {
  return EQUIPMENT_SLOT_LABELS[slot as keyof typeof EQUIPMENT_SLOT_LABELS] ?? slot;
}

export default async function CraftPage() {
  const recipes = await getCraftRecipes();

  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  if (!recipes) {
    return (
      <main className="min-h-screen bg-base p-8">
        <MenuPageHeaderClient title="工房" description="装備や消耗品を製作する" currentPath="/dashboard/craft" />
        <p className="text-text-muted">ログインしてください。</p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
        <footer className="mt-8 border-t border-base-border pt-4">
          <Link href="/dashboard" className={footerLinkClass}>
            ← 開拓拠点に戻る
          </Link>
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="工房"
        description="装備や消耗品を製作する。レシピを選んで実行すると必要な資源を消費して装備・消耗品を作成。装備は個体ごとにステータスがランダムで決まります。"
        currentPath="/dashboard/craft"
      />
      <p className="mb-4 text-sm text-text-muted">
        <Link href="/dashboard/bag" className="text-brass hover:underline">物資庫</Link>
        で所持数を確認できます。
      </p>

      <section className="rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
        <h2 className="text-lg font-medium text-text-primary">レシピ一覧</h2>
        {recipes.length === 0 ? (
          <p className="mt-4 text-text-muted">レシピがありません。</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {recipes.map((r) => (
              <li
                key={r.id}
                className="rounded border border-base-border bg-base p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <span className="font-medium text-text-primary">{r.name}</span>
                  <div className="mt-1 text-sm text-text-muted">
                    消費: {r.inputs.map((i) => `${i.itemName} × ${i.amount}`).join("、")}
                  </div>
                  <div className="mt-1 text-sm text-brass">
                    →{" "}
                    {r.output.kind === "equipment" && (
                      <>
                        {r.output.equipmentTypeName}
                        {r.output.equipmentSlot && (
                          <span className="text-text-muted">（{slotLabel(r.output.equipmentSlot)}）</span>
                        )}
                      </>
                    )}
                    {r.output.kind === "mecha_part" && r.output.mechaPartTypeName}
                    {r.output.kind === "item" && r.output.itemName}
                  </div>
                </div>
                <CraftExecuteButton recipeId={r.id} recipeName={r.name} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
