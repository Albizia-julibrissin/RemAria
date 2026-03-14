// コンテンツ管理トップ（管理用アカウントのみ）。各編集画面へのリンクハブ。

import Link from "next/link";
import { redirect } from "next/navigation";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminBackButton } from "../admin-back-button";

const LINK_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "アイテム・クラフト",
    links: [
      { href: "/dashboard/admin/items", label: "アイテムマスタ編集" },
      { href: "/dashboard/admin/equipment-types", label: "装備型編集" },
      { href: "/dashboard/admin/craft-recipes", label: "クラフトレシピ編集" },
    ],
  },
  {
    title: "設備",
    links: [
      { href: "/dashboard/admin/facilities", label: "設備種別編集" },
      { href: "/dashboard/admin/recipes", label: "設備生産レシピ編集" },
    ],
  },
  {
    title: "遺物",
    links: [
      { href: "/dashboard/admin/relic-types", label: "遺物型編集" },
      { href: "/dashboard/admin/relic-passive-effects", label: "遺物パッシブ効果編集" },
      { href: "/dashboard/admin/relic-groups", label: "遺物グループ編集" },
    ],
  },
  {
    title: "敵・スキル",
    links: [
      { href: "/dashboard/admin/enemies", label: "敵マスタ編集" },
      { href: "/dashboard/admin/enemy-groups", label: "敵グループ編集" },
      { href: "/dashboard/admin/skills", label: "スキル編集" },
    ],
  },
  {
    title: "探索",
    links: [
      { href: "/dashboard/admin/exploration-themes", label: "探索テーマ・エリア編集" },
      { href: "/dashboard/admin/skill-events", label: "技能イベント編集" },
      { href: "/dashboard/admin/drops", label: "エリアドロップ編集" },
    ],
  },
  {
    title: "研究・その他",
    links: [
      { href: "/dashboard/admin/research-groups", label: "研究グループ編集" },
      { href: "/dashboard/admin/quests", label: "開拓任務編集" },
      { href: "/dashboard/admin/underground-market", label: "闇市・黒市編集" },
      { href: "/battle/practice", label: "仮戦闘" },
    ],
  },
  {
    title: "運用",
    links: [
      { href: "/dashboard/admin/users", label: "登録済みユーザ一覧" },
      { href: "/dashboard/admin/currency-history", label: "通貨履歴（ユーザー別）" },
      { href: "/dashboard/admin/item-usage-history", label: "特別アイテム使用履歴（ユーザー別）" },
    ],
  },
];

export default async function AdminContentPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6">
        <AdminBackButton />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">コンテンツ管理</h1>
      <p className="mt-2 text-sm text-text-muted">
        各編集画面へ移動します。テストユーザー1でログイン中のみ表示されます。
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {LINK_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider border-b border-base-border pb-1.5 mb-3">
              {group.title}
            </h2>
            <ul className="space-y-2">
              {group.links.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="block rounded-lg border border-base-border bg-base-elevated px-4 py-3 text-text-primary transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
