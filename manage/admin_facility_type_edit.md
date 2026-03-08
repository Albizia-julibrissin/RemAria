# 設備種別編集（管理者用）

FacilityType の name / kind / description / cost の編集・新規作成に加え、**削除**と**建設材料（FacilityConstructionRecipeInput）の編集**が可能。

- **Spec 正本**: spec/035（初期エリア・設備）、spec/047（研究・解放・建設）、docs/018（設備コスト）。
- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/facilities/`（一覧・新規・編集画面）。

---

## 1. 目的・前提

- **目的**: 運用中に設備種別の表示名・種別・説明・設置コストを変更・追加できるようにする。加えて、設備**削除**（参照がある場合は不可）と、設備を**建設するときに必要な材料**の編集が可能。
- **前提**: 対象は **テストユーザー1** でログインしている場合のみ。既存設備の編集・削除・建設材料の編集が可能。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **一覧 URL** | `/dashboard/admin/facilities`。テーブルで全設備種別を表示。「新規作成」ボタンあり。 |
| **新規作成 URL** | `/dashboard/admin/facilities/new`。新規登録フォーム。作成成功後は編集画面へ遷移。 |
| **編集 URL** | `/dashboard/admin/facilities/[id]`。1件編集フォーム＋建設材料（型ごと）＋削除。 |
| **入口** | 実装済み一覧（`/dashboard/admin/content`）の「設備種別編集」リンク。 |
| **操作** | 一覧で「新規作成」→ 入力 → 「作成」。または一覧で「編集」→ 基本項目を変更 → 「保存」。編集画面で「建設材料」を変更 → 「建設材料を保存」。削除する場合は「この設備種別を削除する」→ 確認後「削除する」。 |

---

## 3. API（Server Actions）

いずれも `src/server/actions/admin.ts`。テストユーザー1のみ。

| 関数名 | 役割 |
|--------|------|
| `getAdminFacilityTypeList()` | 全 FacilityType 一覧（id, name, kind, description, cost）。 |
| `getAdminFacilityType(facilityTypeId)` | 1件取得（基本項目のみ）。 |
| `getAdminFacilityTypeWithConstruction(facilityTypeId)` | 1件取得（基本項目＋型ごとの建設材料）。編集画面で使用。 |
| `updateAdminFacilityType(facilityTypeId, input)` | 1件更新。input: name, kind, description, cost。 |
| `createAdminFacilityType(input)` | 新規作成。input は update と同様。成功時は `{ success: true, facilityTypeId }`。name の重複時はエラー。 |
| `deleteAdminFacilityType(facilityTypeId)` | 削除。参照がある場合は `{ success: false, error }`。 |
| `updateAdminFacilityConstructionInputs(facilityTypeId, variantCode, inputs)` | 指定型（base 等）の建設材料を置き換え。inputs: `{ itemId, amount }[]`。 |

- **削除不可条件**: 設置済み（FacilityInstance）・解放済みユーザー（UserFacilityTypeUnlock）・研究解放に紐づき（ResearchGroupItem / ResearchUnlockCost）のいずれかがある場合は削除できず、エラーメッセージを返す。
- **建設材料**: FacilityVariant ごと（base / alpha / beta）。同一型内で itemId はユニーク。amount は 1 以上。工業エリアの設備設置では `getConstructionRecipe` / `placeFacility` が都度 DB を参照するため、管理画面で変更した内容は設置画面に即反映される。

---

## 4. データ構造（参照）

- **FacilityType**: id, name（ユニーク）, kind, description?, cost。schema は `prisma/schema.prisma`。
- **FacilityVariant**: 設備型（facilityTypeId, variantCode: base / alpha / beta）。1 型に 1 建設レシピ。
- **FacilityConstructionRecipeInput**: facilityVariantId, itemId, amount。建設時に消費するアイテム。
- 設備生産レシピ（Recipe / RecipeInput）は「設備生産レシピ編集」で別管理。

---

## 5. 運用メモ

- name の変更は可能。他テーブルで name をキーにしている場合は注意。
- 新規作成時は name の重複チェックを行う。既存の name と被る場合は「この name は既に使用されています。」とエラーになる。
- 工業エリアの設備設置画面（`/dashboard/facilities`）は、必要資源を `getConstructionRecipe` で都度取得し、`placeFacility` でも DB の建設材料を参照して在庫消費するため、管理画面で建設材料を変更すると次回以降の設置から反映される。
