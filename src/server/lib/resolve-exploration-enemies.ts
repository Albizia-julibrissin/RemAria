/**
 * spec/050: 探索戦闘用の敵選出。
 * エリア＋戦闘種別から 1～3 体の EnemyInput を組み立てる。
 */

import { prisma } from "@/lib/db/prisma";
import type { BaseStats } from "@/lib/battle/derived-stats";
import type { BattlePosition } from "@/lib/battle/battle-position";
import type {
  EnemyInput,
  TacticSlotInput,
  SkillDataForBattle,
} from "@/lib/battle/run-battle-with-party";

export type ExplorationBattleType = "normal" | "mid_boss" | "last_boss";

/** 重み付きランダムで1体のインデックスを返す（entries は { enemyId, weight } の配列） */
function weightedPick<T extends { weight: number }>(entries: T[]): number {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= entries[i].weight;
    if (r < 0) return i;
  }
  return entries.length - 1;
}

/** 体数 1～3 をレートで抽選 */
function rollEnemyCount(r1: number, r2: number, r3: number): 1 | 2 | 3 {
  const r = Math.random() * 100;
  if (r < r1) return 1;
  if (r < r1 + r2) return 2;
  return 3;
}

/** Skill + SkillEffect を SkillDataForBattle に変換 */
function skillToBattleData(skill: {
  id: string;
  name: string;
  battleSkillType: string | null;
  powerMultiplier: unknown;
  mpCostCapCoef: unknown;
  mpCostFlat: number | null;
  chargeCycles: number | null;
  cooldownCycles: number | null;
  hitsMin: number | null;
  hitsMax: number | null;
  resampleTargetPerHit: boolean | null;
  targetScope: string | null;
  attribute: string | null;
  weightAddFront: unknown;
  weightAddMid: unknown;
  weightAddBack: unknown;
  logMessage: string | null;
  logMessageOnCondition: string | null;
  skillEffects: Array< { effectType: string; param: unknown } >;
}): SkillDataForBattle {
  return {
    name: skill.name,
    battleSkillType: skill.battleSkillType,
    powerMultiplier: skill.powerMultiplier != null ? Number(skill.powerMultiplier) : null,
    mpCostCapCoef: Number(skill.mpCostCapCoef ?? 0),
    mpCostFlat: skill.mpCostFlat ?? 0,
    hitsMin: skill.hitsMin ?? undefined,
    hitsMax: skill.hitsMax ?? undefined,
    resampleTargetPerHit: skill.resampleTargetPerHit ?? undefined,
    targetScope: skill.targetScope ?? undefined,
    attribute: skill.attribute ?? undefined,
    chargeCycles: skill.chargeCycles ?? undefined,
    cooldownCycles: skill.cooldownCycles ?? undefined,
    weightAddFront: skill.weightAddFront != null ? Number(skill.weightAddFront) : undefined,
    weightAddMid: skill.weightAddMid != null ? Number(skill.weightAddMid) : undefined,
    weightAddBack: skill.weightAddBack != null ? Number(skill.weightAddBack) : undefined,
    effects:
      skill.skillEffects?.map((e) => ({
        effectType: e.effectType,
        param: (e.param as Record<string, unknown>) ?? {},
      })) ?? [],
    logMessage: skill.logMessage ?? undefined,
    logMessageOnCondition: skill.logMessageOnCondition ?? undefined,
  };
}

/** DB の Enemy を EnemyInput に変換 */
function enemyToInput(enemy: {
  id: string;
  name: string;
  iconFilename: string | null;
  STR: number;
  INT: number;
  VIT: number;
  WIS: number;
  DEX: number;
  AGI: number;
  LUK: number;
  CAP: number;
  defaultBattleRow: number;
  defaultBattleCol: number;
  tacticSlots: Array<{
    orderIndex: number;
    subject: string;
    conditionKind: string;
    conditionParam: unknown;
    actionType: string;
    skillId: string | null;
  }>;
  enemySkills: Array<{
    skill: {
      id: string;
      name: string;
      battleSkillType: string | null;
      powerMultiplier: unknown;
      mpCostCapCoef: unknown;
      mpCostFlat: number | null;
      chargeCycles: number | null;
      cooldownCycles: number | null;
      hitsMin: number | null;
      hitsMax: number | null;
      resampleTargetPerHit: boolean | null;
      targetScope: string | null;
      attribute: string | null;
      weightAddFront: unknown;
      weightAddMid: unknown;
      weightAddBack: unknown;
      logMessage: string | null;
      logMessageOnCondition: string | null;
      skillEffects: Array<{ effectType: string; param: unknown }>;
    };
  }>;
}): EnemyInput {
  const base: BaseStats = {
    STR: enemy.STR,
    INT: enemy.INT,
    VIT: enemy.VIT,
    WIS: enemy.WIS,
    DEX: enemy.DEX,
    AGI: enemy.AGI,
    LUK: enemy.LUK,
    CAP: enemy.CAP,
  };
  const tacticSlots: TacticSlotInput[] = enemy.tacticSlots.map((s) => ({
    orderIndex: s.orderIndex,
    subject: s.subject,
    conditionKind: s.conditionKind,
    conditionParam: (s.conditionParam as Record<string, unknown>) ?? {},
    actionType: s.actionType,
    skillId: s.skillId ?? undefined,
  }));
  const skills: Record<string, SkillDataForBattle> = {};
  for (const es of enemy.enemySkills) {
    skills[es.skill.id] = skillToBattleData({
      ...es.skill,
      skillEffects: es.skill.skillEffects,
    });
  }
  return {
    base,
    tacticSlots,
    skills,
    displayName: enemy.name,
    iconFilename: enemy.iconFilename,
    position: {
      row: Math.max(1, Math.min(3, enemy.defaultBattleRow)) as 1 | 2 | 3,
      col: Math.max(1, Math.min(3, enemy.defaultBattleCol)) as 1 | 2 | 3,
    },
  };
}

const enemyInclude = {
  tacticSlots: { orderBy: { orderIndex: "asc" as const } },
  enemySkills: {
    include: {
      skill: {
        include: { skillEffects: { select: { effectType: true, param: true } } },
      },
    },
  },
} as const;

/**
 * 探索戦闘で使う敵 1～3 体を選出する。
 * 通常戦: グループから重み付きで選出。中/大ボス戦: ボス1体＋(体数-1)を雑魚グループから選出。
 */
export async function resolveEnemiesForExplorationBattle(
  areaId: string,
  battleType: ExplorationBattleType
): Promise<EnemyInput[]> {
  const area = await prisma.explorationArea.findUnique({
    where: { id: areaId },
    select: {
      normalEnemyGroupCode: true,
      enemyCount1Rate: true,
      enemyCount2Rate: true,
      enemyCount3Rate: true,
      midBossEnemyId: true,
      lastBossEnemyId: true,
    },
  });
  if (!area) return [];

  const r1 = area.enemyCount1Rate ?? 34;
  const r2 = area.enemyCount2Rate ?? 33;
  const r3 = area.enemyCount3Rate ?? 33;
  const count = rollEnemyCount(r1, r2, r3);

  if (battleType === "normal") {
    const code = area.normalEnemyGroupCode;
    if (!code) return [];
    const group = await prisma.enemyGroup.findUnique({
      where: { code },
      include: {
        entries: {
          include: {
            enemy: { include: enemyInclude },
          },
        },
      },
    });
    if (!group || group.entries.length === 0) return [];
    const inputs: EnemyInput[] = [];
    for (let i = 0; i < count; i++) {
      const idx = weightedPick(group.entries);
      const entry = group.entries[idx];
      if (entry?.enemy) inputs.push(enemyToInput(entry.enemy));
    }
    return inputs;
  }

  const bossId = battleType === "mid_boss" ? area.midBossEnemyId : area.lastBossEnemyId;
  if (!bossId) return [];

  const boss = await prisma.enemy.findUnique({
    where: { id: bossId },
    include: enemyInclude,
  });
  if (!boss) return [];

  const result: EnemyInput[] = [enemyToInput(boss)];
  const trashCount = count - 1;
  if (trashCount <= 0) return result;

  const code = area.normalEnemyGroupCode;
  if (!code) return result;
  const group = await prisma.enemyGroup.findUnique({
    where: { code },
    include: {
      entries: {
        include: {
          enemy: { include: enemyInclude },
        },
      },
    },
  });
  if (!group || group.entries.length === 0) return result;
  for (let i = 0; i < trashCount; i++) {
    const idx = weightedPick(group.entries);
    const entry = group.entries[idx];
    if (entry?.enemy) result.push(enemyToInput(entry.enemy));
  }
  return result;
}
