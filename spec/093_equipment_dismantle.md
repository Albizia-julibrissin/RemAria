# Spec: 工房での装備解体

工房に「解体」タブを追加し、未装着の装備個体を消費して製造レシピ素材の一部を返却する機能を定義する。一括解体モード・フィルタ・一括選択に対応する。

---

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**: セッションが有効であること。
- **045_inventory_and_items**: Item, UserInventory, EquipmentType, EquipmentInstance, CharacterEquipment。
- **046_item_craft**: CraftRecipe, CraftRecipeInput, 装備はクラフトで作成される想定。「本来のレシピ」で素材返却量を算出。

### 0.2 用語

- **本来のレシピ**: 当該装備種別（EquipmentType）を出力とするクラフトレシピ（CraftRecipe, outputKind=equipment, outputEquipmentTypeId=装備種別ID）のうち 1 件。複数ある場合は **code 昇順の先頭** を採用する（既存の鍛錬側の `recipeByEquipmentTypeId` の決め方に合わせる）。
- **解体**: 装備個体（EquipmentInstance）を 1 件削除し、その装備の「本来のレシピ」の各入力素材を、製造必要量の 1/10（端数切捨て）でユーザーに付与する操作。

---

## 1. 対象・前提

- **対象**: ユーザーが所持する **装備個体（EquipmentInstance）** のうち、**未装着** のもの。装着中は解体不可（鍛錬・継承・鑑定タブの分解と同様）。
- **レシピが存在しない装備**: 当該装備種別を出力とするクラフトレシピが 1 件も存在しない場合、返却素材が決まらないため **解体対象外** とする（一覧に表示しない、または「解体不可」と表示するかは UI 方針でよい。実装では「解体可能一覧」をレシピが存在するものに限定して取得する）。
- **部位**: 武器・防具を問わず、**全部位** の装備を対象とする（main_weapon, sub_weapon, head, body, arm, leg）。画面上のフィルタで部位を絞り込む。

---

## 2. 返却ルール

- 装備 1 個体を解体するとき、その装備の **本来のレシピ** に紐づく **CraftRecipeInput** の各行について:
  - **返却数** = `Math.floor(amount / 10)`（1 回の製造必要量 `amount` の 1/10、端数切捨て）。
  - 返却数が 0 の素材も、仕様上は「0 個付与」として扱い、在庫は変化させない（実装では付与処理をスキップしてよい）。
- 同一アイテムが複数行で入力に含まれることはない（CraftRecipeInput は craftRecipeId + itemId で UNIQUE）。返却は「アイテムごとに 1 回」でよい。

---

## 3. API

### 3.1 解体可能装備一覧の取得

| 項目 | 内容 |
|------|------|
| 名前 | `getDismantlableEquipment()` |
| 返却型 | `DismantlableEquipmentRow[]` または null（未ログイン時） |
| 条件 | 当該ユーザーの EquipmentInstance のうち、(1) 未装着、(2) 当該 equipmentTypeId を出力とする CraftRecipe が存在するもの。 |

**DismantlableEquipmentRow**（鍛錬の TemperableEquipmentRow と同様の行形式）:

- `id`: EquipmentInstance.id  
- `equipmentTypeName`: 装備種別名  
- `slot`: 部位（equipmentType.slot）  
- `stats`: 戦闘用ステータス（PATK, PDEF 等）のキー・値  
- `statCap`, `capCeiling`, `statsSum`: 鍛錬タブと同様（表示・ソート・フィルタ用）  
- `recipeId`, `recipeName`: 本来のレシピ（表示用）  
- `returnInputs`: 解体時に返却される素材の一覧。`{ itemId, itemName, amount }[]`。各 `amount` は `Math.floor(レシピ入力量 / 10)`。

※ 一覧は「レシピが存在する」装備に限定するため、getTemperableEquipment と同様に recipeByEquipmentTypeId を組み、recipe が null のインスタンスは結果に含めない。

### 3.2 単体解体

| 項目 | 内容 |
|------|------|
| 名前 | `dismantleEquipment(equipmentInstanceId: string)` |
| 入力 | 装備個体 ID。 |
| 処理 | (1) 自分の装備かつ未装着であることを検証。(2) 本来のレシピを取得し、各 CraftRecipeInput について `floor(amount/10)` を UserInventory に加算。(3) EquipmentInstance を削除（CharacterEquipment は未装着のみ対象のため参照なし想定）。 |
| 返却 | `{ success: true, returned: { itemId, itemName, amount }[] }` または `{ success: false, error, message }`。 |

### 3.3 一括解体

| 項目 | 内容 |
|------|------|
| 名前 | `dismantleEquipmentBulk(equipmentInstanceIds: string[])` |
| 入力 | 装備個体 ID の配列。 |
| 処理 | 各 ID について「自分の装備かつ未装着」かつ「本来のレシピが存在」を検証し、順に返却付与とインスタンス削除を行う。**1 件でも検証失敗した場合はその時点でエラーとし、全体をロールバック**し、1 件も解体しない。 |
| 返却 | 成功時は `{ success: true, dismantledCount: number, returned: { itemId, itemName, totalAmount }[] }`（同一アイテムは合算して返す）。失敗時は `{ success: false, error, message }`。 |

---

## 4. UI

### 4.1 タブ

- 工房（`/dashboard/craft`）のタブに **「解体」** を追加する。配置は製造・鍛錬・継承・鑑定・調律と同列（順序は任意。例: 製造の次に「解体」）。

### 4.2 表示形式

- **鍛錬タブと同様のテーブル形式**で行表示する。
  - 列: 名前、各ステータス（PATK, PDEF 等）、合計、上限、操作列。
  - 操作列: 通常時は **「解体」** ボタン 1 つのみ。一括解体モード時は **チェックボックス** を表示し、「解体」ボタンは行ごとに出さず、画面上部の「一括解体実行」でまとめて実行する。
- 各行に、解体時に返却される素材の概要（例: 「鉄 x1, 木材 x0」）を表示してもよい（任意）。

### 4.3 一括解体モード

- **「一括解体」** ボタン（または「一括解体モード」トグル）を押すと、一括解体モードになる。
  - モード中: 各行にチェックボックスを表示。画面上部に「一括解体実行」「キャンセル」を表示。
  - 「一括解体実行」: チェックが付いた装備をまとめて `dismantleEquipmentBulk` で解体する。
  - 「キャンセル」: 一括解体モードを解除し、チェックを外す。

### 4.4 フィルタ

- 画面上に以下を配置する。
  - **部位**: ドロップダウン（すべて / main_weapon / sub_weapon / head / body / arm / leg）。鍛錬タブの「部位」フィルタと同様。
  - **ステータスフィルタ**: 「特定ステータスが N **以下**」のみ指定可能にする（「以上」は用意しない）。
    - 対象ステータス: 装備の戦闘用ステータス **HP, MP, PATK, MATK, PDEF, MDEF, HIT, EVA, LUCK（運）の 9 種** と **合計**・**上限能力値**（capCeiling）。計 11 種類から選択。
    - 複数条件を指定する場合は AND で絞り込む（例: PATK 5 以下 **かつ** 合計 10 以下）。
  - 必要に応じて **装備名（種別名）** の部分一致フィルタを追加してもよい。

### 4.5 一括選択

- **「一括選択」** ボタンを配置する。**一括解体モード中のみ有効**とする。
  - 押下時、**現在のフィルタ結果**に含まれる行のチェックボックスを **すべてオン** にする。
  - 一括解体モードでないときは押しても無効（非表示または disabled でよい）。

### 4.6 ヘルプ

- タブの「?」などで、例として「未装着の装備を解体すると、その装備の製造に使った素材の 1/10 が返却されます。一括解体モードで複数まとめて解体できます。」といった説明を表示する。

---

## 5. データ・副作用

- **EquipmentInstance**: 解体時に該当行を削除する。
- **UserInventory**: 返却素材の itemId ごとに quantity を加算する（既存行を update、存在しなければ insert）。
- **ItemUsageLog**: 装備の「消費」は現仕様ではアイテム消費に含めない想定とする。将来的に特別アイテムや履歴が必要になった場合は docs/081 等を参照して検討する。
- **通貨履歴**: 不要。

---

## 6. 確定事項（ヒアリング結果）

- **対象**: 全部位。画面上のフィルタで部位を絞り込む。
- **レシピなし**: 当該装備種別を出力とするレシピが 1 件もない場合は解体対象外（一覧に表示しない）。
- **複数レシピ**: 「本来のレシピ」は CraftRecipe **code 昇順の先頭 1 件**。実装・運用で注意が必要なため、管理画面で装備種別・レシピを登録する際に注意を表示する（§8.1）。
- **ステータスフィルタ**: 「N 以下」のみ。対象は HP, MP, PATK, MATK, PDEF, MDEF, HIT, EVA, LUCK（運）（9 種）と合計・上限能力値。
- **一括解体の失敗時**: 1 件でも失敗したら **全件ロールバック**（1 件も解体しない）。
- **一括選択**: 一括解体モード中のみ有効。

---

## 7. 実装フェーズ

| Phase | 内容 |
|-------|------|
| **Phase 1** | Server Actions: `getDismantlableEquipment`, `dismantleEquipment`, `dismantleEquipmentBulk`（型・一覧取得・単体/一括解体、一括はトランザクションで全件ロールバック）。 |
| **Phase 2** | 工房ページで `getDismantlableEquipment` を呼び、結果を CraftTabs に渡す。 |
| **Phase 3** | 解体タブ追加（製造の次）、テーブル表示（名前・ステ・合計・上限・操作列）、部位フィルタ、行ごと「解体」ボタン、単体解体確認モーダル。 |
| **Phase 4** | ステータスフィルタ（11 種類から「N 以下」を複数 AND）、ソート（名前・各ステ・合計・上限）。 |
| **Phase 5** | 一括解体モード（トグル）、チェックボックス、「一括選択」「一括解体実行」「キャンセル」、実行確認モーダル、ヘルプ文。 |

---

## 8. 実装時の参照

### 8.1 管理画面での注意表示

- 同一装備種別を出力とするレシピが複数ある場合、解体・鍛錬では **code 昇順の先頭 1 件** が「本来のレシピ」として使われる。運用で混乱しないよう、管理画面で次を実施する。
  - **装備種別（EquipmentType）の新規作成・編集画面**: 「この装備種別を出力とするレシピが複数ある場合、工房の鍛錬・解体では code が辞書順で先のレシピが使われます。」といった注意文を表示する。
  - **クラフトレシピの新規作成・編集画面**（outputKind=equipment のとき）: 選択中の出力装備種別について、既に同じ装備種別を出力とするレシピが他に存在する場合、「同一装備を出力するレシピが他に ○ 件あります。鍛錬・解体では code 昇順の先頭が採用されます。」と警告または注意を表示する。
- 実装場所: `src/app/dashboard/admin/` の装備種別編集フォーム・クラフトレシピ編集フォーム。詳細は manage にメモを残す（例: `manage/admin_craft_recipe_equipment_note.md`）。

### 8.2 コード参照

- 工房タブ・鍛錬テーブル: `src/app/dashboard/craft/craft-tabs.tsx`
- 鍛錬用データ取得・型: `src/server/actions/craft.ts`（getTemperableEquipment, TemperableEquipmentRow）
- 装備ステータスキー・ラベル: `src/lib/craft/equipment-stat-gen.ts`（EQUIPMENT_STAT_KEYS, EQUIPMENT_STAT_LABELS）
- 遺物分解の UI パターン: 鑑定タブの「分解」ボタンと DecomposeConfirmModal
- レシピ入力: `prisma/schema.prisma` の CraftRecipe, CraftRecipeInput
- 装備個体: EquipmentInstance（characterEquipments で装着有無を判定）

---

以上が装備解体機能の仕様です。§6 の確定事項と §7.1 の管理画面注意表示を反映済み。実装時に本 spec を参照すること。
