// 探索戦闘画面（MVP 版）: 進行中 Expedition の「次ステップ」を抽選し、戦闘 or 技能イベントを表示する。
// 他ページから戻ってきたときは ?step=next が無い限り「復帰」画面（サマリ＋次へ）のみ表示する。

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  getCurrentExpeditionSummary,
  getExplorationRoundConsumablesAndParty,
  getExplorationResumeSummary,
  getNextExplorationStep,
  runExplorationBattle,
} from "@/server/actions/exploration";
import { BattleFullView } from "../practice/battle-full-view";
import { ExplorationFinishClient } from "../exploration-finish-client";
import { ExplorationSkillEventBlock } from "./exploration-skill-event-block";
import { ExplorationAfterBattleStatusClient } from "./exploration-after-battle-status-client";
import { ExplorationNextButton } from "./exploration-next-button";

type PageProps = { searchParams?: Promise<{ step?: string }> };

export default async function ExplorationBattlePage(props: PageProps) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const searchParams = (await (props.searchParams ?? Promise.resolve({}))) as { step?: string };
  const doNextStep = searchParams.step === "next";
  const doStrongEnemyBattle = searchParams.step === "strong_enemy_battle";
  const doAreaLordBattle = searchParams.step === "area_lord_battle";

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

  // 結果確定待ち：報酬受け取り画面を表示（戦闘ログは永続化しないため、ここでは表示しない。直後の結果は runExplorationBattle の戻り値で表示）
  if (current.state === "ready_to_finish") {
    const isWiped = current.remainingNormalBattles > 0;
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索結果</h1>
        <p className="mt-2 text-text-muted">
          {current.themeName} / {current.areaName} の探索が終了しました。報酬を受け取ってください。
        </p>
        <ExplorationFinishClient
          themeName={current.themeName}
          areaName={current.areaName}
          isWiped={isWiped}
        />
      </main>
    );
  }

  // 進行中かつ step=next / strong_enemy_battle / area_lord_battle が無い: 復帰画面
  if (
    current.state === "in_progress" &&
    !doNextStep &&
    !doStrongEnemyBattle &&
    !doAreaLordBattle
  ) {
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
          <ExplorationNextButton href="/battle/exploration?step=next" />
          <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover self-center">
            ← ダッシュボードへ
          </Link>
        </p>
      </main>
    );
  }

  // 進行中かつ 強敵/領域主へ挑む: 戦闘を1回実行して結果表示
  if (current.state === "in_progress" && (doStrongEnemyBattle || doAreaLordBattle)) {
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
        <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
        <p className="mt-2 text-text-muted">
          {battleResult.themeName} / {battleResult.areaName} での戦闘結果です。
        </p>
        <div className="mt-4">
          <BattleFullView data={battleResult.result} />
        </div>
        <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-4 space-y-2">
          {!isNowReadyToFinish && !battleResult.areaLordAppeared && (
            <ExplorationAfterBattleStatusClient
              partyDisplayNames={partyNames}
              partyHp={partyHpArray}
              partyMp={partyMpArray}
              partyMaxHp={partyMaxHpArray}
              partyMaxMp={partyMaxMpArray}
              remainingAfter={
                battleResult.remainingNormalBattlesBefore > 0
                  ? battleResult.remainingNormalBattlesBefore - 1
                  : 0
              }
              consumables={consumables}
              partyMembers={partyMembers}
              sectionTitle="現在のパーティ状況"
            />
          )}
          {battleResult.areaLordAppeared && (
            <div className="space-y-3">
              <p className="text-text-primary">強敵に勝利！ 領域主が現れた。</p>
              <p>
                <Link
                  href="/battle/exploration?step=area_lord_battle"
                  className="inline-flex items-center justify-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-brass-inverse hover:bg-brass-hover"
                >
                  領域主へ挑む
                </Link>
              </p>
            </div>
          )}
          {isNowReadyToFinish && (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">
                {battleResult.result.result === "player"
                  ? "このエリアでの戦闘はすべて終了しました。下のボタンから今回の報酬を確定してください。"
                  : "敗北しましたが、ここまでの結果に応じた報酬を確定できます。"}
              </p>
              <ExplorationFinishClient
                themeName={battleResult.themeName}
                areaName={battleResult.areaName}
                isWiped={battleResult.result.result !== "player"}
              />
            </div>
          )}
        </div>
      </main>
    );
  }

  // 進行中かつ step=next: 次ステップを抽選（戦闘 or 技能イベント）
  const stepResult = await getNextExplorationStep();
  if (!stepResult.success) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
        <p className="mt-2 text-text-muted">{stepResult.message}</p>
        <p className="mt-4">
          <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
            ← ダッシュボードへ
          </Link>
        </p>
      </main>
    );
  }

  if (stepResult.step.kind === "strong_enemy_challenge") {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
        <p className="mt-2 text-text-muted">
          {stepResult.step.themeName} / {stepResult.step.areaName}
        </p>
        <p className="mt-4 text-text-primary">
          規定の戦闘をクリアしました。強敵が待ち構えています。
        </p>
        <p className="mt-6">
          <Link
            href="/battle/exploration?step=strong_enemy_battle"
            className="inline-flex items-center justify-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-brass-inverse hover:bg-brass-hover"
          >
            強敵へ挑む
          </Link>
        </p>
        <p className="mt-4">
          <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
            ← ダッシュボードへ
          </Link>
        </p>
      </main>
    );
  }

  if (stepResult.step.kind === "area_lord_challenge") {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
        <p className="mt-2 text-text-muted">
          {stepResult.step.themeName} / {stepResult.step.areaName}
        </p>
        <p className="mt-4 text-text-primary">領域主が現れた。</p>
        <p className="mt-6">
          <Link
            href="/battle/exploration?step=area_lord_battle"
            className="inline-flex items-center justify-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-brass-inverse hover:bg-brass-hover"
          >
            領域主へ挑む
          </Link>
        </p>
        <p className="mt-4">
          <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
            ← ダッシュボードへ
          </Link>
        </p>
      </main>
    );
  }

  if (stepResult.step.kind === "skill_check") {
    const roundData = await getExplorationRoundConsumablesAndParty();
    const consumables = roundData.success ? roundData.consumables : [];
    const partyMembers = roundData.success ? roundData.partyMembers : [];
    const totalHp = stepResult.step.partyHp.reduce((sum, v) => sum + v, 0);
    const totalMp = stepResult.step.partyMp.reduce((sum, v) => sum + v, 0);
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
        <p className="mt-2 text-text-muted">
          {current.themeName} / {current.areaName} — 技能イベント
        </p>
        <div className="mt-4">
          <ExplorationSkillEventBlock
            eventMessage={stepResult.step.eventMessage}
            partyDisplayNames={stepResult.step.partyDisplayNames}
            partyIconFilenames={stepResult.step.partyIconFilenames}
            partyPositions={stepResult.step.partyPositions}
            partyHp={stepResult.step.partyHp}
            partyMp={stepResult.step.partyMp}
            partyMaxHp={stepResult.step.partyMaxHp}
            partyMaxMp={stepResult.step.partyMaxMp}
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

  // step.kind === "battle": 戦闘を1回実行
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
      <h1 className="text-2xl font-bold text-text-primary">探索戦闘</h1>
      <p className="mt-2 text-text-muted">
        {battleResult.themeName} / {battleResult.areaName} での戦闘結果です。
      </p>

      <div className="mt-4">
        <BattleFullView data={battleResult.result} />
      </div>

      {/* 戦闘後の現在HP/MPサマリと次アクション */}
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
                  <Link
                    href="/battle/exploration?step=strong_enemy_battle"
                    className="inline-flex items-center justify-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-brass-inverse hover:bg-brass-hover"
                  >
                    強敵へ挑む
                  </Link>
                </p>
              </div>
            ) : (
              <p className="mt-4">
                <ExplorationNextButton href="/battle/exploration?step=next" />
              </p>
            )}
          </>
        )}

        {!isNowReadyToFinish && battleResult.areaLordAppeared && (
          <div className="space-y-3">
            <p className="text-text-primary">強敵に勝利！ 領域主が現れた。</p>
            <p>
              <Link
                href="/battle/exploration?step=area_lord_battle"
                className="inline-flex items-center justify-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-brass-inverse hover:bg-brass-hover"
              >
                領域主へ挑む
              </Link>
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

