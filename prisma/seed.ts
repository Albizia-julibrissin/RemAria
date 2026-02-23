/**
 * テスト用サンプルデータ
 * 実行: npm run db:seed
 *
 * 投入されるテストユーザー（いずれもパスワード: password123）
 * - test1@example.com … テストユーザー1（主人公作成済み・物理型A）
 * - test2@example.com … テストユーザー2
 *
 * 主人公の基礎ステータス（物理型A）: docs/10_battle_status.csv 14行目
 * STR=210, INT=20, VIT=80, DEX=140, AGI→SPD=210, LUK=10, CAP=700
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_USERS = [
  { email: "test1@example.com", password: "password123", name: "テストユーザー1" },
  { email: "test2@example.com", password: "password123", name: "テストユーザー2" },
] as const;

/** docs/10_battle_status.csv 物理型A の基礎ステータス（WIS/AGI は INT/SPD で対応） */
const PHYSICAL_TYPE_A_STATS = {
  STR: 210,
  INT: 20,
  DEX: 140,
  VIT: 80,
  SPD: 210,
  LUK: 10,
  CAP: 700,
} as const;

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
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
