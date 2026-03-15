// spec/010_auth - 保護画面（ログイン必須）
// spec/020_test_battle - 仮戦闘 / spec/025 - 宿舎 / spec/030 - 通貨表示
// docs/07_ui_guidelines 準拠

import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentExpeditionSummary, getExplorationMenu } from "@/server/actions/exploration";
import { getPartyPresetListForExploration } from "@/server/actions/tactics";
import { getConsumableStacksForExploration } from "@/server/actions/inventory";
import { getAdminEmail } from "@/server/lib/admin";
import { ExplorationStartClient } from "./exploration-start-client";
import { CharacterSummaryCard } from "./character-summary-card";
import { GameIcon } from "@/components/icons/game-icon";

export default async function DashboardPage() {
  // セッション取得後、ダッシュボード表示に必要なデータだけを並列取得
  const session = await getSession();

  const [
    userForDashboard,
    explorationMenuResult,
    partyPresetListResult,
    consumableStacksResult,
    currentExpedition,
    charactersForSummary,
  ] = await Promise.all([
    session?.userId
      ? prisma.user.findUnique({
          where: { id: session.userId },
          select: {
            email: true,
            premiumCurrencyFreeBalance: true,
            premiumCurrencyPaidBalance: true,
            marketUnlocked: true,
          },
        })
      : Promise.resolve(null),
    getExplorationMenu(),
    getPartyPresetListForExploration(),
    getConsumableStacksForExploration(),
    getCurrentExpeditionSummary(),
    session?.userId
      ? prisma.character.findMany({
          where: { userId: session.userId, category: { in: ["protagonist", "companion", "mech"] } },
          select: {
            id: true,
            category: true,
            displayName: true,
            iconFilename: true,
            level: true,
            experiencePoints: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const adminEmail = await getAdminEmail();
  const showAdminContent = userForDashboard?.email === adminEmail;
  const balances =
    userForDashboard != null
      ? {
          premiumFree: userForDashboard.premiumCurrencyFreeBalance,
          premiumPaid: userForDashboard.premiumCurrencyPaidBalance,
        }
      : null;

  const explorationThemes =
    explorationMenuResult.success === true ? explorationMenuResult.themes : [];
  const partyPresets = "presets" in partyPresetListResult ? partyPresetListResult.presets : [];
  const consumableStacks = consumableStacksResult ?? [];

  const subMenuLinks = [
    // 居住区: spec/025_character_list.md, spec/030（推薦紹介状で仲間追加）
    { href: "/dashboard/characters", label: "居住区", sub: "キャラクター一覧・推薦紹介状で仲間追加", icon: "three-friends" },
    // 機工区: spec/035_initial_area_facilities.md, 036_production
    { href: "/dashboard/facilities", label: "機工区", sub: "設備配置と生産の管理", icon: "factory" },
    // 研究局: spec/047_research_unlock_construction.md
    { href: "/dashboard/research", label: "研究局", sub: "設備やレシピを解放する", icon: "microscope" },
    // 工房: spec/046_item_craft.md
    { href: "/dashboard/craft", label: "工房", sub: "装備や消耗品を製作する", icon: "anvil-impact" },
    // 物資庫: spec/045_inventory_and_items.md
    { href: "/dashboard/bag", label: "物資庫", sub: "所持アイテムの確認", icon: "wooden-crate" },
    // 開拓任務: spec/054_quests.md
    { href: "/dashboard/quests", label: "開拓任務", sub: "使命・研究・特殊・一般の開拓任務の進捗", icon: "feather" },
    // 闇市: docs/079（GRA で特別アイテム購入）
    { href: "/dashboard/underground-market", label: "闇市", sub: "GRA で特別アイテムを購入", icon: "black-bar" },
    // 市場: spec/075_market.md（解放時のみ有効）
    { href: "/dashboard/market", label: "市場", sub: "出品・購入", icon: "life-in-the-balance" },
    // 開拓者証（プロフィール）: docs/088_profile_screen_draft.md（表示名・称号など・草案）
    { href: "/dashboard/profile", label: "開拓者証", sub: "表示名・称号などのアカウント情報", icon: "person" },
  ] as const;

  const marketUnlocked = userForDashboard?.marketUnlocked ?? false;

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="max-w-5xl mx-auto">
        {/* 2カラム：左 = ぱっと見たい情報 / 右 = メニュー */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* 左カラム：キャラサマリ・探索 */}
          <div className="space-y-6">
            {/* キャラサマリ（主人公/仲間のアイコン・レベル・経験値、ドロップダウンで切り替え） */}
            {charactersForSummary.length > 0 && (
              <CharacterSummaryCard
                characters={charactersForSummary}
                balances={balances}
              />
            )}

            {/* 探索（進行中があれば「再開」＋「撤退」、なければ新規開始） */}
            <section>
              <div className="max-w-md">
                <ExplorationStartClient
                  themes={explorationThemes}
                  partyPresets={partyPresets}
                  consumableStacks={consumableStacks}
                  hasOngoingExpedition={currentExpedition != null}
                />
              </div>
            </section>
          </div>

          {/* 右カラム：機能メニュー（居住区・人材局・機工区・研究局・工房・物資庫・開拓任務・作戦室 など） */}
          <div className="space-y-4">
            <section>
              <div className="grid gap-2 sm:grid-cols-2">
                {subMenuLinks.map(({ href, label, sub, icon }) => {
                  const isMarket = href === "/dashboard/market";
                  const disabled = isMarket && !marketUnlocked;
                  const title = disabled
                    ? "開拓任務をクリアすると利用可能になります"
                    : sub;
                  if (disabled) {
                    return (
                      <span
                        key={href}
                        title={title}
                        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-base-border bg-base px-3 py-1.5 text-sm text-text-muted whitespace-nowrap opacity-70"
                      >
                        {icon && <GameIcon name={icon} className="w-4 h-4" />}
                        <span className="font-medium">{label}</span>
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={title}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-base-border bg-base px-3 py-1.5 text-sm text-text-primary whitespace-nowrap transition-colors hover:border-brass hover:bg-base-elevated focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                    >
                      {icon && (
                        <GameIcon name={icon} className="w-4 h-4 text-brass" />
                      )}
                      <span className="font-medium">{label}</span>
                    </Link>
                  );
                })}

                {/* 作戦室：探索前の準備として常に見えるようにメニュー側にも配置 */}
                <Link
                  href="/dashboard/tactics"
                  title="パーティプリセットと作戦スロットの設定"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-base-border bg-base px-4 py-2 text-sm text-text-primary transition-colors hover:border-brass hover:bg-base-elevated focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                >
                  <GameIcon name="battle-gear" className="w-4 h-4 text-brass" />
                  <span className="font-medium">作戦室</span>
                </Link>
              </div>
            </section>

            {showAdminContent && (
              <section className="rounded-lg border border-base-border bg-base-elevated p-4 text-sm">
                <Link
                  href="/dashboard/admin/content"
                  className="flex flex-col text-text-primary transition-colors hover:text-brass"
                >
                  <span className="font-medium">コンテンツ管理（管理者用）</span>
                  <span className="mt-1 text-xs text-text-muted">
                    アイテム・スキル・敵・探索テーマ/エリアなどのマスタ編集。
                  </span>
                </Link>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
