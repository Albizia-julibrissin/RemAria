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
import { getRequiredExpForLevel } from "@/lib/level";
import { DismissCompanionButton } from "./dismiss-companion-button";
import { CharacterEquipmentSection } from "./character-equipment-section";
import { MechaEquipmentSection } from "./mecha-equipment-section";
import { CharacterRelicSection } from "./character-relic-section";
import { CharacterSkillTabs } from "./character-skill-tabs";
import { CharacterStatAllocationForm } from "./character-stat-allocation-form";
import { CharacterIconChange } from "./character-icon-change";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";

const CATEGORY_LABEL: Record<string, string> = {
  protagonist: "主人公",
  companion: "仲間",
  mech: "メカ",
};

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
  const [characterEquipment, allEquipment, mechaEquipment, allMechaParts, characterRelics, allRelics] = await Promise.all([
    canEquip ? getCharacterEquipment(character.id) : null,
    canEquip ? getEquipmentInstancesWithEquipped() : null,
    isMech ? getMechaEquipment(character.id) : null,
    isMech ? getMechaPartInstancesWithEquipped() : null,
    getCharacterRelics(character.id),
    getRelicInstances(),
  ]);
  const relicSlots = characterRelics.success ? characterRelics.slots : [];
  const allRelicList = allRelics.success ? allRelics.relics : [];

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

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-text-primary">
          {character.category === "protagonist" && protagonist ? protagonist.displayName : character.displayName}
        </h1>
        <p className="mt-1 text-sm text-text-muted">{CATEGORY_LABEL[character.category] ?? character.category}</p>

        {!isMech && (
          <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
            <h2 className="text-lg font-medium text-text-primary">経験値・レベル</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">レベル</dt>
                <dd className="font-medium text-text-primary tabular-nums">{character.level}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">経験値（累計）</dt>
                <dd className="font-medium text-text-primary tabular-nums">{character.experiencePoints}</dd>
              </div>
              <div className="flex justify-between gap-2 col-span-2">
                <dt className="text-text-muted">次のレベルまで</dt>
                <dd className="font-medium text-text-primary tabular-nums">
                  {(() => {
                    const need = getRequiredExpForLevel(character.level + 1) - character.experiencePoints;
                    return need <= 0 ? "—" : need;
                  })()}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-6 flex items-start gap-6 rounded-lg border border-base-border bg-base-elevated p-6">
          <CharacterIconChange
            characterId={character.id}
            currentIconFilename={character.iconFilename}
            iconFilenames={iconFilenames}
          />
          <div className="min-w-0 flex-1 overflow-x-auto">
            <h2 className="text-lg font-medium text-text-primary">基礎ステータス</h2>
            <p className="mt-1 text-xs text-text-muted">列は 基礎・装備・遺物 の加算です。</p>
            <table className="mt-3 w-full min-w-[200px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-base-border text-left text-text-muted">
                  <th className="py-1 pr-4 font-medium"></th>
                  <th className="w-14 py-1 text-right font-medium tabular-nums">基礎</th>
                  <th className="w-14 py-1 text-right font-medium tabular-nums">装備</th>
                  <th className="w-14 py-1 text-right font-medium tabular-nums">遺物</th>
                </tr>
              </thead>
              <tbody>
                {BASE_STAT_KEYS.map((key) => {
                  const baseVal = character[key];
                  const relAdd = key === "CAP" ? 0 : (relicBonus[key as keyof typeof relicBonus] ?? 0);
                  const equipAdd = key === "CAP" ? 0 : (mechaEquipmentBonus?.[key as keyof typeof mechaEquipmentBonus] ?? 0);
                  if (key === "CAP") {
                    return (
                      <tr key={key} className="border-b border-base-border/70">
                        <td className="py-1 pr-4 text-text-muted">{key}</td>
                        <td className="py-1 text-right font-medium tabular-nums text-text-primary">{baseVal}</td>
                        <td className="py-1 text-right tabular-nums text-text-muted">—</td>
                        <td className="py-1 text-right tabular-nums text-text-muted">—</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={key} className="border-b border-base-border/70">
                      <td className="py-1 pr-4 text-text-muted">{key}</td>
                      <td className="py-1 text-right font-medium tabular-nums text-text-primary">{baseVal}</td>
                      <td className="py-1 text-right tabular-nums text-text-primary">
                        {equipAdd > 0 ? <span className="text-green-600 dark:text-green-400">+{equipAdd}</span> : "+0"}
                      </td>
                      <td className="py-1 text-right tabular-nums text-text-primary">
                        {relAdd > 0 ? <span className="text-amber-600 dark:text-amber-400">+{relAdd}</span> : "+0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {!isMech && (
          <CharacterStatAllocationForm
            characterId={character.id}
            cap={character.CAP}
            initialValues={{
              STR: character.STR,
              INT: character.INT,
              VIT: character.VIT,
              WIS: character.WIS,
              DEX: character.DEX,
              AGI: character.AGI,
              LUK: character.LUK,
            }}
          />
        )}

        {(battleSkills.length > 0 || industrialSkills.length > 0) && (
          <CharacterSkillTabs battleSkills={battleSkills} industrialSkills={industrialSkills} />
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

        <p className="mt-8">
          <Link href="/dashboard/characters" className="text-brass hover:text-brass-hover text-sm">
            ← キャラ一覧へ
          </Link>
        </p>
      </div>
    </main>
  );
}
