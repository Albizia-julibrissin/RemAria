// spec/045, 051 - バッグ（所持一覧・種別タブ・遺物）

import Link from "next/link";
import {
  getInventory,
  getCharactersForSkillBook,
} from "@/server/actions/inventory";
import { getRelicInstances } from "@/server/actions/relic";
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

  if (!data) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">バッグ</h1>
        <p className="mt-4 text-text-muted">ログインしてください。</p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
      </main>
    );
  }

  const { stackable, equipmentInstances, mechaPartInstances } = data;
  const relics = relicResult.success ? relicResult.relics : [];
  const relicTokenQuantity = stackable.find((s) => s.code === "relic_group_a_token")?.quantity ?? 0;

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← ダッシュボード
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">バッグ</h1>
      <p className="mt-2 text-text-muted">
        所持アイテムを種別ごとに確認できます。消費は各機能画面（工業・クラフト等）で行います。
      </p>

      <BagTabs
        stackable={stackable}
        equipmentInstances={equipmentInstances}
        mechaPartInstances={mechaPartInstances}
        relicInstances={relics}
        relicTokenQuantity={relicTokenQuantity}
        allTabIds={ALL_TAB_IDS}
        charactersForSkillBook={charactersForSkillBook ?? []}
      />
    </main>
  );
}
