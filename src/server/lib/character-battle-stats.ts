/**
 * docs/077: 1キャラ分の戦闘ステ（装備・遺物反映）と戦闘力（HP+MP）を算出。
 * 戦闘（battle.ts）と同じ計算式を使用するが、battle には手を入れない。
 */

import {
  computeDerivedStats,
  type BaseStats,
  type DerivedStats,
} from "@/lib/battle/derived-stats";
import {
  computeEffectiveBaseStats,
  parseRelicStatBonus,
} from "@/lib/battle/effective-base-stats";
import { prisma } from "@/lib/db/prisma";

const DERIVED_STAT_KEYS = ["HP", "MP", "PATK", "MATK", "PDEF", "MDEF", "HIT", "EVA", "LUCK"] as const;

export type CharacterBattleStatsResult = {
  derived: DerivedStats;
  combatPower: number;
};

/**
 * 1キャラの戦闘ステ（装備・遺物・メカパーツ反映済み）と戦闘力（HP+MP）を返す。
 * キャラが存在しない or userId が一致しない場合は null。
 */
export async function getCharacterBattleStats(
  characterId: string,
  userId: string
): Promise<CharacterBattleStatsResult | null> {
  const character = await prisma.character.findFirst({
    where: { id: characterId, userId },
    select: {
      id: true,
      category: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
      CAP: true,
      characterRelics: {
        where: { relicInstanceId: { not: null } },
        select: {
          relicInstance: {
            select: { statBonus1: true, statBonus2: true },
          },
        },
      },
      characterEquipments: {
        select: { equipmentInstance: { select: { stats: true } } },
      },
    },
  });
  if (!character) return null;

  const rawBase: BaseStats = {
    STR: character.STR,
    INT: character.INT,
    VIT: character.VIT,
    WIS: character.WIS,
    DEX: character.DEX,
    AGI: character.AGI,
    LUK: character.LUK,
    CAP: character.CAP,
  };

  const relicStatBonuses: { stat: string; percent: number }[] = [];
  for (const cr of character.characterRelics ?? []) {
    const ri = cr.relicInstance;
    if (!ri) continue;
    const b1 = parseRelicStatBonus(ri.statBonus1);
    if (b1) relicStatBonuses.push(b1);
    const b2 = parseRelicStatBonus(ri.statBonus2);
    if (b2) relicStatBonuses.push(b2);
  }

  let mechaFlat: Partial<BaseStats> | undefined;
  let frameMultiplier: Record<string, number> | null | undefined;
  if (character.category === "mech") {
    const mechEquips = await prisma.mechaEquipment.findMany({
      where: { characterId: character.id },
      select: {
        mechaPartInstance: {
          select: {
            mechaPartType: {
              select: {
                slot: true,
                statRates: true,
                strAdd: true,
                intAdd: true,
                vitAdd: true,
                wisAdd: true,
                dexAdd: true,
                agiAdd: true,
                lukAdd: true,
                capAdd: true,
              },
            },
          },
        },
        mechaPartType: {
          select: {
            slot: true,
            statRates: true,
            strAdd: true,
            intAdd: true,
            vitAdd: true,
            wisAdd: true,
            dexAdd: true,
            agiAdd: true,
            lukAdd: true,
            capAdd: true,
          },
        },
      },
    });
    const data = { mechaFlat: {} as Partial<BaseStats>, frameMultiplier: null as Record<string, number> | null };
    for (const eq of mechEquips) {
      const partType = eq.mechaPartInstance?.mechaPartType ?? eq.mechaPartType;
      if (!partType || !("slot" in partType)) continue;
      const slot = (partType as { slot: string }).slot;
      if (slot === "frame") {
        const rates = (partType as { statRates?: unknown }).statRates;
        data.frameMultiplier =
          rates && typeof rates === "object" && !Array.isArray(rates)
            ? (rates as Record<string, number>)
            : null;
      } else {
        const p = partType as {
          strAdd?: number | null;
          intAdd?: number | null;
          vitAdd?: number | null;
          wisAdd?: number | null;
          dexAdd?: number | null;
          agiAdd?: number | null;
          lukAdd?: number | null;
          capAdd?: number | null;
        };
        if (p.strAdd != null) data.mechaFlat.STR = (data.mechaFlat.STR ?? 0) + p.strAdd;
        if (p.intAdd != null) data.mechaFlat.INT = (data.mechaFlat.INT ?? 0) + p.intAdd;
        if (p.vitAdd != null) data.mechaFlat.VIT = (data.mechaFlat.VIT ?? 0) + p.vitAdd;
        if (p.wisAdd != null) data.mechaFlat.WIS = (data.mechaFlat.WIS ?? 0) + p.wisAdd;
        if (p.dexAdd != null) data.mechaFlat.DEX = (data.mechaFlat.DEX ?? 0) + p.dexAdd;
        if (p.agiAdd != null) data.mechaFlat.AGI = (data.mechaFlat.AGI ?? 0) + p.agiAdd;
        if (p.lukAdd != null) data.mechaFlat.LUK = (data.mechaFlat.LUK ?? 0) + p.lukAdd;
        if (p.capAdd != null) data.mechaFlat.CAP = (data.mechaFlat.CAP ?? 0) + p.capAdd;
      }
    }
    mechaFlat = Object.keys(data.mechaFlat).length > 0 ? data.mechaFlat : undefined;
    frameMultiplier = data.frameMultiplier;
  }

  const base = computeEffectiveBaseStats(rawBase, {
    relicStatBonuses,
    mechaFlat,
    frameMultiplier: frameMultiplier ?? undefined,
  });

  const derivedBonus: Partial<DerivedStats> = {};
  for (const ce of character.characterEquipments ?? []) {
    const stats = ce.equipmentInstance?.stats;
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) continue;
    const s = stats as Record<string, unknown>;
    for (const key of DERIVED_STAT_KEYS) {
      const v = s[key];
      if (typeof v !== "number") continue;
      (derivedBonus as Record<string, number>)[key] =
        ((derivedBonus as Record<string, number>)[key] ?? 0) + v;
    }
  }

  const before = computeDerivedStats(base);
  const derived: DerivedStats = {
    HP: before.HP + (derivedBonus.HP ?? 0),
    MP: before.MP + (derivedBonus.MP ?? 0),
    PATK: before.PATK + (derivedBonus.PATK ?? 0),
    MATK: before.MATK + (derivedBonus.MATK ?? 0),
    PDEF: before.PDEF + (derivedBonus.PDEF ?? 0),
    MDEF: before.MDEF + (derivedBonus.MDEF ?? 0),
    HIT: before.HIT + (derivedBonus.HIT ?? 0),
    EVA: before.EVA + (derivedBonus.EVA ?? 0),
    LUCK: before.LUCK + (derivedBonus.LUCK ?? 0),
  };

  const combatPower =
    derived.HP +
    derived.MP +
    derived.PATK +
    derived.MATK +
    derived.PDEF +
    derived.MDEF +
    derived.HIT +
    derived.EVA +
    derived.LUCK;

  return { derived, combatPower };
}
