# 設備種別編集（管理者用）

FacilityType の name / kind / description / cost を編集・新規作成する管理機能の手順と仕様。

- **Spec 正本**: spec/035（初期エリア・設備）、docs/018（設備コスト）。
- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/facilities/`（一覧・新規・編集画面）。

---

## 1. 目的・前提

- **目的**: 運用中に設備種別の表示名・種別（kind）・説明・設置コストを、コードを触らずに変更・追加できるようにする。
- **前提**: 対象は **テストユーザー1** でログインしている場合のみ。既存設備の編集に加え、**新規作成**も可能。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **一覧 URL** | `/dashboard/admin/facilities`。テーブルで全設備種別を表示。「新規作成」ボタンあり。 |
| **新規作成 URL** | `/dashboard/admin/facilities/new`。新規登録フォーム。作成成功後は編集画面へ遷移。 |
| **編集 URL** | `/dashboard/admin/facilities/[id]`。1件編集フォーム。 |
| **入口** | 実装済み一覧（`/dashboard/admin/content`）の「設備種別編集」リンク。 |
| **操作** | 一覧で「新規作成」→ 入力 → 「作成」。または一覧で「編集」→ 変更 → 「保存」。 |

---

## 3. API（Server Actions）

いずれも `src/server/actions/admin.ts`。テストユーザー1のみ。

| 関数名 | 役割 |
|--------|------|
| `getAdminFacilityTypeList()` | 全 FacilityType 一覧（id, name, kind, description, cost）。 |
| `getAdminFacilityType(facilityTypeId)` | 1件取得（編集フォーム用）。 |
| `updateAdminFacilityType(facilityTypeId, input)` | 1件更新。input: name, kind, description, cost。 |
| `createAdminFacilityType(input)` | 新規作成。input は update と同様。成功時は `{ success: true, facilityTypeId }`。name の重複時はエラー。 |

- **kind**: `resource_exploration`（資源探索）/ `industrial`（工業）/ `training`（訓練）のいずれか。
- **cost**: 設置枠のコスト消費（0 以上の整数。spec/035）。

---

## 4. データ構造（参照）

- **FacilityType**: id, name（ユニーク）, kind, description?, cost。schema は `prisma/schema.prisma`。
- 設備には FacilityVariant（型: base / alpha / beta）・Recipe（生産レシピ）・FacilityTypeTag 等の関連あり。本管理画面では FacilityType の基本項目のみ編集。Variant・Recipe・タグは別途 seed または将来の管理画面で対応。

---

## 5. 運用メモ

- name の変更は可能。他テーブルで name をキーにしている場合は注意。
- 新規作成時は name の重複チェックを行う。既存の name と被る場合は「この name は既に使用されています。」とエラーになる。
