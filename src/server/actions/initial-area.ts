"use server";

// spec/035_initial_area_facilities.md - 初期エリア・設備配置と生産チェーン
// docs/019 - 受け取り可能サイクル数のプレビュー

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/** docs/019: 生産キャップ 24 時間 */
const PRODUCTION_CAP_MINUTES = 1440;

/** テストアカウントのメール（遺跡跡エリアを解放する）。 */
const TEST_USER_EMAILS = ["test1@example.com", "test2@example.com"] as const;

function isTestUser(email: string | null): boolean {
  if (!email) return false;
  return (TEST_USER_EMAILS as readonly string[]).includes(email.toLowerCase());
}

const INITIAL_AREA_FACILITY_NAMES = [
  "川探索拠点",
  "浄水施設",
  "小麦畑",
  "小麦製粉器",
  "携帯食料包装",
] as const;

export type InitialAreaFacility = {
  id: string;
  facilityTypeId: string;
  facilityName: string;
  cost: number;
  displayOrder: number;
  /** 受け取り可能サイクル数（019）。0 のときも受け取りボタンは表示し、押下で「受け取り可能な生産がありません」と返す。 */
  receivableCycles: number;
  /** 受け取り可能な出力合計数（receivableCycles * recipe.outputAmount） */
  receivableOutputAmount: number;
  recipe: {
    cycleMinutes: number;
    outputItemName: string;
    outputAmount: number;
    inputs: { itemName: string; amount: number; itemId: string }[];
  } | null;
};

export type GetInitialAreaResult = {
  placementArea: { id: string; name: string; maxCost: number; maxSlots: number };
  facilities: InitialAreaFacility[];
  usedCost: number;
  usedSlots: number;
};

export type PlacementAreaOption = { code: string; name: string };

export type GetFacilitiesPageDataResult = {
  availableAreas: PlacementAreaOption[];
  selectedAreaCode: string;
  currentArea: GetInitialAreaResult;
};

/** ユーザーの初期エリアに強制配置 5 設備が無ければ作成する。冪等。spec/035 */
export async function ensureInitialAreaFacilities(userId: string): Promise<void> {
  const area = await prisma.placementArea.findUnique({ where: { code: "initial" } });
  if (!area) return;
  const existing = await prisma.facilityInstance.count({
    where: { userId, placementAreaId: area.id },
  });
  if (existing >= 5) return;

  const facilityTypes = await prisma.facilityType.findMany({
    where: { name: { in: [...INITIAL_AREA_FACILITY_NAMES] } },
    select: { id: true, name: true },
  });
  const byName = new Map(facilityTypes.map((f) => [f.name, f.id]));
  let displayOrder = 0;
  for (const name of INITIAL_AREA_FACILITY_NAMES) {
    const facilityTypeId = byName.get(name);
    if (!facilityTypeId) continue;
    displayOrder += 1;
    await prisma.facilityInstance.upsert({
      where: {
        userId_placementAreaId_facilityTypeId_variantCode: {
          userId,
          placementAreaId: area.id,
          facilityTypeId,
          variantCode: "base",
        },
      },
      create: {
        userId,
        placementAreaId: area.id,
        facilityTypeId,
        variantCode: "base",
        displayOrder,
      },
      update: { displayOrder },
    });
  }
}

/** 初期エリア情報を取得。未作成なら ensure してから返す。spec/035 */
export async function getInitialArea(): Promise<GetInitialAreaResult | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  await ensureInitialAreaFacilities(session.userId);

  const area = await prisma.placementArea.findUnique({
    where: { code: "initial" },
  });
  if (!area) return null;

  const instances = await prisma.facilityInstance.findMany({
    where: { userId: session.userId, placementAreaId: area.id },
    orderBy: { displayOrder: "asc" },
    include: {
      facilityType: {
        include: {
          recipes: {
            include: {
              outputItem: true,
              inputs: { include: { item: true } },
            },
          },
        },
      },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { createdAt: true },
  });
  const inventories = await prisma.userInventory.findMany({
    where: { userId: session.userId },
    select: { itemId: true, quantity: true },
  });
  const qtyByItemId = new Map(inventories.map((i) => [i.itemId, i.quantity]));

  const now = new Date();
  let usedCost = 0;
  const facilities: InitialAreaFacility[] = instances.map((inst) => {
    usedCost += inst.facilityType.cost;
    const recipe = inst.facilityType.recipes[0] ?? null;
    let receivableCycles = 0;
    let receivableOutputAmount = 0;
    if (recipe) {
      const isInitial = area.code === "initial";
      const effectiveLast = inst.lastReceivedAt ?? (isInitial ? user?.createdAt ?? inst.createdAt : inst.createdAt);
      const elapsedMs = Math.max(0, now.getTime() - effectiveLast.getTime());
      const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
      const cappedMinutes = Math.min(elapsedMinutes, PRODUCTION_CAP_MINUTES);
      let cyclesByTime = Math.floor(cappedMinutes / recipe.cycleMinutes);
      if (recipe.inputs.length > 0) {
        for (const input of recipe.inputs) {
          const have = qtyByItemId.get(input.itemId) ?? 0;
          cyclesByTime = Math.min(cyclesByTime, Math.floor(have / input.amount));
        }
      }
      receivableCycles = Math.max(0, cyclesByTime);
      receivableOutputAmount = recipe.outputAmount * receivableCycles;
    }
    return {
      id: inst.id,
      facilityTypeId: inst.facilityTypeId,
      facilityName: inst.facilityType.name,
      cost: inst.facilityType.cost,
      displayOrder: inst.displayOrder,
      receivableCycles,
      receivableOutputAmount,
      recipe: recipe
        ? {
            cycleMinutes: recipe.cycleMinutes,
            outputItemName: recipe.outputItem.name,
            outputAmount: recipe.outputAmount,
            inputs: recipe.inputs.map((ri) => ({
              itemName: ri.item.name,
              amount: ri.amount,
              itemId: ri.itemId,
            })),
          }
        : null,
    };
  });

  return {
    placementArea: {
      id: area.id,
      name: area.name,
      maxCost: area.maxCost,
      maxSlots: area.maxSlots,
    },
    facilities,
    usedCost,
    usedSlots: facilities.length,
  };
}

/**
 * 工業エリア画面用。解放済みエリア一覧と、選択中エリアの設備一覧を返す。
 * テストアカウントのみ「遺跡跡」を解放。選択は searchParams.area で渡す。
 */
export async function getFacilitiesPageData(
  selectedAreaCode?: string | null
): Promise<GetFacilitiesPageDataResult | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  await ensureInitialAreaFacilities(session.userId);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, createdAt: true },
  });
  if (!user) return null;

  const availableAreas: PlacementAreaOption[] = [
    { code: "initial", name: "廃墟街再興地" },
  ];
  if (isTestUser(user.email)) {
    availableAreas.push({ code: "ruins", name: "遺跡跡" });
  }

  const code = selectedAreaCode && availableAreas.some((a) => a.code === selectedAreaCode)
    ? selectedAreaCode
    : "initial";

  const area = await prisma.placementArea.findUnique({ where: { code } });
  if (!area) {
    const fallback = await prisma.placementArea.findUnique({ where: { code: "initial" } });
    if (!fallback) return null;
    const data = await buildAreaResult(session.userId, fallback, user.createdAt);
    return data ? { availableAreas, selectedAreaCode: "initial", currentArea: data } : null;
  }

  const data = await buildAreaResult(session.userId, area, user.createdAt);
  if (!data) return null;
  return { availableAreas, selectedAreaCode: code, currentArea: data };
}

async function buildAreaResult(
  userId: string,
  area: { id: string; name: string; maxCost: number; maxSlots: number; code: string },
  userCreatedAt: Date
): Promise<GetInitialAreaResult | null> {
  const instances = await prisma.facilityInstance.findMany({
    where: { userId, placementAreaId: area.id },
    orderBy: { displayOrder: "asc" },
    include: {
      facilityType: {
        include: {
          recipes: {
            include: {
              outputItem: true,
              inputs: { include: { item: true } },
            },
          },
        },
      },
    },
  });

  const inventories = await prisma.userInventory.findMany({
    where: { userId },
    select: { itemId: true, quantity: true },
  });
  const qtyByItemId = new Map(inventories.map((i) => [i.itemId, i.quantity]));
  const now = new Date();

  let usedCost = 0;
  const facilities: InitialAreaFacility[] = instances.map((inst) => {
    usedCost += inst.facilityType.cost;
    const recipe = inst.facilityType.recipes[0] ?? null;
    let receivableCycles = 0;
    let receivableOutputAmount = 0;
    if (recipe) {
      const isInitial = area.code === "initial";
      const effectiveLast = inst.lastReceivedAt ?? (isInitial ? userCreatedAt : inst.createdAt);
      const elapsedMs = Math.max(0, now.getTime() - effectiveLast.getTime());
      const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
      const cappedMinutes = Math.min(elapsedMinutes, PRODUCTION_CAP_MINUTES);
      let cyclesByTime = Math.floor(cappedMinutes / recipe.cycleMinutes);
      if (recipe.inputs.length > 0) {
        for (const input of recipe.inputs) {
          const have = qtyByItemId.get(input.itemId) ?? 0;
          cyclesByTime = Math.min(cyclesByTime, Math.floor(have / input.amount));
        }
      }
      receivableCycles = Math.max(0, cyclesByTime);
      receivableOutputAmount = recipe.outputAmount * receivableCycles;
    }
    return {
      id: inst.id,
      facilityTypeId: inst.facilityTypeId,
      facilityName: inst.facilityType.name,
      cost: inst.facilityType.cost,
      displayOrder: inst.displayOrder,
      receivableCycles,
      receivableOutputAmount,
      recipe: recipe
        ? {
            cycleMinutes: recipe.cycleMinutes,
            outputItemName: recipe.outputItem.name,
            outputAmount: recipe.outputAmount,
            inputs: recipe.inputs.map((ri) => ({
              itemName: ri.item.name,
              amount: ri.amount,
              itemId: ri.itemId,
            })),
          }
        : null,
    };
  });

  return {
    placementArea: {
      id: area.id,
      name: area.name,
      maxCost: area.maxCost,
      maxSlots: area.maxSlots,
    },
    facilities,
    usedCost,
    usedSlots: facilities.length,
  };
}
