"use server";

// spec/020_test_battle.md - 仮戦闘実行 API（作戦・スキル・物理/魔法防御対応）

import { getSession } from "@/lib/auth/session";
import { userRepository } from "@/server/repositories/user-repository";
import type { BaseStats } from "@/lib/battle/derived-stats";
import { runBattleWithParty } from "@/lib/battle/run-battle-with-party";
import type {
  PartyMemberInput,
  TacticSlotInput,
  SkillDataForBattle,
  BattleLogEntryWithParty,
  BattleSummaryWithParty,
} from "@/lib/battle/run-battle-with-party";
import {
  TEST_ENEMY_BASE_STATS,
  TEST_ENEMY_POSITIONS_1V3,
  TEST_ENEMY_TACTIC_SLOTS,
  TEST_ENEMY_SKILLS,
} from "@/lib/battle/test-enemy";
import type { BattlePosition } from "@/lib/battle/battle-position";
import { prisma } from "@/lib/db/prisma";

export type RunTestBattleSuccess = {
  success: true;
  result: "player" | "enemy" | "draw";
  protagonistPosition: BattlePosition;
  protagonistIconFilename: string | null;
  partyDisplayNames: string[];
  partyIconFilenames: (string | null)[];
  /** 戦闘開始時の味方の列位置（作戦室で設定した列） */
  initialPartyPositions: BattlePosition[];
  enemyPositions: BattlePosition[];
  log: BattleLogEntryWithParty[];
  summary: BattleSummaryWithParty;
};

export type RunTestBattleError = {
  success: false;
  error: string;
  message: string;
};

export type RunTestBattleResult = RunTestBattleSuccess | RunTestBattleError;

/** 仮戦闘実行。指定プリセットの編成・作戦・スキルで戦闘。 */
export async function runTestBattle(presetId: string): Promise<RunTestBattleResult> {
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
      tacticSlots: {
        orderBy: { orderIndex: "asc" },
        select: {
          orderIndex: true,
          subject: true,
          conditionKind: true,
          conditionParam: true,
          actionType: true,
          skillId: true,
        },
      },
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
    },
  });

  // spec/044: メカは装備パーツのスキルを使用。戦闘用に skillId → SkillDataForBattle を事前取得。
  const mechIds = characters.filter((x) => x.category === "mech").map((x) => x.id);
  const mechSkillsByCharId = new Map<string, Record<string, SkillDataForBattle>>();
  if (mechIds.length > 0) {
    const mechEquips = await prisma.mechaEquipment.findMany({
      where: { characterId: { in: mechIds } },
      select: {
        characterId: true,
        mechaPartInstance: {
          select: {
            mechaPartType: {
              select: {
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
  }

  const partyInput: PartyMemberInput[] = [];
  const partyIconFilenames: (string | null)[] = [];
  const order = [preset.slot1CharacterId, preset.slot2CharacterId, preset.slot3CharacterId].filter(Boolean) as string[];
  const colForSlot = [
    Math.max(1, Math.min(3, preset.slot1BattleCol ?? 1)),
    Math.max(1, Math.min(3, preset.slot2BattleCol ?? 1)),
    Math.max(1, Math.min(3, preset.slot3BattleCol ?? 1)),
  ] as const;
  const initialPartyPositions: BattlePosition[] = order.map((_, i) => ({
    row: (i + 1) as 1 | 2 | 3,
    col: colForSlot[i],
  }));

  for (const charId of order) {
    const c = characters.find((x) => x.id === charId);
    if (!c) continue;
    const base: BaseStats = {
      STR: c.STR,
      INT: c.INT,
      VIT: c.VIT,
      WIS: c.WIS,
      DEX: c.DEX,
      AGI: c.AGI,
      LUK: c.LUK,
      CAP: c.CAP,
    };
    const tacticSlots: TacticSlotInput[] = c.tacticSlots.map((s) => ({
      orderIndex: s.orderIndex,
      subject: s.subject ?? undefined,
      conditionKind: s.conditionKind,
      conditionParam: s.conditionParam as unknown,
      actionType: s.actionType,
      skillId: s.skillId,
    }));

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

    partyInput.push({
      displayName: c.category === "protagonist" && user?.name ? user.name : c.displayName,
      base,
      tacticSlots,
      skills,
    });
    partyIconFilenames.push(c.iconFilename);
  }

  const battle = runBattleWithParty(
    partyInput,
    TEST_ENEMY_BASE_STATS,
    TEST_ENEMY_POSITIONS_1V3,
    initialPartyPositions,
    undefined,
    TEST_ENEMY_TACTIC_SLOTS,
    TEST_ENEMY_SKILLS
  );

  return {
    success: true,
    result: battle.result,
    protagonistPosition: { row: 1, col: colForSlot[0] },
    protagonistIconFilename: partyIconFilenames[0] ?? null,
    partyDisplayNames: battle.summary.partyDisplayNames,
    partyIconFilenames,
    initialPartyPositions,
    enemyPositions: battle.enemyPositions,
    log: battle.log,
    summary: battle.summary,
  };
}
