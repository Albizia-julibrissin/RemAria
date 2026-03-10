// spec/039: 作戦室 - パーティプリセット選択と作戦スロット編集

import Link from "next/link";
import {
  getPartyPresetListForTacticsPage,
  getPartyPresetWithCharacters,
  getTacticsForPreset,
  getCharactersForPartySlots,
  getBattleSkillsForCharacters,
  getTacticsSkillCatalogForCharacters,
} from "@/server/actions/tactics";
import { TacticsEditorClient } from "./tactics-editor-client";
import { CreatePresetForm } from "./create-preset-form";

export default async function TacticsRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ presetId?: string }>;
}) {
  const { presetId } = await searchParams;

  // プリセット一覧表示時のみ軽量APIで取得（id・name・3スロットの表示名＋上限）
  if (!presetId) {
    const result = await getPartyPresetListForTacticsPage();
    if ("error" in result) {
      return (
        <main className="min-h-screen bg-base p-8">
          <h1 className="text-2xl font-bold text-text-primary">作戦室</h1>
          <p className="mt-2 text-text-muted">ログインしてください。</p>
          <p className="mt-8">
            <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">← ダッシュボードへ</Link>
          </p>
        </main>
      );
    }
    const { presets, presetLimit } = result;
    const canCreateMore = presets.length < presetLimit;

    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">作戦室</h1>
        <p className="mt-2 text-text-muted">パーティプリセットを選び、編成と作戦スロットを設定します。</p>

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

        <p className="mt-8">
          <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
            ← ダッシュボードへ
          </Link>
        </p>
      </main>
    );
  }

  const preset = await getPartyPresetWithCharacters(presetId);
  if (!preset) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">作戦室</h1>
        <p className="mt-2 text-error">指定したプリセットが見つかりません。</p>
        <p className="mt-4">
          <Link href="/dashboard/tactics" className="text-sm text-brass hover:text-brass-hover">
            ← プリセット一覧へ
          </Link>
        </p>
      </main>
    );
  }

  const characterIds = [preset.slot1!.characterId, preset.slot2?.characterId, preset.slot3?.characterId].filter(Boolean) as string[];

  // 作戦（spec/063: プリセット別）・仲間/メカ一覧・スキル一覧を並列取得
  const [tacticsResult, { companions, mechs }, battleSkillsByCharacter, catalogResult] = await Promise.all([
    getTacticsForPreset(presetId),
    getCharactersForPartySlots(),
    getBattleSkillsForCharacters(characterIds),
    getTacticsSkillCatalogForCharacters(characterIds),
  ]);

  const initialTactics = "error" in tacticsResult ? [] : tacticsResult.tactics;
  const skillCatalog = "skills" in catalogResult ? catalogResult.skills : [];

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/dashboard/tactics" className="text-sm text-brass hover:text-brass-hover">
          ← プリセット一覧
        </Link>
        <span className="text-text-muted">|</span>
        <h1 className="text-2xl font-bold text-text-primary">作戦室：{preset.name ?? "編成編集"}</h1>
      </div>

      <TacticsEditorClient
        preset={preset}
        companions={companions}
        mechs={mechs}
        initialTactics={initialTactics}
        battleSkillsByCharacter={battleSkillsByCharacter}
        skillCatalog={skillCatalog}
      />

      <p className="mt-8">
        <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
          ← ダッシュボードへ
        </Link>
      </p>
    </main>
  );
}
