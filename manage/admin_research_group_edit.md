# 研究グループ編集（管理者用）

docs/054 の研究解放を管理する。ResearchGroup（グループ）・ResearchGroupItem（解放対象）・ResearchUnlockCost（解放時の消費アイテム）を編集・新規作成する。

- **Spec 正本**: docs/054（研究・解放）。
- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/research-groups/`（一覧・新規・編集画面）。

---

## 1. 目的・前提

- **目的**: 研究画面で表示されるグループ名・解放対象（設備型 / クラフトレシピ）・解放時に消費するアイテムと個数を、コードを触らずに変更・追加できるようにする。
- **前提**: 対象は **テストユーザー1** でログインしている場合のみ。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **一覧 URL** | `/dashboard/admin/research-groups`。全研究グループをテーブル表示。「新規作成」ボタンあり。 |
| **新規作成 URL** | `/dashboard/admin/research-groups/new`。code / name / 表示順を入力して作成。作成後は編集画面へ遷移。 |
| **編集 URL** | `/dashboard/admin/research-groups/[id]`。グループ基本項目・解放対象一覧・対象ごとの消費アイテムを編集。 |
| **入口** | 実装済み一覧（`/dashboard/admin/content`）の「研究グループ編集」リンク。 |

---

## 3. API（Server Actions）

いずれも `src/server/actions/admin.ts`。テストユーザー1のみ。

| 関数名 | 役割 |
|--------|------|
| `getAdminResearchGroupList()` | 全 ResearchGroup 一覧（id, code, name, displayOrder, itemCount, prerequisiteGroupCode）。 |
| `getAdminResearchGroupEditData(groupId)` | 1件取得（グループ＋解放対象＋各対象の消費、および facilityTypes / craftRecipes / items / researchGroups の選択肢）。 |
| `createAdminResearchGroup(input)` | 新規作成。input: code, name, displayOrder?, prerequisiteGroupId?。成功時は `{ success: true, researchGroupId }`。 |
| `updateAdminResearchGroup(groupId, input)` | グループ基本項目を更新。input: code, name, displayOrder, prerequisiteGroupId?。 |
| `saveAdminResearchGroupItems(groupId, items)` | 解放対象を置き換え。items: `{ targetType, targetId, isVariant, displayOrder }[]`。同一対象の重複は不可。 |
| `saveAdminResearchUnlockCosts(targetType, targetId, costs)` | 指定対象の解放時消費を置き換え。costs: `{ itemId, amount }[]`。 |

- **targetType**: `facility_type`（設備型）または `craft_recipe`（クラフトレシピ）。
- **targetId**: FacilityType.id または CraftRecipe.id。
- **isVariant**: 派生型なら true。グループクリア判定は「派生型以外」をすべて解放済みかで行う（docs/054）。

---

## 4. データ構造（参照）

- **ResearchGroup**: id, code（ユニーク）, name, displayOrder, prerequisiteGroupId。schema は `prisma/schema.prisma`。
- **ResearchGroupItem**: researchGroupId, targetType, targetId, isVariant, displayOrder。@@unique([researchGroupId, targetType, targetId])。
- **ResearchUnlockCost**: targetType, targetId, itemId, amount。同一対象に複数アイテム可。@@unique([targetType, targetId, itemId])。

---

## 5. 運用メモ

- 前提グループ（prerequisiteGroupId）を設定すると、そのグループの「派生型以外」をすべて解放したユーザーにのみ、このグループが表示・解放可能になる。
- 解放対象を追加したあと、各対象ごとに「消費アイテム」を設定し、「消費を保存」で ResearchUnlockCost を更新する。
