# エリア別ドロップ編集（管理者用）

探索エリアごとのドロップテーブル（基本／戦闘／技能／強敵／領域主）のアイテム・数量・重みを編集する管理機能の手順と仕様。**リバースエンジニアリング**により実装から整理した。

- **Spec 正本**: 探索のドロップ枠・データ構造は `spec/049_exploration.md` の「7.2 ドロップテーブル」を参照。
- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/drops/`（画面）。

---

## 1. 目的・前提

- **目的**: 運用中にエリアのドロップ内容（どのアイテムがどの重みで出るか）を、コードを触らずに変更できるようにする。
- **前提**:
  - 対象は **テストユーザー1**（`TEST_USER_1_EMAIL`）でログインしている場合のみ。それ以外は API が null を返すか redirect する。
  - 編集対象は **既にエリアに紐づいている DropTable** のみ。テーブルが未設定の枠（例: 強敵枠が未紐づけ）は「未設定」と表示され、編集はできない。新規テーブル作成・エリアへの紐づけは **seed または DB 操作** で行う。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **URL** | `/dashboard/admin/drops`。クエリ `?areaId=<areaId>` で編集対象エリアを指定。 |
| **入口** | ダッシュボードで管理者表示時「エリアドロップ編集」カード。実装済み一覧（`/dashboard/admin/content`）からもリンクあり。 |
| **操作** | 1) エリア一覧からエリアを選択 → 2) 表示される 5 枠（基本／戦闘／技能／強敵／領域主）のうち、紐づきがあるテーブルについて「行を追加」「アイテム・最小数・最大数・重み」を編集 → 3) 各テーブルごとに「保存」で反映。 |
| **未設定** | そのエリアに `strongEnemyDropTableId` 等が null の枠は「未設定」と表示。編集不可。 |

---

## 3. API（Server Actions）

いずれも `src/server/actions/admin.ts`。**テストユーザー1** でないと実行されない。

| 関数名 | 役割 |
|--------|------|
| `getAdminAreaList()` | ドロップ編集用の探索エリア一覧（id, code, name, themeName）を返す。 |
| `getAreaDropEditData(areaId)` | 指定エリアの 5 種ドロップテーブル（base / battle / skill / strongEnemy / areaLord）と、各テーブルのエントリ一覧（itemId, itemCode, itemName, minQuantity, maxQuantity, weight）を返す。 |
| `getAdminItemsForDrop()` | ドロップ編集時のアイテムセレクト用。Item の id, code, name, category 一覧。 |
| `saveDropTableEntries(dropTableId, entries)` | 指定 DropTable の DropTableEntry を **一括置換**。entries は `{ itemId, minQuantity, maxQuantity, weight }[]`。不正な行はスキップし、それ以外を deleteMany 後に createMany で保存。 |

---

## 4. データ構造（参照）

- **ExplorationArea**: `baseDropTableId`, `battleDropTableId`, `skillDropTableId`, `strongEnemyDropTableId`, `areaLordDropTableId` で 5 種の DropTable を参照。
- **DropTable**: id, code（ユニーク）, name, kind（base / battle_bonus / skill / strong_enemy / area_lord_special）, areaId（任意）。
- **DropTableEntry**: dropTableId, itemId, minQuantity, maxQuantity, weight。重みはテーブル内の相対確率。

枠種別と kind の対応は `spec/049_exploration.md` の表を参照。

---

## 5. 強敵枠の追加（新規エリアや既存エリアに強敵テーブルを足す場合）

強敵用ドロップテーブルを「実装」するとは、**DropTable の作成** と **ExplorationArea.strongEnemyDropTableId への紐づけ** を行うこと。編集画面は「既に紐づいているテーブル」しか編集できないため、新規作成は **seed またはマイグレーション＋手動 SQL/seed** で行う。

### 5.1 seed で行う場合（例: 遊覧舗装路跡）

1. **DropTable の upsert**  
   - `code`: エリアコード + `_strong_enemy`（例: `yuran_paved_road_strong_enemy`）。  
   - `name`, `kind: "strong_enemy"`, `areaId`: 対象エリアの id。

2. **DropTableEntry の作成**  
   - 同一 seed 内で、強敵用テーブル用のエントリ（itemId, minQuantity, maxQuantity, weight）を `dropTableEntry.create` または配列を回して create。

3. **ExplorationArea の更新**  
   - `strongEnemyDropTableId` に上記 DropTable の id を設定。

実行: `npm run db:seed`。既存の「ドロップテーブル seed」処理に上記 3 点を組み込む（`prisma/seed.ts` の `seedDropTablesForYuranPavedRoad` 相当）。

### 5.2 他エリアに強敵枠を追加する場合

- そのエリア用の `*_strong_enemy` な DropTable を seed または手動で作成。
- 必要なら DropTableEntry を追加。
- ExplorationArea の `strongEnemyDropTableId` をその DropTable の id に更新。

その後、管理画面「エリアドロップ編集」で当該エリアを選べば、強敵枠が表示・編集可能になる。

---

## 6. 運用メモ

- 編集は **テーブル単位**。1 テーブルごとに「保存」で `saveDropTableEntries` が呼ばれ、そのテーブルのエントリがまとめて置き換わる。
- 重みは整数で相対確率。最小・最大数は 0 以上かつ min ≤ max。重みは 1 以上のみ有効。
- 管理系の追加仕様・手順は、原則として **manage/ 配下** にまとめる（本ドキュメントの方針）。
