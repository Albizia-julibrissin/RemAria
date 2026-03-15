/**
 * 遺物パッシブ効果マスタを一括投入するスクリプト。
 *
 * 投入内容:
 * - 物理の〇〇輝き: +1%～+5% の5段階
 * - 魔法の〇〇輝き: +1%～+5% の5段階
 * - 属性（極星を除く6種）× 1%～7%: 圧縮・切創・穿孔・焼損・凍傷・侵食
 * - HP回復: 毎ターン10/20/30 の3段階
 *
 * 実行: npx tsx prisma/seed-relic-passive-effects.ts
 * 既存の code はスキップ（重複しないよう upsert）。
 */
import { PrismaClient } from "@prisma/client";
import { ATTRIBUTE_RESISTANCE_LABELS } from "../src/lib/constants/relic";

const prisma = new PrismaClient();

/** 物理ダメージ％の段階名（弱→強） */
const PHYSICAL_GLOW_NAMES = ["鈍い輝き", "微かな輝き", "穏やかな輝き", "鮮やかな輝き", "絶大な輝き"] as const;

/** 魔法ダメージ％の段階名（弱→強） */
const MAGIC_GLOW_NAMES = ["鈍い輝き", "微かな輝き", "穏やかな輝き", "鮮やかな輝き", "絶大な輝き"] as const;

/** 属性ダメージ％の段階名（1%～7%、弱→強） */
const ATTRIBUTE_TIER_NAMES = [
  "微かな閃き",
  "鈍い輝き",
  "穏やかな輝き",
  "鮮やかな輝き",
  "鋭い閃き",
  "猛き輝き",
  "絶大な輝き",
] as const;

/** 極星を除く6属性（属性コード → 表示名は ATTRIBUTE_RESISTANCE_LABELS を使用） */
const ATTRIBUTE_KEYS_EXCLUDE_POLARITY = ["crush", "slash", "pierce", "burn", "freeze", "corrode"] as const;

/** HP回復の段階名（10/20/30） */
const HP_REGEN_NAMES = ["微かな癒し", "穏やかな癒し", "深い癒し"] as const;

type RelicPassiveRow = {
  code: string;
  name: string;
  description: string;
  effectType: string;
  param: Record<string, number | string>;
};

function buildRows(): RelicPassiveRow[] {
  const rows: RelicPassiveRow[] = [];

  // 物理 +1%～+5%
  for (let pct = 1; pct <= 5; pct++) {
    const tier = pct - 1;
    rows.push({
      code: `physical_pct_${pct}`,
      name: `物理の${PHYSICAL_GLOW_NAMES[tier]}`,
      description: `物理攻撃ダメージ+${pct}％`,
      effectType: "final_physical_damage_pct",
      param: { pct },
    });
  }

  // 魔法 +1%～+5%
  for (let pct = 1; pct <= 5; pct++) {
    const tier = pct - 1;
    rows.push({
      code: `magic_pct_${pct}`,
      name: `魔法の${MAGIC_GLOW_NAMES[tier]}`,
      description: `魔法攻撃ダメージ+${pct}％`,
      effectType: "final_magic_damage_pct",
      param: { pct },
    });
  }

  // 属性（6種 × 1%～7%）
  for (const attr of ATTRIBUTE_KEYS_EXCLUDE_POLARITY) {
    const label = ATTRIBUTE_RESISTANCE_LABELS[attr];
    for (let pct = 1; pct <= 7; pct++) {
      const tier = pct - 1;
      rows.push({
        code: `${attr}_pct_${pct}`,
        name: `${label}の${ATTRIBUTE_TIER_NAMES[tier]}`,
        description: `${label}属性ダメージ+${pct}％`,
        effectType: "final_attribute_damage_pct",
        param: { attribute: attr, pct },
      });
    }
  }

  // HP回復 10/20/30
  const amounts = [10, 20, 30] as const;
  for (let i = 0; i < amounts.length; i++) {
    const amount = amounts[i];
    rows.push({
      code: `hp_regen_${amount}`,
      name: `生命の${HP_REGEN_NAMES[i]}`,
      description: `毎ターン${amount}ずつ回復`,
      effectType: "hp_regen_per_turn",
      param: { amount },
    });
  }

  return rows;
}

async function main(): Promise<void> {
  const rows = buildRows();
  console.log(`遺物パッシブ効果: ${rows.length} 件を投入します。`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await prisma.relicPassiveEffect.findUnique({
      where: { code: row.code },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.relicPassiveEffect.create({
      data: {
        code: row.code,
        name: row.name,
        description: row.description,
        effectType: row.effectType,
        param: row.param as object,
      },
    });
    created++;
    console.log(`  created: ${row.code} ${row.name}`);
  }

  console.log(`完了: 新規 ${created} 件, 既存のためスキップ ${skipped} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
