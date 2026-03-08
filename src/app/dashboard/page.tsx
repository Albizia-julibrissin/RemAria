// spec/010_auth - 保護画面（ログイン必須）
// spec/020_test_battle - 仮戦闘 / spec/025 - 宿舎 / spec/030 - 通貨表示
// docs/07_ui_guidelines 準拠

import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentExpeditionSummary, getExplorationMenu } from "@/server/actions/exploration";
import { getPartyPresets } from "@/server/actions/tactics";
import { getInventory } from "@/server/actions/inventory";
import { isTestUser1 } from "@/server/lib/admin";
import { ExplorationStartClient } from "./exploration-start-client";
import { ExplorationAbortClient } from "./exploration-abort-client";
import { GraDisplay } from "@/components/currency/gra-display";

export default async function DashboardPage() {
  const session = await getSession();
  const showAdminContent = await isTestUser1();
  let balances: { premiumFree: number; premiumPaid: number } | null = null;
  if (session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        premiumCurrencyFreeBalance: true,
        premiumCurrencyPaidBalance: true,
      },
    });
    if (user) {
      balances = {
        premiumFree: user.premiumCurrencyFreeBalance,
        premiumPaid: user.premiumCurrencyPaidBalance,
      };
    }
  }

  // 探索メニュー（MVP プレビュー用）
  const explorationMenuResult = await getExplorationMenu();
  const explorationThemes =
    explorationMenuResult.success === true ? explorationMenuResult.themes : [];

  // パーティプリセット一覧（探索時の編成選択用）
  const partyPresetResult = await getPartyPresets();
  const partyPresets = "presets" in partyPresetResult ? partyPresetResult.presets : [];

  // 探索用消耗品候補（category=consumable の所持アイテム）
  const inventory = await getInventory("consumable");
  const consumableStacks = inventory?.stackable ?? [];

  // 進行中の探索サマリ（あれば）
  const currentExpedition = await getCurrentExpeditionSummary();

  const subMenuLinks = [
    { href: "/dashboard/characters", label: "宿舎", sub: "キャラクター一覧" },
    { href: "/dashboard/recruit", label: "雇用斡旋所", sub: "仲間を雇用する" },
    { href: "/dashboard/facilities", label: "工業エリア", sub: "設備配置（spec/035）" },
    { href: "/dashboard/research", label: "研究", sub: "設備・レシピ解放（docs/054）" },
    { href: "/dashboard/craft", label: "アイテムクラフト", sub: "装備・消耗品を製作（spec/046）" },
    { href: "/dashboard/bag", label: "倉庫", sub: "所持アイテム（種別タブ）spec/045" },
    { href: "/dashboard/quests", label: "クエスト", sub: "ストーリー・研究クエスト進捗（docs/054）" },
  ];

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary">ダッシュボード</h1>
        {balances != null && (
          <div className="rounded-lg border border-base-border bg-base-elevated px-4 py-2">
            <span className="text-xs text-text-muted mr-2">所持通貨</span>
            <GraDisplay free={balances.premiumFree} paid={balances.premiumPaid} />
          </div>
        )}
      </div>

      {/* 上部バー：押すと展開するメニュー（宿舎・雇用・工業・研究・クラフト・倉庫・クエスト） */}
      <details className="mt-6 rounded-lg border border-base-border bg-base-elevated overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-text-primary font-medium list-none flex items-center justify-between gap-2">
          <span>メニュー</span>
          <span className="text-sm text-text-muted font-normal">宿舎・雇用・工業・研究・クラフト・倉庫・クエスト</span>
        </summary>
        <div className="border-t border-base-border px-4 py-3 flex flex-wrap gap-2">
          {subMenuLinks.map(({ href, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex flex-col rounded-lg border border-base-border bg-base px-4 py-3 text-text-primary transition-colors hover:border-brass hover:bg-base-elevated min-w-[10rem]"
            >
              <span className="font-medium">{label}</span>
              <span className="text-sm text-text-muted mt-0.5">{sub}</span>
            </Link>
          ))}
        </div>
      </details>

      {/* 探索・作戦室をすぐ見えるように前面に */}
      <div className="mt-6 flex flex-col lg:flex-row gap-6 max-w-5xl">
        {/* 探索（メイン） */}
        <section className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">探索</h2>
          <p className="mt-2 text-sm text-text-muted">
            テーマ・エリア・パーティプリセット・持ち込み消耗品を選んで探索を開始します。戦闘が発生する場合は
            探索戦闘画面に遷移し、そこでログと現在HP/MPを確認できます。
          </p>

          {currentExpedition && (
          <div className="mt-4 rounded-lg border border-base-border bg-base-elevated p-4 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-text-muted">進行中の探索</h3>
              <ExplorationAbortClient />
              <Link
                href="/battle/exploration"
                className="text-sm text-brass hover:text-brass-hover"
              >
                探索を続ける →
              </Link>
            </div>
            <p className="mt-1 text-sm text-text-primary">
              {currentExpedition.themeName} / {currentExpedition.areaName}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {currentExpedition.state === "in_progress"
                ? "進行中"
                : currentExpedition.state === "ready_to_finish"
                ? "結果確定待ち"
                : currentExpedition.state}
              ・{currentExpedition.rounds} ラウンド
            </p>
          </div>
          )}

          {/* 探索開始：テーマ・エリア・プリセット・消耗品はすべてフォーム内の選択で完結 */}
          <div className="mt-6 max-w-md">
            <ExplorationStartClient
              themes={explorationThemes}
              partyPresets={partyPresets}
              consumableStacks={consumableStacks}
            />
          </div>
        </section>

        {/* 作戦室（常時見える） */}
        <div className="lg:w-64 flex-shrink-0 space-y-4">
          <Link
            href="/dashboard/tactics"
            className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base h-full min-h-[8rem]"
          >
            <span className="text-lg font-medium">作戦室</span>
            <span className="mt-1 text-sm text-text-muted">パーティプリセットと作戦スロットの設定</span>
          </Link>
          {showAdminContent && (
            <Link
              href="/dashboard/admin/content"
              className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-4 text-text-primary transition-colors hover:border-brass hover:bg-base-elevated/90 text-sm"
            >
              <span className="font-medium">コンテンツ管理</span>
              <span className="mt-0.5 text-xs text-text-muted">管理者用</span>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
