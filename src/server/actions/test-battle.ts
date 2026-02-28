"use server";

// spec/020_test_battle.md - 仮戦闘実行 API（作戦・スキル・物理/魔法防御対応）

import { getSession } from "@/lib/auth/session";
import type { BaseStats } from "@/lib/battle/derived-stats";
import { runBattleWithParty } from "@/lib/battle/run-battle-with-party";
import type {
  PartyMemberInput,
  TacticSlotInput,
  SkillDataForBattle,
  BattleLogEntryWithParty,
  BattleSummaryWithParty,
} from "@/lib/battle/run-battle-with-party";
import { TEST_ENEMY_BASE_STATS, TEST_ENEMY_POSITIONS_1V3 } from "@/lib/battle/test-enemy";
import type { BattlePosition } from "@/lib/battle/battle-position";
import { DEFAULT_PROTAGONIST_POSITION } from "@/lib/battle/battle-position";
import { prisma } from "@/lib/db/prisma";

export type RunTestBattleSuccess = {
  success: true;
  result: "player" | "enemy" | "draw";
  protagonistPosition: BattlePosition;
  protagonistIconFilename: string | null;
  partyDisplayNames: string[];
  partyIconFilenames: (string | null)[];
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

  const characterIds = [
    preset.slot1CharacterId,
    preset.slot2CharacterId,
    preset.slot3CharacterId,
  ].filter(Boolean) as string[];

  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds }, userId: session.userId },
    select: {
      id: true,
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
            },
          },
        },
      },
    },
  });

  const partyInput: PartyMemberInput[] = [];
  const partyIconFilenames: (string | null)[] = [];
  const order = [preset.slot1CharacterId, preset.slot2CharacterId, preset.slot3CharacterId].filter(Boolean) as string[];
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
      conditionKind: s.conditionKind,
      conditionParam: s.conditionParam as unknown,
      actionType: s.actionType,
      skillId: s.skillId,
    }));
    const skills: Record<string, SkillDataForBattle> = {};
    for (const cs of c.characterSkills) {
      const sk = cs.skill;
      skills[sk.id] = {
        name: sk.name,
        battleSkillType: sk.battleSkillType,
        powerMultiplier: sk.powerMultiplier != null ? Number(sk.powerMultiplier) : null,
        mpCostCapCoef: Number(sk.mpCostCapCoef ?? 0),
        mpCostFlat: sk.mpCostFlat ?? 0,
      };
    }
    partyInput.push({
      displayName: c.displayName,
      base,
      tacticSlots,
      skills,
    });
    partyIconFilenames.push(c.iconFilename);
  }

  const battle = runBattleWithParty(partyInput, TEST_ENEMY_BASE_STATS, TEST_ENEMY_POSITIONS_1V3);

  return {
    success: true,
    result: battle.result,
    protagonistPosition: DEFAULT_PROTAGONIST_POSITION,
    protagonistIconFilename: partyIconFilenames[0] ?? null,
    partyDisplayNames: battle.summary.partyDisplayNames,
    partyIconFilenames,
    enemyPositions: battle.enemyPositions,
    log: battle.log,
    summary: battle.summary,
  };
}
