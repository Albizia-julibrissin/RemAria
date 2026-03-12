// migrate_initial_facilities_and_items_to_basic_kit.cjs
//
// 目的:
// - 旧「水→浄水→小麦→小麦粉→携帯食料」チェーンを、
//   docs/064_game_cycle_design.md の「食糧→携帯食糧／備品→探索備品→基本探索キット」チェーンに
//   置き換えるための **開発/検証用スクリプト**。
//
// 対象:
// - FacilityType.name が以下の 5 件である設備
//   - 川探索
//   - 浄水施設
//   - 小麦畑
//   - 小麦製粉器
//   - 携帯食料包装
// - Item.code が以下の 5 件であるアイテム
//   - water
//   - drinkable_water
//   - wheat
//   - flour
//   - portable_ration
//
// 変更内容（概略）:
// - 上記 5 アイテムの code / name を新チェーン用にリネーム
//   - water            → code: food,                name: 食糧
//   - drinkable_water  → code: packed_food,         name: 携帯食糧
//   - wheat            → code: supply,              name: 備品
//   - flour            → code: exploration_supply,  name: 探索備品
//   - portable_ration  → code: basic_exploration_kit, name: 基本探索キット
// - 上記 5 設備の name を新チェーン用にリネームし、レシピを docs/064 の案に合わせて更新
//   - 食糧生産設備（旧 川探索）: 10 分ごとに 食糧 70
//   - 携帯食糧包装（旧 浄水施設）: 10 分ごとに 食糧 70 → 携帯食糧 70
//   - 備品生産設備（旧 小麦畑）: 10 分ごとに 備品 70
//   - 探索備品包装（旧 小麦製粉器）: 10 分ごとに 備品 70 → 探索備品 70
//   - 基本探索キット組立（旧 携帯食料包装）: 5 分ごとに 携帯食糧 70 ＋ 探索備品 70 → 基本探索キット 70
//
// 注意:
// - 本番 DB に対して直接実行しないこと。必ずバックアップを取得し、まずは開発/検証環境で挙動を確認してください。
// - マスタは管理画面や手作業で編集されている可能性があるため、WHERE で対象が見つからない場合はログだけ出して何もしません。

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ITEM_CODE_MAPPING = [
  {
    oldCode: "water",
    newCode: "food",
    newName: "食糧",
  },
  {
    oldCode: "drinkable_water",
    newCode: "packed_food",
    newName: "携帯食糧",
  },
  {
    oldCode: "wheat",
    newCode: "supply",
    newName: "備品",
  },
  {
    oldCode: "flour",
    newCode: "exploration_supply",
    newName: "探索備品",
  },
  {
    oldCode: "portable_ration",
    newCode: "basic_exploration_kit",
    newName: "基本探索キット",
  },
];

const FACILITY_MAPPING = [
  {
    oldName: "川探索",
    newName: "食糧生産設備",
    newDescription: "食糧を生産する設備。10分ごとに一定量の食糧を生み出す。",
    recipe: {
      cycleMinutes: 10,
      outputItemCode: "food",
      outputAmount: 70,
      inputs: [],
    },
  },
  {
    oldName: "浄水施設",
    newName: "携帯食糧包装",
    newDescription: "食糧を携帯食糧に加工する設備。10分ごとに一定量を包装する。",
    recipe: {
      cycleMinutes: 10,
      outputItemCode: "packed_food",
      outputAmount: 70,
      inputs: [{ itemCode: "food", amount: 70 }],
    },
  },
  {
    oldName: "小麦畑",
    newName: "備品生産設備",
    newDescription: "探索備品の元となる備品を生産する設備。10分ごとに一定量の備品を生み出す。",
    recipe: {
      cycleMinutes: 10,
      outputItemCode: "supply",
      outputAmount: 70,
      inputs: [],
    },
  },
  {
    oldName: "小麦製粉器",
    newName: "探索備品包装",
    newDescription: "備品を探索備品に加工する設備。10分ごとに一定量を包装する。",
    recipe: {
      cycleMinutes: 10,
      outputItemCode: "exploration_supply",
      outputAmount: 70,
      inputs: [{ itemCode: "supply", amount: 70 }],
    },
  },
  {
    oldName: "携帯食料包装",
    newName: "基本探索キット組立",
    newDescription:
      "携帯食糧と探索備品から基本探索キットを組み立てる設備。5分ごとに一定量の基本探索キットを生産する。",
    recipe: {
      cycleMinutes: 5,
      outputItemCode: "basic_exploration_kit",
      outputAmount: 70,
      inputs: [
        { itemCode: "packed_food", amount: 70 },
        { itemCode: "exploration_supply", amount: 70 },
      ],
    },
  },
];

async function renameItems() {
  console.log("=== Renaming items for basic exploration kit chain ===");

  // 新コードが既に存在しないか一応チェックしておく
  const existingNewCodes = await prisma.item.findMany({
    where: { code: { in: ITEM_CODE_MAPPING.map((m) => m.newCode) } },
    select: { code: true },
  });
  if (existingNewCodes.length > 0) {
    console.warn(
      "WARNING: 以下の newCode を持つ Item が既に存在します:",
      existingNewCodes.map((i) => i.code)
    );
    console.warn(
      "このスクリプトは既存行の code/name を上書きする想定なので、重複がある場合は手作業で調整してください。"
    );
  }

  for (const mapping of ITEM_CODE_MAPPING) {
    const item = await prisma.item.findUnique({
      where: { code: mapping.oldCode },
    });
    if (!item) {
      console.log(`Item(code='${mapping.oldCode}') が見つかりませんでした。スキップします。`);
      continue;
    }

    console.log(
      `Updating Item '${mapping.oldCode}' -> code='${mapping.newCode}', name='${mapping.newName}' (id=${item.id})`
    );
    await prisma.item.update({
      where: { id: item.id },
      data: {
        code: mapping.newCode,
        name: mapping.newName,
      },
    });
  }
}

async function updateFacilitiesAndRecipes() {
  console.log("=== Updating facilities and recipes for basic exploration kit chain ===");

  // Item を新コードで引けるようにしておく
  const itemByCode = {};
  const items = await prisma.item.findMany({
    where: { code: { in: ITEM_CODE_MAPPING.map((m) => m.newCode) } },
  });
  for (const it of items) {
    itemByCode[it.code] = it;
  }

  for (const f of FACILITY_MAPPING) {
    // oldName か newName のどちらかに一致するものを拾う（再実行に強くするため）
    const facility = await prisma.facilityType.findFirst({
      where: {
        OR: [{ name: f.oldName }, { name: f.newName }],
      },
    });
    if (!facility) {
      console.log(
        `FacilityType(name='${f.oldName}' または '${f.newName}') が見つかりませんでした。スキップします。`
      );
      continue;
    }

    console.log(
      `Updating FacilityType '${facility.name}' (id=${facility.id}) -> name='${f.newName}'`
    );

    await prisma.facilityType.update({
      where: { id: facility.id },
      data: {
        name: f.newName,
        description: f.newDescription,
      },
    });

    // レシピ本体
    const outputItem = itemByCode[f.recipe.outputItemCode];
    if (!outputItem) {
      console.warn(
        `  WARN: outputItemCode='${f.recipe.outputItemCode}' の Item が見つからないため、Recipe 更新をスキップします。`
      );
      continue;
    }

    let recipe = await prisma.recipe.findUnique({
      where: { facilityTypeId: facility.id },
    });

    if (!recipe) {
      console.log(`  Recipe が存在しないため新規作成します。`);
      recipe = await prisma.recipe.create({
        data: {
          facilityTypeId: facility.id,
          cycleMinutes: f.recipe.cycleMinutes,
          outputItemId: outputItem.id,
          outputAmount: f.recipe.outputAmount,
        },
      });
    } else {
      console.log(
        `  Updating Recipe(id=${recipe.id}) cycleMinutes=${f.recipe.cycleMinutes}, outputItem='${f.recipe.outputItemCode}', outputAmount=${f.recipe.outputAmount}`
      );
      recipe = await prisma.recipe.update({
        where: { id: recipe.id },
        data: {
          cycleMinutes: f.recipe.cycleMinutes,
          outputItemId: outputItem.id,
          outputAmount: f.recipe.outputAmount,
        },
      });
    }

    // 既存の入力レシピを削除してから、新しい inputs を作り直す
    console.log(`  Clearing existing RecipeInput for recipeId=${recipe.id}`);
    await prisma.recipeInput.deleteMany({
      where: { recipeId: recipe.id },
    });

    if (f.recipe.inputs.length > 0) {
      console.log(`  Inserting ${f.recipe.inputs.length} RecipeInput rows...`);
      for (const input of f.recipe.inputs) {
        const inputItem = itemByCode[input.itemCode];
        if (!inputItem) {
          console.warn(
            `    WARN: input.itemCode='${input.itemCode}' の Item が見つからず、この入力はスキップされます。`
          );
          continue;
        }
        await prisma.recipeInput.create({
          data: {
            recipeId: recipe.id,
            itemId: inputItem.id,
            amount: input.amount,
          },
        });
      }
    } else {
      console.log(`  No inputs for this facility (resource production only).`);
    }
  }
}

async function main() {
  try {
    console.log("=== migrate_initial_facilities_and_items_to_basic_kit.cjs ===");
    console.log("このスクリプトは開発/検証環境向けです。実行前に必ず DB のバックアップを取得してください。");

    await renameItems();
    await updateFacilitiesAndRecipes();

    console.log("Done.");
  } catch (e) {
    console.error("Migration script failed:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

