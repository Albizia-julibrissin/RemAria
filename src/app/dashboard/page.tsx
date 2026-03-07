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

export default async function DashboardPage() {
  const session = await getSession();
  const showAdminContent = await isTestUser1();
  let balances: { game: number; premiumFree: number; premiumPaid: number } | null = null;
  if (session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        gameCurrencyBalance: true,
        premiumCurrencyFreeBalance: true,
        premiumCurrencyPaidBalance: true,
      },
    });
    if (user) {
      balances = {
        game: user.gameCurrencyBalance,
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

  return (
    <main className="min-h-screen bg-base p-8">
      <h1 className="text-2xl font-bold text-text-primary">ダッシュボード</h1>
      <p className="mt-4 text-text-muted">ようこそ。ここはログイン後に表示される保護画面です。</p>

      {balances != null && (
        <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-4 max-w-md">
          <h2 className="text-sm font-medium text-text-muted mb-2">所持通貨</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-text-muted">ゲーム通貨</dt>
              <dd className="font-medium text-text-primary tabular-nums">{balances.game}</dd>
            </div>
            <div>
              <dt className="text-text-muted">課金通貨（無償）</dt>
              <dd className="font-medium text-text-primary tabular-nums">{balances.premiumFree}</dd>
            </div>
            <div>
              <dt className="text-text-muted">課金通貨（有償）</dt>
              <dd className="font-medium text-text-primary tabular-nums">{balances.premiumPaid}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl">
        <Link
          href="/dashboard/characters"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">宿舎</span>
          <span className="mt-1 text-sm text-text-muted">キャラクター一覧</span>
        </Link>
        <Link
          href="/dashboard/recruit"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">雇用斡旋所</span>
          <span className="mt-1 text-sm text-text-muted">仲間を雇用する</span>
        </Link>
        <Link
          href="/dashboard/facilities"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">工業エリア</span>
          <span className="mt-1 text-sm text-text-muted">初期エリア・設備配置（spec/035）</span>
        </Link>
        <Link
          href="/dashboard/research"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">研究</span>
          <span className="mt-1 text-sm text-text-muted">研究グループで設備・レシピを解放（docs/054）</span>
        </Link>
        <Link
          href="/dashboard/craft"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">アイテムクラフト</span>
          <span className="mt-1 text-sm text-text-muted">装備・消耗品を製作（spec/046）</span>
        </Link>
        <Link
          href="/dashboard/bag"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">バッグ</span>
          <span className="mt-1 text-sm text-text-muted">所持アイテムの確認（種別タブ）spec/045</span>
        </Link>
        <Link
          href="/dashboard/warehouse"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">倉庫</span>
          <span className="mt-1 text-sm text-text-muted">所持数一覧（簡易）</span>
        </Link>
        <Link
          href="/dashboard/quests"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">クエスト</span>
          <span className="mt-1 text-sm text-text-muted">ストーリー・研究クエストの進捗（docs/054）</span>
        </Link>
        <Link
          href="/dashboard/tactics"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">作戦室</span>
          <span className="mt-1 text-sm text-text-muted">パーティプリセットと作戦スロットの設定</span>
        </Link>
        <Link
          href="/battle/practice"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">仮戦闘</span>
          <span className="mt-1 text-sm text-text-muted">テスト戦闘を実行</span>
        </Link>
        {showAdminContent && (
          <Link
            href="/dashboard/admin/content"
            className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          >
            <span className="text-lg font-medium">コンテンツ管理</span>
            <span className="mt-1 text-sm text-text-muted">実装済み一覧・ドロップ・アイテム・レシピ等（管理者用）</span>
          </Link>
        )}
      </div>

      {/* 探索（MVP プレビュー用） */}
      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl font-semibold text-text-primary">探索（MVP プレビュー）</h2>
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
              状態:{" "}
              {currentExpedition.state === "in_progress"
                ? "進行中"
                : currentExpedition.state === "ready_to_finish"
                ? "結果確定待ち"
                : currentExpedition.state}
              （raw: {currentExpedition.state}）
              ・経過ラウンド数: {currentExpedition.rounds}
            </p>
            <p className="mt-1 text-[10px] text-text-muted/80">
              Expedition ID: {currentExpedition.expeditionId}
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-base-border bg-base-elevated p-4">
            <h3 className="text-sm font-medium text-text-muted">テーマとエリア</h3>
            {explorationThemes.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">探索テーマがまだ登録されていません。</p>
            ) : (
              <div className="mt-2 space-y-3">
                {explorationThemes.map((theme) => (
                  <div key={theme.themeId}>
                    <p className="text-sm font-semibold text-text-primary">{theme.name}</p>
                    {theme.description && (
                      <p className="text-xs text-text-muted mt-0.5">{theme.description}</p>
                    )}
                    <ul className="mt-1 space-y-1 text-sm">
                      {theme.areas.map((area) => (
                        <li key={area.areaId} className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{area.name}</span>
                            {area.description && (
                              <span className="ml-1 text-xs text-text-muted">
                                — {area.description}
                              </span>
                            )}
                          </div>
                          <span className="ml-2 text-xs text-text-muted">
                            推奨Lv {area.recommendedLevel}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-base-border bg-base-elevated p-4">
              <h3 className="text-sm font-medium text-text-muted">パーティプリセット</h3>
              {partyPresets.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">
                  作戦室でパーティプリセットを作成すると、ここに表示されます。
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {partyPresets.map((p) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span className="font-medium">{p.name ?? "名称未設定プリセット"}</span>
                      <span className="ml-2 text-xs text-text-muted">
                        {[
                          p.slot1?.displayName,
                          p.slot2?.displayName,
                          p.slot3?.displayName,
                        ]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-base-border bg-base-elevated p-4">
              <h3 className="text-sm font-medium text-text-muted">探索用消耗品（候補）</h3>
              {consumableStacks.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">
                  category=consumable のアイテムを所持していません。クラフト実装後にここに表示されます。
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {consumableStacks.map((s) => (
                    <li key={s.itemId} className="flex items-center justify-between">
                      <span>
                        {s.name} <span className="text-xs text-text-muted">({s.code})</span>
                      </span>
                      <span className="ml-2 text-xs text-text-muted">x{s.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ExplorationStartClient
              themes={explorationThemes}
              partyPresets={partyPresets}
              consumableStacks={consumableStacks}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
