# 設備生産レシピ編集（管理者用）

設備種別ごとの生産レシピ（Recipe）の周期・出力・入力素材を編集・新規作成する管理機能。spec/035 の設備生産用レシピ（クラフトレシピとは別）。

- **Spec 正本**: spec/035（初期エリア・設備）、Recipe / RecipeInput。
- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/recipes/`（一覧・新規・編集画面）。

---

## 1. 目的・前提

- **目的**: 設備の生産周期・出力アイテム・出力数・入力素材を、コードを触らずに変更・追加できるようにする。
- **前提**: 対象は **テストユーザー1** のみ。1 設備に 1 レシピまで（Recipe.facilityTypeId はユニーク）。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **一覧 URL** | `/dashboard/admin/recipes`。全設備生産レシピをテーブル表示。「新規作成」でレシピ未登録の設備にレシピを追加。 |
| **新規作成 URL** | `/dashboard/admin/recipes/new`。レシピ未登録の設備を選択し、周期・出力・入力素材を登録。作成後は編集画面へ遷移。 |
| **編集 URL** | `/dashboard/admin/recipes/[id]`。周期・出力アイテム・出力数・入力素材を編集。設備は変更不可。 |
| **入口** | 実装済み一覧（`/dashboard/admin/content`）の「設備生産レシピ編集」リンク。 |

---

## 3. API（Server Actions）

いずれも `src/server/actions/admin.ts`。テストユーザー1のみ。

| 関数名 | 役割 |
|--------|------|
| `getAdminRecipeList()` | 全 Recipe 一覧（設備名・種別・周期・出力・入力件数）。 |
| `getAdminRecipe(recipeId)` | 1件取得（編集用。inputs 含む）。 |
| `getAdminRecipeOptions()` | フォーム用: items、facilityTypesWithoutRecipe（新規用）。 |
| `updateAdminRecipe(recipeId, input)` | 更新。input: cycleMinutes, outputItemId, outputAmount, inputs。inputs は削除してから再登録。同一 itemId は合算。 |
| `createAdminRecipe(input)` | 新規作成。input: facilityTypeId, cycleMinutes, outputItemId, outputAmount, inputs。成功時は `{ success: true, recipeId }`。 |

- 周期・出力数は 1 以上の整数。入力は 0 件可（資源探索は入力なし）。

---

## 4. データ構造（参照）

- **Recipe**: facilityTypeId（ユニーク）, cycleMinutes, outputItemId, outputAmount。schema は `prisma/schema.prisma`。
- **RecipeInput**: recipeId, itemId, amount。@@unique([recipeId, itemId])。
