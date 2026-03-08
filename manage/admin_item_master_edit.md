# アイテムマスタ編集（管理者用）

Item マスタの code / name / category / skillId / consumableEffect / maxCarryPerExpedition を編集する管理機能の手順と仕様。加えて、**装備型（EquipmentType）の名前**も同一画面で編集できる。

- **Spec 正本**: `spec/045_inventory_and_items.md`（Item の項目定義）。
- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/items/`（一覧・編集画面）、`src/lib/constants/item-categories.ts`（category 定数）。

---

## 1. 目的・前提

- **目的**: 運用中にアイテムの表示名・カテゴリ・スキル分析書の紐づけ・消耗品効果・探索持ち込み上限を、コードを触らずに変更できるようにする。あわせて、クラフトで製造する**装備型の表示名（name）**も編集できる（どの装備をレシピで作るかはクラフトレシピ編集で設定）。
- **前提**: 対象は **テストユーザー1** でログインしている場合のみ。既存アイテムの編集に加え、**新規作成**も可能（一覧の「新規作成」→ 作成後は編集画面へ遷移）。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **一覧 URL** | `/dashboard/admin/items`。テーブルで全アイテムを表示。「新規作成」ボタンあり。 |
| **新規作成 URL** | `/dashboard/admin/items/new`。新規登録フォーム。作成成功後は編集画面へ遷移。 |
| **編集 URL** | `/dashboard/admin/items/[id]`。1件編集フォーム。 |
| **入口** | ダッシュボードで管理者表示時「アイテムマスタ編集」カード。実装済み一覧（`/dashboard/admin/content`）からもリンクあり。 |
| **操作** | 一覧で「新規作成」→ 入力 → 「作成」。または一覧で「編集」→ 編集画面で変更 → 「保存」。ページ下部「装備型」セクションで装備の名前を編集 → 行ごとに「保存」。 |

---

## 3. API（Server Actions）

いずれも `src/server/actions/admin.ts`。テストユーザー1のみ。

| 関数名 | 役割 |
|--------|------|
| `getAdminItemList()` | 全 Item 一覧（id, code, name, category, skillId, skillName, consumableEffect, maxCarryPerExpedition）。 |
| `getAdminItem(itemId)` | 1件取得（編集フォーム用）。 |
| `getAdminSkillsForItem()` | スキル一覧（skill_book の skillId 選択用）。 |
| `updateAdminItem(itemId, input)` | 1件更新。input: code, name, category, skillId, consumableEffectJson（文字列）, maxCarryPerExpedition。 |
| `createAdminItem(input)` | 新規作成。input は update と同様。成功時は `{ success: true, itemId }`。code の重複時はエラー。 |
| `getAdminEquipmentTypeListForItemMaster()` | 装備型一覧（id, code, name）。一覧ページの「装備型」セクション用。 |
| `updateAdminEquipmentTypeName(id, name)` | 装備型の name のみ更新。 |

- **category**: `src/lib/constants/item-categories.ts` の ITEM_CATEGORIES（material / consumable / blueprint / skill_book / paid）。
- **skill_book** のときは skillId 必須。consumableEffect は有効な JSON 文字列のみ（空は null 扱い）。
- **装備型**: EquipmentType はクラフトレシピで「装備」を出力すると作成される。アイテムマスタ一覧では名前（name）のみ編集可能。code・スロット・ステ生成設定は別画面（クラフトレシピ等）で扱う。

---

## 4. データ構造（参照）

- **Item**: id, code（ユニーク）, name, category, skillId（skill_book 時）, consumableEffect（Json）, maxCarryPerExpedition（Int?）。schema は `prisma/schema.prisma`。
- **consumableEffect**: 消耗品の効果。例: `{ "type": "hp_percent", "value": 10 }`。docs/027 で拡張一覧化可。

---

## 5. 運用メモ

- code の変更は可能だが、他テーブル（ドロップテーブル・クラフト等）で code ではなく id で参照している場合は影響なし。code をキーにしている処理があれば注意。
- 新規作成時は code の重複チェックを行う。既存の code と被る場合は「この code は既に使用されています。」とエラーになる。
