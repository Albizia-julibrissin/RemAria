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
  { email: "test1@example.com", password: "password123", name: "テストユーザー1" },
  { email: "test2@example.com", password: "password123", name: "テストユーザー2" },
] as const;

/** docs/10_battle_status.csv 物理型A の基礎ステータス（15行目。7種＋CAP） */
const PHYSICAL_TYPE_A_STATS = {
  STR: 210,
  INT: 20,
  VIT: 80,
  WIS: 30,
  DEX: 140,
  AGI: 210,
  LUK: 10,
  CAP: 700,
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
const ITEMS = [
  { code: "water", name: "水" },
  { code: "drinkable_water", name: "飲料水" },
  { code: "wheat", name: "小麦" },
  { code: "flour", name: "小麦粉" },
  { code: "portable_ration", name: "携帯食料" },
] as const;

/** spec/030, docs/15: 工業スキル 5 種。対象タグの設備に配備時のみ効果。 */
const INDUSTRIAL_SKILLS = [
  { name: "水の心得", description: "水に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "water", effectType: "time_reduction" as const, effectValue: 5 },
  { name: "水質管理", description: "水に関わる工業設備に配備時、生産量が3%アップ。", targetTagCode: "water", effectType: "production_bonus" as const, effectValue: 3 },
  { name: "採掘の勘", description: "鉱石に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "ore", effectType: "time_reduction" as const, effectValue: 5 },
  { name: "精錬の手慣れ", description: "精錬に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "smelt", effectType: "time_reduction" as const, effectValue: 5 },
  { name: "鍛冶の才", description: "金属に関わる工業設備に配備時、作業時間が5%短縮。", targetTagCode: "metal", effectType: "time_reduction" as const, effectValue: 5 },
] as const;

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

/** spec/035: 素材・製品マスタ。 */
async function seedItems() {
  for (const i of ITEMS) {
    await prisma.item.upsert({
      where: { code: i.code },
      create: { code: i.code, name: i.name },
      update: { name: i.name },
    });
  }
  console.log(`Items: ${ITEMS.length} 件 upsert`);
}

/** spec/035, docs/018: 設置エリア。初期=廃墟街再興地、テスト用に遺跡跡を追加。 */
async function seedPlacementArea() {
  await prisma.placementArea.upsert({
    where: { code: "initial" },
    create: { code: "initial", name: "廃墟街再興地", maxCost: 200, maxSlots: 5 },
    update: { name: "廃墟街再興地", maxCost: 200, maxSlots: 5 },
  });
  await prisma.placementArea.upsert({
    where: { code: "ruins" },
    create: { code: "ruins", name: "遺跡跡", maxCost: 200, maxSlots: 5 },
    update: { name: "遺跡跡", maxCost: 200, maxSlots: 5 },
  });
  console.log("PlacementArea: initial と ruins の 2 件 upsert");
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

/** spec/035: ユーザーの初期エリアに強制配置 5 設備が無ければ作成。 */
async function ensureInitialAreaFacilitiesForUser(userId: string) {
  const area = await prisma.placementArea.findUnique({ where: { code: "initial" } });
  if (!area) return;
  const existing = await prisma.facilityInstance.count({ where: { userId, placementAreaId: area.id } });
  if (existing >= 5) return;
  const facilityByName = new Map<string, { id: string }>();
  for (const f of await prisma.facilityType.findMany({ where: { name: { in: [...INITIAL_AREA_FACILITY_NAMES] } }, select: { id: true, name: true } })) {
    facilityByName.set(f.name, { id: f.id });
  }
  let order = 0;
  for (const name of INITIAL_AREA_FACILITY_NAMES) {
    const ft = facilityByName.get(name);
    if (!ft) continue;
    await prisma.facilityInstance.upsert({
      where: {
        userId_placementAreaId_facilityTypeId_variantCode: {
          userId,
          placementAreaId: area.id,
          facilityTypeId: ft.id,
          variantCode: "base",
        },
      },
      create: {
        userId,
        placementAreaId: area.id,
        facilityTypeId: ft.id,
        variantCode: "base",
        displayOrder: ++order,
      },
      update: { displayOrder: ++order },
    });
  }
}

async function main() {
  for (const u of TEST_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, passwordHash, name: u.name },
      update: { passwordHash, name: u.name },
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
            displayName: "テスト主人公",
            iconFilename: "1.gif",
            ...PHYSICAL_TYPE_A_STATS,
          },
        });
      } else {
        const character = await prisma.character.create({
          data: {
            userId: user.id,
            category: "protagonist",
            displayName: "テスト主人公",
            iconFilename: "1.gif",
            ...PHYSICAL_TYPE_A_STATS,
          },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { protagonistCharacterId: character.id },
        });
      }
      console.log("Created/updated: test1 の主人公（物理型A）");
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
  await seedItems();
  await seedPlacementArea();
  await seedRecipes();

  for (const u of TEST_USERS) {
    const user = await prisma.user.findUnique({ where: { email: u.email } });
    if (user) {
      await ensureInitialAreaFacilitiesForUser(user.id);
    }
  }
  console.log("Initial area facilities: テストユーザーに 5 設備を確保");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
