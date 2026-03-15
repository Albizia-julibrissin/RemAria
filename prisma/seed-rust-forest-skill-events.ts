/**
 * 錆びれた森林スコーガルズ 3エリアの技能イベントを登録する。
 * - 共通イベント 10 個 → 遊覧舗装路跡・保護管理棟跡・森林最奥地の全3エリアに紐づけ
 * - 遊覧舗装路跡専用 5 個
 * - 保護管理棟跡専用 5 個
 * - 森林最奥地専用 5 個
 *
 * 前提: ExplorationArea の name が「遊覧舗装路跡」「保護管理棟跡」「森林最奥地」の3件が存在すること。
 * 実行: npx tsx prisma/seed-rust-forest-skill-events.ts
 *
 * 設計: docs/森林エリア設定.ini, docs/rust_forest_skill_events_design.md, spec/073_skill_events_exploration.md
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI"] as const;
const SORT_ORDER: Record<string, number> = { STR: 0, INT: 1, VIT: 2, WIS: 3, DEX: 4, AGI: 5 };

/** ステータス別 成功・失敗メッセージ（共通） */
const STAT_MESSAGES: Record<
  string,
  { successMessage: string; failMessage: string }
> = {
  STR: { successMessage: "力で押しのけ、先へ進んだ。", failMessage: "力及ばず、迂回することにした。" },
  INT: { successMessage: "知恵で対処法を見つけ、切り抜けた。", failMessage: "判断がつかず、手間取った。" },
  VIT: { successMessage: "耐久力で堪え、乗り越えた。", failMessage: "堪えきれず、休憩を余儀なくされた。" },
  WIS: { successMessage: "判断で安全な経路を選んだ。", failMessage: "判断を誤り、時間を費やした。" },
  DEX: { successMessage: "器用にやり過ごした。", failMessage: "器用さが足りず、迂回した。" },
  AGI: { successMessage: "素早く対処し、難を逃れた。", failMessage: "反応が遅れ、巻き込まれた。" },
};

type AreaKind = "common" | "yuran" | "hogokan" | "forest_deep";

interface EventDef {
  code: string;
  name: string;
  occurrenceMessage: string;
  areaKind: AreaKind;
}

const COMMON_EVENTS: EventDef[] = [
  { code: "rust_forest_dust_wind", name: "赤茶の粉塵", occurrenceMessage: "風が吹くと赤茶の粉が舞い、視界が霞む。", areaKind: "common" },
  { code: "rust_forest_water_edge", name: "オレンジの水辺", occurrenceMessage: "水辺がオレンジ色に濁り、足元がぬかるんでいる。", areaKind: "common" },
  { code: "rust_forest_corroded_metal", name: "腐食した金属", occurrenceMessage: "腐食した金属の残骸が道を塞いでいる。触ると脆そうだ。", areaKind: "common" },
  { code: "rust_forest_roots_structure", name: "樹根と構造物", occurrenceMessage: "樹根がリベットや継ぎ目を割って構造物に絡まっている。", areaKind: "common" },
  { code: "rust_forest_iron_wetland", name: "鉄酸化した湿地", occurrenceMessage: "湿地が錆色に変色し、オレンジの沈殿が見える。", areaKind: "common" },
  { code: "rust_forest_iron_dust_breath", name: "鉄粉の降り積もり", occurrenceMessage: "鉄粉が降り積もり、息が辛い。", areaKind: "common" },
  { code: "rust_forest_bark_color", name: "赤茶に染まった樹皮", occurrenceMessage: "樹皮が赤茶色に染まった異様な光景が広がる。", areaKind: "common" },
  { code: "rust_forest_drone_wreck", name: "廃ドローン残骸", occurrenceMessage: "廃ドローンの残骸が木に絡まり、道を塞いでいる。", areaKind: "common" },
  { code: "rust_forest_dim_path", name: "薄暗い森道", occurrenceMessage: "日光が弱く、森道が薄暗い。", areaKind: "common" },
  { code: "rust_forest_iron_soil", name: "鉄濃度の高い土壌", occurrenceMessage: "鉄濃度の高い土壌が足を取る。", areaKind: "common" },
];

const YURAN_EVENTS: EventDef[] = [
  { code: "yuran_paved_crack", name: "舗装のひび割れ", occurrenceMessage: "アスファルトが樹根で隆起し、ひびが入っている。", areaKind: "yuran" },
  { code: "yuran_guardrail", name: "錆びたガードレール", occurrenceMessage: "遊覧路のガードレールが錆で崩れかけている。", areaKind: "yuran" },
  { code: "yuran_drainage", name: "詰まった排水溝", occurrenceMessage: "路肩の排水溝が鉄分で詰まっている。", areaKind: "yuran" },
  { code: "yuran_signboard", name: "腐食した案内板", occurrenceMessage: "旧観光案内板が腐食で読めない。", areaKind: "yuran" },
  { code: "yuran_collapse", name: "道路の崩落", occurrenceMessage: "遊覧道路の分岐点で道が崩落している。", areaKind: "yuran" },
];

const HOGOKAN_EVENTS: EventDef[] = [
  { code: "hogokan_entrance", name: "管理棟の入り口", occurrenceMessage: "管理棟の入り口のドアが歪んで開かない。", areaKind: "hogokan" },
  { code: "hogokan_monitor", name: "監視機器の残骸", occurrenceMessage: "監視機器の残骸が転がり、配線が露出している。", areaKind: "hogokan" },
  { code: "hogokan_storage", name: "備品庫の扉", occurrenceMessage: "備品庫の扉が錆で固着している。", areaKind: "hogokan" },
  { code: "hogokan_handrail", name: "階段の手すり", occurrenceMessage: "階段の手すりが腐食で不安定だ。", areaKind: "hogokan" },
  { code: "hogokan_window", name: "変形した窓枠", occurrenceMessage: "窓枠が変形し、ガラスが割れている。", areaKind: "hogokan" },
];

const FOREST_DEEP_EVENTS: EventDef[] = [
  { code: "forest_deep_giant_tree", name: "深森の巨木", occurrenceMessage: "幹が黒赤に染まった巨木が道を塞いでいる。", areaKind: "forest_deep" },
  { code: "forest_deep_untouched_wetland", name: "人跡未踏の湿地", occurrenceMessage: "オレンジの膜が張った、人跡未踏の湿地が広がる。", areaKind: "forest_deep" },
  { code: "forest_deep_metal_tree_fusion", name: "機械と樹木の融合", occurrenceMessage: "機械と樹木が完全に一体化した景観が立ちはだかる。", areaKind: "forest_deep" },
  { code: "forest_deep_iron_plants", name: "鉄耐性植物の群生", occurrenceMessage: "鉄耐性で進化した植物が赤茶の森を形成している。", areaKind: "forest_deep" },
  { code: "forest_deep_silence", name: "最奥の静寂", occurrenceMessage: "粉塵が音を吸い、不気味な静寂が漂う。", areaKind: "forest_deep" },
];

const ALL_EVENTS: EventDef[] = [
  ...COMMON_EVENTS,
  ...YURAN_EVENTS,
  ...HOGOKAN_EVENTS,
  ...FOREST_DEEP_EVENTS,
];

const AREA_NAMES = ["遊覧舗装路跡", "保護管理棟跡", "森林最奥地"] as const;
const WEIGHT_DEFAULT = 10;

async function main(): Promise<void> {
  const areas = await prisma.explorationArea.findMany({
    where: { name: { in: [...AREA_NAMES] } },
    select: { id: true, name: true },
  });

  const areaByName: Record<string, { id: string }> = {};
  for (const a of areas) {
    areaByName[a.name] = { id: a.id };
  }

  const missing = AREA_NAMES.filter((n) => !areaByName[n]);
  if (missing.length > 0) {
    console.error("以下の名前の探索エリアが DB に存在しません:", missing.join(", "));
    console.error("管理画面で「遊覧舗装路跡」「保護管理棟跡」「森林最奥地」の3エリアを作成してから再実行してください。");
    process.exit(1);
  }

  const yuranId = areaByName["遊覧舗装路跡"].id;
  const hogokanId = areaByName["保護管理棟跡"].id;
  const forestDeepId = areaByName["森林最奥地"].id;

  for (const ev of ALL_EVENTS) {
    const created = await prisma.explorationEvent.upsert({
      where: { code: ev.code },
      create: {
        code: ev.code,
        eventType: "skill_check",
        name: ev.name,
        description: `錆びれた森林スコーガルズ 技能イベント: ${ev.name}`,
      },
      update: {
        name: ev.name,
        description: `錆びれた森林スコーガルズ 技能イベント: ${ev.name}`,
      },
    });

    await prisma.skillEventDetail.upsert({
      where: { explorationEventId: created.id },
      create: {
        explorationEventId: created.id,
        occurrenceMessage: ev.occurrenceMessage,
      },
      update: { occurrenceMessage: ev.occurrenceMessage },
    });

    for (const statKey of STAT_KEYS) {
      const msg = STAT_MESSAGES[statKey] ?? {
        successMessage: "うまく切り抜けた。",
        failMessage: "うまくいかず、時間を費やした。",
      };
      await prisma.skillEventStatOption.upsert({
        where: {
          skillEventDetailId_statKey: {
            skillEventDetailId: created.id,
            statKey,
          },
        },
        create: {
          skillEventDetailId: created.id,
          statKey,
          sortOrder: SORT_ORDER[statKey] ?? 0,
          difficultyCoefficient: 1,
          successMessage: msg.successMessage,
          failMessage: msg.failMessage,
        },
        update: {
          successMessage: msg.successMessage,
          failMessage: msg.failMessage,
        },
      });
    }

    const areaIds: string[] =
      ev.areaKind === "common"
        ? [yuranId, hogokanId, forestDeepId]
        : ev.areaKind === "yuran"
          ? [yuranId]
          : ev.areaKind === "hogokan"
            ? [hogokanId]
            : [forestDeepId];

    for (const areaId of areaIds) {
      await prisma.areaExplorationEvent.upsert({
        where: {
          areaId_explorationEventId: { areaId, explorationEventId: created.id },
        },
        create: {
          areaId,
          explorationEventId: created.id,
          weight: WEIGHT_DEFAULT,
        },
        update: { weight: WEIGHT_DEFAULT },
      });
    }
  }

  console.log(`錆びれた森林 技能イベント: ${ALL_EVENTS.length} 件を登録し、エリアに紐づけました。`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
