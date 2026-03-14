# アイテムカテゴリ「課金(paid)」を「特別(special)」に差し替える計画

**目的**: 既存の課金カテゴリ（`paid`）を**特別**として扱い、DB 上の値も `special` に統一する。闇市・黒市（docs/079）では「特別」カテゴリのアイテムのみ取り扱う。

---

## 1. 方針

| 項目 | 変更内容 |
|------|----------|
| **カテゴリ値** | `paid` → `special` に**差し替え**（paid を削除し special のみにする）。 |
| **表示名** | 管理画面・バッグ・市場などで「有料」「課金」→ **「特別」** に統一。 |
| **データ** | 既存の `Item.category = 'paid'` を `'special'` にマイグレーションで更新。 |
| **闇市・黒市** | 取り扱い対象は **category = 'special'** のアイテムのみ（079 のとおり）。 |

---

## 2. 変更箇所一覧

### 2.1 定数・型

| ファイル | 内容 |
|----------|------|
| `src/lib/constants/item-categories.ts` | `ITEM_CATEGORIES` から `"paid"` を削除し `"special"` に差し替え。 |

### 2.2 スキーマ・DB

| 対象 | 内容 |
|------|------|
| `prisma/schema.prisma` | Item.category のコメントを `paid` 削除・`special` に統一。 |
| **マイグレーション** | `UPDATE "Item" SET category = 'special' WHERE category = 'paid';` を実行するマイグレーションを追加。 |

### 2.3 表示ラベル（「有料」→「特別」）

| ファイル | 内容 |
|----------|------|
| `src/app/dashboard/admin/items/admin-item-list-client.tsx` | カテゴリ表示: `paid: "有料"` → `special: "特別"` に変更。 |
| `src/app/dashboard/admin/items/[id]/admin-item-edit-form.tsx` | 同上。 |
| `src/app/dashboard/admin/items/new/admin-item-create-form.tsx` | 同上。 |
| `src/app/dashboard/bag/page.tsx` | タブなどで `paid` 参照を `special` に、表示を「特別」に。 |
| `src/app/dashboard/market/market-client.tsx` | カテゴリ表示があれば `paid` → `special`、「特別」。 |

### 2.4 バリデーション・型

| ファイル | 内容 |
|----------|------|
| `src/server/actions/admin.ts` | アイテム作成・更新時の category チェックを `"paid"` → `"special"` に変更。`ITEM_CATEGORIES` を参照している場合は定数変更で自動的に対応。 |

### 2.5 その他参照

- コード内で `category === "paid"` や `"paid"` をリテラルで参照している箇所を検索し、すべて `"special"` に変更。
- コメント・docs で「課金アイテム」「paid」と書いている箇所は、必要に応じて「特別」「special」に更新。

---

## 3. 実施順序

1. **定数**: `item-categories.ts` で `paid` を `special` に差し替え。
2. **スキーマ**: Item.category のコメント修正（実施済みの場合は省略）。
3. **マイグレーション**: 既存データの `paid` → `special` 更新マイグレーションを作成・適用。
4. **表示・バリデーション**: 上記一覧の TS/TSX を `special` と「特別」に統一。
5. **検索**: `"paid"` リテラル・`paid` カテゴリの残りがないか grep で確認。

---

## 4. 実施メモ

- **定数**: `item-categories.ts` で `paid` を削除し `special` のみに差し替え済み。
- **スキーマ**: Item.category のコメントを `special` に統一。`SystemShopItem` モデル追加（079）。
- **マイグレーション**: `20260315000000_special_category_and_system_shop_item` で (1) `UPDATE Item SET category = 'special' WHERE category = 'paid'`、(2) `Item_category_idx` 追加、(3) `SystemShopItem` テーブル作成。
- **表示・バリデーション**: 上記一覧の TS/TSX を `special` と「特別」に変更済み。

---

## 5. 参照

- **闇市・黒市**: `docs/079_underground_market_design.md`（特別カテゴリのみ取り扱い）
- **アイテム種別**: `docs/026_user_inventory_and_items.md`
- **特別タブ方針**: `docs/065_special_items_and_facility_speed.md`（「課金」→「特別」の表示名方針）
