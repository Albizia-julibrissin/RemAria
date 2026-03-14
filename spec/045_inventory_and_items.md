# Spec: アイテム・所持・バッグ

`docs/026_user_inventory_and_items.md` に基づき、**Item の category 拡張**・**所持データの構造**・**バッグ一覧 API** を定義する。工業受け取り（036）や建設（047）で消費・付与される在庫の土台となる。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：セッションが有効であること。所持 API は getSession を前提とする。
- **036_production_receive**：UserInventory を利用している。本 spec は Item に category を追加し、在庫の「種別」を扱えるようにする。
- **docs/026**：アイテム種別・所持の考え方・確定事項（§9）に準拠する。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| getInventory | ユーザーの所持一覧を種別（category）ごとに取得。バッグ画面のタブ表示用。 | バッグ画面 |
| getInventoryByCategory | 指定 category のスタック型所持のみ取得（任意） | バッグ画面・他機能 |

------------------------------------------------------------------------

## 1. 目的

- **Item** に **category** を追加し、資源・消耗品・設計図・スキル分析書・課金アイテムなどを区別する。
- **スタック型**の所持は既存 **UserInventory**（userId, itemId, quantity）のまま扱う。
- **装備個体・メカパーツ個体**は別テーブル（EquipmentInstance, MechaPartInstance）で持ち、046 で作成・更新する。本 spec ではスキーマと定数を定義し、バッグで「所持一覧」に含めて返すための契約を定める。
- **装備スロット**は `main_weapon` / `sub_weapon` / `head` / `body` / `arm` / `leg` で統一する（026 §9 C-2）。

------------------------------------------------------------------------

## 2. 用語

- **スタック型**：同一アイテムを数量（quantity）で管理。UserInventory の 1 行 = 1 種のアイテムの所持数。
- **個体管理**：装備・メカパーツは 1 個 1 行（EquipmentInstance, MechaPartInstance）。同一種別でも個体ごとにステータスが異なる。
- **category**：Item の種別。material / consumable / blueprint / skill_book / paid 等。バッグのタブや消費先の判定に使う。
- **バッグ**：UI 上の所持一覧画面。種別ごとのタブで一覧する（026）。

------------------------------------------------------------------------

## 3. 永続化データ

### 3.1 Item（拡張）

既存 Item に **category** と **所持上限（maxOwnedPerUser）** を追加する。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK（既存） |
| code | String, UNIQUE | 既存 |
| name | String | 既存 |
| **category** | **String, NOT NULL, default 'material'** | material / consumable / blueprint / skill_book / paid のいずれか。拡張時はマスタで追加。 |
| **maxOwnedPerUser** | **Int?（NULL 可）** | ユーザー 1 人あたりの**所持上限個数**。NULL の場合は「上限なし」。未指定の既存アイテムは後述の共通ルールで扱う。 |

- 既存の素材・製品は category = `material` とする。seed またはマイグレーションで設定する。
- 所持上限は基本方針として **すべてのアイテムで 30,000 個/ユーザー** を上限（maxOwnedPerUser = 30000）とし、  
  - 探索用資源である **基本探索キット** は「**1 日 1,000 個の排出**・**1 回探索の基本消費を 10 個想定**（100 回分/日）」の案から **3 日分 ≒ 3,000 個** を上限にするイメージで設定する。  
  - 特別に厳しい上限が必要なレアアイテム等は、個別に maxOwnedPerUser を別値（例: 999）にする。

### 3.2 UserInventory（既存・変更なし）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| userId | String, FK→User | 所有者 |
| itemId | String, FK→Item | アイテム |
| quantity | Int, default 0 | 所持数（0 以上） |

- @@unique([userId, itemId]) のまま。スタック型の所持のみ。装備個体・メカパーツ個体はここに持たない。

### 3.3 装備スロット定数（コード値）

主人公・仲間の装備枠。DB の enum またはアプリ定数で以下を定義する。

| 定数 | 説明 |
|------|------|
| main_weapon | 主武器 |
| sub_weapon | 副武器 |
| head | 頭 |
| body | 胴 |
| arm | 腕 |
| leg | 脚 |

- 遺物枠（4）は別スロットとして扱う（本 spec では個数だけ定義。遺物個体テーブルは別 spec または Later）。

### 3.4 EquipmentType（装備種別マスタ）— 046 で使用、スキーマは本 spec で定義

クラフトの「出力」として参照する。046 でクラフトレシピと紐づける。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| code | String, UNIQUE | 安定参照用（例: iron_sword, cloth_armor） |
| name | String | 表示名 |
| slot | String | 装着スロット。上記定数のいずれか。 |
| createdAt / updatedAt | DateTime | 既存パターン |

- ステータス範囲・重み範囲は 021 に従い、別カラムまたは JSON で持つ。詳細は 046 で定義してよい。

### 3.5 EquipmentInstance（装備個体）

ユーザーがクラフトで入手した装備 1 個 1 行。046 で作成される。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| userId | String, FK→User | 所有者 |
| equipmentTypeId | String, FK→EquipmentType | 種別 |
| ステータス値 | 各カラムまたは JSON | 製造時に決定した戦闘用ステ補正・属性耐性等。021・026 に従う。 |
| createdAt / updatedAt | DateTime | 既存パターン |

- 戦闘計算では「基礎→係数表で戦闘用ステ→装備補正を加算」で使用（09・10）。

### 3.6 CharacterEquipment（装着）

主人公・仲間の「どのスロットにどの装備個体を装着しているか」。046 で着脱時に更新する。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| characterId | String, FK→Character | 主人公または仲間（category = protagonist / companion） |
| slot | String | main_weapon / sub_weapon / head / body / arm / leg のいずれか |
| equipmentInstanceId | String, FK→EquipmentInstance, NULL 可 | 装着している個体。NULL は未装着。 |
| createdAt / updatedAt | DateTime | 既存パターン |

- @@unique([characterId, slot])。1 キャラあたり各スロット 1 つまで。

### 3.7 MechaPartInstance（メカパーツ個体）— 046 で作成、スキーマは本 spec で定義

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| userId | String, FK→User | 所有者 |
| mechaPartTypeId | String, FK→MechaPartType | 種別（044） |
| ステータス値 | 各カラムまたは JSON | 製造時に決定した基礎ステ補正等。021・044 に従う。 |
| createdAt / updatedAt | DateTime | 既存パターン |

### 3.8 MechaEquipment（044 既存・拡張）

既存は mechaPartTypeId 参照。**個体を扱う場合は** mechaPartInstanceId を追加し、mechaPartTypeId を NULL 可にするか、mechaPartInstanceId に統一する（026 §9 F-1）。実装方針は 046 で「個体参照に拡張」する。

------------------------------------------------------------------------

## 4. API

### 4.1 getInventory

- **入力**：セッションから userId を取得。オプションで category フィルタ（指定時はその category のスタック型のみ）。
- **出力**：
  - **stackable**：UserInventory の一覧（itemId, item.code, item.name, item.category, quantity）。category 指定時はその category に絞る。
  - **equipmentInstances**（MVP で実装する場合）：その userId の EquipmentInstance 一覧（id, equipmentTypeId, 表示用ステ要約）。バッグの「装備」タブ用。
  - **mechaPartInstances**（MVP で実装する場合）：その userId の MechaPartInstance 一覧。バッグの「メカパーツ」タブ用。
- **ルール**：0 以下の quantity は返さない。論理削除は行わず、quantity=0 の行は表示しないか 0 として扱う（運用で決めてよい）。

### 4.2 在庫増減の前提（本 spec では API を持たない）

- **増加**：036 の受け取り、047 の建設完了時の付与、046 のクラフト出力（消耗品）、探索報酬など。いずれも他 spec で UserInventory を更新する。  
  このとき、対象 Item の maxOwnedPerUser（NULL なら上限なし）を見て、  
  `newQuantity = min(currentQuantity + delta, maxOwnedPerUser)` となるように**クリップ（上限で打ち止め）**する。  
  `currentQuantity + delta` が上限を超えていた場合、**超えたぶんは付与されず破棄**される。必要に応じて「所持上限に達しているため一部が破棄された」旨をログや UI メッセージで通知する。
- **消費**：047 の建設時の資源消費、046 のクラフト入力。他 spec で UserInventory を減算する。減算後 quantity が 0 未満にならないようトランザクションで検証する。

------------------------------------------------------------------------

## 5. ルール

- Item.category はマスタで管理する。新規 category を足す場合は Item の seed または管理画面で追加し、バッグのタブ一覧を category から生成する形にすると拡張しやすい（026 §7）。
- 装備スロットは 6 種（main_weapon, sub_weapon, head, body, arm, leg）を MVP で定義。増やす場合はスロット定数と CharacterEquipment の制約を拡張する。

------------------------------------------------------------------------

## 6. 処理フロー（getInventory）

1. セッション検証（getSession）。userId 取得。
2. UserInventory を userId で取得。Item を join して code, name, category を含める。オプションで category でフィルタ。
3. （MVP で装備タブを出す場合）EquipmentInstance を userId で取得。EquipmentType を join。
4. （MVP でメカパーツタブを出す場合）MechaPartInstance を userId で取得。MechaPartType を join。
5. 返却：stackable, equipmentInstances, mechaPartInstances をまとめたオブジェクト。

------------------------------------------------------------------------

## 7. 永続化データ / 一時データ

- **永続化**：Item, UserInventory, EquipmentType, EquipmentInstance, CharacterEquipment, MechaPartInstance。MechaEquipment は 044 のまままたは 046 で instance 参照に拡張。
- **保存しない**：getInventory の返却用に組み立てた一時的な集計。再計算可能なため保存しない。

------------------------------------------------------------------------

## 8. エラー条件 / NG

- 未ログイン時は getInventory を呼ばない（010 でガード）。不正な userId の場合は空で返すか 401 とする。
- 在庫の整合性（0 未満防止）は、消費を行う spec（046, 047）でトランザクション内チェックする。

------------------------------------------------------------------------

## 9. 画面仕様（バッグ）

| 項目 | 内容 |
|------|------|
| **URL** | /dashboard/bag 等（プロジェクトのルーティングに合わせる） |
| **前提** | 010_auth のセッションが有効であること。 |
| **要素** | 種別タブ（資源・装備・メカパーツ・消耗品・設計図・課金等）、タブごとの所持一覧。消費は各機能画面で行うため、バッグでは一覧確認が主。 |
| **呼び出す API** | getInventory |
| **成功時** | タブに応じた一覧を表示。 |
| **エラー時** | セッション切れの場合はログインへ。その他はエラーメッセージ表示。 |

------------------------------------------------------------------------

## 10. テスト観点

- Item.category を seed で投入し、getInventory で category ごとに取得できること。
- UserInventory の quantity が 0 の行をどう表示するか（非表示 or 0 表示）を仕様で決め、それに沿ったレスポンスであること。
