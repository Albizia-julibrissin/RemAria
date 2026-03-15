// spec/025, 030, 046: キャラ詳細（基礎ステータス・経験値・スキル・装備着脱・仲間は解雇）

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getProtagonist } from "@/server/actions/protagonist";
import { characterRepository } from "@/server/repositories/character-repository";
import {
  getCharacterEquipment,
  getEquipmentInstancesWithEquipped,
} from "@/server/actions/craft";
import {
  getMechaEquipment,
  getMechaPartInstancesWithEquipped,
} from "@/server/actions/mecha-equipment";
import { getCharacterRelics, getRelicInstances } from "@/server/actions/relic";
import { getCharacterBattleStats } from "@/server/lib/character-battle-stats";
import { getRequiredExpForLevel } from "@/lib/level";
import { getReconstitutionState } from "@/server/actions/reconstitution";
import { DismissCompanionButton } from "./dismiss-companion-button";
import { CharacterEquipmentSection } from "./character-equipment-section";
import { MechaEquipmentSection } from "./mecha-equipment-section";
import { CharacterRelicSection } from "./character-relic-section";
import { CharacterSkillTabs } from "./character-skill-tabs";
import { CharacterStatSection } from "./character-stat-section";
import { CharacterIconChange } from "./character-icon-change";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";
import { MenuPageHeaderClient } from "../../menu-page-header-client";

const BASE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK", "CAP"] as const;
const BASE_STAT_KEYS_7 = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

/** 遺物スロットから基礎ステへの加算（statBonus1/2 の % を床で適用）を集計 */
function computeRelicBonusFromSlots(
  relicSlots: { slot: number; relicInstance: { statBonus1: { stat: string; percent: number } | null; statBonus2: { stat: string; percent: number } | null } | null }[],
  baseStats: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = { STR: 0, INT: 0, VIT: 0, WIS: 0, DEX: 0, AGI: 0, LUK: 0 };
  for (const row of relicSlots) {
    const r = row.relicInstance;
    if (!r) continue;
    for (const b of [r.statBonus1, r.statBonus2]) {
      if (!b || !(b.stat in out)) continue;
      const base = baseStats[b.stat];
      if (typeof base === "number") out[b.stat] += Math.floor((base * b.percent) / 100);
    }
  }
  return out;
}

/** メカ装着スロットから基礎ステ加算を集計 */
function computeMechaEquipmentBonus(
  slots: { stats: Record<string, number> | null }[]
): Record<string, number> {
  const out: Record<string, number> = { STR: 0, INT: 0, VIT: 0, WIS: 0, DEX: 0, AGI: 0, LUK: 0 };
  for (const row of slots) {
    const s = row.stats;
    if (!s) continue;
    for (const key of BASE_STAT_KEYS_7) {
      const v = s[key];
      if (typeof v === "number") out[key] += v;
    }
  }
  return out;
}

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const protagonist = await getProtagonist();
  if (!protagonist) redirect("/character/create");

  const { id } = await params;
  const character = await characterRepository.getCharacterWithSkillsForUser(id, session.userId);
  if (!character) notFound();

  const characterSkillsWithLevel =
    character.characterSkills?.map((cs) => ({ skill: cs.skill, level: cs.level })).filter((x) => x.skill) ?? [];
  const battleSkills = characterSkillsWithLevel
    .filter((x) => x.skill.category?.startsWith("battle_"))
    .map((x) => ({ ...x.skill, level: x.level }));
  const industrialSkills = characterSkillsWithLevel
    .filter((x) => x.skill.category === "industrial")
    .map((x) => ({ ...x.skill, level: x.level }));

  const canEquip = character.category === "protagonist" || character.category === "companion";
  const isMech = character.category === "mech";
  const [characterEquipment, allEquipment, mechaEquipment, allMechaParts, characterRelics, allRelics, battleStats] =
    await Promise.all([
      canEquip ? getCharacterEquipment(character.id) : null,
      canEquip ? getEquipmentInstancesWithEquipped() : null,
      isMech ? getMechaEquipment(character.id) : null,
      isMech ? getMechaPartInstancesWithEquipped() : null,
      getCharacterRelics(character.id),
      getRelicInstances(),
      getCharacterBattleStats(character.id, session.userId),
    ]);
  const relicSlots = characterRelics.success ? characterRelics.slots : [];
  const allRelicList = allRelics.success ? allRelics.relics : [];
  const reconstitutionState = !isMech ? await getReconstitutionState(character.id) : null;

  const baseStatsForBonus = {
    STR: character.STR,
    INT: character.INT,
    VIT: character.VIT,
    WIS: character.WIS,
    DEX: character.DEX,
    AGI: character.AGI,
    LUK: character.LUK,
  };
  const relicBonus = computeRelicBonusFromSlots(relicSlots, baseStatsForBonus);
  const mechaEquipmentBonus =
    isMech && mechaEquipment
      ? computeMechaEquipmentBonus(mechaEquipment.slots)
      : null;

  const iconFilenames = getProtagonistIconFilenames();

  const displayName =
    character.category === "protagonist" && protagonist ? protagonist.displayName : character.displayName;
  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="個室"
        description=""
        currentPath={`/dashboard/characters/${character.id}`}
        backHref="/dashboard/characters"
        backLabel="居住区に戻る"
        showDestinations={false}
      />
      <div className="max-w-lg">
        <div className="mt-6 flex flex-wrap items-start gap-6 rounded-lg border border-base-border bg-base-elevated p-6">
          <CharacterIconChange
            characterId={character.id}
            currentIconFilename={character.iconFilename}
            iconFilenames={iconFilenames}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-text-primary">{displayName}</p>
            {battleStats && (
              <>
                <p className="mt-1 text-sm font-medium text-text-primary tabular-nums">戦闘力 {battleStats.combatPower.toLocaleString()}</p>
                <p className="mt-1 text-sm tabular-nums">
                  <span className="text-text-muted">HP </span>
                  <span className="font-medium text-green-600 dark:text-green-400">{battleStats.derived.HP.toLocaleString()}</span>
                  <span className="text-text-muted"> MP </span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{battleStats.derived.MP.toLocaleString()}</span>
                </p>
              </>
            )}
            {isMech ? (
              <>
                <p className="mt-2 text-sm font-medium text-text-primary tabular-nums">レベル {character.level ?? 1}</p>
                <p className="mt-1 text-sm text-text-muted tabular-nums">経験値 — / —</p>
                <div className="mt-1 h-2 rounded-full overflow-hidden bg-base-border">
                  <div className="h-full w-full bg-error" aria-hidden />
                </div>
              </>
            ) : (
              (() => {
                const lv = character.level ?? 1;
                const totalExp = character.experiencePoints ?? 0;
                const currentLevelExp = getRequiredExpForLevel(lv);
                const nextLevelExp = getRequiredExpForLevel(lv + 1);
                const gainedInLevel = Math.max(0, totalExp - currentLevelExp);
                const neededThisLevel = Math.max(1, nextLevelExp - currentLevelExp);
                const ratio = Math.max(0, Math.min(1, gainedInLevel / neededThisLevel));
                return (
                  <>
                    <p className="mt-2 text-sm font-medium text-text-primary tabular-nums">レベル {lv}</p>
                    <p className="mt-1 text-sm text-text-muted tabular-nums">
                      経験値 {gainedInLevel.toLocaleString()} / {neededThisLevel.toLocaleString()}
                    </p>
                    <div className="mt-1 h-2 rounded-full overflow-hidden bg-base-border">
                      <div
                        className="h-full bg-brass transition-[width]"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>

        <CharacterStatSection
          characterId={character.id}
          character={{
            STR: character.STR,
            INT: character.INT,
            VIT: character.VIT,
            WIS: character.WIS,
            DEX: character.DEX,
            AGI: character.AGI,
            LUK: character.LUK,
            CAP: character.CAP,
          }}
          isMech={isMech}
          relicBonus={relicBonus}
          mechaEquipmentBonus={mechaEquipmentBonus}
          reconstitutionState={reconstitutionState}
        />

        {(battleSkills.length > 0 || industrialSkills.length > 0) && (
          <CharacterSkillTabs
            characterId={character.id}
            battleSkills={battleSkills}
            industrialSkills={industrialSkills}
          />
        )}

        {canEquip && characterEquipment && allEquipment && (
          <CharacterEquipmentSection
            characterId={character.id}
            slots={characterEquipment.slots}
            allEquipment={allEquipment}
          />
        )}

        {isMech && mechaEquipment && allMechaParts && (
          <MechaEquipmentSection
            characterId={character.id}
            slots={mechaEquipment.slots}
            allParts={allMechaParts}
          />
        )}

        <CharacterRelicSection
          characterId={character.id}
          slots={relicSlots}
          allRelics={allRelicList}
        />

        {character.category === "companion" && (
          <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
            <h2 className="text-lg font-medium text-text-primary">解雇</h2>
            <p className="mt-1 text-sm text-text-muted">仲間を解雇すると、このキャラと習得スキルは削除されます。</p>
            <DismissCompanionButton characterId={character.id} displayName={character.displayName} />
          </div>
        )}

      </div>
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard/characters" className={footerLinkClass}>
          ← 居住区に戻る
        </Link>
      </footer>
    </main>
  );
}
