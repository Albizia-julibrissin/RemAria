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
 *
 * テストユーザー（いずれもパスワード: password123）:
 * - test1@example.com … テストユーザー1（主人公・仲間・通貨・所持品を投入）
 * - test2@example.com … テストユーザー2
 *
 * 初期設備の配置・強制配置はアプリ側で行うため、シードでは行わない。
 */
/// <reference path="../node_modules/.prisma/client/index.d.ts" />
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_USERS = [
  { email: "test1@example.com", accountId: "test_user_1", password: "password123", name: "テストユーザー1" },
  { email: "test2@example.com", accountId: "test_user_2", password: "password123", name: "テストユーザー2" },
] as const;

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

/** test1 に探索用消耗品を各10個所持させる。アイテムが DB に存在すること前提。 */
async function seedTest1Consumables(): Promise<void> {
  const test1 = await prisma.user.findUnique({
    where: { email: "test1@example.com" },
    select: { id: true },
  });
  if (!test1) return;

  const codes = ["consumable_hp_10", "consumable_mp_10"];
  const items = await prisma.item.findMany({
    where: { code: { in: codes } },
    select: { id: true },
  });
  for (const item of items) {
    await prisma.userInventory.upsert({
      where: { userId_itemId: { userId: test1.id, itemId: item.id } },
      create: { userId: test1.id, itemId: item.id, quantity: 10 },
      update: { quantity: 10 },
    });
  }
  console.log("test1: 探索用消耗品を各10個所持");
}

/** test1 にスキル分析書を10冊付与。 */
async function seedTest1SkillBooks(): Promise<void> {
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
  console.log("test1: スキル分析書（メテオスォーム）を10冊所持");
}

/** テスト用データのみ投入。マスタは事前に DB に存在すること（バックアップ復元など）。 */
async function runTest(): Promise<void> {
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
            displayName: user.name,
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
            displayName: user.name,
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
      console.log("Created/updated: test1 の主人公");

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
      }
      console.log("Created/updated: test1 の初期仲間");

      await prisma.user.update({
        where: { id: user.id },
        data: {
          gameCurrencyBalance: 5000,
          premiumCurrencyFreeBalance: 500,
          premiumCurrencyPaidBalance: 500,
        },
      });
      console.log("test1 に通貨を付与");
    }
  }

  await seedTest1Consumables();
  await seedTest1SkillBooks();

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
