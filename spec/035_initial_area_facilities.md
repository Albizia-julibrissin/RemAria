# Spec: 初期工業・強制配置設備と生産チェーン

`docs/018_facility_placement_areas.md` に基づき、**初期状態**（設置枠 5・コスト上限 200、強制配置 5 設備）と生産チェーン（水→飲料水、小麦→小麦粉、飲料水＋小麦粉→携帯食料）をデータ・seed・API で扱えるようにする。  
エリア制は廃止しており、設備は単一プールに配置する（018 準拠）。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：セッションが有効であること。設備 API は保護画面として getSession を前提とする。
- **015_protagonist_creation**：主人公の有無判定（dashboard で実施）。
- **017 / 018**：設計は `docs/017_facility_variant_and_rare_parts.md` および `docs/018_facility_placement_areas.md` に準拠する。
- **019 / 036**：生産受け取りは `docs/019_production_receive.md` および **spec/036_production_receive.md** に準拠する。在庫（UserInventory）は 036 で利用する。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| ensureInitialFacilities | ユーザーの強制配置 5 設備が無ければ作成する | **新規登録時（register）** および 工業画面の初回表示時（getIndustrial） |
| getIndustrial | 工業情報（設置枠・コスト上限・配置済み設備一覧・生産仕様）を返す | 工業画面 |

------------------------------------------------------------------------

## 1. 目的

- ゲーム開始時点で**設置枠 5・コスト上限 200**とする。
- **川探索拠点・浄水施設・小麦畑・小麦製粉器・携帯食料包装**の 5 設備を**強制配置**する。プレイヤーは解体・変更できない。
- 設備は**配備がなくても基礎生産力で稼働**する。生産チェーンは以下とする。
  - 川探索拠点：60分で 水 600
  - 浄水施設：20分ごとに 水 200 → 飲料水 100
  - 小麦畑：120分で 小麦 200
  - 小麦製粉器：30分ごとに 小麦 50 → 小麦粉 150
  - 携帯食料包装：15分ごとに 飲料水 75 ＋ 小麦粉 75 → 携帯食料 25
- 上記により **1 時間あたり携帯食料 100 個**がロスなく生産される（docs/018 の仮数値）。
- 各設備のコストは仮で 40 ずつとし、合計 200 を初期状態で消費する。

------------------------------------------------------------------------

## 2. 用語

- **設置枠・コスト上限**：ユーザー（または Factory）が持つ最大配置数と最大コスト。進行で増加（018）。初期は 5 枠・200 コスト。
- **設置済み設備（FacilityInstance）**：ユーザーが配置した 1 設備。**設置エリアには属さない**（単一プール）。facilityTypeId と variantCode（基本型='base'）を持つ。
- **強制配置**：ゲーム開始時に必ず存在する 5 設備。解体・変更不可。
- **レシピ（Recipe）**：設備種別ごとの生産仕様（周期・入力素材・出力素材）。資源探索は入力なし・出力のみ。

------------------------------------------------------------------------

## 3. 永続化データ

### 3.1 設置枠・コスト上限

- **User** または **Factory** に **industrialMaxSlots**（Int, 初期 5）と **industrialMaxCost**（Int, 初期 200）を持つ。進行で増やす。本 spec では「初期 5 / 200」を前提とする。

### 3.2 設置済み設備（FacilityInstance）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| userId | String, FK→User | 所有者 |
| facilityTypeId | String, FK→FacilityType | 設備種別 |
| variantCode | String, default 'base' | 基本型='base'。017 の派生型は将来。 |
| displayOrder | Int | 表示順 |
| isForced | Boolean, default false | 強制配置なら true（解体・変更不可） |
| lastProducedAt | DateTime, NULL 可 | 最終生産日時（019） |

- **placementAreaId は持たない**（エリア制廃止のため）。

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

### 3.7 在庫（UserInventory）— 036 で利用

- 受け取り（receiveProduction）で消費・付与するため、**UserInventory**（userId, itemId, quantity）を用意する。本 spec（035）では設備・レシピまでを担当し、在庫の増減は **036_production_receive** で行う。

------------------------------------------------------------------------

## 4. ルール

- **新規アカウント登録時（register）** に **ensureInitialFacilities(userId)** を呼び、強制配置 5 設備を作成する。industrialMaxSlots / industrialMaxCost は 5 / 200 で初期化する（User または Factory に持たせる場合）。
- 工業画面の初回表示時（getIndustrial）にも同処理を呼ぶ（冪等）。設備は 川探索拠点・浄水施設・小麦畑・小麦製粉器・携帯食料包装 の順で displayOrder 1〜5、isForced=true。
- 強制配置の 5 設備は削除・変更不可（API では更新・削除を許可しない）。画面では建設・解体ボタンを出さない（枠に余裕ができた場合は追加設備用に建設 UI を出す）。
- 生産計算は本 spec では「レシピと周期が参照できること」まで。実際の受け取り・在庫増減は **036_production_receive**（019 準拠）で扱う。

------------------------------------------------------------------------

## 5. 処理フロー

### ensureInitialFacilities(userId)

1. userId に紐づく FacilityInstance のうち **isForced=true** の件数を取得。
2. 5 件未満なら、不足分を 川探索拠点・浄水施設・小麦畑・小麦製粉器・携帯食料包装 の facilityTypeId で作成（variantCode='base', displayOrder 1〜5, isForced=true）。既存がある場合は facilityType 名でマッチして並びのみ補正してもよい。最低限「5 件無ければ 5 件作成」でよい。
3. User または Factory の industrialMaxSlots / industrialMaxCost が未設定なら 5 / 200 をセットする。

### getIndustrial(userId)

1. ensureInitialFacilities(userId) を実行（冪等）。
2. userId に紐づく FacilityInstance を displayOrder 昇順で取得。FacilityType を join。
3. 各 FacilityType に紐づく Recipe（と RecipeInput, Item）を取得。
4. User または Factory から industrialMaxSlots, industrialMaxCost を取得。
5. 返却：{ maxSlots, maxCost, usedSlots, usedCost, facilities: [{ facilityInstance, facilityType, recipe, recipeInputs }] }

------------------------------------------------------------------------

## 6. 画面仕様（最小）

- **URL**：`/dashboard` または `/dashboard/facilities`（既存ダッシュボード内のカード／タブでも可）。
- **前提**：010_auth セッション、015 主人公作成済み。
- **要素**：設置枠・コスト上限（例：5 / 200）、使用中枠・使用コスト、配置済み設備の一覧（設備名・コスト・生産仕様の要約）。強制配置 5 は建設・解体しない。枠に余裕がある場合は建設 UI を表示する。
- **呼び出す API**：getIndustrial(session.userId)。受け取りは 019 に従い全設備一括。

------------------------------------------------------------------------

## 7. テスト観点

- 新規ユーザー作成後、ensureInitialFacilities により FacilityInstance が 5 件（isForced=true）存在すること。
- ensureInitialFacilities を 2 回呼んでも FacilityInstance が 5 件のまま増えないこと（冪等）。
- getIndustrial が 5 設備・各レシピ・maxSlots/maxCost を返すこと。
- Item が 5 件、Recipe が 5 件、RecipeInput が 3 件（浄水・製粉・携帯食料包装）は seed で用意されていること。

------------------------------------------------------------------------

## 8. エラー条件

- facilityType が seed に無い（川探索拠点等の名前不一致）：seed の FACILITY_TYPES と一致させる。

------------------------------------------------------------------------

## 9. 実装準備（018/019 準拠への変更チェックリスト）

以下の変更を実装時に実施する。018（エリア制廃止）・019（全設備一括受け取り）に合わせる。

### 9.1 スキーマ・データ

- [ ] **PlacementArea** モデルを削除する（または使わない）。設置枠・コスト上限は **User** または **Factory** の `industrialMaxSlots`（Int, 初期 5）・`industrialMaxCost`（Int, 初期 200）で持つ。
- [ ] **FacilityInstance** から `placementAreaId` を削除する。`isForced`（Boolean, default false）、`lastProducedAt`（DateTime?, NULL 可）を追加する。
- [ ] **UserInventory**（userId, itemId, quantity）を用意する（036 の受け取りで使用）。

### 9.2 API・処理のリネームと変更

- [ ] `ensureInitialAreaFacilities` → **ensureInitialFacilities**。PlacementArea を参照せず、userId に紐づく FacilityInstance のうち isForced=true が 5 件あるか確認し、不足分を作成する。
- [ ] `getInitialArea` → **getIndustrial**。返却は `{ maxSlots, maxCost, usedSlots, usedCost, facilities }`。PlacementArea は返さない。
- [ ] 工業画面で「エリア選択」UI を削除する。単一プールのためエリア切り替えは不要。
- [ ] 受け取りは **036** の **receiveProduction** を 1 回呼ぶ（全設備一括）。設備配置変更時は、変更前に receiveProduction を 1 回呼んでから設備の追加・撤去・入れ替えを反映する（強制受け取り）。

### 9.3 Seed

- [ ] PlacementArea の seed を削除または無効化する。User または Factory の industrialMaxSlots / industrialMaxCost は新規ユーザー作成時（ensureInitialFacilities 内）で 5 / 200 をセットする。
