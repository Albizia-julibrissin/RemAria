// spec/039: 作戦室 - パーティプリセット選択と作戦スロット編集
// spec/054: 画面訪問で screen_visit 任務の進捗を記録

import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { addQuestProgressScreenVisit } from "@/server/actions/quest";
import {
  getPartyPresetListForTacticsPage,
  getPartyPresetWithCharacters,
  getTacticsForPreset,
  getCharactersForPartySlots,
  getBattleSkillsForCharacters,
  getTacticsSkillCatalogForCharacters,
  getCharacterMaxMpForTactics,
} from "@/server/actions/tactics";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { TacticsEditorClient } from "./tactics-editor-client";
import { CreatePresetForm } from "./create-preset-form";

const TACTICS_PATH = "/dashboard/tactics";

export default async function TacticsRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ presetId?: string }>;
}) {
  const { presetId } = await searchParams;

  const session = await getSession();
  if (session?.userId) {
    await addQuestProgressScreenVisit(session.userId, TACTICS_PATH);
  }

  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  // プリセット一覧表示時のみ軽量APIで取得（id・name・3スロットの表示名＋上限）
  if (!presetId) {
    const result = await getPartyPresetListForTacticsPage();
    if ("error" in result) {
      return (
        <main className="min-h-screen bg-base p-8">
          <MenuPageHeaderClient
            title="作戦室"
            description="パーティプリセットと作戦スロットの設定"
            currentPath="/dashboard/tactics"
          />
          <p className="text-text-muted">ログインしてください。</p>
          <footer className="mt-8 border-t border-base-border pt-4">
            <Link href="/dashboard" className={footerLinkClass}>
              ← 開拓拠点に戻る
            </Link>
          </footer>
        </main>
      );
    }
    const { presets, presetLimit } = result;

    return (
      <main className="min-h-screen bg-base p-8">
        <MenuPageHeaderClient
          title="作戦室"
          description="パーティプリセットと作戦スロットの設定。プリセットを選び、編成と作戦スロットを設定します。"
          currentPath="/dashboard/tactics"
        />
        {presets.length === 0 ? (
          <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
            <p className="text-text-muted">プリセットがありません。新規作成してください。</p>
            <CreatePresetForm presetCount={0} presetLimit={presetLimit} />
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-2">
              {presets.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/tactics?presetId=${p.id}`}
                    className="block rounded-lg border border-base-border bg-base-elevated p-4 text-text-primary hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                  >
                    <span className="font-medium">{p.name ?? `プリセット（${p.id.slice(0, 8)}）`}</span>
                    <span className="ml-2 text-sm text-text-muted">
                      {p.slot1DisplayName ?? "—"}
                      {p.slot2DisplayName != null ? ` / ${p.slot2DisplayName}` : " / —"}
                      {p.slot3DisplayName != null ? ` / ${p.slot3DisplayName}` : " / —"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-4">
              <p className="text-sm text-text-muted">
                プリセット {presets.length}/{presetLimit} 件
              </p>
              <CreatePresetForm presetCount={presets.length} presetLimit={presetLimit} />
            </div>
          </>
        )}
        <footer className="mt-8 border-t border-base-border pt-4">
          <Link href="/dashboard" className={footerLinkClass}>
            ← 開拓拠点に戻る
          </Link>
        </footer>
      </main>
    );
  }

  const preset = await getPartyPresetWithCharacters(presetId);
  if (!preset) {
    return (
      <main className="min-h-screen bg-base p-8">
        <MenuPageHeaderClient
          title="作戦室"
          description="パーティプリセットと作戦スロットの設定"
          currentPath="/dashboard/tactics"
        />
        <p className="text-error">指定したプリセットが見つかりません。</p>
        <p className="mt-4">
          <Link href="/dashboard/tactics" className="text-sm text-brass hover:text-brass-hover">
            ← プリセット一覧へ
          </Link>
        </p>
        <footer className="mt-8 border-t border-base-border pt-4">
          <Link href="/dashboard" className={footerLinkClass}>
            ← 開拓拠点に戻る
          </Link>
        </footer>
      </main>
    );
  }

  const characterIds = [preset.slot1!.characterId, preset.slot2?.characterId, preset.slot3?.characterId].filter(Boolean) as string[];

  // 作戦（spec/063: プリセット別）・仲間/メカ一覧・スキル一覧・キャラ別最大MPを並列取得
  const [tacticsResult, { companions, mechs }, battleSkillsByCharacter, catalogResult, maxMpByCharacter] =
    await Promise.all([
      getTacticsForPreset(presetId),
      getCharactersForPartySlots(),
      getBattleSkillsForCharacters(characterIds),
      getTacticsSkillCatalogForCharacters(characterIds),
      getCharacterMaxMpForTactics(characterIds),
    ]);

  const initialTactics = "error" in tacticsResult ? [] : tacticsResult.tactics;
  const skillCatalog = "skills" in catalogResult ? catalogResult.skills : [];

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="作戦室"
        description="パーティプリセットと作戦スロットの設定"
        currentPath="/dashboard/tactics"
      />

      <TacticsEditorClient
        preset={preset}
        companions={companions}
        mechs={mechs}
        initialTactics={initialTactics}
        battleSkillsByCharacter={battleSkillsByCharacter}
        skillCatalog={skillCatalog}
        maxMpByCharacter={maxMpByCharacter}
      />
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
