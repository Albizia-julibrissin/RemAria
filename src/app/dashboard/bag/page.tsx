// spec/045, 051 - 物資庫（所持一覧・種別タブ・遺物。旧バッグ）

import Link from "next/link";
import {
  getInventory,
  getCharactersForSkillBook,
} from "@/server/actions/inventory";
import { getRelicInstances } from "@/server/actions/relic";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { BagTabs } from "./bag-tabs";

const ALL_TAB_IDS = [
  "material",
  "consumable",
  "blueprint",
  "skill_book",
  "paid",
  "equipment",
  "mecha_parts",
  "relic",
];

export default async function BagPage() {
  const [data, relicResult, charactersForSkillBook] = await Promise.all([
    getInventory(),
    getRelicInstances(),
    getCharactersForSkillBook(),
  ]);

  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  if (!data) {
    return (
      <main className="min-h-screen bg-base p-8">
        <MenuPageHeaderClient title="物資庫" description="所持アイテムの確認" currentPath="/dashboard/bag" />
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

  const { stackable, equipmentInstances, mechaPartInstances } = data;
  const relics = relicResult.success ? relicResult.relics : [];
  const relicTokenQuantity = stackable.find((s) => s.code === "relic_group_a_token")?.quantity ?? 0;

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="物資庫"
        description="所持アイテムを種別ごとに確認。消費は各機能画面（機工区・工房等）で行います。"
        currentPath="/dashboard/bag"
      />
      <BagTabs
        stackable={stackable}
        equipmentInstances={equipmentInstances}
        mechaPartInstances={mechaPartInstances}
        relicInstances={relics}
        relicTokenQuantity={relicTokenQuantity}
        allTabIds={ALL_TAB_IDS}
        charactersForSkillBook={charactersForSkillBook ?? []}
      />
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
