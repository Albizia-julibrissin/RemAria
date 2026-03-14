// spec/046 - 製造 / spec/084 - 鍛錬・継承タブ

import Link from "next/link";
import { getCraftRecipes, getTemperableEquipment, getInheritCandidates } from "@/server/actions/craft";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { CraftTabs } from "./craft-tabs";

export default async function CraftPage() {
  const [recipes, temperableEquipment, inheritCandidates] = await Promise.all([
    getCraftRecipes(),
    getTemperableEquipment(),
    getInheritCandidates(),
  ]);

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
        description="製造で装備・消耗品を作成。鍛錬で装備のステを振り直し、継承で装備の上限を引き上げます。"
        currentPath="/dashboard/craft"
      />

      <CraftTabs
        recipes={recipes}
        temperableEquipment={temperableEquipment ?? []}
        inheritCandidates={inheritCandidates ?? { targets: [], consumeOptions: [] }}
      />

      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
