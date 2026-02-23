# Spec: 初期エリア・設備配置と生産チェーン

`docs/018_facility_placement_areas.md` に基づき、**初期エリア**（強制配置 5 設備）と生産チェーン（水→飲料水、小麦→小麦粉、飲料水＋小麦粉→携帯食料）をデータ・seed・API で扱えるようにする。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：セッションが有効であること。設備・設置エリア API は保護画面として getSession を前提とする。
- **015_protagonist_creation**：主人公の有無判定（dashboard で実施）。
- **017 / 018**：設計は `docs/017_facility_variant_and_rare_parts.md` および `docs/018_facility_placement_areas.md` に準拠する。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| ensureInitialAreaFacilities | ユーザーの初期エリアに強制配置 5 設備が無ければ作成する | **新規登録時（register）** および 工業画面の初回表示時（getInitialArea） |
| getInitialArea | 初期エリア情報（設置エリアマスタ・配置済み設備一覧・生産仕様）を返す | 工業・初期エリア表示画面 |

------------------------------------------------------------------------

## 1. 目的

- ゲーム開始時から解放されている**初期エリア**を 1 つ定義し、**最大コスト 200・最大配置数 5** とする。
- 初期エリアには**川探索拠点・浄水施設・小麦畑・小麦製粉器・携帯食料包装**の 5 設備を**強制配置**する。プレイヤーは解体・変更できない。
- 設備は**配備がなくても基礎生産力で稼働**する。生産チェーンは以下とする。
  - 川探索拠点：60分で 水 600
  - 浄水施設：20分ごとに 水 200 → 飲料水 100
  - 小麦畑：120分で 小麦 200
  - 小麦製粉器：30分ごとに 小麦 50 → 小麦粉 150
  - 携帯食料包装：15分ごとに 飲料水 75 ＋ 小麦粉 75 → 携帯食料 25
- 上記により **1 時間あたり携帯食料 100 個**がロスなく生産される（docs/018 の仮数値）。
- 各設備のコストは仮で 40 ずつとし、合計 200 を初期エリアで消費する。

------------------------------------------------------------------------

## 2. 用語

- **設置エリア（PlacementArea）**：設備を配置する枠。最大コスト・最大配置数を持つ。code='initial' が初期エリア。
- **設置済み設備（FacilityInstance）**：ユーザーが特定の設置エリアに置いた 1 設備。facilityTypeId と variantCode（基本型='base'）を持つ。
- **初期エリア**：ゲーム開始時から解放されている設置エリア。強制配置 5 設備で固定。
- **レシピ（Recipe）**：設備種別ごとの生産仕様（周期・入力素材・出力素材）。資源探索は入力なし・出力のみ。

------------------------------------------------------------------------

## 3. 永続化データ

### 3.1 設置エリア（PlacementArea）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| code | String, UNIQUE | 'initial' 等。安定参照用。 |
| name | String | 表示名（例：初期エリア） |
| maxCost | Int | 最大コスト（初期エリアは 200） |
| maxSlots | Int | 最大配置数（初期エリアは 5） |

### 3.2 設置済み設備（FacilityInstance）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| userId | String, FK→User | 所有者 |
| placementAreaId | String, FK→PlacementArea | どの設置エリアに置いているか |
| facilityTypeId | String, FK→FacilityType | 設備種別 |
| variantCode | String, default 'base' | 基本型='base'。017 の派生型は将来。 |
| displayOrder | Int | 表示順 |

### 3.3 設備種別のコスト（FacilityType）

- 既存 FacilityType に **cost**（Int, default 40）を追加。初期 5 設備は各 40 で合計 200。

### 3.4 素材・製品（Item）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| code | String, UNIQUE | 安定参照用（water, drinkable_water, wheat, flour, portable_ration） |
| name | String | 表示名（水、飲料水、小麦、小麦粉、携帯食料） |

### 3.5 レシピ（Recipe）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| facilityTypeId | String, FK→FacilityType | この設備で実行するレシピ |
| cycleMinutes | Int | 1 回の生産にかかる分数 |
| outputItemId | String, FK→Item | 出力するアイテム |
| outputAmount | Int | 1 回あたりの出力個数 |

### 3.6 レシピ入力（RecipeInput）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| recipeId | String, FK→Recipe | レシピ |
| itemId | String, FK→Item | 消費する素材 |
| amount | Int | 1 回あたりの消費個数 |

- 資源探索（川・小麦畑）は RecipeInput が 0 件。工業設備は 1 件以上。

------------------------------------------------------------------------

## 4. ルール

- 初期エリア（code='initial'）は seed で 1 件作成する。maxCost=200, maxSlots=5。
- **新規アカウント登録時（register）** に **ensureInitialAreaFacilities(userId)** を呼び、強制配置 5 設備を作成する。これにより新規ユーザーも工業エリアを開く前から初期エリアが用意される。
- 工業画面の初回表示時（getInitialArea）にも同処理を呼ぶ（冪等）。設備は 川探索拠点・浄水施設・小麦畑・小麦製粉器・携帯食料包装 の順で displayOrder 1〜5。
- 初期エリアの 5 設備は削除・変更不可（API では更新・削除を許可しない）。画面では建設・解体ボタンを出さない。
- 生産計算は本 spec では「レシピと周期が参照できること」まで。実際の Job 進行・在庫増減は別 spec（生産実行・在庫）で扱う。

------------------------------------------------------------------------

## 5. 処理フロー

### ensureInitialAreaFacilities(userId)

1. placementArea where code='initial' を取得。無ければエラー（seed 前提）。
2. その placementAreaId に対して、userId の FacilityInstance の件数を取得。
3. 5 件未満なら、不足分を 川探索拠点・浄水施設・小麦畑・小麦製粉器・携帯食料包装 の facilityTypeId で作成（variantCode='base', displayOrder 1〜5）。既存がある場合は facilityType 名でマッチして並びのみ補正してもよい。最低限「5 件無ければ 5 件作成」でよい。

### getInitialArea(userId)

1. ensureInitialAreaFacilities(userId) を実行（冪等）。
2. PlacementArea (code='initial') を取得。
3. そのエリアに属する FacilityInstance (userId 一致) を displayOrder 昇順で取得。FacilityType を join。
4. 各 FacilityType に紐づく Recipe（と RecipeInput, Item）を取得。
5. 返却：{ placementArea, facilities: [{ facilityInstance, facilityType, recipe, recipeInputs }] }

------------------------------------------------------------------------

## 6. 画面仕様（最小）

- **URL**：`/dashboard` または `/dashboard/facilities`（既存ダッシュボード内のカード／タブでも可）。
- **前提**：010_auth セッション、015 主人公作成済み。
- **要素**：初期エリア名、最大コスト 200・最大配置数 5、配置済み 5 設備の一覧（設備名・コスト・生産仕様の要約）。建設・解体は表示しない。
- **呼び出す API**：getInitialArea(session.userId)。

------------------------------------------------------------------------

## 7. テスト観点

- seed 実行後、PlacementArea が 1 件（code='initial'）、Item が 5 件、Recipe が 5 件、RecipeInput が 3 件（浄水・製粉・携帯食料包装）存在すること。
- ensureInitialAreaFacilities を 2 回呼んでも FacilityInstance が 5 件のまま増えないこと（冪等）。
- getInitialArea が 5 設備・各レシピを返すこと。

------------------------------------------------------------------------

## 8. エラー条件

- code='initial' の PlacementArea が存在しない：seed 未実行または不整合。500 または seed 実行を促す。
- facilityType が seed に無い（川探索拠点等の名前不一致）：seed の FACILITY_TYPES と一致させる。
