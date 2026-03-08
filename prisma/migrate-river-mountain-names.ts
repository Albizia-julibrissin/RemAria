/**
 * 川・山の設備名を「川探索」「山探索」に統一する（DB は消さない）。
 * 川探索拠点 → 川探索、山探索拠点 → 山探索 にリネームまたは参照を移行してから旧行を削除する。
 *
 * 実行: npx tsx prisma/migrate-river-mountain-names.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const riverOld = await prisma.facilityType.findUnique({ where: { name: "川探索拠点" }, select: { id: true } });
  const riverNew = await prisma.facilityType.findUnique({ where: { name: "川探索" }, select: { id: true } });
  const mountainOld = await prisma.facilityType.findUnique({ where: { name: "山探索拠点" }, select: { id: true } });
  const mountainNew = await prisma.facilityType.findUnique({ where: { name: "山探索" }, select: { id: true } });

  if (!riverOld && !mountainOld) {
    console.log("川探索拠点・山探索拠点はどちらも存在しません。処理不要です。");
    return;
  }

  // --- 川 ---
  if (riverOld) {
    if (riverNew) {
      console.log("川探索拠点 の参照を 川探索 に移行してから 川探索拠点 を削除します。");
      const idOld = riverOld.id;
      const idNew = riverNew.id;
      const userIdsOld = await prisma.userFacilityTypeUnlock.findMany({
        where: { facilityTypeId: idOld },
        select: { userId: true },
      });
      await prisma.facilityInstance.updateMany({ where: { facilityTypeId: idOld }, data: { facilityTypeId: idNew } });
      await prisma.userFacilityTypeUnlock.deleteMany({ where: { facilityTypeId: idOld } });
      for (const u of userIdsOld) {
        await prisma.userFacilityTypeUnlock.upsert({
          where: { userId_facilityTypeId: { userId: u.userId, facilityTypeId: idNew } },
          create: { userId: u.userId, facilityTypeId: idNew },
          update: {},
        });
      }
      const recipeNew = await prisma.recipe.findUnique({ where: { facilityTypeId: idNew }, select: { id: true } });
      const recipeOld = await prisma.recipe.findUnique({ where: { facilityTypeId: idOld }, select: { id: true } });
      if (recipeOld) {
        if (recipeNew) {
          await prisma.recipe.delete({ where: { id: recipeOld.id } });
        } else {
          await prisma.recipe.update({ where: { id: recipeOld.id }, data: { facilityTypeId: idNew } });
        }
      }
      const variantsOld = await prisma.facilityVariant.findMany({
        where: { facilityTypeId: idOld },
        select: { id: true, variantCode: true },
      });
      for (const v of variantsOld) {
        const exists = await prisma.facilityVariant.findUnique({
          where: { facilityTypeId_variantCode: { facilityTypeId: idNew, variantCode: v.variantCode } },
        });
        if (exists) {
          await prisma.facilityVariant.delete({ where: { id: v.id } });
        } else {
          await prisma.facilityVariant.update({ where: { id: v.id }, data: { facilityTypeId: idNew } });
        }
      }
      const tagIdsOld = await prisma.facilityTypeTag.findMany({
        where: { facilityTypeId: idOld },
        select: { tagId: true },
      });
      await prisma.facilityTypeTag.deleteMany({ where: { facilityTypeId: idOld } });
      for (const t of tagIdsOld) {
        await prisma.facilityTypeTag.upsert({
          where: { facilityTypeId_tagId: { facilityTypeId: idNew, tagId: t.tagId } },
          create: { facilityTypeId: idNew, tagId: t.tagId },
          update: {},
        });
      }
      await prisma.researchGroupItem.updateMany({
        where: { targetType: "facility_type", targetId: idOld },
        data: { targetId: idNew },
      });
      await prisma.researchUnlockCost.updateMany({
        where: { targetType: "facility_type", targetId: idOld },
        data: { targetId: idNew },
      });
      await prisma.facilityType.delete({ where: { id: idOld } });
      console.log("川探索拠点 を削除しました。");
    } else {
      await prisma.facilityType.update({ where: { id: riverOld.id }, data: { name: "川探索" } });
      console.log("川探索拠点 を 川探索 にリネームしました。");
    }
  }

  // --- 山 ---
  if (mountainOld) {
    if (mountainNew) {
      console.log("山探索拠点 の参照を 山探索 に移行してから 山探索拠点 を削除します。");
      const idOld = mountainOld.id;
      const idNew = mountainNew.id;
      const userIdsOld = await prisma.userFacilityTypeUnlock.findMany({
        where: { facilityTypeId: idOld },
        select: { userId: true },
      });
      await prisma.facilityInstance.updateMany({ where: { facilityTypeId: idOld }, data: { facilityTypeId: idNew } });
      await prisma.userFacilityTypeUnlock.deleteMany({ where: { facilityTypeId: idOld } });
      for (const u of userIdsOld) {
        await prisma.userFacilityTypeUnlock.upsert({
          where: { userId_facilityTypeId: { userId: u.userId, facilityTypeId: idNew } },
          create: { userId: u.userId, facilityTypeId: idNew },
          update: {},
        });
      }
      const recipeNewM = await prisma.recipe.findUnique({ where: { facilityTypeId: idNew }, select: { id: true } });
      const recipeOldM = await prisma.recipe.findUnique({ where: { facilityTypeId: idOld }, select: { id: true } });
      if (recipeOldM) {
        if (recipeNewM) {
          await prisma.recipe.delete({ where: { id: recipeOldM.id } });
        } else {
          await prisma.recipe.update({ where: { id: recipeOldM.id }, data: { facilityTypeId: idNew } });
        }
      }
      const variantsOld = await prisma.facilityVariant.findMany({
        where: { facilityTypeId: idOld },
        select: { id: true, variantCode: true },
      });
      for (const v of variantsOld) {
        const exists = await prisma.facilityVariant.findUnique({
          where: { facilityTypeId_variantCode: { facilityTypeId: idNew, variantCode: v.variantCode } },
        });
        if (exists) {
          await prisma.facilityVariant.delete({ where: { id: v.id } });
        } else {
          await prisma.facilityVariant.update({ where: { id: v.id }, data: { facilityTypeId: idNew } });
        }
      }
      const tagIdsOld = await prisma.facilityTypeTag.findMany({
        where: { facilityTypeId: idOld },
        select: { tagId: true },
      });
      await prisma.facilityTypeTag.deleteMany({ where: { facilityTypeId: idOld } });
      for (const t of tagIdsOld) {
        await prisma.facilityTypeTag.upsert({
          where: { facilityTypeId_tagId: { facilityTypeId: idNew, tagId: t.tagId } },
          create: { facilityTypeId: idNew, tagId: t.tagId },
          update: {},
        });
      }
      await prisma.researchGroupItem.updateMany({
        where: { targetType: "facility_type", targetId: idOld },
        data: { targetId: idNew },
      });
      await prisma.researchUnlockCost.updateMany({
        where: { targetType: "facility_type", targetId: idOld },
        data: { targetId: idNew },
      });
      await prisma.facilityType.delete({ where: { id: idOld } });
      console.log("山探索拠点 を削除しました。");
    } else {
      await prisma.facilityType.update({ where: { id: mountainOld.id }, data: { name: "山探索" } });
      console.log("山探索拠点 を 山探索 にリネームしました。");
    }
  }

  console.log("完了しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
