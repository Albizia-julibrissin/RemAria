# クラフトレシピ編集（管理者用）

CraftRecipe の code / name / 出力種別・出力先 / 入力素材（CraftRecipeInput）を編集・新規作成する管理機能の手順と仕様。

- **Spec 正本**: `spec/046_item_craft.md`（クラフト仕様）。
- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/craft-recipes/`（一覧・新規・編集画面）。

---

## 1. 目的・前提

- **目的**: 運用中にクラフトレシピの表示名・出力・入力素材を、コードを触らずに変更・追加できるようにする。
- **前提**: 対象は **テストユーザー1** でログインしている場合のみ。既存レシピの編集に加え、**新規作成**も可能（一覧の「新規作成」→ 作成後は編集画面へ遷移）。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **一覧 URL** | `/dashboard/admin/craft-recipes`。テーブルで全クラフトレシピを表示。「新規作成」ボタンあり。 |
| **新規作成 URL** | `/dashboard/admin/craft-recipes/new`。新規登録フォーム。作成成功後は編集画面へ遷移。出力が装備・メカのときは「既存を選択」または「新規作成」で、新規の場合は CAP・ウェイト（装備は code/name/slot も）をその場で設定可能。 |
| **編集 URL** | `/dashboard/admin/craft-recipes/[id]`。1件編集フォーム。出力が装備のときは CAP・ウェイト・code/name/slot を編集可能。出力がメカパーツのときは CAP・ウェイト・フレームの場合は基礎ステ倍率（補正）・フラット加算を編集可能。 |
| **入口** | 実装済み一覧（`/dashboard/admin/content`）の「クラフトレシピ編集」リンク。 |
| **操作** | 一覧で「新規作成」→ code / name / 出力種別・出力先（既存 or 新規） / 入力素材 → 「作成」。編集画面では出力装備・メカの設定を変更して「保存」。 |

---

## 3. API（Server Actions）

いずれも `src/server/actions/admin.ts`。テストユーザー1のみ。

| 関数名 | 役割 |
|--------|------|
| `getAdminCraftRecipeList()` | 全クラフトレシピ一覧（id, code, name, outputKind, outputName）。 |
| `getAdminCraftRecipe(craftRecipeId)` | 1件取得（編集フォーム用。inputs の itemId, itemCode, itemName, amount 含む）。 |
| `getAdminCraftRecipeOptions()` | フォーム用選択肢: items, equipmentTypes, mechaPartTypes。 |
| `updateAdminCraftRecipe(craftRecipeId, input)` | 1件更新。input: code, name, outputKind, 出力 ID（種別に応じて1つ）, inputs: { itemId, amount }[]。inputs は一度削除してから再登録。同一 itemId は amount 合算して1行にまとめる。 |
| `createAdminCraftRecipe(input)` | 新規作成。input は update と同様。成功時は `{ success: true, craftRecipeId }`。code の重複時はエラー。 |

- **outputKind**: `equipment` | `mecha_part` | `item` のいずれか。種別に応じて outputEquipmentTypeId / outputMechaPartTypeId / outputItemId のどれか1つを必須で指定。
- **inputs**: 1件以上必須。同一アイテムを複数行指定した場合は保存時に amount を合算して1行にマージ（CraftRecipeInput は craftRecipeId+itemId ユニークのため）。
- **装備の設定（編集・新規）**: `equipmentOutput` / `equipmentNew` で code, name, slot, statGenConfig（capMin, capMax, weights: key/weightMin/weightMax）を送信。装備の CAP・ウェイトは docs/053 の EquipmentType.statGenConfig に保存される。
- **メカパーツの設定（編集・新規）**: `mechaPartOutput` / `mechaPartNew` で name, slot, statRates（フレーム時のみ）, statGenConfig, strAdd 等のフラット加算を送信。メカの CAP・ウェイト・補正は MechaPartType の statGenConfig / statRates に保存される。

---

## 4. データ構造（参照）

- **CraftRecipe**: id, code（ユニーク）, name, outputKind, outputEquipmentTypeId?, outputMechaPartTypeId?, outputItemId?。schema は `prisma/schema.prisma`。
- **CraftRecipeInput**: craftRecipeId, itemId, amount。@@unique([craftRecipeId, itemId]) のため、1レシピあたり同一 item は1行。

---

## 5. 運用メモ

- code の変更は可能。他で code をキーに参照している場合は注意。
- 新規作成時は code の重複チェックを行う。既存の code と被る場合は「この code は既に使用されています。」とエラーになる。
- 入力素材で同じアイテムを複数行選んでも、保存時に合算されて1行になる。
