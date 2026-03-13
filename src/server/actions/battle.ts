"use server";

// spec/020_test_battle.md - 戦闘実行 API（探索・練習の両方で使用。作戦・スキル・物理/魔法防御対応）

import { getSession } from "@/lib/auth/session";
import { userRepository } from "@/server/repositories/user-repository";
import {
  computeDerivedStats,
  type BaseStats,
  type DerivedStats,
} from "@/lib/battle/derived-stats";
import {
  computeEffectiveBaseStats,
  parseRelicStatBonus,
} from "@/lib/battle/effective-base-stats";
import { runBattleWithParty } from "@/lib/battle/run-battle-with-party";
import type {
  PartyMemberInput,
  TacticSlotInput,
  SkillDataForBattle,
  BattleLogEntryWithParty,
  BattleSummaryWithParty,
  EnemyInput,
} from "@/lib/battle/run-battle-with-party";
import {
  DEFAULT_ENEMY_BASE_STATS,
  DEFAULT_ENEMY_POSITIONS_1V3,
  DEFAULT_ENEMY_TACTIC_SLOTS,
  DEFAULT_ENEMY_SKILLS,
  DEFAULT_ENEMY_NAME,
  DEFAULT_ENEMY_ICON_FILENAME,
} from "@/lib/battle/default-enemy";
import type { BattleCol, BattlePosition, BattleRow } from "@/lib/battle/battle-position";
import { mergeAttributeResistancesFromRelics } from "@/lib/battle/attribute-resistances";
import { prisma } from "@/lib/db/prisma";

export type RunBattleSuccess = {
  success: true;
  result: "player" | "enemy" | "draw";
  protagonistPosition: BattlePosition;
  protagonistIconFilename: string | null;
  partyDisplayNames: string[];
  partyIconFilenames: (string | null)[];
  /** spec/050: 敵の表示名（探索時はエリア敵、練習時はスライム1～3） */
  enemyDisplayNames: string[];
  /** spec/050: 敵のアイコンファイル名（未設定時は null） */
  enemyIconFilenames: (string | null)[];
  /** 戦闘開始時の味方の列位置（作戦室で設定した列） */
  initialPartyPositions: BattlePosition[];
  enemyPositions: BattlePosition[];
  log: BattleLogEntryWithParty[];
  summary: BattleSummaryWithParty;
  /** 戦闘に参加したキャラクターID（partyDisplayNames と同じ順番） */
  partyCharacterIds: string[];
  /** docs/054: 撃破した敵の DB id（探索戦闘で player 勝利時のみ。enemyInputs に enemyId がある場合） */
  defeatedEnemyIds?: string[];
  /** 検証ログ用: 各キャラの装備前・装備後の戦闘ステ（VERIFICATION_LOG） */
  verificationPartyStats?: { displayName: string; before: DerivedStats; after: DerivedStats }[];
};

export type RunBattleError = {
  success: false;
  error: string;
  message: string;
};

export type RunBattleResult = RunBattleSuccess | RunBattleError;

/** 戦闘実行。指定プリセットの編成・作戦・スキルで戦闘。探索・練習の両方で使用。 */
export async function runBattle(
  presetId: string,
  initialHpMpByCharacterId?: Record<string, { hp: number; mp: number }>,
  /** spec/050: 探索戦闘でエリア敵を使う場合に渡す。省略時はデフォルト敵（スライム×3）。 */
  enemyInputs?: EnemyInput[]
): Promise<RunBattleResult> {
  const session = await getSession();
  if (!session.userId || !session.isLoggedIn) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }

  const preset = await prisma.partyPreset.findFirst({
    where: { id: presetId, userId: session.userId },
    include: {
      slot1Character: true,
      slot2Character: true,
      slot3Character: true,
    },
  });
  if (!preset?.slot1Character) {
    return { success: false, error: "PRESET_NOT_FOUND", message: "指定したプリセットが見つかりません" };
  }

  const user = await userRepository.findById(session.userId);

  const characterIds = [
    preset.slot1CharacterId,
    preset.slot2CharacterId,
    preset.slot3CharacterId,
  ].filter(Boolean) as string[];

  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds }, userId: session.userId },
    select: {
      id: true,
      category: true,
      displayName: true,
      iconFilename: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
      CAP: true,
      characterSkills: {
        where: { skill: { category: "battle_active" } },
        select: {
          skillId: true,
          skill: {
            select: {
              id: true,
              name: true,
              battleSkillType: true,
              powerMultiplier: true,
              mpCostCapCoef: true,
              mpCostFlat: true,
              hitsMin: true,
              hitsMax: true,
              resampleTargetPerHit: true,
              targetScope: true,
              attribute: true,
              chargeCycles: true,
              cooldownCycles: true,
              weightAddFront: true,
              weightAddMid: true,
              weightAddBack: true,
              logMessage: true,
              logMessageOnCondition: true,
              skillEffects: {
                select: { effectType: true, param: true },
              },
            },
          },
        },
      },
      characterRelics: {
        where: { relicInstanceId: { not: null } },
        select: {
          relicInstance: {
            select: {
              attributeResistances: true,
              statBonus1: true,
              statBonus2: true,
              relicPassiveEffect: {
                select: { effectType: true, param: true },
              },
            },
          },
        },
      },
      characterEquipments: {
        select: {
          equipmentInstance: {
            select: { stats: true },
          },
        },
      },
    },
  });

  // spec/044: メカは装備パーツのスキルを使用。戦闘用に skillId → SkillDataForBattle を事前取得。
  const mechIds = characters.filter((x) => x.category === "mech").map((x) => x.id);
  const mechSkillsByCharId = new Map<string, Record<string, SkillDataForBattle>>();
  const mechPartDataByCharId = new Map<
    string,
    { mechaFlat: Partial<BaseStats>; frameMultiplier: Record<string, number> | null }
  >();
  if (mechIds.length > 0) {
    const mechEquips = await prisma.mechaEquipment.findMany({
      where: { characterId: { in: mechIds } },
      select: {
        characterId: true,
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
                mechaPartTypeSkills: {
                  select: {
                    skill: {
                      select: {
                        id: true,
                        name: true,
                        battleSkillType: true,
                        powerMultiplier: true,
                        mpCostCapCoef: true,
                        mpCostFlat: true,
                        hitsMin: true,
                        hitsMax: true,
                        resampleTargetPerHit: true,
                        targetScope: true,
                        attribute: true,
                        chargeCycles: true,
                        cooldownCycles: true,
                        weightAddFront: true,
                        weightAddMid: true,
                        weightAddBack: true,
                        logMessage: true,
                        logMessageOnCondition: true,
                        skillEffects: { select: { effectType: true, param: true } },
                      },
                    },
                  },
                },
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
            mechaPartTypeSkills: {
              select: {
                skill: {
                  select: {
                    id: true,
                    name: true,
                    battleSkillType: true,
                    powerMultiplier: true,
                    mpCostCapCoef: true,
                    mpCostFlat: true,
                    hitsMin: true,
                    hitsMax: true,
                    resampleTargetPerHit: true,
                    targetScope: true,
                    attribute: true,
                    chargeCycles: true,
                    cooldownCycles: true,
                    weightAddFront: true,
                    weightAddMid: true,
                    weightAddBack: true,
                    logMessage: true,
                    logMessageOnCondition: true,
                    skillEffects: { select: { effectType: true, param: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    for (const eq of mechEquips) {
      const partType = eq.mechaPartInstance?.mechaPartType ?? eq.mechaPartType;
      if (!partType) continue;
      let map = mechSkillsByCharId.get(eq.characterId);
      if (!map) {
        map = {};
        mechSkillsByCharId.set(eq.characterId, map);
      }
      for (const pts of partType.mechaPartTypeSkills) {
        const sk = pts.skill;
        if (!sk || map[sk.id]) continue;
        map[sk.id] = {
          name: sk.name,
          battleSkillType: sk.battleSkillType,
          powerMultiplier: sk.powerMultiplier != null ? Number(sk.powerMultiplier) : null,
          mpCostCapCoef: Number(sk.mpCostCapCoef ?? 0),
          mpCostFlat: sk.mpCostFlat ?? 0,
          hitsMin: sk.hitsMin ?? undefined,
          hitsMax: sk.hitsMax ?? undefined,
          resampleTargetPerHit: sk.resampleTargetPerHit ?? undefined,
          targetScope: sk.targetScope ?? undefined,
          attribute: sk.attribute ?? undefined,
          chargeCycles: sk.chargeCycles ?? undefined,
          cooldownCycles: sk.cooldownCycles ?? undefined,
          weightAddFront: sk.weightAddFront != null ? Number(sk.weightAddFront) : undefined,
          weightAddMid: sk.weightAddMid != null ? Number(sk.weightAddMid) : undefined,
          weightAddBack: sk.weightAddBack != null ? Number(sk.weightAddBack) : undefined,
          effects:
            sk.skillEffects?.map((e) => ({
              effectType: e.effectType,
              param: (e.param as Record<string, unknown>) ?? {},
            })) ?? [],
          logMessage: sk.logMessage ?? undefined,
          logMessageOnCondition: sk.logMessageOnCondition ?? undefined,
        };
      }
    }
    for (const eq of mechEquips) {
      const partType = eq.mechaPartInstance?.mechaPartType ?? eq.mechaPartType;
      if (!partType || !("slot" in partType)) continue;
      const slot = (partType as { slot: string }).slot;
      let data = mechPartDataByCharId.get(eq.characterId);
      if (!data) {
        data = { mechaFlat: {}, frameMultiplier: null };
        mechPartDataByCharId.set(eq.characterId, data);
      }
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
  }

  // spec/063: 味方の作戦スロットはプリセット別に PresetTacticSlot から取得する
  const presetTactics = await prisma.presetTacticSlot.findMany({
    where: { partyPresetId: presetId, characterId: { in: characterIds } },
    orderBy: [{ characterId: "asc" }, { orderIndex: "asc" }],
    select: {
      characterId: true,
      orderIndex: true,
      subject: true,
      conditionKind: true,
      conditionParam: true,
      actionType: true,
      skillId: true,
    },
  });
  const tacticSlotsByCharId = new Map<string, TacticSlotInput[]>();
  for (const id of characterIds) {
    tacticSlotsByCharId.set(id, []);
  }
  for (const s of presetTactics) {
    const list = tacticSlotsByCharId.get(s.characterId);
    if (!list) continue;
    list.push({
      orderIndex: s.orderIndex,
      subject: s.subject ?? undefined,
      conditionKind: s.conditionKind,
      conditionParam: s.conditionParam as unknown,
      actionType: s.actionType,
      skillId: s.skillId,
    });
  }

  const order = [preset.slot1CharacterId, preset.slot2CharacterId, preset.slot3CharacterId].filter(Boolean) as string[];
  const relicsPerMember = order.map((charId) => {
    const c = characters.find((x) => x.id === charId);
    if (!c?.characterRelics) return [];
    return c.characterRelics
      .filter((cr) => cr.relicInstance?.attributeResistances)
      .map((cr) => ({ attributeResistances: cr.relicInstance!.attributeResistances as Record<string, number> | null }));
  });
  const partyAttributeResistances = mergeAttributeResistancesFromRelics(relicsPerMember);

  const partyInput: PartyMemberInput[] = [];
  const verificationPartyStats: { displayName: string; before: DerivedStats; after: DerivedStats }[] = [];
  const partyIconFilenames: (string | null)[] = [];
  const colForSlot = [
    Math.max(1, Math.min(3, preset.slot1BattleCol ?? 1)),
    Math.max(1, Math.min(3, preset.slot2BattleCol ?? 1)),
    Math.max(1, Math.min(3, preset.slot3BattleCol ?? 1)),
  ] as const;
  const initialPartyPositions: BattlePosition[] = order.map((_, i) => ({
    row: (i + 1) as BattleRow,
    col: (colForSlot[i] ?? 1) as BattleCol,
  }));

  const initialPartyHpMp: { currentHp: number; currentMp: number }[] = [];

  const DERIVED_STAT_KEYS = ["HP", "MP", "PATK", "MATK", "PDEF", "MDEF", "HIT", "EVA", "LUCK"] as const;

  for (const charId of order) {
    const c = characters.find((x) => x.id === charId);
    if (!c) continue;
    const rawBase: BaseStats = {
      STR: c.STR,
      INT: c.INT,
      VIT: c.VIT,
      WIS: c.WIS,
      DEX: c.DEX,
      AGI: c.AGI,
      LUK: c.LUK,
      CAP: c.CAP,
    };
    const relicStatBonuses: { stat: string; percent: number }[] = [];
    for (const cr of c.characterRelics ?? []) {
      const ri = cr.relicInstance;
      if (!ri) continue;
      const b1 = parseRelicStatBonus(ri.statBonus1);
      if (b1) relicStatBonuses.push(b1);
      const b2 = parseRelicStatBonus(ri.statBonus2);
      if (b2) relicStatBonuses.push(b2);
    }
    const mechData = c.category === "mech" ? mechPartDataByCharId.get(c.id) : undefined;
    const base = computeEffectiveBaseStats(rawBase, {
      relicStatBonuses,
      mechaFlat: mechData?.mechaFlat,
      frameMultiplier: mechData?.frameMultiplier ?? undefined,
    });
    const tacticSlots: TacticSlotInput[] = tacticSlotsByCharId.get(c.id) ?? [];

    const derivedBonus: Partial<DerivedStats> = {};
    for (const ce of c.characterEquipments ?? []) {
      const stats = ce.equipmentInstance?.stats;
      if (!stats || typeof stats !== "object" || Array.isArray(stats)) continue;
      const s = stats as Record<string, unknown>;
      for (const key of DERIVED_STAT_KEYS) {
        const v = s[key];
        if (typeof v !== "number") continue;
        const add = v;
        (derivedBonus as Record<string, number>)[key] = ((derivedBonus as Record<string, number>)[key] ?? 0) + add;
      }
    }

    // メカは装備パーツのスキル、それ以外は CharacterSkill（battle_active）
    let skills: Record<string, SkillDataForBattle> = {};
    if (c.category === "mech") {
      skills = mechSkillsByCharId.get(c.id) ?? {};
    } else {
      for (const cs of c.characterSkills) {
        const sk = cs.skill;
        skills[sk.id] = {
          name: sk.name,
          battleSkillType: sk.battleSkillType,
          powerMultiplier: sk.powerMultiplier != null ? Number(sk.powerMultiplier) : null,
          mpCostCapCoef: Number(sk.mpCostCapCoef ?? 0),
          mpCostFlat: sk.mpCostFlat ?? 0,
          hitsMin: sk.hitsMin ?? undefined,
          hitsMax: sk.hitsMax ?? undefined,
          resampleTargetPerHit: sk.resampleTargetPerHit ?? undefined,
          targetScope: sk.targetScope ?? undefined,
          attribute: sk.attribute ?? undefined,
          chargeCycles: sk.chargeCycles ?? undefined,
          cooldownCycles: sk.cooldownCycles ?? undefined,
          weightAddFront: sk.weightAddFront != null ? Number(sk.weightAddFront) : undefined,
          weightAddMid: sk.weightAddMid != null ? Number(sk.weightAddMid) : undefined,
          weightAddBack: sk.weightAddBack != null ? Number(sk.weightAddBack) : undefined,
          effects:
            sk.skillEffects?.map((e) => ({
              effectType: e.effectType,
              param: (e.param as Record<string, unknown>) ?? {},
            })) ?? [],
          logMessage: sk.logMessage ?? undefined,
          logMessageOnCondition: sk.logMessageOnCondition ?? undefined,
        };
      }
    }

    const memberIndex = order.indexOf(c.id);
    const attributeResistances = memberIndex >= 0 && partyAttributeResistances[memberIndex]
      ? partyAttributeResistances[memberIndex]
      : undefined;

    const relicPassiveEffects = (c.characterRelics ?? [])
      .filter((cr) => cr.relicInstance?.relicPassiveEffect?.effectType)
      .map((cr) => ({
        effectType: cr.relicInstance!.relicPassiveEffect!.effectType!,
        param: (cr.relicInstance!.relicPassiveEffect!.param as Record<string, unknown>) ?? {},
      }));

    const before = computeDerivedStats(base);
    const after: DerivedStats = {
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
    verificationPartyStats.push({
      displayName: c.category === "protagonist" && user?.name ? user.name : c.displayName,
      before,
      after,
    });

    partyInput.push({
      displayName: c.category === "protagonist" && user?.name ? user.name : c.displayName,
      base,
      tacticSlots,
      skills,
      attributeResistances,
      relicPassiveEffects,
      derivedBonus: Object.keys(derivedBonus).length > 0 ? derivedBonus : undefined,
    });
    partyIconFilenames.push(c.iconFilename);
    const override = initialHpMpByCharacterId?.[c.id];
    if (override) {
      // 探索などで前回戦闘から HP/MP を引き継ぐ場合は、その値をそのまま渡す（0 も有効値）
      initialPartyHpMp.push({ currentHp: override.hp, currentMp: override.mp });
    } else {
      // 引き継ぎ情報がない場合は「未指定扱い」にし、run-battle-with-party 側で最大値スタートとする
      initialPartyHpMp.push({ currentHp: -1, currentMp: -1 });
    }
  }

  const resolvedEnemyInputs =
    enemyInputs ??
    DEFAULT_ENEMY_POSITIONS_1V3.map((pos, i) => ({
      base: DEFAULT_ENEMY_BASE_STATS,
      tacticSlots: DEFAULT_ENEMY_TACTIC_SLOTS,
      skills: DEFAULT_ENEMY_SKILLS,
      displayName: `${DEFAULT_ENEMY_NAME}${i + 1}`,
      iconFilename: DEFAULT_ENEMY_ICON_FILENAME,
      position: pos,
    }));

  const battle = runBattleWithParty(
    partyInput,
    resolvedEnemyInputs,
    initialPartyPositions,
    undefined,
    initialPartyHpMp
  );

  const defeatedEnemyIds =
    battle.result === "player" && resolvedEnemyInputs
      ? resolvedEnemyInputs
          .filter((e): e is typeof e & { enemyId: string } => "enemyId" in e && !!(e as { enemyId?: string }).enemyId)
          .map((e) => e.enemyId)
      : undefined;

  return {
    success: true,
    result: battle.result,
    protagonistPosition: { row: 1 as BattleRow, col: (colForSlot[0] ?? 1) as BattleCol },
    protagonistIconFilename: partyIconFilenames[0] ?? null,
    partyDisplayNames: battle.summary.partyDisplayNames,
    partyIconFilenames,
    enemyDisplayNames: battle.summary.enemyDisplayNames,
    enemyIconFilenames: battle.summary.enemyIconFilenames,
    initialPartyPositions,
    enemyPositions: battle.enemyPositions,
    log: battle.log,
    summary: battle.summary,
    partyCharacterIds: order,
    defeatedEnemyIds,
    verificationPartyStats,
  };
}

/** 検証ログ用: 指定プリセットの編成について装備前・装備後の戦闘ステを返す。探索トップのテーブル表示用。 */
export async function getPartyVerificationStats(
  presetId: string,
  userId: string
): Promise<{ displayName: string; before: DerivedStats; after: DerivedStats }[]> {
  const preset = await prisma.partyPreset.findFirst({
    where: { id: presetId, userId },
    include: { slot1Character: true },
  });
  if (!preset?.slot1Character) return [];

  const user = await userRepository.findById(userId);
  const characterIds = [
    preset.slot1CharacterId,
    preset.slot2CharacterId,
    preset.slot3CharacterId,
  ].filter(Boolean) as string[];

  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds }, userId },
    select: {
      id: true,
      category: true,
      displayName: true,
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

  const mechIds = characters.filter((x) => x.category === "mech").map((x) => x.id);
  const mechPartDataByCharId = new Map<
    string,
    { mechaFlat: Partial<BaseStats>; frameMultiplier: Record<string, number> | null }
  >();
  if (mechIds.length > 0) {
    const mechEquips = await prisma.mechaEquipment.findMany({
      where: { characterId: { in: mechIds } },
      select: {
        characterId: true,
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
    for (const eq of mechEquips) {
      const partType = eq.mechaPartInstance?.mechaPartType ?? eq.mechaPartType;
      if (!partType || !("slot" in partType)) continue;
      const slot = (partType as { slot: string }).slot;
      let data = mechPartDataByCharId.get(eq.characterId);
      if (!data) {
        data = { mechaFlat: {}, frameMultiplier: null };
        mechPartDataByCharId.set(eq.characterId, data);
      }
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
  }

  const DERIVED_STAT_KEYS = ["HP", "MP", "PATK", "MATK", "PDEF", "MDEF", "HIT", "EVA", "LUCK"] as const;
  const order = [preset.slot1CharacterId, preset.slot2CharacterId, preset.slot3CharacterId].filter(
    Boolean
  ) as string[];

  const result: { displayName: string; before: DerivedStats; after: DerivedStats }[] = [];
  for (const charId of order) {
    const c = characters.find((x) => x.id === charId);
    if (!c) continue;
    const rawBase: BaseStats = {
      STR: c.STR,
      INT: c.INT,
      VIT: c.VIT,
      WIS: c.WIS,
      DEX: c.DEX,
      AGI: c.AGI,
      LUK: c.LUK,
      CAP: c.CAP,
    };
    const relicStatBonuses: { stat: string; percent: number }[] = [];
    for (const cr of c.characterRelics ?? []) {
      const ri = cr.relicInstance;
      if (!ri) continue;
      const b1 = parseRelicStatBonus(ri.statBonus1);
      if (b1) relicStatBonuses.push(b1);
      const b2 = parseRelicStatBonus(ri.statBonus2);
      if (b2) relicStatBonuses.push(b2);
    }
    const mechData = c.category === "mech" ? mechPartDataByCharId.get(c.id) : undefined;
    const base = computeEffectiveBaseStats(rawBase, {
      relicStatBonuses,
      mechaFlat: mechData?.mechaFlat,
      frameMultiplier: mechData?.frameMultiplier ?? undefined,
    });
    const derivedBonus: Partial<DerivedStats> = {};
    for (const ce of c.characterEquipments ?? []) {
      const stats = ce.equipmentInstance?.stats;
      if (!stats || typeof stats !== "object" || Array.isArray(stats)) continue;
      const s = stats as Record<string, unknown>;
      for (const key of DERIVED_STAT_KEYS) {
        const v = s[key];
        if (typeof v !== "number") continue;
        const add = v;
        (derivedBonus as Record<string, number>)[key] = ((derivedBonus as Record<string, number>)[key] ?? 0) + add;
      }
    }
    const before = computeDerivedStats(base);
    const after: DerivedStats = {
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
    result.push({
      displayName: c.category === "protagonist" && user?.name ? user.name : c.displayName,
      before,
      after,
    });
  }
  return result;
}
