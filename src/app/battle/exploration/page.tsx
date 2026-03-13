// 探索戦闘画面（MVP 版）: 進行中 Expedition の「次ステップ」を抽選し、戦闘 or 技能イベントを表示する。
// 他ページから戻ってきたときは ?step=next が無い限り「復帰」画面（サマリ＋次へ）のみ表示する。

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getCurrentExpeditionSummary,
  getExplorationLastBattleDisplay,
  getExplorationPartyStatsVerification,
  getExplorationPendingSkillDisplay,
  getExplorationResumeSummary,
  getExplorationRoundConsumablesAndParty,
} from "@/server/actions/exploration";
import { BattleFullView } from "../practice/battle-full-view";
import { ExplorationFinishClient } from "../exploration-finish-client";
import { ExplorationSkillEventBlock } from "./exploration-skill-event-block";
import { ExplorationAfterBattleStatusClient } from "./exploration-after-battle-status-client";
import { ExplorationNextButton } from "./exploration-next-button";
import { ExplorationVerificationStatsTable } from "./exploration-verification-stats-table";

type PageProps = { searchParams?: Promise<{ step?: string }> };

export default async function ExplorationBattlePage(props: PageProps) {
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

  if (current.state === "ready_to_finish") {
    const isWiped = current.remainingNormalBattles > 0;
    const lastBattle = await getExplorationLastBattleDisplay();
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索結果</h1>
        <p className="mt-2 text-text-muted">
          {current.themeName} / {current.areaName} の探索が終了しました。報酬を受け取ってください。
        </p>
        {lastBattle && lastBattle.success && (
          <div className="mt-4">
            <BattleFullView data={lastBattle.result} hideSummaryTop />
          </div>
        )}
        <ExplorationFinishClient
          themeName={current.themeName}
          areaName={current.areaName}
          isWiped={isWiped}
        />
      </main>
    );
  }

  // 進行中（059 Phase 2b）: lastBattle → pendingSkill → resume の順で表示を決定
  if (current.state === "in_progress") {
    const showVerificationLog = process.env.NEXT_PUBLIC_SHOW_VERIFICATION_LOG === "true";
    const verificationStats = showVerificationLog ? await getExplorationPartyStatsVerification() : null;

    const lastBattle = await getExplorationLastBattleDisplay();
    if (lastBattle && lastBattle.success) {
      const battleResult = lastBattle;
      const remainingBefore = battleResult.remainingNormalBattlesBefore;
      const remainingAfter = remainingBefore > 0 ? remainingBefore - 1 : 0;
      const isPlayerWin = battleResult.result.result === "player";
      const isNowReadyToFinish = battleResult.stateAfter === "ready_to_finish";
      const roundData = await getExplorationRoundConsumablesAndParty();
      const consumables = roundData.success ? roundData.consumables : [];
      const partyMembers = roundData.success ? roundData.partyMembers : [];
      const partyNames = battleResult.result.summary.partyDisplayNames ?? ["味方"];
      const partyHpArray = partyNames.map(
        (_name, i) =>
          battleResult.result.summary.partyHpFinals?.[i] ??
          battleResult.result.summary.playerHpFinal
      );
      const partyMpArray = partyNames.map(
        (_name, i) =>
          battleResult.result.summary.partyMpFinals?.[i] ??
          battleResult.result.summary.playerMpFinal
      );
      const partyMaxHpArray = partyNames.map(
        (_name, i) =>
          battleResult.result.summary.partyMaxHp?.[i] ??
          battleResult.result.summary.playerMaxHp ??
          1
      );
      const partyMaxMpArray = partyNames.map(
        (_name, i) =>
          battleResult.result.summary.partyMaxMp?.[i] ??
          battleResult.result.summary.playerMaxMp ??
          1
      );
      return (
        <main className="min-h-screen bg-base p-8">
          <h1 className="text-2xl font-bold text-text-primary">
            開拓者たちは敵性存在と接触した…！
          </h1>
          {verificationStats && verificationStats.length > 0 && (
            <ExplorationVerificationStatsTable stats={verificationStats} />
          )}
          <div className="mt-4">
            <BattleFullView data={battleResult.result} hideSummaryTop />
          </div>
          <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-4 space-y-2">
            {!isNowReadyToFinish && !battleResult.areaLordAppeared && (
              <>
                <ExplorationAfterBattleStatusClient
                  partyDisplayNames={partyNames}
                  partyHp={partyHpArray}
                  partyMp={partyMpArray}
                  partyMaxHp={partyMaxHpArray}
                  partyMaxMp={partyMaxMpArray}
                  remainingAfter={remainingAfter}
                  consumables={consumables}
                  partyMembers={partyMembers}
                />
                {remainingAfter === 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-text-primary">
                      規定の戦闘をクリアしました。強敵が待ち構えています。
                    </p>
                    <p>
                      <ExplorationNextButton useAdvanceAction>強敵へ挑む</ExplorationNextButton>
                    </p>
                  </div>
                ) : (
                  <p className="mt-4">
                    <ExplorationNextButton useAdvanceAction />
                  </p>
                )}
              </>
            )}
            {!isNowReadyToFinish && battleResult.areaLordAppeared && (
              <div className="space-y-3">
                <p className="text-text-primary">強敵に勝利！ 領域主が現れた。</p>
                <p>
                  <ExplorationNextButton useAdvanceAction>領域主へ挑む</ExplorationNextButton>
                </p>
              </div>
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

    const pendingSkill = await getExplorationPendingSkillDisplay();
    if (pendingSkill) {
      const roundData = await getExplorationRoundConsumablesAndParty();
      const consumables = roundData.success ? roundData.consumables : [];
      const partyMembers = roundData.success ? roundData.partyMembers : [];
      const totalHp = pendingSkill.partyHp.reduce((sum, v) => sum + v, 0);
      const totalMp = pendingSkill.partyMp.reduce((sum, v) => sum + v, 0);
      return (
        <main className="min-h-screen bg-base p-8">
          <h1 className="text-2xl font-bold text-text-primary">
            開拓者たちは困難に遭遇した…！
          </h1>
          {verificationStats && verificationStats.length > 0 && (
            <ExplorationVerificationStatsTable stats={verificationStats} />
          )}
          <div className="mt-4">
            <ExplorationSkillEventBlock
              key={pendingSkill.eventKey}
              eventMessage={pendingSkill.eventMessage}
              partyDisplayNames={pendingSkill.partyDisplayNames}
              partyIconFilenames={pendingSkill.partyIconFilenames}
              partyPositions={pendingSkill.partyPositions}
              partyHp={pendingSkill.partyHp}
              partyMp={pendingSkill.partyMp}
              partyMaxHp={pendingSkill.partyMaxHp}
              partyMaxMp={pendingSkill.partyMaxMp}
              consumables={consumables}
              partyMembers={partyMembers}
              totalHp={totalHp}
              totalMp={totalMp}
            />
          </div>
          <p className="mt-6">
            <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
              ← ダッシュボードへ
            </Link>
          </p>
        </main>
      );
    }

    const resume = await getExplorationResumeSummary();
    if (!resume.success) {
      return (
        <main className="min-h-screen bg-base p-8">
          <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
          <p className="mt-2 text-text-muted">{resume.message}</p>
          <p className="mt-4">
            <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
              ← ダッシュボードへ
            </Link>
          </p>
        </main>
      );
    }
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
        <p className="mt-2 text-text-muted">
          {resume.themeName} / {resume.areaName} — 進行中の探索に復帰しました
        </p>
        {verificationStats && verificationStats.length > 0 && (
          <ExplorationVerificationStatsTable stats={verificationStats} />
        )}
        <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-4 space-y-2">
          <ExplorationAfterBattleStatusClient
            partyDisplayNames={resume.partyDisplayNames}
            partyHp={resume.partyHp}
            partyMp={resume.partyMp}
            partyMaxHp={resume.partyMaxHp}
            partyMaxMp={resume.partyMaxMp}
            remainingAfter={resume.remainingNormalBattles}
            consumables={resume.consumables}
            partyMembers={resume.partyMembers}
            sectionTitle="現在のパーティ状況"
          />
        </div>
        <p className="mt-6 flex gap-4">
          <ExplorationNextButton useAdvanceAction />
          <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover self-center">
            ← ダッシュボードへ
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
      <p className="mt-2 text-text-muted">進行中の探索がありません。</p>
      <p className="mt-4">
        <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
          ← ダッシュボードへ
        </Link>
      </p>
    </main>
  );
}

