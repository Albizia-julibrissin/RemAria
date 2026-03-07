/**
 * テスト用サンプルデータ ＋ マスタ（タグ・設備・工業スキル）
 * 実行: npm run db:seed
 *
 * 投入されるテストユーザー（いずれもパスワード: password123）
 * - test1@example.com … テストユーザー1（主人公作成済み・物理型A）
 * - test2@example.com … テストユーザー2
 *
 * 主人公の基礎ステータス（物理型A）: docs/10_battle_status.csv 14行目
 * タグ・設備種別・工業スキル: docs/15_facility_tags_and_industrial_skills.md
 */
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { INITIAL_FACILITY_NAMES } from "../src/lib/constants/initial-area";

const prisma = new PrismaClient();

const TEST_USERS = [
  { email: "test1@example.com", accountId: "test_user_1", password: "password123", name: "テストユーザー1" },
  { email: "test2@example.com", accountId: "test_user_2", password: "password123", name: "テストユーザー2" },
] as const;

/**
 * テスト用：Lv50 時点の基礎ステータス（spec/048: 各ステ 10〜30%、合計=CAP）。
 * docs/09: Lv50 CAP=3,500。下限 10% = 350/ステ。自由分 30% を均等に振り 500/ステ。
 */
const LEVEL_50_BASE_STATS = {
  STR: 500,
  INT: 500,
  VIT: 500,
  WIS: 500,
  DEX: 500,
  AGI: 500,
  LUK: 500,
  CAP: 3500,
} as const;

/** docs/15: タグ一覧。code で参照、増減は将来調整可。 */
const TAGS = [
  { code: "water", name: "水" },
  { code: "food", name: "食糧" },
  { code: "life", name: "生活" },
  { code: "preserve", name: "保存" },
  { code: "steam", name: "蒸気" },
  { code: "ore", name: "鉱石" },
  { code: "fuel", name: "燃料" },
  { code: "smelt", name: "精錬" },
  { code: "metal", name: "金属" },
  { code: "craft", name: "製造" },
  { code: "machine", name: "機械" },
  { code: "magic", name: "魔術" },
  { code: "training", name: "訓練" },
  { code: "intellect", name: "知力" },
] as const;

/** docs/15, 018: 設備種別。名前はユニーク。先頭 5 件は INITIAL_FACILITY_NAMES と一致させる（spec/035 強制配置）。cost は初期エリア用（合計200）。 */
const FACILITY_TYPES = [
  { name: "川探索拠点", kind: "resource_exploration" as const, description: "川で水を探索・採取。output 水。", cost: 40 },
  { name: "浄水施設", kind: "industrial" as const, description: "水を input に飲用・工業用水を生成。output 飲料水。", cost: 40 },
  { name: "小麦畑", kind: "resource_exploration" as const, description: "小麦を栽培・採取。output 小麦。", cost: 40 },
  { name: "小麦製粉器", kind: "industrial" as const, description: "小麦を製粉。output 小麦粉。", cost: 40 },
  { name: "携帯食料包装", kind: "industrial" as const, description: "飲料水と小麦粉で携帯食料を生産。", cost: 40 },
  { name: "山探索拠点", kind: "resource_exploration" as const, description: "山で銅鉱石などを探索・採取。output 銅。" },
  { name: "貯水槽", kind: "industrial" as const, description: "浄水や雨水を貯留。" },
  { name: "蒸気凝縮器", kind: "industrial" as const, description: "蒸気機関の排気を凝縮して水回収。" },
  { name: "穀物貯蔵庫", kind: "industrial" as const, description: "麦・豆などの保管・乾燥。" },
  { name: "乾燥窯", kind: "industrial" as const, description: "肉・魚・野菜の燻製・乾燥。保存食の生産。" },
  { name: "調理場", kind: "industrial" as const, description: "食糧を加工し、携帯食やボイラー用の燃料補助。" },
  { name: "鉄鉱山", kind: "resource_exploration" as const, description: "鉄鉱石の採掘。output 鉄鉱石。" },
  { name: "石炭坑", kind: "resource_exploration" as const, description: "石炭の採掘。output 石炭。" },
  { name: "水晶採掘場", kind: "resource_exploration" as const, description: "魔術用の水晶・魔石を採掘。output 水晶。" },
  { name: "鉄精錬炉", kind: "industrial" as const, description: "鉄鉱石 → 純鉄。" },
  { name: "銅精錬炉", kind: "industrial" as const, description: "銅鉱石 → 銅地金。" },
  { name: "鍛冶場", kind: "industrial" as const, description: "純鉄等から武器・防具の下地を製造。" },
  { name: "メカ工房", kind: "industrial" as const, description: "メカパーツの組み立て・調整。" },
  { name: "調合室", kind: "industrial" as const, description: "魔術薬・強化剤などの調合。" },
  { name: "訓練所", kind: "training" as const, description: "筋力・体力など身体系の訓練。output なし、ステータス変動。" },
  { name: "読書室", kind: "training" as const, description: "知力・集中の訓練。output なし、ステータス変動。" },
] as const;

/** 設備種別名 → タグ code のリスト。docs/15 の表に準拠。 */
const FACILITY_TYPE_TAG_CODES: Record<string, readonly string[]> = {
  "川探索拠点": ["water"],
  "浄水施設": ["water", "life"],
  "小麦畑": ["food"],
  "小麦製粉器": ["food", "craft"],
  "携帯食料包装": ["food", "life"],
  "山探索拠点": ["ore"],
  "貯水槽": ["water"],
  "蒸気凝縮器": ["water", "steam"],
  "穀物貯蔵庫": ["food", "preserve"],
  "乾燥窯": ["food", "preserve"],
  "調理場": ["food", "life"],
  "鉄鉱山": ["ore"],
  "石炭坑": ["ore", "fuel"],
  "水晶採掘場": ["ore", "magic"],
  "鉄精錬炉": ["smelt", "metal"],
  "銅精錬炉": ["smelt", "metal"],
  "鍛冶場": ["craft", "metal"],
  "メカ工房": ["craft", "machine"],
  "調合室": ["craft", "magic"],
  "訓練所": ["training"],
  "読書室": ["training", "intellect"],
};

/** spec/035: 生産チェーン用アイテム（水・飲料水・小麦・小麦粉・携帯食料）。 */
/** spec/045: category で種別。既存はすべて material。 */
const ITEMS = [
  { code: "water", name: "水", category: "material" as const },
  { code: "drinkable_water", name: "飲料水", category: "material" as const },
  { code: "wheat", name: "小麦", category: "material" as const },
  { code: "flour", name: "小麦粉", category: "material" as const },
  { code: "portable_ration", name: "携帯食料", category: "material" as const },
  // 探索報酬用の素材・部品・設計図・遺物グループトークン（遺物本体は鑑定で別途生成）
  { code: "iron_equip_part", name: "鉄の装備部品", category: "material" as const },
  { code: "cloth_equip_part", name: "布の装備部品", category: "material" as const },
  { code: "blueprint_water_search_alpha", name: "水資源探索α型設計図", category: "blueprint" as const },
  { code: "relic_group_a_token", name: "遺物グループAの原石", category: "material" as const },
] as const;

/** spec/049: 探索用消耗品。HP/MP 割合回復・持ち込み上限2個。 */
const CONSUMABLE_ITEMS = [
  {
    code: "consumable_hp_10",
    name: "簡易HP回復薬",
    category: "consumable" as const,
    consumableEffect: { type: "hp_percent", value: 10 } as const,
    maxCarryPerExpedition: 2,
  },
  {
    code: "consumable_mp_10",
    name: "簡易MP回復薬",
    category: "consumable" as const,
    consumableEffect: { type: "mp_percent", value: 10 } as const,
    maxCarryPerExpedition: 2,
  },
] as const;

/** spec/051: 遺物型マスタ。groupCode は鑑定トークン（relic_group_a_token → group_a）と対応。 */
const RELIC_TYPES = [
  { code: "relic_series_a", name: "古い紋章", groupCode: "group_a" },
] as const;

/** spec/051: 遺物用パッシブ効果マスタ。MVP では表示用。 */
const RELIC_PASSIVE_EFFECTS = [
  { code: "none", name: "なし", description: "特になし" },
  { code: "patk_up_5", name: "物理の輝き", description: "物理攻撃力+5%" },
  { code: "matk_up_5", name: "魔法の輝き", description: "魔法攻撃力+5%" },
] as const;

/** spec/030, docs/15: 工業スキル 5 種。対象タグの設備に配備時のみ効果。 */
const INDUSTRIAL_SKILLS = [
  { name: "水の心得", description: "水に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "water", effectType: "time_reduction" as const, effectValue: 5 },
  { name: "水質管理", description: "水に関わる工業設備に配備時、生産量が3%アップ。", targetTagCode: "water", effectType: "production_bonus" as const, effectValue: 3 },
  { name: "採掘の勘", description: "鉱石に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "ore", effectType: "time_reduction" as const, effectValue: 5 },
  { name: "精錬の手慣れ", description: "精錬に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "smelt", effectType: "time_reduction" as const, effectValue: 5 },
  { name: "鍛冶の才", description: "金属に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "metal", effectType: "time_reduction" as const, effectValue: 5 },
] as const;

/** docs/020, spec/049: 探索テーマ・エリア（MVP 用）。 */
const EXPLORATION_THEMES = [
  {
    code: "rust_forest",
    name: "錆びれた森林地区",
    description: "過去に環境保護区だった森林地帯。今は錆と霧が漂う探索エリア。",
    displayOrder: 1,
  },
] as const;

const EXPLORATION_AREAS = [
  {
    themeCode: "rust_forest",
    code: "yuran_paved_road",
    name: "遊覧舗装路跡",
    description: "かつて観光用の遊覧路だった舗装路。今はひび割れと苔むした石畳が続く。",
    difficultyRank: 1,
    recommendedLevel: 1,
    baseDropMin: 3,
    baseDropMax: 5,
    baseSkillEventRate: 10, // 資源多め・技能イベント少なめエリア
    normalBattleCount: 5,
    normalEnemyGroupCode: "rust_forest_easy_normal",
    strongEnemyEnemyGroupCode: "rust_forest_easy_mid_boss",
    areaLordEnemyGroupCode: "rust_forest_easy_last_boss",
  },
  // 後続エリア（監視設備廃墟・森林奥地）は拡張時に追加
] as const;

/** docs/14_initial_skills.csv: 初期スキル 25 種（物理10・魔法10・補助5）。既存プロポーザル30種は廃止。 */
const BATTLE_SKILLS: Array<{
  name: string;
  battleSkillType: string;
  mpCostCapCoef: number;
  mpCostFlat: number;
  chargeCycles: number;
  cooldownCycles: number;
  powerMultiplier: number | null;
  hitsMin: number;
  hitsMax: number;
  resampleTargetPerHit: boolean;
  targetScope: string;
  attribute: string;
  weightAddFront: number;
  weightAddMid: number;
  weightAddBack: number;
  /** 日本語説明（docs/14_初期スキル の「説明」列と同内容） */
  description?: string;
  /** 表示用タグ（作戦室スキル一覧・ツールチップ用）。docs/14_initial_skills.csv の display_tags に対応。 */
  displayTags?: string[];
  logMessage?: string;
  logMessageOnCondition?: string;
}> = [
  {
    name: "虎挟ミ",
    battleSkillType: "physical",
    mpCostCapCoef: 0.03,
    mpCostFlat: 10,
    chargeCycles: 0,
    cooldownCycles: 0,
    powerMultiplier: 1.2,
    hitsMin: 2,
    hitsMax: 2,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "crush",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "単体に2回攻撃",
    displayTags: ["#敵単体", "#複数回集中攻撃", "#圧縮属性"],
    logMessage: "一瞬のうちに挟撃が放たれる…！",
  },
  {
    name: "強行突破",
    battleSkillType: "physical",
    mpCostCapCoef: 0.05,
    mpCostFlat: 20,
    chargeCycles: 0,
    cooldownCycles: 0,
    powerMultiplier: 2.0,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "crush",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 2.0,
    description: "後列の敵を狙って攻撃する。後列の敵に命中時、全体に追加ダメージが発生する。",
    displayTags: ["#敵単体", "#後列優先", "#単発攻撃", "#ヒット時全体追撃", "#圧縮属性"],
    logMessage: "進む道全ての敵を蹴散らして吶喊する…！",
    logMessageOnCondition: "後列の敵に当たった際、ダメージの半分を敵全体に追加で与える。",
  },
  {
    name: "閃槍",
    battleSkillType: "physical",
    mpCostCapCoef: 0.03,
    mpCostFlat: 7,
    chargeCycles: 0,
    cooldownCycles: 0,
    powerMultiplier: 1.8,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "pierce",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "単体に1回攻撃。命中した対象が圧縮状態だった場合、ダメージが増加する。",
    displayTags: ["#敵単体", "#単発攻撃", "#圧縮特攻", "#穿孔属性"],
    logMessage: "鋭い一撃が空ごと敵を突き抜ける…！",
    logMessageOnCondition: "放たれた一撃はその脆弱を許さない!",
  },
  {
    name: "襲双連斬",
    battleSkillType: "physical",
    mpCostCapCoef: 0.1,
    mpCostFlat: 30,
    chargeCycles: 0,
    cooldownCycles: 1,
    powerMultiplier: 0.6,
    hitsMin: 3,
    hitsMax: 5,
    resampleTargetPerHit: true,
    targetScope: "enemy_single",
    attribute: "slash",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "敵全体にランダムに3～5回攻撃。",
    displayTags: ["#ランダム攻撃", "#複数回攻撃", "#切創属性"],
    logMessage: "敵陣を駆け巡る乱撃…！",
  },
  {
    name: "宵闇ノ奈落",
    battleSkillType: "physical",
    mpCostCapCoef: 0.05,
    mpCostFlat: 10,
    chargeCycles: 1,
    cooldownCycles: 1,
    powerMultiplier: 4.0,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "pierce",
    weightAddFront: 0,
    weightAddMid: 1.0,
    weightAddBack: 1.5,
    description: "中～後列を狙って攻撃する。命中した対象が焼損状態だった場合、直撃する。",
    displayTags: ["#敵単体", "#中後列優先", "#単発攻撃", "#溜めスキル", "#焼損特攻", "#直撃確定", "#穿孔属性"],
    logMessage: "闇に紛れ、ひと際大きな影が奈落のように佇む…",
    logMessageOnCondition: "奈落の底に落ちていく…！",
  },
  {
    name: "血ノ嘆キ",
    battleSkillType: "physical",
    mpCostCapCoef: 0.07,
    mpCostFlat: 15,
    chargeCycles: 1,
    cooldownCycles: 1,
    powerMultiplier: 1.5,
    hitsMin: 3,
    hitsMax: 3,
    resampleTargetPerHit: true,
    targetScope: "enemy_single",
    attribute: "slash",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "敵全体にランダムに複数回攻撃。命中した対象が切創だった場合、出血の状態異常を与える。",
    displayTags: ["#敵単体", "#複数回攻撃", "#溜めスキル", "#切創属性", "#出血"],
    logMessage: "通りすがりに真新しい血を啜る…。",
    logMessageOnCondition: "血の流れは勢いを増す…！",
  },
  {
    name: "掌底撃",
    battleSkillType: "physical",
    mpCostCapCoef: 0.04,
    mpCostFlat: 12,
    chargeCycles: 0,
    cooldownCycles: 0,
    powerMultiplier: 2.2,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "crush",
    weightAddFront: 1.5,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "前列の敵を狙って攻撃する。単体に1回攻撃。確率で敵を1列後ろに移動させる。",
    displayTags: ["#敵単体", "#前列優先", "#単発攻撃", "#列後退", "#圧縮属性"],
    logMessage: "気を込めた武術の一撃…！",
  },
  {
    name: "旋回斬",
    battleSkillType: "physical",
    mpCostCapCoef: 0.1,
    mpCostFlat: 25,
    chargeCycles: 1,
    cooldownCycles: 2,
    powerMultiplier: 1.4,
    hitsMin: 2,
    hitsMax: 4,
    resampleTargetPerHit: false,
    targetScope: "enemy_all",
    attribute: "slash",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "前列と中列の敵に2-3回の全体攻撃を行う。",
    displayTags: ["#敵全体", "#前中列全体攻撃", "#複数回攻撃", "#溜めスキル", "#切創属性"],
    logMessage: "嵐のごとく巻き込む斬撃…！",
  },
  {
    name: "連装射弓",
    battleSkillType: "physical",
    mpCostCapCoef: 0.15,
    mpCostFlat: 30,
    chargeCycles: 2,
    cooldownCycles: 1,
    powerMultiplier: 1.5,
    hitsMin: 4,
    hitsMax: 7,
    resampleTargetPerHit: true,
    targetScope: "enemy_single",
    attribute: "pierce",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "敵全体にランダムに4～7回攻撃。命中した対象が凍傷状態の場合、ダメージが増加する。",
    displayTags: ["#ランダム攻撃", "#複数回攻撃", "#溜めスキル", "#凍傷特攻", "#穿孔属性"],
    logMessage: "乱れ撃つ矢の豪雨…。",
    logMessageOnCondition: "そのどれもが必殺級の一射…！",
  },
  {
    name: "前進突撃",
    battleSkillType: "physical",
    mpCostCapCoef: 0.07,
    mpCostFlat: 14,
    chargeCycles: 0,
    cooldownCycles: 2,
    powerMultiplier: 2.2,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "slash",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "単体に1回攻撃。自身を1列前進する。",
    displayTags: ["#敵単体", "#単発攻撃", "#自列前進", "#位置取り", "#切創属性"],
    logMessage: "先陣を切る覚悟の突撃…！",
  },
  {
    name: "ファイアボルト",
    battleSkillType: "magic",
    mpCostCapCoef: 0.1,
    mpCostFlat: 30,
    chargeCycles: 0,
    cooldownCycles: 1,
    powerMultiplier: 2.4,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "burn",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "単体に1回攻撃。",
    displayTags: ["#敵単体", "#単発攻撃", "#焼損属性"],
    logMessage: "燃え盛る火球が雷を纏い飛翔する…！",
  },
  {
    name: "アイススパイク",
    battleSkillType: "magic",
    mpCostCapCoef: 0.12,
    mpCostFlat: 25,
    chargeCycles: 0,
    cooldownCycles: 1,
    powerMultiplier: 1.4,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_all",
    attribute: "freeze",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "前列に全体攻撃。",
    displayTags: ["#敵全体", "#前列全体攻撃", "#単発攻撃", "#凍傷属性"],
    logMessage: "進軍をせき止める氷の罠…！",
  },
  {
    name: "ライトニングストーム",
    battleSkillType: "magic",
    mpCostCapCoef: 0.2,
    mpCostFlat: 40,
    chargeCycles: 1,
    cooldownCycles: 1,
    powerMultiplier: 1.5,
    hitsMin: 3,
    hitsMax: 3,
    resampleTargetPerHit: true,
    targetScope: "enemy_single",
    attribute: "burn",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "敵全体にランダムに3回攻撃。命中した対象が焼損状態だった場合、麻痺の状態異常を与える。",
    displayTags: ["#ランダム攻撃", "#複数回攻撃", "#溜めスキル", "#焼損特攻", "#麻痺", "#焼損属性"],
    logMessage: "焦がしつくす雷撃の嵐…。",
    logMessageOnCondition: "その雷撃は獲物を鈍らせる…！",
  },
  {
    name: "ウィンドブラスト",
    battleSkillType: "magic",
    mpCostCapCoef: 0.15,
    mpCostFlat: 30,
    chargeCycles: 1,
    cooldownCycles: 1,
    powerMultiplier: 2.4,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_all",
    attribute: "slash",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "中列と後列の敵に全体攻撃。",
    displayTags: ["#敵全体", "#中後列全体攻撃", "#単発攻撃", "#切創属性"],
    logMessage: "圧縮大気の爆発、風の刃となりて切り刻む…！",
  },
  {
    name: "クエイクバースト",
    battleSkillType: "magic",
    mpCostCapCoef: 0.2,
    mpCostFlat: 40,
    chargeCycles: 2,
    cooldownCycles: 1,
    powerMultiplier: 4.8,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "crush",
    weightAddFront: 0,
    weightAddMid: 1.5,
    weightAddBack: 0,
    description: "中列の敵を狙って攻撃する。中列の敵に命中時、全体に追加ダメージが発生する。",
    displayTags: ["#敵単体", "#中列優先", "#単発攻撃", "#溜めスキル", "#ヒット時全体追撃", "#圧縮属性"],
    logMessage: "瓦礫を飲み込んだ土塊が破裂する…！",
  },
  {
    name: "カースドブレス",
    battleSkillType: "magic",
    mpCostCapCoef: 0.1,
    mpCostFlat: 30,
    chargeCycles: 0,
    cooldownCycles: 2,
    powerMultiplier: 1.0,
    hitsMin: 1,
    hitsMax: 3,
    resampleTargetPerHit: true,
    targetScope: "enemy_single",
    attribute: "corrode",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "敵全体にランダムに1～3回攻撃。",
    displayTags: ["#ランダム攻撃", "#複数回攻撃", "#侵食属性"],
    logMessage: "闇の霧が戦場を飲み込み、生命を蝕む…！",
  },
  {
    name: "メテオスォーム",
    battleSkillType: "magic",
    mpCostCapCoef: 0.3,
    mpCostFlat: 100,
    chargeCycles: 2,
    cooldownCycles: 2,
    powerMultiplier: 1.8,
    hitsMin: 3,
    hitsMax: 5,
    resampleTargetPerHit: true,
    targetScope: "enemy_single",
    attribute: "burn",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "敵全体にランダムに3～5回攻撃。命中した敵が焼損状態だった場合、相手に確率で燃焼の状態異常を付与する。",
    displayTags: ["#ランダム攻撃", "#複数回攻撃", "#溜めスキル", "#焼損特攻", "#燃焼", "#焼損属性"],
    logMessage: "灼熱の隕石が戦場に降り注ぐ…。",
    logMessageOnCondition: "戦場のすべてが劫火に呑まれる…！",
  },
  {
    name: "ホーリーランス",
    battleSkillType: "magic",
    mpCostCapCoef: 0.1,
    mpCostFlat: 50,
    chargeCycles: 0,
    cooldownCycles: 3,
    powerMultiplier: 1.1,
    hitsMin: 3,
    hitsMax: 3,
    resampleTargetPerHit: true,
    targetScope: "enemy_single",
    attribute: "pierce",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "敵全体にランダムに3回攻撃。",
    displayTags: ["#ランダム攻撃", "#複数回攻撃", "#穿孔属性"],
    logMessage: "光の槍が瞬時に大地を穿つ…！",
  },
  {
    name: "エンドオブモーゼ",
    battleSkillType: "magic",
    mpCostCapCoef: 0.3,
    mpCostFlat: 100,
    chargeCycles: 2,
    cooldownCycles: 2,
    powerMultiplier: 3.3,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_all",
    attribute: "corrode",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "前列と後列の敵に全体攻撃。命中した敵を確率で中列に強制移動する。",
    displayTags: ["#敵全体", "#前後列全体攻撃", "#単発攻撃", "#溜めスキル", "#列強制移動", "#侵食属性"],
    logMessage: "大海を割る波が逃げ場を奪う…！",
  },
  {
    name: "ポイズンホール",
    battleSkillType: "magic",
    mpCostCapCoef: 0.2,
    mpCostFlat: 60,
    chargeCycles: 1,
    cooldownCycles: 3,
    powerMultiplier: 0.5,
    hitsMin: 1,
    hitsMax: 5,
    resampleTargetPerHit: true,
    targetScope: "enemy_single",
    attribute: "corrode",
    weightAddFront: 0,
    weightAddMid: 0.5,
    weightAddBack: 1.0,
    description: "列のターゲット割合を無視し、ランダムに1～5回攻撃。命中した敵が侵食状態だった場合、毒の状態異常を付与する。",
    displayTags: ["#ランダム攻撃", "#複数回攻撃", "#溜めスキル", "#侵食特攻", "#毒", "#侵食属性"],
    logMessage: "底無しの毒沼が戦場を支配する…。",
    logMessageOnCondition: "気づけば足元に…！",
  },
  {
    name: "癒しの光",
    battleSkillType: "support",
    mpCostCapCoef: 0.06,
    mpCostFlat: 15,
    chargeCycles: 0,
    cooldownCycles: 1,
    powerMultiplier: 1.0,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "ally_all",
    attribute: "none",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "味方全体を回復する。",
    displayTags: ["#味方全体", "#回復"],
    logMessage: "あたたかな光のベールが味方を覆う…。",
  },
  {
    name: "感覚深化",
    battleSkillType: "support",
    mpCostCapCoef: 0.05,
    mpCostFlat: 20,
    chargeCycles: 0,
    cooldownCycles: 0,
    powerMultiplier: null,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "self",
    attribute: "none",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "自身の命中力と物理の攻撃力を7サイクル上昇させる。",
    displayTags: ["#自分強化", "#命中強化", "#物攻強化", "#長時間バフ"],
    logMessage: "戦場に気を張り巡らせる…。",
  },
  {
    name: "浄化の祈り",
    battleSkillType: "support",
    mpCostCapCoef: 0.03,
    mpCostFlat: 10,
    chargeCycles: 0,
    cooldownCycles: 1,
    powerMultiplier: 1.5,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "ally_single",
    attribute: "none",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "HP割合が低い味方1人を回復する。確率で状態を全て解消する。",
    displayTags: ["#味方単体", "#回復", "#HP割合優先", "#属性状態解除チャンス"],
    logMessage: "祈りの力がその者を浄化する…。",
  },
  {
    name: "砦の構え",
    battleSkillType: "support",
    mpCostCapCoef: 0.03,
    mpCostFlat: 15,
    chargeCycles: 0,
    cooldownCycles: 0,
    powerMultiplier: null,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "ally_all",
    attribute: "none",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "味方全体の物理と魔法の防御力を2サイクル上昇する。",
    displayTags: ["#味方全体", "#物防強化", "#魔防強化", "#短時間バフ"],
    logMessage: "兵を守る砦の構え…！",
  },
  {
    name: "萎縮の呪い",
    battleSkillType: "support",
    mpCostCapCoef: 0.04,
    mpCostFlat: 20,
    chargeCycles: 0,
    cooldownCycles: 1,
    powerMultiplier: 0,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_all",
    attribute: "none",
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    description: "敵全体の物理攻撃力を1サイクル減少させる。",
    displayTags: ["#敵全体", "#物攻デバフ", "#短時間デバフ"],
  },
];

/** docs/14_initial_skills.csv: スキル名 → SkillEffect（effectType + param）。戦闘解決時に参照。 */
const BATTLE_SKILL_EFFECTS: Record<string, Array<{ effectType: string; param: object }>> = {
  "強行突破": [{ effectType: "column_splash", param: { whenTargetCol: 3, pctOfDealtDamage: 0.5 } }],
  "閃槍": [{ effectType: "attr_state_trigger_damage", param: { triggerAttr: "crush", damageMultiplier: 1.7, consumeAttr: true } }],
  "宵闇ノ奈落": [{ effectType: "attr_state_force_direct", param: { triggerAttr: "burn", fatalAsNormal: true } }],
  "血ノ嘆キ": [{ effectType: "attr_state_trigger_debuff", param: { triggerAttr: "slash", debuffCode: "bleeding", durationCycles: 1, includeCurrent: true } }],
  "掌底撃": [{ effectType: "move_target_column", param: { direction: "back", steps: 1, chance: 0.2 } }],
  "旋回斬": [{ effectType: "damage_target_columns", param: { targetColumns: [1, 2] } }],
  "連装射弓": [{ effectType: "attr_state_trigger_damage", param: { triggerAttr: "freeze", damageMultiplier: 1.1, consumeAttr: true } }],
  "前進突撃": [{ effectType: "move_self_column", param: { direction: "forward", steps: 1 } }],
  "アイススパイク": [{ effectType: "damage_target_columns", param: { targetColumns: [1] } }],
  "ライトニングストーム": [{ effectType: "attr_state_trigger_debuff", param: { triggerAttr: "burn", debuffCode: "paralysis", durationCycles: 1, includeCurrent: true } }],
  "ウィンドブラスト": [{ effectType: "damage_target_columns", param: { targetColumns: [2, 3] } }],
  "クエイクバースト": [{ effectType: "column_splash", param: { whenTargetCol: 2, pctOfDealtDamage: 0.5 } }],
  "メテオスォーム": [
    {
      effectType: "attr_state_chance_debuff",
      param: { triggerAttr: "burn", chance: 0.5, debuffCode: "burning", durationCycles: 2, includeCurrent: true, recordDamagePct: 0.2 },
    },
  ],
  "エンドオブモーゼ": [
    { effectType: "damage_target_columns", param: { targetColumns: [1, 3] } },
    { effectType: "move_target_column", param: { toColumn: 2, chance: 0.5 } },
  ],
  "ポイズンホール": [
    { effectType: "target_select_equal_weight", param: {} },
    { effectType: "attr_state_trigger_debuff", param: { triggerAttr: "corrode", debuffCode: "poison", durationCycles: 7, includeCurrent: true } },
  ],
  "癒しの光": [{ effectType: "heal_all", param: { scale: "MATK*1.0", randMin: 0.8, randMax: 1.0 } }],
  "感覚深化": [
    { effectType: "ally_buff", param: { target: "self", stat: "HIT", pct: 0.2, durationCycles: 7, includeCurrent: true } },
    { effectType: "ally_buff", param: { target: "self", stat: "PATK", pct: 0.15, durationCycles: 7, includeCurrent: true } },
  ],
  "浄化の祈り": [
    { effectType: "heal_single", param: { scale: "MATK*1.5", targetSelection: "lowest_hp_percent" } },
    { effectType: "dispel_attr_states", param: { chance: 0.5 } },
  ],
  "砦の構え": [
    { effectType: "ally_buff", param: { target: "ally_all", stat: "PDEF", pct: 0.5, durationCycles: 2, includeCurrent: true } },
    { effectType: "ally_buff", param: { target: "ally_all", stat: "MDEF", pct: 0.25, durationCycles: 2, includeCurrent: true } },
  ],
  "萎縮の呪い": [
    {
      effectType: "apply_debuff",
      param: { debuffCode: "wither", statMult: { PATK: 0.4 }, durationCycles: 1, includeCurrent: true, targetScope: "enemy_all" },
    },
  ],
};

/** spec/044, docs/024: メカ専用スキル（おんぼろシリーズ用）。category=mecha */
const MECHA_SKILLS: Array<{
  name: string;
  battleSkillType: string;
  mpCostCapCoef: number;
  mpCostFlat: number;
  chargeCycles: number;
  cooldownCycles: number;
  powerMultiplier: number | null;
  hitsMin: number;
  hitsMax: number;
  resampleTargetPerHit: boolean;
  targetScope: string;
  attribute: string;
  description?: string;
  logMessage?: string;
}> = [
  {
    name: "限界駆動",
    battleSkillType: "support",
    mpCostCapCoef: 0.08,
    mpCostFlat: 25,
    chargeCycles: 0,
    cooldownCycles: 2,
    powerMultiplier: null,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "self",
    attribute: "none",
    description: "全能力が10ターンの間、1.2倍になる。",
    logMessage: "限界まで駆動し、全能力が一時的に上昇する…！",
  },
  {
    name: "ソードストライク",
    battleSkillType: "physical",
    mpCostCapCoef: 0.04,
    mpCostFlat: 12,
    chargeCycles: 0,
    cooldownCycles: 1,
    powerMultiplier: 2.2,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "slash",
    description: "単体に1回攻撃。切創属性。",
    logMessage: "ソードアームが一閃する…！",
  },
  {
    name: "掃射",
    battleSkillType: "physical",
    mpCostCapCoef: 0.1,
    mpCostFlat: 30,
    chargeCycles: 1,
    cooldownCycles: 3,
    powerMultiplier: 2.2,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_all",
    attribute: "pierce",
    description: "敵全体に1回攻撃。穿孔属性。",
    logMessage: "銃口から弾幕が敵全体を覆う…！",
  },
  {
    name: "タックル",
    battleSkillType: "physical",
    mpCostCapCoef: 0.02,
    mpCostFlat: 5,
    chargeCycles: 0,
    cooldownCycles: 0,
    powerMultiplier: 1.2,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "crush",
    description: "単体に1回攻撃。圧縮属性。",
    logMessage: "レッグスで体当たりする…！",
  },
  {
    name: "排熱スチーム",
    battleSkillType: "support",
    mpCostCapCoef: 0.03,
    mpCostFlat: 10,
    chargeCycles: 0,
    cooldownCycles: 1,
    powerMultiplier: null,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "none",
    description: "相手の命中力を3ターン20％ダウン。",
    logMessage: "排熱スチームが相手の視界を奪う…！",
  },
];

/** メカスキル名 → SkillEffect（effectType + param） */
const MECHA_SKILL_EFFECTS: Record<string, Array<{ effectType: string; param: object }>> = {
  "限界駆動": [
    { effectType: "ally_buff", param: { target: "self", stat: "PATK", pct: 0.2, durationCycles: 10, includeCurrent: true } },
    { effectType: "ally_buff", param: { target: "self", stat: "MATK", pct: 0.2, durationCycles: 10, includeCurrent: true } },
    { effectType: "ally_buff", param: { target: "self", stat: "PDEF", pct: 0.2, durationCycles: 10, includeCurrent: true } },
    { effectType: "ally_buff", param: { target: "self", stat: "MDEF", pct: 0.2, durationCycles: 10, includeCurrent: true } },
    { effectType: "ally_buff", param: { target: "self", stat: "HIT", pct: 0.2, durationCycles: 10, includeCurrent: true } },
    { effectType: "ally_buff", param: { target: "self", stat: "EVA", pct: 0.2, durationCycles: 10, includeCurrent: true } },
  ],
  "排熱スチーム": [
    {
      effectType: "apply_debuff",
      param: { debuffCode: "accuracy_down", statMult: { HIT: 0.8 }, durationCycles: 3, includeCurrent: true },
    },
  ],
};

/** おんぼろシリーズ：全装備で基礎ステオール60になるようフラット加算を配分。フレームは倍率のみ。 */
const ONBORO_PART_TYPES: Array<{
  slot: string;
  name: string;
  statRates?: Record<string, number>;
  strAdd?: number;
  intAdd?: number;
  vitAdd?: number;
  wisAdd?: number;
  dexAdd?: number;
  agiAdd?: number;
  lukAdd?: number;
  capAdd?: number;
  skillName: string;
}> = [
  { slot: "frame", name: "おんぼろフレーム", statRates: { STR: 1.2, VIT: 0.9, AGI: 0.9 }, skillName: "" },
  {
    slot: "core",
    name: "おんぼろコア",
    strAdd: 8,
    intAdd: 10,
    vitAdd: 12,
    wisAdd: 10,
    dexAdd: 10,
    agiAdd: 12,
    lukAdd: 10,
    capAdd: 10,
    skillName: "限界駆動",
  },
  {
    slot: "head",
    name: "おんぼろヘッド",
    strAdd: 8,
    intAdd: 10,
    vitAdd: 11,
    wisAdd: 10,
    dexAdd: 10,
    agiAdd: 11,
    lukAdd: 10,
    capAdd: 10,
    skillName: "排熱スチーム",
  },
  {
    slot: "rightArm",
    name: "おんぼろソードアーム",
    strAdd: 8,
    intAdd: 10,
    vitAdd: 11,
    wisAdd: 10,
    dexAdd: 10,
    agiAdd: 11,
    lukAdd: 10,
    capAdd: 10,
    skillName: "ソードストライク",
  },
  {
    slot: "leftArm",
    name: "おんぼろガンアーム",
    strAdd: 8,
    intAdd: 10,
    vitAdd: 11,
    wisAdd: 10,
    dexAdd: 10,
    agiAdd: 11,
    lukAdd: 10,
    capAdd: 10,
    skillName: "掃射",
  },
  {
    slot: "legs",
    name: "おんぼろレッグス",
    strAdd: 8,
    intAdd: 10,
    vitAdd: 12,
    wisAdd: 10,
    dexAdd: 10,
    agiAdd: 12,
    lukAdd: 10,
    capAdd: 10,
    skillName: "タックル",
  },
];

async function seedTags() {
  for (const t of TAGS) {
    await prisma.tag.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name },
      update: { name: t.name },
    });
  }
  console.log(`Tags: ${TAGS.length} 件 upsert`);
}

async function seedFacilityTypes() {
  for (const f of FACILITY_TYPES) {
    const cost = "cost" in f ? f.cost : 40;
    await prisma.facilityType.upsert({
      where: { name: f.name },
      create: { name: f.name, kind: f.kind, description: f.description ?? undefined, cost },
      update: { kind: f.kind, description: f.description ?? undefined, cost },
    });
  }
  console.log(`FacilityTypes: ${FACILITY_TYPES.length} 件 upsert`);
}

async function seedFacilityTypeTags() {
  const tagByCode = new Map<string, string>();
  for (const t of await prisma.tag.findMany({ select: { id: true, code: true } })) {
    tagByCode.set(t.code, t.id);
  }
  const facilityByName = new Map<string, string>();
  for (const f of await prisma.facilityType.findMany({ select: { id: true, name: true } })) {
    facilityByName.set(f.name, f.id);
  }
  let count = 0;
  for (const [facilityName, tagCodes] of Object.entries(FACILITY_TYPE_TAG_CODES)) {
    const facilityTypeId = facilityByName.get(facilityName);
    if (!facilityTypeId) continue;
    for (const code of tagCodes) {
      const tagId = tagByCode.get(code);
      if (!tagId) continue;
      await prisma.facilityTypeTag.upsert({
        where: {
          facilityTypeId_tagId: { facilityTypeId, tagId },
        },
        create: { facilityTypeId, tagId },
        update: {},
      });
      count++;
    }
  }
  console.log(`FacilityTypeTags: ${count} 件 upsert`);
}

async function seedIndustrialSkills() {
  const tagByCode = new Map<string, string>();
  for (const t of await prisma.tag.findMany({ select: { id: true, code: true } })) {
    tagByCode.set(t.code, t.id);
  }
  for (const s of INDUSTRIAL_SKILLS) {
    const targetTagId = tagByCode.get(s.targetTagCode) ?? null;
    await prisma.skill.upsert({
      where: {
        name_category: { name: s.name, category: "industrial" },
      },
      create: {
        name: s.name,
        category: "industrial",
        description: s.description,
        effectType: s.effectType,
        effectValue: s.effectValue,
        targetTagId,
      },
      update: {
        description: s.description,
        effectType: s.effectType,
        effectValue: s.effectValue,
        targetTagId,
      },
    });
  }
  console.log(`Industrial skills: ${INDUSTRIAL_SKILLS.length} 件 upsert`);
}

/** docs/14_initial_skills.csv: 既存の battle_active を削除し、初期スキル 25 種のみ登録。 */
async function seedBattleSkills() {
  const deleted = await prisma.skill.deleteMany({
    where: { category: "battle_active" },
  });
  console.log(`Battle skills: 旧 ${deleted.count} 件を削除`);

  let effectCount = 0;
  for (const s of BATTLE_SKILLS) {
    const skill = await prisma.skill.create({
      data: {
        name: s.name,
        category: "battle_active",
        description: s.description ?? null,
        battleSkillType: s.battleSkillType,
        mpCostCapCoef: s.mpCostCapCoef,
        mpCostFlat: s.mpCostFlat,
        chargeCycles: s.chargeCycles,
        cooldownCycles: s.cooldownCycles,
        powerMultiplier: s.powerMultiplier,
        hitsMin: s.hitsMin,
        hitsMax: s.hitsMax,
        resampleTargetPerHit: s.resampleTargetPerHit,
        targetScope: s.targetScope,
        attribute: s.attribute,
        weightAddFront: s.weightAddFront,
        weightAddMid: s.weightAddMid,
        weightAddBack: s.weightAddBack,
        logMessage: s.logMessage ?? null,
        logMessageOnCondition: s.logMessageOnCondition ?? null,
        displayTags: (s.displayTags ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    const effects = BATTLE_SKILL_EFFECTS[s.name];
    if (effects?.length) {
      for (const e of effects) {
        await prisma.skillEffect.create({
          data: { skillId: skill.id, effectType: e.effectType, param: e.param as object },
        });
        effectCount++;
      }
    }
  }
  console.log(`Battle skills: 新規 ${BATTLE_SKILLS.length} 件作成, SkillEffect: ${effectCount} 件`);
}

/** spec/044: メカ専用スキルを登録（category=mecha）。 */
async function seedMechaSkills() {
  let effectCount = 0;
  for (const s of MECHA_SKILLS) {
    const skill = await prisma.skill.upsert({
      where: { name_category: { name: s.name, category: "mecha" } },
      create: {
        name: s.name,
        category: "mecha",
        description: s.description ?? null,
        battleSkillType: s.battleSkillType,
        mpCostCapCoef: s.mpCostCapCoef,
        mpCostFlat: s.mpCostFlat,
        chargeCycles: s.chargeCycles,
        cooldownCycles: s.cooldownCycles,
        powerMultiplier: s.powerMultiplier,
        hitsMin: s.hitsMin,
        hitsMax: s.hitsMax,
        resampleTargetPerHit: s.resampleTargetPerHit,
        targetScope: s.targetScope,
        attribute: s.attribute,
        logMessage: s.logMessage ?? null,
      },
      update: {
        description: s.description ?? null,
        battleSkillType: s.battleSkillType,
        mpCostCapCoef: s.mpCostCapCoef,
        mpCostFlat: s.mpCostFlat,
        chargeCycles: s.chargeCycles,
        cooldownCycles: s.cooldownCycles,
        powerMultiplier: s.powerMultiplier,
        hitsMin: s.hitsMin,
        hitsMax: s.hitsMax,
        resampleTargetPerHit: s.resampleTargetPerHit,
        targetScope: s.targetScope,
        attribute: s.attribute,
        logMessage: s.logMessage ?? null,
      },
    });

    const effects = MECHA_SKILL_EFFECTS[s.name];
    if (effects?.length) {
      await prisma.skillEffect.deleteMany({ where: { skillId: skill.id } });
      for (const e of effects) {
        await prisma.skillEffect.create({
          data: { skillId: skill.id, effectType: e.effectType, param: e.param as object },
        });
        effectCount++;
      }
    }
  }
  console.log(`Mecha skills: ${MECHA_SKILLS.length} 件 upsert, SkillEffect: ${effectCount} 件`);
}

/** docs/053: おんぼろシリーズ用のステ生成設定（基礎ステ CAP 40〜60、7種均等寄り）。 */
const ONBORO_STAT_GEN_CONFIG = {
  capMin: 40,
  capMax: 60,
  weights: [
    { key: "STR", weightMin: 1, weightMax: 3 },
    { key: "INT", weightMin: 1, weightMax: 3 },
    { key: "VIT", weightMin: 1, weightMax: 3 },
    { key: "WIS", weightMin: 1, weightMax: 3 },
    { key: "DEX", weightMin: 1, weightMax: 3 },
    { key: "AGI", weightMin: 1, weightMax: 3 },
    { key: "LUK", weightMin: 1, weightMax: 3 },
  ],
} as const;

/** spec/044, docs/053: おんぼろシリーズの MechaPartType と MechaPartTypeSkill を登録。statGenConfig をマスタに持つ。 */
async function seedOnboroPartTypes() {
  const skillByName = new Map<string, string>();
  for (const s of await prisma.skill.findMany({ where: { category: "mecha" }, select: { id: true, name: true } })) {
    skillByName.set(s.name, s.id);
  }

  for (const p of ONBORO_PART_TYPES) {
    const existing = await prisma.mechaPartType.findFirst({
      where: { name: p.name, slot: p.slot },
      select: { id: true },
    });

    const data = {
      slot: p.slot,
      name: p.name,
      statRates: (p.statRates ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      statGenConfig: ONBORO_STAT_GEN_CONFIG as unknown as Prisma.InputJsonValue,
      strAdd: p.strAdd ?? 0,
      intAdd: p.intAdd ?? 0,
      vitAdd: p.vitAdd ?? 0,
      wisAdd: p.wisAdd ?? 0,
      dexAdd: p.dexAdd ?? 0,
      agiAdd: p.agiAdd ?? 0,
      lukAdd: p.lukAdd ?? 0,
      capAdd: p.capAdd ?? 0,
    };

    let partTypeId: string;
    if (existing) {
      await prisma.mechaPartType.update({ where: { id: existing.id }, data });
      partTypeId = existing.id;
      await prisma.mechaPartTypeSkill.deleteMany({ where: { mechaPartTypeId: existing.id } });
    } else {
      const created = await prisma.mechaPartType.create({ data, select: { id: true } });
      partTypeId = created.id;
    }

    if (p.skillName) {
      const skillId = skillByName.get(p.skillName);
      if (skillId) {
        await prisma.mechaPartTypeSkill.create({
          data: { mechaPartTypeId: partTypeId, skillId, orderIndex: 0 },
        });
      }
    }
  }
  console.log(`Onboro part types: ${ONBORO_PART_TYPES.length} 件 upsert`);
}

/** spec/038: テスト主人公が戦闘スキルを全習得しているようにする。 */
async function ensureProtagonistHasAllBattleSkills(characterId: string) {
  const battleSkills = await prisma.skill.findMany({
    where: { category: "battle_active" },
    select: { id: true },
  });
  for (const skill of battleSkills) {
    await prisma.characterSkill.upsert({
      where: {
        characterId_skillId: { characterId, skillId: skill.id },
      },
      create: { characterId, skillId: skill.id },
      update: {},
    });
  }
  console.log(`Protagonist: 戦闘スキル ${battleSkills.length} 種を習得済みにしました`);
}

/** spec/035, 045: 素材・製品マスタ。category で種別。 */
async function seedItems() {
  for (const i of ITEMS) {
    await prisma.item.upsert({
      where: { code: i.code },
      create: {
        code: i.code,
        name: i.name,
        category: i.category,
        consumableEffect: Prisma.JsonNull,
        maxCarryPerExpedition: null,
      },
      update: {
        name: i.name,
        category: i.category,
        consumableEffect: Prisma.JsonNull,
        maxCarryPerExpedition: null,
      },
    });
  }
  for (const i of CONSUMABLE_ITEMS) {
    await prisma.item.upsert({
      where: { code: i.code },
      create: {
        code: i.code,
        name: i.name,
        category: i.category,
        consumableEffect: i.consumableEffect as object,
        maxCarryPerExpedition: i.maxCarryPerExpedition,
      },
      update: {
        name: i.name,
        category: i.category,
        consumableEffect: i.consumableEffect as object,
        maxCarryPerExpedition: i.maxCarryPerExpedition,
      },
    });
  }
  console.log(`Items: ${ITEMS.length + CONSUMABLE_ITEMS.length} 件 upsert`);
}

/** spec/052: スキル分析書アイテム。戦闘スキル1種につき1アイテム。seedBattleSkills の後に実行すること。 */
async function seedSkillBookItems() {
  const battleSkills = await prisma.skill.findMany({
    where: { category: "battle_active" },
    select: { id: true, name: true },
  });
  for (const skill of battleSkills) {
    const code = `skill_book_${skill.name}`;
    await prisma.item.upsert({
      where: { code },
      create: {
        code,
        name: `${skill.name}の分析書`,
        category: "skill_book",
        skillId: skill.id,
      },
      update: {
        name: `${skill.name}の分析書`,
        category: "skill_book",
        skillId: skill.id,
      },
    });
  }
  console.log(`SkillBook items: ${battleSkills.length} 件 upsert`);
}

/** spec/051: 遺物型・遺物パッシブ効果マスタ。 */
async function seedRelicTypesAndEffects() {
  for (const r of RELIC_TYPES) {
    await prisma.relicType.upsert({
      where: { code: r.code },
      create: { code: r.code, name: r.name, groupCode: r.groupCode ?? undefined },
      update: { name: r.name, groupCode: r.groupCode ?? undefined },
    });
  }
  for (const e of RELIC_PASSIVE_EFFECTS) {
    await prisma.relicPassiveEffect.upsert({
      where: { code: e.code },
      create: { code: e.code, name: e.name, description: e.description ?? undefined },
      update: { name: e.name, description: e.description ?? undefined },
    });
  }
  console.log(`RelicTypes: ${RELIC_TYPES.length}, RelicPassiveEffects: ${RELIC_PASSIVE_EFFECTS.length} upsert`);
}

/** spec/051: 遺物グループごとの鑑定設定。groupCode は RelicType.groupCode と一致。 */
async function seedRelicGroupConfig() {
  const groupA = await prisma.relicGroupConfig.upsert({
    where: { groupCode: "group_a" },
    create: {
      groupCode: "group_a",
      name: "グループA",
      statBonus1Min: 3,
      statBonus1Max: 8,
      statBonus2Min: 2,
      statBonus2Max: 5,
      attributeResistMin: 0.85,
      attributeResistMax: 0.95,
      includeNoEffect: true,
    },
    update: {
      name: "グループA",
      statBonus1Min: 3,
      statBonus1Max: 8,
      statBonus2Min: 2,
      statBonus2Max: 5,
      attributeResistMin: 0.85,
      attributeResistMax: 0.95,
      includeNoEffect: true,
    },
  });
  const passives = await prisma.relicPassiveEffect.findMany({
    where: { code: { in: ["patk_up_5", "matk_up_5"] } },
    select: { id: true },
  });
  for (const p of passives) {
    await prisma.relicGroupPassiveEffect.upsert({
      where: {
        relicGroupConfigId_relicPassiveEffectId: {
          relicGroupConfigId: groupA.id,
          relicPassiveEffectId: p.id,
        },
      },
      create: {
        relicGroupConfigId: groupA.id,
        relicPassiveEffectId: p.id,
      },
      update: {},
    });
  }
  console.log("RelicGroupConfig: group_a and passive links upsert");
}

/** spec/049: テストユーザー test1 に探索用消耗品を各10個所持させる。 */
async function seedTest1Consumables() {
  const test1 = await prisma.user.findUnique({
    where: { email: "test1@example.com" },
    select: { id: true },
  });
  if (!test1) return;

  const consumableCodes = CONSUMABLE_ITEMS.map((i) => i.code);
  const items = await prisma.item.findMany({
    where: { code: { in: consumableCodes } },
    select: { id: true, code: true },
  });

  for (const item of items) {
    await prisma.userInventory.upsert({
      where: {
        userId_itemId: { userId: test1.id, itemId: item.id },
      },
      create: { userId: test1.id, itemId: item.id, quantity: 10 },
      update: { quantity: 10 },
    });
  }
  console.log("test1: 探索用消耗品（HP/MP回復薬）を各10個所持");
}

/** spec/052: テスト用に test1 にスキル分析書を10冊付与。遊覧舗装路の技能枠は weight 合計95のうち分析書が15なので約16%、かつ技能イベント発生時のみなので出にくい。 */
async function seedTest1SkillBooks() {
  const test1 = await prisma.user.findUnique({
    where: { email: "test1@example.com" },
    select: { id: true },
  });
  if (!test1) return;

  const item = await prisma.item.findUnique({
    where: { code: "skill_book_メテオスォーム" },
    select: { id: true },
  });
  if (!item) return;

  await prisma.userInventory.upsert({
    where: { userId_itemId: { userId: test1.id, itemId: item.id } },
    create: { userId: test1.id, itemId: item.id, quantity: 10 },
    update: { quantity: 10 },
  });
  console.log("test1: スキル分析書（メテオスォーム）を10冊所持（テスト用）");
}

/** spec/035, docs/018: 初期 5 設備のレシピ（周期・入出力）。1時間で携帯食料100個。 */
async function seedRecipes() {
  const itemByCode = new Map<string, string>();
  for (const i of await prisma.item.findMany({ select: { id: true, code: true } })) {
    itemByCode.set(i.code, i.id);
  }
  const facilityByName = new Map<string, string>();
  for (const f of await prisma.facilityType.findMany({ select: { id: true, name: true } })) {
    facilityByName.set(f.name, f.id);
  }

  const recipes: { facilityName: string; cycleMinutes: number; outputCode: string; outputAmount: number; inputs?: { itemCode: string; amount: number }[] }[] = [
    { facilityName: "川探索拠点", cycleMinutes: 60, outputCode: "water", outputAmount: 600 },
    { facilityName: "浄水施設", cycleMinutes: 20, outputCode: "drinkable_water", outputAmount: 100, inputs: [{ itemCode: "water", amount: 200 }] },
    { facilityName: "小麦畑", cycleMinutes: 120, outputCode: "wheat", outputAmount: 200 },
    { facilityName: "小麦製粉器", cycleMinutes: 30, outputCode: "flour", outputAmount: 150, inputs: [{ itemCode: "wheat", amount: 50 }] },
    { facilityName: "携帯食料包装", cycleMinutes: 15, outputCode: "portable_ration", outputAmount: 25, inputs: [{ itemCode: "drinkable_water", amount: 75 }, { itemCode: "flour", amount: 75 }] },
  ];

  for (const r of recipes) {
    const facilityTypeId = facilityByName.get(r.facilityName);
    const outputItemId = itemByCode.get(r.outputCode);
    if (!facilityTypeId || !outputItemId) continue;
    const recipe = await prisma.recipe.upsert({
      where: { facilityTypeId },
      create: { facilityTypeId, cycleMinutes: r.cycleMinutes, outputItemId, outputAmount: r.outputAmount },
      update: { cycleMinutes: r.cycleMinutes, outputItemId, outputAmount: r.outputAmount },
    });
    if (r.inputs) {
      for (const inp of r.inputs) {
        const itemId = itemByCode.get(inp.itemCode);
        if (!itemId) continue;
        await prisma.recipeInput.upsert({
          where: { recipeId_itemId: { recipeId: recipe.id, itemId } },
          create: { recipeId: recipe.id, itemId, amount: inp.amount },
          update: { amount: inp.amount },
        });
      }
    }
  }
  console.log(`Recipes: ${recipes.length} 件 upsert`);
}

/** docs/053: 装備のステ生成設定（CAP・重み）。seed でマスタに持つ。 */
const EQUIPMENT_STAT_GEN_CONFIG: Record<
  string,
  { capMin: number; capMax: number; weights: Array<{ key: string; weightMin: number; weightMax: number }> }
> = {
  iron_sword: {
    capMin: 70,
    capMax: 100,
    weights: [
      { key: "PATK", weightMin: 5, weightMax: 10 },
      { key: "PDEF", weightMin: 1, weightMax: 5 },
    ],
  },
  cloth_armor: {
    capMin: 50,
    capMax: 80,
    weights: [
      { key: "PDEF", weightMin: 3, weightMax: 8 },
      { key: "MDEF", weightMin: 2, weightMax: 6 },
    ],
  },
};

/** spec/046, docs/053: 装備種別マスタ。クラフト出力用。statGenConfig をマスタに持つ。 */
async function seedEquipmentTypes() {
  const types = [
    { code: "iron_sword", name: "鉄の剣", slot: "main_weapon" },
    { code: "cloth_armor", name: "布の鎧", slot: "body" },
  ];
  for (const t of types) {
    const statGenConfig = EQUIPMENT_STAT_GEN_CONFIG[t.code] ?? null;
    await prisma.equipmentType.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name, slot: t.slot, statGenConfig: statGenConfig as object },
      update: { name: t.name, slot: t.slot, statGenConfig: statGenConfig as object },
    });
  }
  console.log(`EquipmentTypes: ${types.length} 件 upsert`);
}

/** spec/046, docs/053: クラフトレシピと入力。鉄の剣・布の鎧・おんぼろシリーズをレシピマスタに登録。消費素材は現状のまま（あとで再設定可）。 */
async function seedCraftRecipes() {
  const itemByCode = new Map<string, string>();
  for (const i of await prisma.item.findMany({ select: { id: true, code: true } })) {
    itemByCode.set(i.code, i.id);
  }
  const equipmentTypeByCode = new Map<string, string>();
  for (const e of await prisma.equipmentType.findMany({ select: { id: true, code: true } })) {
    equipmentTypeByCode.set(e.code, e.id);
  }
  const mechaPartTypeByName = new Map<string, string>();
  for (const m of await prisma.mechaPartType.findMany({ select: { id: true, name: true } })) {
    mechaPartTypeByName.set(m.name, m.id);
  }

  const recipes: {
    code: string;
    name: string;
    outputKind: "equipment" | "mecha_part" | "item";
    outputEquipmentTypeCode?: string;
    outputMechaPartTypeName?: string;
    outputItemCode?: string;
    inputs: { itemCode: string; amount: number }[];
  }[] = [
    {
      code: "iron_sword",
      name: "鉄の剣",
      outputKind: "equipment",
      outputEquipmentTypeCode: "iron_sword",
      inputs: [{ itemCode: "water", amount: 10 }, { itemCode: "wheat", amount: 5 }],
    },
    {
      code: "cloth_armor",
      name: "布の鎧",
      outputKind: "equipment",
      outputEquipmentTypeCode: "cloth_armor",
      inputs: [{ itemCode: "flour", amount: 15 }, { itemCode: "wheat", amount: 10 }],
    },
    {
      code: "onboro_frame",
      name: "おんぼろフレーム",
      outputKind: "mecha_part",
      outputMechaPartTypeName: "おんぼろフレーム",
      inputs: [{ itemCode: "water", amount: 10 }, { itemCode: "wheat", amount: 5 }],
    },
    {
      code: "onboro_core",
      name: "おんぼろコア",
      outputKind: "mecha_part",
      outputMechaPartTypeName: "おんぼろコア",
      inputs: [{ itemCode: "water", amount: 10 }, { itemCode: "wheat", amount: 5 }],
    },
    {
      code: "onboro_head",
      name: "おんぼろヘッド",
      outputKind: "mecha_part",
      outputMechaPartTypeName: "おんぼろヘッド",
      inputs: [{ itemCode: "water", amount: 10 }, { itemCode: "wheat", amount: 5 }],
    },
    {
      code: "onboro_sword_arm",
      name: "おんぼろソードアーム",
      outputKind: "mecha_part",
      outputMechaPartTypeName: "おんぼろソードアーム",
      inputs: [{ itemCode: "water", amount: 10 }, { itemCode: "wheat", amount: 5 }],
    },
    {
      code: "onboro_gun_arm",
      name: "おんぼろガンアーム",
      outputKind: "mecha_part",
      outputMechaPartTypeName: "おんぼろガンアーム",
      inputs: [{ itemCode: "water", amount: 10 }, { itemCode: "wheat", amount: 5 }],
    },
    {
      code: "onboro_legs",
      name: "おんぼろレッグス",
      outputKind: "mecha_part",
      outputMechaPartTypeName: "おんぼろレッグス",
      inputs: [{ itemCode: "water", amount: 10 }, { itemCode: "wheat", amount: 5 }],
    },
    {
      code: "portable_ration_craft",
      name: "携帯食料（クラフト）",
      outputKind: "item",
      outputItemCode: "portable_ration",
      inputs: [{ itemCode: "drinkable_water", amount: 2 }, { itemCode: "flour", amount: 2 }],
    },
  ];

  for (const r of recipes) {
    const outputEquipmentTypeId = r.outputEquipmentTypeCode
      ? equipmentTypeByCode.get(r.outputEquipmentTypeCode)
      : null;
    const outputMechaPartTypeId = r.outputMechaPartTypeName
      ? mechaPartTypeByName.get(r.outputMechaPartTypeName)
      : null;
    const outputItemId = r.outputItemCode ? itemByCode.get(r.outputItemCode) : null;
    const recipe = await prisma.craftRecipe.upsert({
      where: { code: r.code },
      create: {
        code: r.code,
        name: r.name,
        outputKind: r.outputKind,
        outputEquipmentTypeId: outputEquipmentTypeId ?? undefined,
        outputMechaPartTypeId: outputMechaPartTypeId ?? undefined,
        outputItemId: outputItemId ?? undefined,
      },
      update: {
        name: r.name,
        outputKind: r.outputKind,
        outputEquipmentTypeId: outputEquipmentTypeId ?? undefined,
        outputMechaPartTypeId: outputMechaPartTypeId ?? undefined,
        outputItemId: outputItemId ?? undefined,
      },
    });
    for (const inp of r.inputs) {
      const itemId = itemByCode.get(inp.itemCode);
      if (!itemId) continue;
      await prisma.craftRecipeInput.upsert({
        where: { craftRecipeId_itemId: { craftRecipeId: recipe.id, itemId } },
        create: { craftRecipeId: recipe.id, itemId, amount: inp.amount },
        update: { amount: inp.amount },
      });
    }
  }
  console.log(`CraftRecipes: ${recipes.length} 件 upsert`);
}

/** spec/047: 型マスタ（基本型）と建設レシピ。MVP では初期 5 設備種別に base のみ。 */
async function seedFacilityVariantsAndConstruction() {
  const itemByCode = new Map<string, string>();
  for (const i of await prisma.item.findMany({ select: { id: true, code: true } })) {
    itemByCode.set(i.code, i.id);
  }
  const facilityByName = new Map<string, string>();
  for (const f of await prisma.facilityType.findMany({ select: { id: true, name: true } })) {
    facilityByName.set(f.name, f.id);
  }

  const constructionRecipes: { facilityName: string; inputs: { itemCode: string; amount: number }[] }[] = [
    { facilityName: "川探索拠点", inputs: [{ itemCode: "water", amount: 30 }] },
    { facilityName: "浄水施設", inputs: [{ itemCode: "water", amount: 60 }] },
    { facilityName: "小麦畑", inputs: [{ itemCode: "wheat", amount: 20 }] },
    { facilityName: "小麦製粉器", inputs: [{ itemCode: "wheat", amount: 40 }] },
    { facilityName: "携帯食料包装", inputs: [{ itemCode: "drinkable_water", amount: 25 }, { itemCode: "flour", amount: 25 }] },
  ];

  for (const cr of constructionRecipes) {
    const facilityTypeId = facilityByName.get(cr.facilityName);
    if (!facilityTypeId) continue;
    const variant = await prisma.facilityVariant.upsert({
      where: { facilityTypeId_variantCode: { facilityTypeId, variantCode: "base" } },
      create: { facilityTypeId, variantCode: "base", name: "基本型" },
      update: { name: "基本型" },
    });
    for (const inp of cr.inputs) {
      const itemId = itemByCode.get(inp.itemCode);
      if (!itemId) continue;
      await prisma.facilityConstructionRecipeInput.upsert({
        where: { facilityVariantId_itemId: { facilityVariantId: variant.id, itemId } },
        create: { facilityVariantId: variant.id, itemId, amount: inp.amount },
        update: { amount: inp.amount },
      });
    }
  }
  console.log("FacilityVariants + ConstructionRecipeInput: 5 設備の基本型を登録");
}

/** spec/047: テストユーザーに初期 5 設備種別を解放（建設可能にする）。 */
async function seedUserFacilityTypeUnlocks() {
  const facilityByName = new Map<string, string>();
  for (const f of await prisma.facilityType.findMany({ select: { id: true, name: true } })) {
    facilityByName.set(f.name, f.id);
  }
  const facilityTypeIds = INITIAL_FACILITY_NAMES.map((name) => facilityByName.get(name)).filter(Boolean) as string[];
  for (const user of await prisma.user.findMany({ select: { id: true } })) {
    for (const facilityTypeId of facilityTypeIds) {
      await prisma.userFacilityTypeUnlock.upsert({
        where: { userId_facilityTypeId: { userId: user.id, facilityTypeId } },
        create: { userId: user.id, facilityTypeId },
        update: {},
      });
    }
  }
  console.log("UserFacilityTypeUnlock: テストユーザーに 5 設備種別を解放");
}

/** spec/035: ユーザーに強制配置 5 設備が無ければ作成（エリア制廃止・単一プール）。 */
async function ensureInitialFacilitiesForUser(userId: string) {
  const forcedCount = await prisma.facilityInstance.count({
    where: { userId, isForced: true },
  });
  if (forcedCount >= 5) return;
  const facilityTypes = await prisma.facilityType.findMany({
    where: { name: { in: [...INITIAL_FACILITY_NAMES] } },
    select: { id: true, name: true },
  });
  const byName = new Map(facilityTypes.map((f) => [f.name, f.id]));
  const existing = await prisma.facilityInstance.findMany({
    where: { userId, isForced: true },
    select: { facilityTypeId: true },
  });
  const existingTypeIds = new Set(existing.map((e) => e.facilityTypeId));
  for (let index = 0; index < INITIAL_FACILITY_NAMES.length; index++) {
    const name = INITIAL_FACILITY_NAMES[index];
    const facilityTypeId = byName.get(name);
    if (!facilityTypeId || existingTypeIds.has(facilityTypeId)) continue;
    await prisma.facilityInstance.create({
      data: {
        userId,
        facilityTypeId,
        variantCode: "base",
        displayOrder: index + 1,
        isForced: true,
      },
    });
    existingTypeIds.add(facilityTypeId);
  }
}

/** spec/049_exploration: 探索テーマ・エリアのシード。 */
async function seedExplorationThemesAndAreas() {
  console.log("Seeding exploration themes and areas...");

  // テーマ
  for (const t of EXPLORATION_THEMES) {
    await prisma.explorationTheme.upsert({
      where: { code: t.code },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        displayOrder: t.displayOrder,
      },
      update: {
        name: t.name,
        description: t.description,
        displayOrder: t.displayOrder,
      },
    });
  }

  // エリア
  for (const a of EXPLORATION_AREAS) {
    const theme = await prisma.explorationTheme.findUnique({
      where: { code: a.themeCode },
      select: { id: true },
    });
    if (!theme) {
      console.warn(`ExplorationTheme not found for area seed: ${a.code} (themeCode=${a.themeCode})`);
      continue;
    }

    await prisma.explorationArea.upsert({
      where: { code: a.code },
      create: {
        themeId: theme.id,
        code: a.code,
        name: a.name,
        description: a.description,
        difficultyRank: a.difficultyRank,
        recommendedLevel: a.recommendedLevel,
        baseDropMin: a.baseDropMin,
        baseDropMax: a.baseDropMax,
        baseSkillEventRate: a.baseSkillEventRate,
        skillCheckRequiredValue: 80, // Phase 3 技能判定の必要値（MVP: 全ステ共通）
        normalBattleCount: a.normalBattleCount,
        normalEnemyGroupCode: a.normalEnemyGroupCode,
        strongEnemyEnemyGroupCode: a.strongEnemyEnemyGroupCode,
        areaLordEnemyGroupCode: a.areaLordEnemyGroupCode,
      },
      update: {
        themeId: theme.id,
        name: a.name,
        description: a.description,
        difficultyRank: a.difficultyRank,
        recommendedLevel: a.recommendedLevel,
        baseDropMin: a.baseDropMin,
        baseDropMax: a.baseDropMax,
        baseSkillEventRate: a.baseSkillEventRate,
        skillCheckRequiredValue: 80,
        normalBattleCount: a.normalBattleCount,
        normalEnemyGroupCode: a.normalEnemyGroupCode,
        strongEnemyEnemyGroupCode: a.strongEnemyEnemyGroupCode,
        areaLordEnemyGroupCode: a.areaLordEnemyGroupCode,
      },
    });
  }

  // 遊覧舗装路跡用のドロップテーブル（MVP: 1 エリアのみ）
  const area = await prisma.explorationArea.findUnique({
    where: { code: "yuran_paved_road" },
    select: { id: true },
  });
  if (!area) {
    console.warn("ExplorationArea yuran_paved_road not found for DropTable seed");
    return;
  }

  // アイテム ID 解決（spec/052: スキル分析書を技能枠に追加するため code に含める）
  const itemCodes = [
    "water",
    "wheat",
    "iron_equip_part",
    "cloth_equip_part",
    "blueprint_water_search_alpha",
    "relic_group_a_token",
    "skill_book_メテオスォーム",
    "skill_book_閃槍",
    "skill_book_癒しの光",
  ];
  const items = await prisma.item.findMany({
    where: { code: { in: itemCodes } },
    select: { id: true, code: true },
  });
  const itemByCode = new Map(items.map((i) => [i.code, i.id]));

  const baseTable = await prisma.dropTable.upsert({
    where: { code: "yuran_paved_road_base" },
    create: {
      code: "yuran_paved_road_base",
      name: "遊覧舗装路跡・基本ドロップ",
      kind: "base",
      areaId: area.id,
    },
    update: {
      name: "遊覧舗装路跡・基本ドロップ",
      kind: "base",
      areaId: area.id,
    },
  });

  const battleTable = await prisma.dropTable.upsert({
    where: { code: "yuran_paved_road_battle" },
    create: {
      code: "yuran_paved_road_battle",
      name: "遊覧舗装路跡・戦闘ボーナス",
      kind: "battle_bonus",
      areaId: area.id,
    },
    update: {
      name: "遊覧舗装路跡・戦闘ボーナス",
      kind: "battle_bonus",
      areaId: area.id,
    },
  });

  const skillTable = await prisma.dropTable.upsert({
    where: { code: "yuran_paved_road_skill" },
    create: {
      code: "yuran_paved_road_skill",
      name: "遊覧舗装路跡・技能イベント枠",
      kind: "skill",
      areaId: area.id,
    },
    update: {
      name: "遊覧舗装路跡・技能イベント枠",
      kind: "skill",
      areaId: area.id,
    },
  });

  const strongEnemyTable = await prisma.dropTable.upsert({
    where: { code: "yuran_paved_road_strong_enemy" },
    create: {
      code: "yuran_paved_road_strong_enemy",
      name: "遊覧舗装路跡・強敵枠",
      kind: "strong_enemy",
      areaId: area.id,
    },
    update: {
      name: "遊覧舗装路跡・強敵枠",
      kind: "strong_enemy",
      areaId: area.id,
    },
  });

  const areaLordTable = await prisma.dropTable.upsert({
    where: { code: "yuran_paved_road_area_lord" },
    create: {
      code: "yuran_paved_road_area_lord",
      name: "遊覧舗装路跡・領域主専用枠",
      kind: "area_lord_special",
      areaId: area.id,
    },
    update: {
      name: "遊覧舗装路跡・領域主専用枠",
      kind: "area_lord_special",
      areaId: area.id,
    },
  });

  // DropTableEntry を簡易に upsert（既存は削除してから入れ直す）
  await prisma.dropTableEntry.deleteMany({
    where: {
      dropTableId: {
        in: [baseTable.id, battleTable.id, skillTable.id, strongEnemyTable.id, areaLordTable.id],
      },
    },
  });

  const entries: Array<{
    tableId: string;
    code: string;
    min: number;
    max: number;
    weight: number;
  }> = [
    // 基本枠: 資源多め
    { tableId: baseTable.id, code: "water", min: 20, max: 40, weight: 50 },
    { tableId: baseTable.id, code: "wheat", min: 10, max: 20, weight: 40 },
    { tableId: baseTable.id, code: "iron_equip_part", min: 1, max: 2, weight: 5 },
    { tableId: baseTable.id, code: "cloth_equip_part", min: 1, max: 2, weight: 5 },

    // 戦闘ボーナス枠: 部品・設計図
    { tableId: battleTable.id, code: "iron_equip_part", min: 1, max: 3, weight: 40 },
    { tableId: battleTable.id, code: "cloth_equip_part", min: 1, max: 3, weight: 40 },
    { tableId: battleTable.id, code: "blueprint_water_search_alpha", min: 1, max: 1, weight: 20 },

    // 技能枠: 設計図・部品・スキル分析書（spec/052）
    { tableId: skillTable.id, code: "blueprint_water_search_alpha", min: 1, max: 1, weight: 40 },
    { tableId: skillTable.id, code: "iron_equip_part", min: 1, max: 2, weight: 20 },
    { tableId: skillTable.id, code: "cloth_equip_part", min: 1, max: 2, weight: 20 },
    { tableId: skillTable.id, code: "skill_book_メテオスォーム", min: 1, max: 1, weight: 5 },
    { tableId: skillTable.id, code: "skill_book_閃槍", min: 1, max: 1, weight: 5 },
    { tableId: skillTable.id, code: "skill_book_癒しの光", min: 1, max: 1, weight: 5 },

    // 強敵枠: 戦闘ボーナスよりやや良い報酬（部品・設計図・遺物トークン）
    { tableId: strongEnemyTable.id, code: "iron_equip_part", min: 2, max: 4, weight: 35 },
    { tableId: strongEnemyTable.id, code: "cloth_equip_part", min: 2, max: 4, weight: 35 },
    { tableId: strongEnemyTable.id, code: "blueprint_water_search_alpha", min: 1, max: 1, weight: 20 },
    { tableId: strongEnemyTable.id, code: "relic_group_a_token", min: 1, max: 1, weight: 10 },

    // 領域主専用枠: 遺物グループAトークンを中心に
    { tableId: areaLordTable.id, code: "relic_group_a_token", min: 1, max: 1, weight: 60 },
    { tableId: areaLordTable.id, code: "blueprint_water_search_alpha", min: 1, max: 1, weight: 30 },
    { tableId: areaLordTable.id, code: "iron_equip_part", min: 2, max: 4, weight: 10 },
  ];

  for (const e of entries) {
    const itemId = itemByCode.get(e.code);
    if (!itemId) {
      console.warn(`DropTableEntry seed: Item not found for code=${e.code}`);
      continue;
    }
    await prisma.dropTableEntry.create({
      data: {
        dropTableId: e.tableId,
        itemId,
        minQuantity: e.min,
        maxQuantity: e.max,
        weight: e.weight,
      },
    });
  }

  // ExplorationArea にテーブル紐づけを反映
  await prisma.explorationArea.update({
    where: { id: area.id },
    data: {
      baseDropTableId: baseTable.id,
      battleDropTableId: battleTable.id,
      skillDropTableId: skillTable.id,
      strongEnemyDropTableId: strongEnemyTable.id,
      areaLordDropTableId: areaLordTable.id,
    },
  });
}

/** spec/050, docs/content-guides/051: 遊覧舗装路跡の敵マスタ・グループ・エリア紐づけ */
async function seedEnemiesForYuranPavedRoad() {
  const skillRows = await prisma.skill.findMany({
    where: { category: "battle_active" },
    select: { id: true, name: true },
  });
  const skillIdByName = new Map(skillRows.map((s) => [s.name, s.id]));

  const ENEMIES_YURAN: Array<{
    code: string;
    name: string;
    iconFilename: string;
    defaultBattleRow: number;
    defaultBattleCol: number;
    STR: number;
    INT: number;
    VIT: number;
    WIS: number;
    DEX: number;
    AGI: number;
    LUK: number;
    CAP: number;
    tacticSlots: Array<{
      orderIndex: number;
      subject: string;
      conditionKind: string;
      conditionParam: object | null;
      actionType: string;
      skillName: string | null;
    }>;
    skillNames: string[];
  }> = [
    {
      code: "scrap_wolf",
      name: "スクラップウルフ",
      iconFilename: "0.gif",
      defaultBattleRow: 1,
      defaultBattleCol: 1,
      STR: 39,
      INT: 39,
      VIT: 30,
      WIS: 39,
      DEX: 39,
      AGI: 75,
      LUK: 39,
      CAP: 300,
      tacticSlots: [{ orderIndex: 1, subject: "self", conditionKind: "always", conditionParam: null, actionType: "normal_attack", skillName: null }],
      skillNames: [],
    },
    {
      code: "cable_crow",
      name: "ケーブルクロウ",
      iconFilename: "0.gif",
      defaultBattleRow: 2,
      defaultBattleCol: 2,
      STR: 32,
      INT: 33,
      VIT: 25,
      WIS: 33,
      DEX: 62,
      AGI: 33,
      LUK: 32,
      CAP: 250,
      tacticSlots: [{ orderIndex: 1, subject: "self", conditionKind: "always", conditionParam: null, actionType: "skill", skillName: "閃槍" }],
      skillNames: ["閃槍"],
    },
    {
      code: "asphalt_mole",
      name: "アスファルトモール",
      iconFilename: "0.gif",
      defaultBattleRow: 2,
      defaultBattleCol: 2,
      STR: 32,
      INT: 32,
      VIT: 80,
      WIS: 80,
      DEX: 32,
      AGI: 32,
      LUK: 32,
      CAP: 320,
      tacticSlots: [{ orderIndex: 1, subject: "self", conditionKind: "always", conditionParam: null, actionType: "normal_attack", skillName: null }],
      skillNames: [],
    },
    {
      code: "wild_drone",
      name: "ワイルドドローン",
      iconFilename: "0.gif",
      defaultBattleRow: 3,
      defaultBattleCol: 3,
      STR: 45,
      INT: 90,
      VIT: 45,
      WIS: 45,
      DEX: 45,
      AGI: 45,
      LUK: 45,
      CAP: 360,
      tacticSlots: [
        { orderIndex: 1, subject: "cycle", conditionKind: "cycle_at_least", conditionParam: { n: 3 }, actionType: "skill", skillName: "ファイアボルト" },
        { orderIndex: 2, subject: "self", conditionKind: "always", conditionParam: null, actionType: "normal_attack", skillName: null },
      ],
      skillNames: ["ファイアボルト"],
    },
    {
      code: "fusion_erosion_wire_trent",
      name: "融合侵食ワイヤートレント",
      iconFilename: "0.gif",
      defaultBattleRow: 1,
      defaultBattleCol: 1,
      STR: 104,
      INT: 104,
      VIT: 200,
      WIS: 104,
      DEX: 104,
      AGI: 80,
      LUK: 104,
      CAP: 800,
      tacticSlots: [
        { orderIndex: 1, subject: "self", conditionKind: "always", conditionParam: null, actionType: "skill", skillName: "砦の構え" },
        { orderIndex: 2, subject: "self", conditionKind: "hp_below_percent", conditionParam: { percent: 50 }, actionType: "skill", skillName: "浄化の祈り" },
      ],
      skillNames: ["砦の構え", "浄化の祈り"],
    },
    {
      code: "road_admin_pathfinder",
      name: "道路管理機構パスファインダー",
      iconFilename: "0.gif",
      defaultBattleRow: 2,
      defaultBattleCol: 2,
      STR: 210,
      INT: 120,
      VIT: 210,
      WIS: 120,
      DEX: 210,
      AGI: 210,
      LUK: 120,
      CAP: 1200,
      tacticSlots: [
        { orderIndex: 1, subject: "cycle", conditionKind: "cycle_equals", conditionParam: { n: 1 }, actionType: "skill", skillName: "感覚深化" },
        { orderIndex: 2, subject: "self", conditionKind: "always", conditionParam: null, actionType: "skill", skillName: "虎挟ミ" },
        { orderIndex: 3, subject: "self", conditionKind: "always", conditionParam: null, actionType: "skill", skillName: "クエイクバースト" },
      ],
      skillNames: ["感覚深化", "虎挟ミ", "クエイクバースト"],
    },
  ];

  const enemyIds: string[] = [];
  for (const e of ENEMIES_YURAN) {
    const enemy = await prisma.enemy.upsert({
      where: { code: e.code },
      create: {
        code: e.code,
        name: e.name,
        iconFilename: e.iconFilename,
        defaultBattleRow: e.defaultBattleRow,
        defaultBattleCol: e.defaultBattleCol,
        STR: e.STR,
        INT: e.INT,
        VIT: e.VIT,
        WIS: e.WIS,
        DEX: e.DEX,
        AGI: e.AGI,
        LUK: e.LUK,
        CAP: e.CAP,
      },
      update: {
        name: e.name,
        iconFilename: e.iconFilename,
        defaultBattleRow: e.defaultBattleRow,
        defaultBattleCol: e.defaultBattleCol,
        STR: e.STR,
        INT: e.INT,
        VIT: e.VIT,
        WIS: e.WIS,
        DEX: e.DEX,
        AGI: e.AGI,
        LUK: e.LUK,
        CAP: e.CAP,
      },
      select: { id: true },
    });
    enemyIds.push(enemy.id);

    await prisma.enemyTacticSlot.deleteMany({ where: { enemyId: enemy.id } });
    for (const slot of e.tacticSlots) {
      const skillId = slot.skillName ? skillIdByName.get(slot.skillName) ?? null : null;
      await prisma.enemyTacticSlot.create({
        data: {
          enemyId: enemy.id,
          orderIndex: slot.orderIndex,
          subject: slot.subject,
          conditionKind: slot.conditionKind,
          conditionParam: slot.conditionParam as Prisma.InputJsonValue,
          actionType: slot.actionType,
          skillId,
        },
      });
    }

    await prisma.enemySkill.deleteMany({ where: { enemyId: enemy.id } });
    for (const skillName of e.skillNames) {
      const skillId = skillIdByName.get(skillName);
      if (skillId) {
        await prisma.enemySkill.create({
          data: { enemyId: enemy.id, skillId },
        });
      }
    }
  }

  const normalEnemyIds = enemyIds.slice(0, 4);
  const strongEnemyId = enemyIds[4];
  const areaLordId = enemyIds[5];

  const group = await prisma.enemyGroup.upsert({
    where: { code: "yuran_normal" },
    create: { code: "yuran_normal" },
    update: {},
    select: { id: true },
  });

  await prisma.enemyGroupEntry.deleteMany({ where: { enemyGroupId: group.id } });
  for (let i = 0; i < normalEnemyIds.length; i++) {
    await prisma.enemyGroupEntry.create({
      data: { enemyGroupId: group.id, enemyId: normalEnemyIds[i], weight: 1 },
    });
  }

  const area = await prisma.explorationArea.findUnique({
    where: { code: "yuran_paved_road" },
    select: { id: true },
  });
  if (area) {
    await prisma.explorationArea.update({
      where: { id: area.id },
      data: {
        normalEnemyGroupCode: "yuran_normal",
        enemyCount1Rate: 20,
        enemyCount2Rate: 50,
        enemyCount3Rate: 30,
        strongEnemyEnemyId: strongEnemyId,
        areaLordEnemyId: areaLordId,
      },
    });
  }
  console.log("Enemies for yuran_paved_road: 6 敵種・グループ yuran_normal・エリア紐づけ 完了");
}

/** docs/054: クエストマスタ。最初のストーリー＝探索1回クリア、研究＝スクラップウルフ10体撃破 */
async function seedQuests() {
  const area = await prisma.explorationArea.findUnique({
    where: { code: "yuran_paved_road" },
    select: { id: true },
  });
  const scrapWolf = await prisma.enemy.findUnique({
    where: { code: "scrap_wolf" },
    select: { id: true },
  });
  if (!area || !scrapWolf) {
    console.warn("Quest seed skipped: yuran_paved_road or scrap_wolf not found");
    return;
  }

  const storyQuest = await prisma.quest.upsert({
    where: { code: "story_first_exploration" },
    create: {
      code: "story_first_exploration",
      questType: "story",
      name: "はじめての探索",
      description:
        "錆びれた森林地区の遊覧舗装路跡。まずは一度、足を踏み入れて無事に帰還することが目標だ。",
      clearReportMessage:
        "無事に帰還した。これでこの先の調査や研究に必要な「実地経験」が認められる。",
      prerequisiteQuestId: null,
      achievementType: "area_clear",
      achievementParam: { areaId: area.id, count: 1 },
      rewardResearchPoint: 0,
    },
    update: {
      achievementParam: { areaId: area.id, count: 1 },
    },
    select: { id: true },
  });

  await prisma.quest.upsert({
    where: { code: "research_scrap_wolf_10" },
    create: {
      code: "research_scrap_wolf_10",
      questType: "research",
      name: "スクラップウルフの生態",
      description:
        "遊覧舗装路跡でよく見かけるスクラップウルフ。10体撃破してデータを集め、研究に役立てる。",
      clearReportMessage: "スクラップウルフの討伐データが研究ポイントとして記録された。",
      prerequisiteQuestId: storyQuest.id,
      achievementType: "enemy_defeat",
      achievementParam: { enemyId: scrapWolf.id, count: 10 },
      rewardResearchPoint: 10,
    },
    update: {
      prerequisiteQuestId: storyQuest.id,
      achievementParam: { enemyId: scrapWolf.id, count: 10 },
    },
  });

  console.log("Quests: ストーリー1本（探索1回）・研究1本（スクラップウルフ10体） 投入完了");
}

/** docs/054: 研究グループ。第一弾は「錆びれた森林研究」。派生型以外すべてクリアで次グループ解放。 */
async function seedResearchGroups() {
  const group = await prisma.researchGroup.upsert({
    where: { code: "rust_forest_research" },
    create: {
      code: "rust_forest_research",
      name: "錆びれた森林研究",
      displayOrder: 0,
      prerequisiteGroupId: null,
    },
    update: {},
    select: { id: true },
  });

  const facilityByName = new Map<string, string>();
  for (const f of await prisma.facilityType.findMany({ select: { id: true, name: true } })) {
    facilityByName.set(f.name, f.id);
  }
  const itemByCode = new Map<string, string>();
  for (const i of await prisma.item.findMany({ select: { id: true, code: true } })) {
    itemByCode.set(i.code, i.id);
  }

  const facilityNames = ["山探索拠点", "貯水槽"] as const;
  for (let order = 0; order < facilityNames.length; order++) {
    const name = facilityNames[order];
    const facilityTypeId = facilityByName.get(name);
    if (!facilityTypeId) continue;
    await prisma.researchGroupItem.upsert({
      where: {
        researchGroupId_targetType_targetId: {
          researchGroupId: group.id,
          targetType: "facility_type",
          targetId: facilityTypeId,
        },
      },
      create: {
        researchGroupId: group.id,
        targetType: "facility_type",
        targetId: facilityTypeId,
        isVariant: false,
        displayOrder: order,
      },
      update: { displayOrder: order },
    });
  }

  const costItemCode = "iron_equip_part";
  const costItemId = itemByCode.get(costItemCode);
  if (costItemId) {
    for (const name of facilityNames) {
      const facilityTypeId = facilityByName.get(name);
      if (!facilityTypeId) continue;
      await prisma.researchUnlockCost.upsert({
        where: {
          targetType_targetId_itemId: {
            targetType: "facility_type",
            targetId: facilityTypeId,
            itemId: costItemId,
          },
        },
        create: {
          targetType: "facility_type",
          targetId: facilityTypeId,
          itemId: costItemId,
          amount: name === "山探索拠点" ? 5 : 3,
        },
        update: { amount: name === "山探索拠点" ? 5 : 3 },
      });
    }
  }

  console.log("Research groups: 錆びれた森林研究（山探索拠点・貯水槽）投入完了");
}

/** docs/054, 046: 既存クラフトレシピを全ユーザーに「初期解放」として付与。getCraftRecipes は解放済みのみ返す。 */
async function seedInitialCraftRecipeUnlocks() {
  const users = await prisma.user.findMany({ select: { id: true } });
  const recipes = await prisma.craftRecipe.findMany({ select: { id: true } });
  for (const user of users) {
    for (const recipe of recipes) {
      await prisma.userCraftRecipeUnlock.upsert({
        where: {
          userId_craftRecipeId: { userId: user.id, craftRecipeId: recipe.id },
        },
        create: { userId: user.id, craftRecipeId: recipe.id },
        update: {},
      });
    }
  }
  console.log("UserCraftRecipeUnlock: 全ユーザーに既存クラフトレシピを初期解放");
}

async function main() {
  for (const u of TEST_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, accountId: u.accountId, passwordHash, name: u.name },
      update: { accountId: u.accountId, passwordHash, name: u.name },
    });
    console.log(`Created/updated: ${u.email}`);

    if (u.email === "test1@example.com") {
      const existing = await prisma.character.findFirst({
        where: { userId: user.id, category: "protagonist" },
      });
      if (existing) {
        await prisma.character.update({
          where: { id: existing.id },
          data: {
            displayName: user.name, // 主人公の表示名は User.name に準拠（docs/08）
            iconFilename: "1.gif",
            level: 50,
            ...LEVEL_50_BASE_STATS,
          },
        });
      } else {
        const character = await prisma.character.create({
          data: {
            userId: user.id,
            category: "protagonist",
            displayName: user.name, // 主人公の表示名は User.name に準拠（docs/08）
            iconFilename: "1.gif",
            level: 50,
            ...LEVEL_50_BASE_STATS,
          },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { protagonistCharacterId: character.id },
        });
      }
      console.log("Created/updated: test1 の主人公（物理型A）");

      // テスト用：test1 に初期仲間キャラ（魔法型・CAP700）を1体登録
      const existingCompanion = await prisma.character.findFirst({
        where: { userId: user.id, category: "companion" },
      });
      if (existingCompanion) {
        await prisma.character.update({
          where: { id: existingCompanion.id },
          data: {
            displayName: "初期仲間",
            iconFilename: "2.gif",
            level: 50,
            ...LEVEL_50_BASE_STATS,
          },
        });
        console.log("Created/updated: test1 の初期仲間（魔法型・CAP700）");
      } else {
        await prisma.character.create({
          data: {
            userId: user.id,
            category: "companion",
            displayName: "初期仲間",
            iconFilename: "2.gif",
            level: 50,
            ...LEVEL_50_BASE_STATS,
          },
        });
        console.log("Created: test1 の初期仲間（魔法型・CAP700）");
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          gameCurrencyBalance: 5000,
          premiumCurrencyFreeBalance: 500,
          premiumCurrencyPaidBalance: 500,
        },
      });
      console.log("test1 に通貨を付与（ゲーム 5000、課金 無償500・有償500）");
    }
  }

  await seedTags();
  await seedFacilityTypes();
  await seedFacilityTypeTags();
  await seedIndustrialSkills();
  await seedBattleSkills();
  await seedMechaSkills();
  await seedOnboroPartTypes();
  await seedItems();
  await seedSkillBookItems();
  await seedTest1Consumables();
  await seedTest1SkillBooks();
  await seedRecipes();
  await seedEquipmentTypes();
  await seedRelicTypesAndEffects();
  await seedRelicGroupConfig();
  await seedCraftRecipes();
  await seedFacilityVariantsAndConstruction();
  await seedExplorationThemesAndAreas();
  await seedEnemiesForYuranPavedRoad();
  await seedQuests();
  await seedResearchGroups();
  await seedInitialCraftRecipeUnlocks();

  for (const u of TEST_USERS) {
    const user = await prisma.user.findUnique({ where: { email: u.email } });
    if (user) {
      await ensureInitialFacilitiesForUser(user.id);
    }
  }
  console.log("Initial facilities: テストユーザーに強制配置 5 設備を確保");

  await seedUserFacilityTypeUnlocks();

  // テスト用: test1 の設備枠・コスト上限を引き上げ（一時的）
  const test1User = await prisma.user.findUnique({
    where: { email: "test1@example.com" },
    select: { id: true },
  });
  if (test1User) {
    await prisma.user.update({
      where: { id: test1User.id },
      data: { industrialMaxSlots: 20, industrialMaxCost: 1000 },
    });
    console.log("test1: 設備枠 20・コスト上限 1000 に設定（テスト用）");
  }

  const test1 = await prisma.user.findUnique({
    where: { email: "test1@example.com" },
    select: { id: true, protagonistCharacterId: true },
  });
  if (test1) {
    if (test1.protagonistCharacterId) {
      await ensureProtagonistHasAllBattleSkills(test1.protagonistCharacterId);
      await prisma.character.update({
        where: { id: test1.protagonistCharacterId },
        data: { level: 50, ...LEVEL_50_BASE_STATS },
      });
    }
    const companions = await prisma.character.findMany({
      where: { userId: test1.id, category: "companion" },
      select: { id: true },
    });
    for (const c of companions) {
      await ensureProtagonistHasAllBattleSkills(c.id);
      await prisma.character.update({
        where: { id: c.id },
        data: { level: 50, ...LEVEL_50_BASE_STATS },
      });
    }
    // メカはアカウント作成フローで作成されるため、test1 用のメカ作成・おんぼろ装着は seed では行わない。
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
