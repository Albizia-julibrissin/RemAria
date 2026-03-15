/**
 * シード: テスト用データのみ投入する。
 *
 * 実行方法:
 * - npm run db:seed       … テスト用データを投入する
 * - npm run db:seed:test  … 同上（SEED_TEST=1）
 *
 * マスタ（タグ・設備・アイテム・スキル・敵・エリア・ドロップなど）はシードでは投入しない。
 * 必要なマスタは「管理画面で編集した DB をバックアップし、復元する」運用とする。
 * 手順: manage/BACKUP_RESTORE.md を参照。
 * 例外: 称号マスタ（開拓者・管理人）はシードで投入する。管理人アカウントには称号「管理人」を付与し装備する。
 *
 * ユーザー:
 * - 管理人: 環境変数 ADMIN_EMAIL（未設定時は test1@example.com）で作成。
 *   パスワードは ADMIN_PASSWORD が設定されていればそれを使用、なければランダム生成してコンソールに表示。
 *   管理画面（/dashboard/admin/*）に入室できるのはこのアカウントのみ。
 * - test2@example.com: テスト用（パスワード: password123）
 *
 * 本番で管理用アカウントを使う場合は .env に ADMIN_EMAIL と ADMIN_PASSWORD を設定してからシードを実行すること。
 *
 * 初期設備の配置・強制配置はアプリ側で行うため、シードでは行わない。
 */
/// <reference path="../node_modules/.prisma/client/index.d.ts" />
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "test1@example.com";

/** 管理人アカウント用: メールは env、名前は「管理人」、パスワードは env またはランダム */
function getAdminSeedConfig(): { email: string; accountId: string; password: string; name: string } {
  const email = process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
  const password =
    process.env.ADMIN_PASSWORD ?? crypto.randomBytes(24).toString("base64url");
  return {
    email,
    accountId: "admin",
    password,
    name: "管理人",
  };
}

const TEST_USER_2 = {
  email: "test2@example.com",
  accountId: "test_user_2",
  password: "password123",
  name: "テストユーザー2",
} as const;

/** テスト用：Lv50 時点の基礎ステータス（spec/048）。 */
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

/** テスト主人公・仲間が戦闘スキルを全習得しているようにする。DB にスキルマスタが存在すること前提。 */
async function ensureProtagonistHasAllBattleSkills(characterId: string): Promise<void> {
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
  console.log(`戦闘スキル ${battleSkills.length} 種を習得済みにしました`);
}

/** 管理人に探索用消耗品を各10個所持させる。アイテムが DB に存在すること前提。 */
async function seedAdminConsumables(adminEmail: string): Promise<void> {
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (!admin) return;

  const codes = ["consumable_hp_10", "consumable_mp_10"];
  const items = await prisma.item.findMany({
    where: { code: { in: codes } },
    select: { id: true },
  });
  for (const item of items) {
    await prisma.userInventory.upsert({
      where: { userId_itemId: { userId: admin.id, itemId: item.id } },
      create: { userId: admin.id, itemId: item.id, quantity: 10 },
      update: { quantity: 10 },
    });
  }
  console.log("管理人: 探索用消耗品を各10個所持");
}

/** 管理人にスキル分析書を10冊付与。 */
async function seedAdminSkillBooks(adminEmail: string): Promise<void> {
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (!admin) return;

  const item = await prisma.item.findUnique({
    where: { code: "skill_book_メテオスォーム" },
    select: { id: true },
  });
  if (!item) return;

  await prisma.userInventory.upsert({
    where: { userId_itemId: { userId: admin.id, itemId: item.id } },
    create: { userId: admin.id, itemId: item.id, quantity: 10 },
    update: { quantity: 10 },
  });
  console.log("管理人: スキル分析書（メテオスォーム）を10冊所持");
}

/** 管理人に緊急製造指示書を3枚付与。spec/083。アイテムが DB に存在すること前提。 */
async function seedAdminEmergencyProductionOrder(adminEmail: string): Promise<void> {
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (!admin) return;

  const item = await prisma.item.findUnique({
    where: { code: "emergency_production_order" },
    select: { id: true },
  });
  if (!item) return;

  await prisma.userInventory.upsert({
    where: { userId_itemId: { userId: admin.id, itemId: item.id } },
    create: { userId: admin.id, itemId: item.id, quantity: 3 },
    update: { quantity: 3 },
  });
  console.log("管理人: 緊急製造指示書を3枚所持");
}

/** 管理人に cotton / cotton_equip_part / iron / iron_equip_part を各10000個付与。アイテムが DB に存在すること前提。 */
async function seedAdminCraftMaterials(adminEmail: string): Promise<void> {
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (!admin) return;

  const codes = ["cotton", "cotton_equip_part", "iron", "iron_equip_part"];
  const items = await prisma.item.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  for (const item of items) {
    await prisma.userInventory.upsert({
      where: { userId_itemId: { userId: admin.id, itemId: item.id } },
      create: { userId: admin.id, itemId: item.id, quantity: 10000 },
      update: { quantity: 10000 },
    });
  }
  if (items.length > 0) {
    console.log(`管理人: ${items.map((i) => i.code).join(", ")} を各10000個所持`);
  }
}

/** 管理人に遺物の欠片を3000個付与。docs/086, 087。アイテムが DB に存在すること前提。 */
async function seedAdminRelicShards(adminEmail: string): Promise<void> {
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (!admin) return;

  const item = await prisma.item.findUnique({
    where: { code: "relic_shard" },
    select: { id: true },
  });
  if (!item) return;

  await prisma.userInventory.upsert({
    where: { userId_itemId: { userId: admin.id, itemId: item.id } },
    create: { userId: admin.id, itemId: item.id, quantity: 3000 },
    update: { quantity: 3000 },
  });
  console.log("管理人: 遺物の欠片を3000個所持");
}

/** docs/079: letter_of_recommendation が存在する場合、闇市で 2000 GRA 販売として登録する。 */
async function ensureSystemShopLetterOfRecommendation(): Promise<void> {
  const item = await prisma.item.findUnique({
    where: { code: "letter_of_recommendation" },
    select: { id: true },
  });
  if (!item) return;

  await prisma.systemShopItem.upsert({
    where: {
      marketType_itemId: { marketType: "underground", itemId: item.id },
    },
    create: {
      marketType: "underground",
      itemId: item.id,
      priceGRA: 2000,
      displayOrder: 0,
    },
    update: { priceGRA: 2000 },
  });
  console.log("闇市: letter_of_recommendation を 2000 GRA で登録");
}

/** spec/055: 称号マスタ（開拓者・管理人）をシードで投入。 */
async function ensureTitleMasters(): Promise<void> {
  await prisma.title.upsert({
    where: { code: "kaitakusha" },
    create: {
      code: "kaitakusha",
      name: "開拓者",
      description: "惑星荒廃を生き延び、この星を再び開拓する者。",
      displayOrder: 0,
    },
    update: {},
  });
  await prisma.title.upsert({
    where: { code: "kanrisha" },
    create: {
      code: "kanrisha",
      name: "管理人",
      description: "開拓拠点の運営・管理を担う者。",
      displayOrder: 10,
    },
    update: {},
  });
  console.log("称号マスタ: 開拓者・管理人を投入");
}

/** テスト用データのみ投入。マスタは事前に DB に存在すること（バックアップ復元など）。 */
async function runTest(): Promise<void> {
  await ensureTitleMasters();

  const adminConfig = getAdminSeedConfig();
  const adminPasswordWasRandom = !process.env.ADMIN_PASSWORD;

  const adminHash = await bcrypt.hash(adminConfig.password, 10);
  // 管理人は1件のみ・accountId 固定のため、accountId で upsert（ADMIN_EMAIL 変更時も既存行を更新する）
  const adminUser = await prisma.user.upsert({
    where: { accountId: adminConfig.accountId },
    create: {
      email: adminConfig.email,
      accountId: adminConfig.accountId,
      passwordHash: adminHash,
      name: adminConfig.name,
    },
    update: { email: adminConfig.email, passwordHash: adminHash, name: adminConfig.name },
  });
  console.log(`Created/updated: ${adminConfig.email} (${adminConfig.name})`);

  {
    const existing = await prisma.character.findFirst({
      where: { userId: adminUser.id, category: "protagonist" },
    });
    if (existing) {
      await prisma.character.update({
        where: { id: existing.id },
        data: {
          displayName: adminUser.name,
          iconFilename: "1.gif",
          level: 50,
          ...LEVEL_50_BASE_STATS,
        },
      });
    } else {
      const character = await prisma.character.create({
        data: {
          userId: adminUser.id,
          category: "protagonist",
          displayName: adminUser.name,
          iconFilename: "1.gif",
          level: 50,
          ...LEVEL_50_BASE_STATS,
        },
      });
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { protagonistCharacterId: character.id },
      });
    }
    console.log("Created/updated: 管理人の主人公");

    const existingCompanion = await prisma.character.findFirst({
      where: { userId: adminUser.id, category: "companion" },
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
    } else {
      await prisma.character.create({
        data: {
          userId: adminUser.id,
          category: "companion",
          displayName: "初期仲間",
          iconFilename: "2.gif",
          level: 50,
          ...LEVEL_50_BASE_STATS,
        },
      });
    }
    console.log("Created/updated: 管理人の初期仲間");

    const titleKanrisha = await prisma.title.findUnique({
      where: { code: "kanrisha" },
      select: { id: true },
    });
    if (titleKanrisha) {
      await prisma.userTitleUnlock.upsert({
        where: {
          userId_titleId: { userId: adminUser.id, titleId: titleKanrisha.id },
        },
        create: { userId: adminUser.id, titleId: titleKanrisha.id },
        update: {},
      });
      await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          premiumCurrencyFreeBalance: 1500,
          premiumCurrencyPaidBalance: 1500,
          marketUnlocked: true, // spec/075: 管理人で市場を利用可能に
          researchPoint: 300, // 研究記録書（研究メニュー用）
          selectedTitleId: titleKanrisha.id, // spec/055: 称号「管理人」を装備
        },
      });
      console.log("管理人に GRA・研究ポイント300・市場アンロック・称号「管理人」付与");
    } else {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          premiumCurrencyFreeBalance: 1500,
          premiumCurrencyPaidBalance: 1500,
          marketUnlocked: true,
          researchPoint: 300,
        },
      });
      console.log("管理人に GRA・研究ポイント300・市場アンロック付与");
    }
  }

  const test2Hash = await bcrypt.hash(TEST_USER_2.password, 10);
  await prisma.user.upsert({
    where: { email: TEST_USER_2.email },
    create: {
      email: TEST_USER_2.email,
      accountId: TEST_USER_2.accountId,
      passwordHash: test2Hash,
      name: TEST_USER_2.name,
    },
    update: { accountId: TEST_USER_2.accountId, passwordHash: test2Hash, name: TEST_USER_2.name },
  });
  console.log(`Created/updated: ${TEST_USER_2.email}`);

  await seedAdminConsumables(adminConfig.email);
  await seedAdminSkillBooks(adminConfig.email);
  await seedAdminEmergencyProductionOrder(adminConfig.email);
  await seedAdminCraftMaterials(adminConfig.email);
  await seedAdminRelicShards(adminConfig.email);

  const adminForSeed = await prisma.user.findUnique({
    where: { email: adminConfig.email },
    select: { id: true, protagonistCharacterId: true },
  });
  if (adminForSeed) {
    if (adminForSeed.protagonistCharacterId) {
      await ensureProtagonistHasAllBattleSkills(adminForSeed.protagonistCharacterId);
      await prisma.character.update({
        where: { id: adminForSeed.protagonistCharacterId },
        data: { level: 50, ...LEVEL_50_BASE_STATS },
      });
    }
    const companions = await prisma.character.findMany({
      where: { userId: adminForSeed.id, category: "companion" },
      select: { id: true },
    });
    for (const c of companions) {
      await ensureProtagonistHasAllBattleSkills(c.id);
      await prisma.character.update({
        where: { id: c.id },
        data: { level: 50, ...LEVEL_50_BASE_STATS },
      });
    }
  }

  if (adminPasswordWasRandom) {
    console.log("\n--- 管理人アカウント（初回ログイン用） ---");
    console.log(`メール: ${adminConfig.email}`);
    console.log(`パスワード: ${adminConfig.password}`);
    console.log("※ 本番では .env に ADMIN_EMAIL と ADMIN_PASSWORD を設定してシードを実行してください。\n");
  }
}

async function main(): Promise<void> {
  const testOnly = process.env.SEED_TEST === "1";
  if (testOnly) {
    console.log("--- テスト用データのみ投入 (SEED_TEST=1) ---");
  } else {
    console.log("--- シード実行（テスト用データのみ） ---");
    console.log("マスタはシードでは投入しません。バックアップ復元または管理画面で用意してください。");
  }
  await runTest();
  await ensureSystemShopLetterOfRecommendation();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
