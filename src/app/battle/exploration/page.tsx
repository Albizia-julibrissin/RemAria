"use server";

// 探索戦闘画面（MVP 版）: 進行中 Expedition のパーティで 1 回だけ戦闘を実行し、仮戦闘と同じ UI でログを表示する。

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getCurrentExpeditionSummary,
  getLastExplorationBattle,
  runExplorationBattle,
} from "@/server/actions/exploration";
import { BattleFullView } from "../test/battle-full-view";
import { ExplorationFinishClient } from "../exploration-finish-client";

export default async function ExplorationBattlePage() {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const current = await getCurrentExpeditionSummary();

  if (!current) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
        <p className="mt-2 text-text-muted">
          進行中の探索がありません。ダッシュボードから新しい探索を開始してください。
        </p>
        <p className="mt-4">
          <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
            ← ダッシュボードへ
          </Link>
        </p>
      </main>
    );
  }

  // 結果確定待ち：報酬受け取り画面を表示
  if (current.state === "ready_to_finish") {
    const isWiped = current.remainingNormalBattles > 0;
    const lastBattle = await getLastExplorationBattle();
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索結果</h1>
        <p className="mt-2 text-text-muted">
          {current.themeName} / {current.areaName} の探索が終了しました。
        </p>
        {lastBattle && (
          <div className="mt-4">
            <BattleFullView data={lastBattle} />
          </div>
        )}
        <ExplorationFinishClient
          themeName={current.themeName}
          areaName={current.areaName}
          isWiped={isWiped}
        />
        <p className="mt-6 text-xs text-text-muted">
          ※ この画面ではまだアイテムの具体的な中身は表示していません。将来的に、由来ごとの枠に対応するドロップ内容をここに表示します。
        </p>
      </main>
    );
  }

  const battleResult = await runExplorationBattle();

  if (!battleResult.success) {
    const isNoExpedition = battleResult.error === "NO_EXPEDITION";
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
        {isNoExpedition ? (
          <p className="mt-2 text-text-muted">
            進行中の探索がありません。ダッシュボードから新しい探索を開始してください。
          </p>
        ) : (
          <p className="mt-2 text-text-muted">
            戦闘の実行中にエラーが発生しました: {battleResult.message}
          </p>
        )}
        <p className="mt-4">
          <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
            ← ダッシュボードへ
          </Link>
        </p>
      </main>
    );
  }

  const remainingBefore = battleResult.remainingNormalBattlesBefore;
  const remainingAfter = remainingBefore > 0 ? remainingBefore - 1 : 0;
  const isPlayerWin = battleResult.result.result === "player";
  const isNowReadyToFinish = !isPlayerWin || remainingAfter <= 0;

  return (
    <main className="min-h-screen bg-base p-8">
      <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
      <p className="mt-2 text-text-muted">
        {battleResult.themeName} / {battleResult.areaName} での戦闘結果です。（現時点ではスライム固定の仮戦闘）
      </p>

      <div className="mt-4">
        <BattleFullView data={battleResult.result} />
      </div>

      {/* 戦闘後の現在HP/MPサマリと次アクション */}
      <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-4 space-y-2">
        {!isNowReadyToFinish && (
          <>
            <h2 className="text-sm font-medium text-text-muted">戦闘後のパーティ状況（仮）</h2>
            <p className="text-xs text-text-muted">
              現在は仮戦闘の結果をそのまま表示しています。探索中の HP/MP 持ち回りや次イベント抽選との連携は後続で実装します。
            </p>
            <ul className="mt-2 space-y-1 text-sm text-text-primary">
              {(battleResult.result.summary.partyDisplayNames ?? ["味方"]).map((name, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>{name}</span>
                  <span className="text-xs text-text-muted tabular-nums">
                    HP{" "}
                    {battleResult.result.summary.partyHpFinals?.[i] ??
                      battleResult.result.summary.playerHpFinal}
                    /
                    {battleResult.result.summary.partyMaxHp?.[i] ??
                      battleResult.result.summary.playerMaxHp ??
                      1}{" "}
                    ・ MP{" "}
                    {battleResult.result.summary.partyMpFinals?.[i] ??
                      battleResult.result.summary.playerMpFinal}
                    /
                    {battleResult.result.summary.partyMaxMp?.[i] ??
                      battleResult.result.summary.playerMaxMp ??
                      1}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-4">
              <span className="text-xs text-text-muted">残り戦闘数: {remainingAfter}</span>
              <Link
                href="/battle/exploration"
                className="text-sm text-brass hover:text-brass-hover"
              >
                次の戦闘へ →
              </Link>
            </div>
          </>
        )}

        {isNowReadyToFinish && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              {isPlayerWin
                ? "このエリアでの戦闘はすべて終了しました。下のボタンから今回の報酬を確定してください。"
                : "敗北しましたが、ここまでの結果に応じた報酬を確定できます。"}
            </p>
            <ExplorationFinishClient
              themeName={battleResult.themeName}
              areaName={battleResult.areaName}
              isWiped={!isPlayerWin}
            />
          </div>
        )}
      </div>
    </main>
  );
}

