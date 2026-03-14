# 特別アイテムの取り扱い方針

**目的**: Item.category = `special`（特別）のアイテムについて、定義・入手経路・使用先・使用履歴のルールをまとめる。闇市・黒市（079）や今後の「特別アイテムを消費する機能」の実装時に参照する。

---

## 1. 特別アイテムとは

| 項目 | 内容 |
|------|------|
| **定義** | Item マスタで `category = "special"` のアイテム。旧「課金(paid)」を差し替えたカテゴリ（docs/080）。 |
| **表示名** | バッグ・管理画面などでは「特別」と表示。 |
| **主な入手経路** | 闇市（無償GRA優先・足りなければ有償も可）・黒市（有償GRAのみ）での購入。任務報酬・イベント付与など。 |
| **市場** | 特別アイテムは市場に出品不可（docs/065）。 |

---

## 2. 取り扱い方針

- **闇市・黒市**: 取り扱い対象は **category = special のアイテムのみ**。システム販売品は `SystemShopItem` で定義（docs/079）。
- **消費時**: 特別アイテムを「使用する」機能（例: 雇用権利書で仲間雇用、設備加速券で生産短縮など）を実装する際は、**所持数減算に加え、必ず特別アイテム使用履歴（ItemUsageLog）に 1 件記録する**。理由コード（ITEM_USAGE_REASON_*）で用途を区別する。
- **監査・運営**: 通貨履歴（CurrencyTransaction）と同様、特別アイテムの使用履歴は運営ビューやトラブル対応で参照する想定。理由コードは定数で一覧管理する。

---

## 3. 使用履歴（ItemUsageLog）

- **テーブル**: `ItemUsageLog`（prisma/schema.prisma）。特別アイテムを消費したときに 1 回ずつ挿入する。
- **主な項目**: userId, itemId, quantity（消費数）, reason（理由コード）, referenceType / referenceId（任意）、createdAt。
- **理由コード**: `src/lib/constants/item-usage-reasons.ts` で定義。新規に「特別アイテムを消費する機能」を追加するときは、ここに理由を追加してからログを書く。
- **現状**: 特別アイテムを消費する機能は未実装のため、挿入処理はまだない。テーブルと定数だけ用意し、今後の実装時に「消費時に ItemUsageLog に insert する」ことを本 doc と AGENTS で参照する。

---

## 4. 参照

- **カテゴリ差し替え**: docs/080_item_category_paid_to_special.md
- **闇市・黒市**: docs/079_underground_market_design.md
- **アイテム・所持**: docs/026_user_inventory_and_items.md、spec/045_inventory_and_items.md
- **市場（特別は出品不可）**: docs/065_market_design.md
- **DB スキーマ**: docs/08_database_schema.md（ItemUsageLog の説明）
