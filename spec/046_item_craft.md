# Spec: アイテムクラフト

`docs/026_user_inventory_and_items.md` および `docs/021_equipment_cycle_design.md` に基づき、**クラフトレシピ**と**装備・メカパーツ・探索用消耗品の作成**、**装備の着脱**を定義する。工業設備の Recipe とは別体系。045 で定義した Item（category）、UserInventory、EquipmentInstance、CharacterEquipment、MechaPartInstance を利用する。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：セッションが有効であること。
- **045_inventory_and_items**：Item, UserInventory, EquipmentType, EquipmentInstance, CharacterEquipment, MechaPartInstance, 装備スロット定数。
- **044_mecha_parts_and_stats**：MechaPartType, 部位（slot）。MechaEquipment は本 spec で「個体参照」に拡張する。
- **docs/021, 026**：製造は工業設備外で行う。クラフトで装備・メカパーツ・消耗品を作る。個体差はステのみ（021）。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| getCraftRecipes | 解放済みクラフトレシピ一覧（入力・出力・必要数）を返す。MVP では「解放」は後回しのため全レシピ返却でも可。 | クラフトメニュー |
| executeCraft | 指定レシピを 1 回実行。入力資源を消費し、装備個体 1 個 or メカパーツ個体 1 個 or 消耗品（Item）を付与。 | クラフトメニュー |
| equipEquipment | 指定キャラの指定スロットに、指定装備個体を装着する。 | 装備メニュー・キャラ画面 |
| unequipEquipment | 指定キャラの指定スロットから装備を外す。 | 装備メニュー・キャラ画面 |
| getCharacterEquipment | 指定キャラの装着状況（スロットごとの装備個体）を返す。 | 装備メニュー・戦闘計算 |

------------------------------------------------------------------------

## 1. 目的

- **アイテムクラフト**は工業設備とは別メニューで、ユーザーが手動で「レシピを選んで実行」する。入力は資源（Item）の消費、出力は装備個体・メカパーツ個体・消耗品（Item）のいずれか（026）。
- 装備・メカパーツは**製造時にステータスを種別ごとの範囲内でランダムに決定**する（個体差はステのみ）。021 の CAP・採用ステータス重みに従う。
- 主人公・仲間は装備を**6 スロット**（main_weapon, sub_weapon, head, body, arm, leg）に装着する。中間テーブル CharacterEquipment で管理（045 で定義済み）。

------------------------------------------------------------------------

## 2. 用語

- **クラフトレシピ**：入力（ItemID + 数量）のリストと、出力（装備種別 / メカパーツ種別 / 消耗品 ItemID）を定義した 1 件。工業設備の Recipe とは別テーブル。
- **解放済みレシピ**：MVP では全レシピを利用可能としてもよい。将来は UserCraftRecipeUnlock（047 または別 spec）で「設計図消費で解放」する。
- **装備個体**：EquipmentInstance。1 回のクラフトで 1 個作成される。ステは乱数で決定。

------------------------------------------------------------------------

## 3. 永続化データ

### 3.1 CraftRecipe（クラフトレシピ）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| code | String, UNIQUE | 安定参照用 |
| name | String | 表示名 |
| outputKind | String | equipment / mecha_part / item のいずれか |
| outputEquipmentTypeId | String, FK→EquipmentType, NULL 可 | outputKind=equipment のとき |
| outputMechaPartTypeId | String, FK→MechaPartType, NULL 可 | outputKind=mecha_part のとき |
| outputItemId | String, FK→Item, NULL 可 | outputKind=item のとき（消耗品） |
| createdAt / updatedAt | DateTime | 既存パターン |

- outputKind に応じていずれか 1 つの output* が非 NULL。

### 3.2 CraftRecipeInput（クラフトレシピ入力）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| craftRecipeId | String, FK→CraftRecipe | レシピ |
| itemId | String, FK→Item | 消費する資源 |
| amount | Int | 1 回あたりの消費個数 |

### 3.3 EquipmentType（045 で定義済み・本 spec で使用）

- 装備種別。ステータス範囲・重み範囲は 021 に従い、カラムまたは JSON で持つ。クラフト実行時にこの範囲で乱数生成する。

### 3.4 EquipmentInstance（045 で定義済み・本 spec で作成）

- クラフト 1 回で 1 行作成。equipmentTypeId, userId に加え、決定したステータス（戦闘用ステ補正・属性耐性等）を保存する。

### 3.5 MechaPartInstance（045 で定義済み・本 spec で作成）

- クラフト 1 回で 1 行作成。mechaPartTypeId, userId に加え、決定したステータスを保存する。

### 3.6 MechaEquipment（044 既存・拡張）

- **個体参照**にする場合：mechaPartTypeId を NULL 可にし、**mechaPartInstanceId**（FK→MechaPartInstance）を追加。装着時は instance を指定する。実装時に 044 と合わせてスキーマを更新する。

------------------------------------------------------------------------

## 4. 入力・出力

### 4.1 executeCraft の入力

- **craftRecipeId**：実行するレシピ ID。
- セッションから **userId** を取得。

### 4.2 executeCraft の出力

- **成功時**：作成された対象の情報（equipmentInstanceId または mechaPartInstanceId または付与した itemId と quantity）。クライアントでは「〇〇を 1 個作成しました」等を表示。
- **失敗時**：在庫不足など。エラーメッセージとコードを返す。

### 4.3 equipEquipment の入力

- **characterId**：装着するキャラ（主人公または仲間）。
- **slot**：main_weapon / sub_weapon / head / body / arm / leg のいずれか。
- **equipmentInstanceId**：装着する装備個体 ID。その個体の所有者が userId と一致し、指定キャラがその userId のキャラであることを検証する。

### 4.4 unequipEquipment の入力

- **characterId**、**slot**。そのスロットの装着を NULL にする。

------------------------------------------------------------------------

## 5. ルール

### 5.1 クラフト実行

- **在庫チェック**：レシピの全 CraftRecipeInput について、userId の UserInventory の quantity が「amount 以上」であること。不足があればエラー。
- **消費**：全入力の amount を UserInventory から減算する。0 になった行は quantity=0 で残すか削除する（プロジェクト方針でよい）。
- **出力**：
  - outputKind = equipment：EquipmentInstance を 1 行作成（userId, equipmentTypeId, ステータスは 021 のルールで乱数生成）。返却に equipmentInstanceId を渡す。
  - outputKind = mecha_part：MechaPartInstance を 1 行作成（同様に乱数）。返却に mechaPartInstanceId を渡す。
  - outputKind = item：UserInventory の該当 itemId の quantity を 1 増やす（なければ INSERT）。
- **トランザクション**：在庫読み取り→消費→出力を 1 トランザクションで行う。

### 5.2 装備ステータスの乱数（021 準拠）

- 装備種別（EquipmentType）ごとに CAP 範囲と採用ステータス（戦闘用ステ名）と重み範囲を定義する。
- 1 個体作成時：CAP を範囲内で乱数、各採用ステの重みを範囲内で乱数→重みの合計で按分し CAP を配分。その結果を EquipmentInstance に保存する。
- メカパーツも同様に種別ごとの CAP・採用ステ（基礎ステ）・重みで乱数し、MechaPartInstance に保存する。

### 5.3 着脱

- **装着**：指定スロットに既に別の個体が装着されていれば上書きする（1 スロット 1 個）。equipmentInstanceId はそのユーザーが所持しているものであることのみ検証する（他キャラに装着中でも「持ち主」の装備一覧から選べる運用は禁止するか、装着時は他キャラから外すかは仕様で決める。推奨：1 個体は 1 キャラにのみ装着可能とする）。
- **解除**：該当 CharacterEquipment の equipmentInstanceId を NULL にする。

------------------------------------------------------------------------

## 6. 処理フロー

### 6.1 executeCraft

1. セッション検証。userId 取得。
2. CraftRecipe を取得。CraftRecipeInput を取得。
3. 在庫スナップショット（UserInventory）を取得。レシピ入力ごとに quantity >= amount を検証。不足ならエラー返却。
4. トランザクション開始。
5. UserInventory を減算（全入力）。
6. outputKind に応じて EquipmentInstance / MechaPartInstance を 1 件作成、または UserInventory に出力 Item を 1 加算。
7. コミット。返却。

### 6.2 equipEquipment

1. セッション検証。characterId がその userId のキャラであること、equipmentInstanceId がその userId の個体であることを検証。
2. slot が main_weapon / sub_weapon / head / body / arm / leg のいずれかであることを検証。
3. CharacterEquipment を upsert（characterId, slot でユニーク）。equipmentInstanceId を設定。既存の同一スロットは上書き。

### 6.3 unequipEquipment

1. セッション検証。characterId がその userId のキャラであることを検証。
2. CharacterEquipment の該当 (characterId, slot) の equipmentInstanceId を NULL に更新。

------------------------------------------------------------------------

## 7. 永続化データ / 一時データ

- **永続化**：CraftRecipe, CraftRecipeInput, EquipmentInstance, MechaPartInstance, UserInventory の増減, CharacterEquipment。MechaEquipment は 046 で個体参照に拡張する場合に更新。
- **保存しない**：乱数生成の中間値（CAP・重みの乱数結果は最終的なステータスとしてのみ保存）。

------------------------------------------------------------------------

## 8. エラー条件 / NG

- 在庫不足で executeCraft を実行した場合：400 または 409 とメッセージ「〇〇が不足しています」。
- 存在しない craftRecipeId、他人の characterId / equipmentInstanceId 指定：404 または 403。
- 不正な slot 文字列：400。

------------------------------------------------------------------------

## 9. 画面仕様（クラフト・装備）

| 項目 | 内容 |
|------|------|
| **URL** | /dashboard/craft, /dashboard/equipment 等 |
| **前提** | 010_auth セッション有効。045 の所持データがある。 |
| **要素** | クラフト：レシピ一覧、選択→実行ボタン、必要素材の表示。装備：キャラ選択、スロット一覧、所持装備一覧から着脱。 |
| **呼び出す API** | getCraftRecipes, executeCraft / getCharacterEquipment, equipEquipment, unequipEquipment |
| **成功時** | クラフト：作成結果を表示。装備：装着状況を更新表示。 |
| **エラー時** | 在庫不足・権限エラーを表示。 |

------------------------------------------------------------------------

## 10. テスト観点

- 在庫が足りない状態で executeCraft を呼ぶとエラーになること。
- 足りる状態で 1 回実行すると、入力が減り出力が 1 増えること（装備の場合は EquipmentInstance が 1 件増える）。
- equipEquipment 後、getCharacterEquipment でそのスロットに該当個体が返ること。unequipEquipment 後は NULL になること。
