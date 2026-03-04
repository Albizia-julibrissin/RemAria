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
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_USERS = [
  { email: "test1@example.com", accountId: "test_user_1", password: "password123", name: "テストユーザー1" },
  { email: "test2@example.com", accountId: "test_user_2", password: "password123", name: "テストユーザー2" },
] as const;

/**
 * テスト用：Lv50 時点・割り振り未使用状態の基礎ステータス。
 * docs/09: Lv1 CAP=560, 1レベルごとに CAP+60 → Lv50 で CAP=3,500。
 * 各ステは CAP の 5% を下限とするため、floor(3,500 * 0.05) = 175。
 * 7 ステすべて 175、CAP=3,500 の状態を「未割り振り」として Seed する。
 */
const LEVEL_50_BASE_STATS = {
  STR: 175,
  INT: 175,
  VIT: 175,
  WIS: 175,
  DEX: 175,
  AGI: 175,
  LUK: 175,
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

/** docs/15, 018: 設備種別。名前はユニーク。cost は spec/035 初期エリア用（合計200）。 */
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

/** spec/035, docs/018: 初期エリアの 5 設備名（強制配置・表示順）。 */
const INITIAL_AREA_FACILITY_NAMES = [
  "川探索拠点",
  "浄水施設",
  "小麦畑",
  "小麦製粉器",
  "携帯食料包装",
] as const;

/** spec/035: 生産チェーン用アイテム（水・飲料水・小麦・小麦粉・携帯食料）。 */
/** spec/045: category で種別。既存はすべて material。 */
const ITEMS = [
  { code: "water", name: "水", category: "material" as const },
  { code: "drinkable_water", name: "飲料水", category: "material" as const },
  { code: "wheat", name: "小麦", category: "material" as const },
  { code: "flour", name: "小麦粉", category: "material" as const },
  { code: "portable_ration", name: "携帯食料", category: "material" as const },
] as const;

/** spec/030, docs/15: 工業スキル 5 種。対象タグの設備に配備時のみ効果。 */
const INDUSTRIAL_SKILLS = [
  { name: "水の心得", description: "水に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "water", effectType: "time_reduction" as const, effectValue: 5 },
  { name: "水質管理", description: "水に関わる工業設備に配備時、生産量が3%アップ。", targetTagCode: "water", effectType: "production_bonus" as const, effectValue: 3 },
  { name: "採掘の勘", description: "鉱石に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "ore", effectType: "time_reduction" as const, effectValue: 5 },
  { name: "精錬の手慣れ", description: "精錬に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "smelt", effectType: "time_reduction" as const, effectValue: 5 },
  { name: "鍛冶の才", description: "金属に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "metal", effectType: "time_reduction" as const, effectValue: 5 },
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
        displayTags: (s.displayTags ?? null) as Prisma.InputJsonValue | null,
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

/** spec/044: おんぼろシリーズの MechaPartType と MechaPartTypeSkill を登録。 */
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
      statRates: p.statRates ? (p.statRates as object) : null,
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

/** テストユーザー(test1)のメカにおんぼろシリーズを所持装備として持たせ、装着する。spec/046 個体参照。 */
async function ensureTest1MechHasOnboroEquipped() {
  const user = await prisma.user.findUnique({
    where: { email: "test1@example.com" },
    select: { id: true },
  });
  if (!user) return;

  const mech = await prisma.character.findFirst({
    where: { userId: user.id, category: "mech" },
    select: { id: true },
  });
  if (!mech) {
    console.log("ensureTest1MechHasOnboroEquipped: test1 にメカがいません（主人公作成後にメカが作られます）");
    return;
  }

  const partTypes = await prisma.mechaPartType.findMany({
    where: { name: { startsWith: "おんぼろ" } },
    select: { id: true, slot: true },
  });
  const bySlot = new Map(partTypes.map((p) => [p.slot, p.id]));

  for (const p of ONBORO_PART_TYPES) {
    const partTypeId = bySlot.get(p.slot);
    if (!partTypeId) continue;

    let instance = await prisma.mechaPartInstance.findFirst({
      where: { userId: user.id, mechaPartTypeId: partTypeId },
      select: { id: true },
    });
    if (!instance) {
      instance = await prisma.mechaPartInstance.create({
        data: { userId: user.id, mechaPartTypeId: partTypeId },
        select: { id: true },
      });
    }

    await prisma.mechaEquipment.upsert({
      where: {
        characterId_slot: { characterId: mech.id, slot: p.slot },
      },
      create: {
        characterId: mech.id,
        slot: p.slot,
        mechaPartInstanceId: instance.id,
      },
      update: { mechaPartInstanceId: instance.id, mechaPartTypeId: null },
    });
  }
  console.log("test1 のメカにおんぼろシリーズを所持装備として装着しました");
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
      create: { code: i.code, name: i.name, category: i.category },
      update: { name: i.name, category: i.category },
    });
  }
  console.log(`Items: ${ITEMS.length} 件 upsert`);
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

/** spec/046: 装備種別マスタ。クラフト出力用。 */
async function seedEquipmentTypes() {
  const types = [
    { code: "iron_sword", name: "鉄の剣", slot: "main_weapon" },
    { code: "cloth_armor", name: "布の鎧", slot: "body" },
  ];
  for (const t of types) {
    await prisma.equipmentType.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name, slot: t.slot },
      update: { name: t.name, slot: t.slot },
    });
  }
  console.log(`EquipmentTypes: ${types.length} 件 upsert`);
}

/** spec/046: クラフトレシピと入力。工業設備の Recipe とは別体系。 */
async function seedCraftRecipes() {
  const itemByCode = new Map<string, string>();
  for (const i of await prisma.item.findMany({ select: { id: true, code: true } })) {
    itemByCode.set(i.code, i.id);
  }
  const equipmentTypeByCode = new Map<string, string>();
  for (const e of await prisma.equipmentType.findMany({ select: { id: true, code: true } })) {
    equipmentTypeByCode.set(e.code, e.id);
  }

  const recipes: {
    code: string;
    name: string;
    outputKind: "equipment" | "item";
    outputEquipmentTypeCode?: string;
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
    const outputItemId = r.outputItemCode ? itemByCode.get(r.outputItemCode) : null;
    const recipe = await prisma.craftRecipe.upsert({
      where: { code: r.code },
      create: {
        code: r.code,
        name: r.name,
        outputKind: r.outputKind,
        outputEquipmentTypeId: outputEquipmentTypeId ?? undefined,
        outputItemId: outputItemId ?? undefined,
      },
      update: {
        name: r.name,
        outputKind: r.outputKind,
        outputEquipmentTypeId: outputEquipmentTypeId ?? undefined,
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
  const facilityTypeIds = INITIAL_AREA_FACILITY_NAMES.map((name) => facilityByName.get(name)).filter(Boolean) as string[];
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
    where: { name: { in: [...INITIAL_AREA_FACILITY_NAMES] } },
    select: { id: true, name: true },
  });
  const byName = new Map(facilityTypes.map((f) => [f.name, f.id]));
  const existing = await prisma.facilityInstance.findMany({
    where: { userId, isForced: true },
    select: { facilityTypeId: true },
  });
  const existingTypeIds = new Set(existing.map((e) => e.facilityTypeId));
  for (let index = 0; index < INITIAL_AREA_FACILITY_NAMES.length; index++) {
    const name = INITIAL_AREA_FACILITY_NAMES[index];
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
  await seedRecipes();
  await seedEquipmentTypes();
  await seedCraftRecipes();
  await seedFacilityVariantsAndConstruction();

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

    // spec/044: test1 にメカがいなければ作成し、おんぼろシリーズを装備
    let mech = await prisma.character.findFirst({
      where: { userId: test1.id, category: "mech" },
      select: { id: true },
    });
    if (!mech) {
      const created = await prisma.character.create({
        data: {
          userId: test1.id,
          category: "mech",
          displayName: "メカ",
          iconFilename: null,
          // メカは基礎ステ10/CAP70（7*10）をベースとし、実際の性能はパーツで表現する。
          STR: 10,
          INT: 10,
          VIT: 10,
          WIS: 10,
          DEX: 10,
          AGI: 10,
          LUK: 10,
          CAP: 70,
        },
        select: { id: true },
      });
      mech = created;
      console.log("test1 にメカを1体作成しました");
    }
    await ensureTest1MechHasOnboroEquipped();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
