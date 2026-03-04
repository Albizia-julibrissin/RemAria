# Spec: 研究・解放・建設

`docs/017_facility_variant_and_rare_parts.md`、`docs/018_facility_placement_areas.md`、`docs/026_user_inventory_and_items.md` に基づき、**設備の基本型解放（研究）**と**型ごとの建設レシピ**、**設備配置時の資源消費**を定義する。MVP では**派生型の解放（設計図消費）は後回し**とする（026 §9 E-2）。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：セッションが有効であること。
- **035_initial_area_facilities**：FacilityType, FacilityInstance（facilityTypeId, variantCode）, 設置枠・コスト上限。
- **036_production_receive**：在庫（UserInventory）の読み取り・更新。強制受け取りの流れ。
- **045_inventory_and_items**：Item, UserInventory。建設時の資源消費で参照・減算する。
- **docs/017, 018, 026**：建設は「その型の建設レシピで定義した資源」を消費する。基本型も資源消費。1 型 : 1 レシピ。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| getUnlockedFacilityTypes | ユーザーが建設可能な設備種別一覧を返す（研究で解放済みのもの）。 | 工業画面・建設選択 |
| getConstructionRecipe | 指定設備種別＋型（variantCode）の建設に必要な資源（itemId, amount）一覧を返す。 | 工業画面・建設確認 |
| placeFacility | 指定設備種別＋型で 1 設備を配置する。建設レシピの資源を消費し、FacilityInstance を 1 件作成。枠・コスト制限内であることと解放済みであることを検証。 | 工業画面・建設確定 |
| dismantleFacility | 指定 FacilityInstance を解体する。強制配置でなければ削除。消費した資源は返却しない。 | 工業画面 |
| getResearchState | 研究状態（どの設備種別が解放済みか、未解放の場合は条件要約）を返す。MVP では解放済み一覧で十分な場合あり。 | 研究メニュー |

- **設計図消費**（設備型解放・クラフトレシピ解放）は MVP では実装しない。将来 047 または別 spec で UserFacilityVariantUnlock / UserCraftRecipeUnlock と設計図消費 API を追加する。

------------------------------------------------------------------------

## 1. 目的

- **研究**で設備の**基本型**を解放する。解放済みの設備種別だけが建設可能（018）。
- **建設時**は、選択した**型**（基本型 = variantCode 'base'）に紐づく**建設レシピ**で定義した資源を消費する。基本型も無料ではなく資源消費（026 §9 A-1）。
- **1 型 : 1 レシピ**。成果物（設置される設備）は同じでも、型ごとに時間・素材効率・排出量などが変わる。それらをまとめてレシピとみなし、型ごとに 1 セットの建設入力を持つ（026 §9 A-2）。
- MVP では**派生型の解放は後回し**のため、建設可能な型は**基本型（base）のみ**とする。派生型用の FacilityVariant と建設レシピはデータだけ用意し、解放・選択は実装しないでもよい。

------------------------------------------------------------------------

## 2. 用語

- **設備種別（FacilityType）**：川探索拠点・精錬機などの施設の種類。既存マスタ。
- **型（Variant）**：各設備種別に紐づく「基本型」（variantCode='base'）と「派生型」（alpha, beta 等）。1 型につき 1 建設レシピ（資源のリスト）。
- **建設レシピ**：その型で 1 設備を建てるときに消費する資源のリスト（itemId + amount）。FacilityConstructionRecipeInput で保持。
- **解放**：研究で「その設備種別を建て可能にする」。UserFacilityTypeUnlock に 1 行追加する。

------------------------------------------------------------------------

## 3. 永続化データ

### 3.1 FacilityVariant（型マスタ）

各設備種別に「基本型」と将来の「派生型」を定義する。1 型 : 1 建設レシピセットに対応。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| facilityTypeId | String, FK→FacilityType | 設備種別 |
| variantCode | String | 'base' / 'alpha' / 'beta' 等。基本型は 'base'。 |
| name | String, NULL 可 | 表示名（例：基本型、α型） |
| createdAt / updatedAt | DateTime | 既存パターン |

- @@unique([facilityTypeId, variantCode])。MVP では各 FacilityType に variantCode='base' の 1 行を用意する。

### 3.2 FacilityConstructionRecipeInput（建設レシピ入力）

その型で 1 設備建設するときに消費する資源。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| facilityVariantId | String, FK→FacilityVariant | 型 |
| itemId | String, FK→Item | 消費する資源 |
| amount | Int | 1 回の建設で消費する個数 |

- 同一 variantId に対して複数行（複数種類の資源を消費可能）。amount は 1 以上。

### 3.3 UserFacilityTypeUnlock（設備種別の解放）

研究で「その設備種別を建て可能にした」ことを表す。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| userId | String, FK→User | ユーザー |
| facilityTypeId | String, FK→FacilityType | 解放した設備種別 |
| createdAt | DateTime | 解放日時（任意） |

- @@unique([userId, facilityTypeId])。研究条件達成時に 1 行追加する。MVP では初期状態で解放済みの設備（例：強制配置 5 に対応する 5 種別）を seed で挿入してもよい。

### 3.4 FacilityInstance（035 既存・変更なし）

- facilityTypeId, variantCode, userId, displayOrder, isForced, lastProducedAt。建設時に 1 件作成する。variantCode は選択した型（MVP では 'base'）。

### 3.5 UserInventory（045・036 と共通）

- 建設時に FacilityConstructionRecipeInput に従い **quantity を減算**する。0 未満にしないようトランザクションで検証する。

------------------------------------------------------------------------

## 4. 入力・出力

### 4.1 placeFacility の入力

- **facilityTypeId**：配置する設備種別。
- **variantCode**：配置する型。MVP では 'base' のみ許可してよい。
- セッションから **userId** を取得。

### 4.2 placeFacility の出力

- **成功時**：作成した FacilityInstance の id および表示用情報。クライアントでは「〇〇を配置しました」等を表示。
- **失敗時**：枠超過・コスト超過・未解放・在庫不足など。エラーメッセージとコードを返す。

### 4.3 getConstructionRecipe の入力

- **facilityTypeId**、**variantCode**（例：'base'）。対応する FacilityVariant の建設レシピ（FacilityConstructionRecipeInput 一覧）を返す。

------------------------------------------------------------------------

## 5. ルール

### 5.1 建設可能条件

- **解放**：UserFacilityTypeUnlock に (userId, facilityTypeId) が存在すること。存在しなければ「未解放」でエラー。
- **枠・コスト**：現在の配置数 < industrialMaxSlots、現在の使用コスト + その設備のコスト <= industrialMaxCost（018）。強制配置 5 はカウントに含める。
- **在庫**：選択した型の FacilityConstructionRecipeInput の全行について、userId の UserInventory の quantity >= amount であること。不足があればエラー。

### 5.2 建設時の処理

1. 解放・枠・コスト・在庫を検証。NG ならエラー返却。
2. **強制受け取り**：035/036 に従い、設備配置変更前に「変更前の設備構成で receiveProduction を 1 回実行」する。その後、在庫を再度取得（スナップショット）し、建設レシピの消費可能を検証する。
3. トランザクション開始。
4. UserInventory から建設レシピの全入力分を減算（存在しなければ INSERT してから減算しない。必ず存在する前提で減算し、0 未満は禁止）。
5. FacilityInstance を 1 件作成（userId, facilityTypeId, variantCode, displayOrder, isForced=false, lastProducedAt=NULL）。
6. コミット。返却。

### 5.3 解体

- isForced が true の設備は解体不可。false の設備は削除する。建設に使った資源は返却しない（017）。

### 5.4 研究（基本型解放）

- MVP では「研究で解放」は、条件達成時に **UserFacilityTypeUnlock に 1 行挿入**する API（unlockFacilityType）で表現する。条件は別 spec または仮条件（例：レベル・クエスト達成）でよい。
- getResearchState は、解放済み facilityTypeId 一覧と、未解放の設備種別とその解放条件の要約を返す。MVP では解放済み一覧だけでも可。

------------------------------------------------------------------------

## 6. 処理フロー

### 6.1 placeFacility

1. セッション検証。userId 取得。
2. UserFacilityTypeUnlock に (userId, facilityTypeId) が存在するか確認。無ければエラー。
3. FacilityVariant を (facilityTypeId, variantCode) で取得。無ければエラー。MVP では variantCode='base' のみ。
4. FacilityConstructionRecipeInput を facilityVariantId で取得。
5. 現在の FacilityInstance 数と使用コストを集計。枠・コスト制限チェック。超過ならエラー。
6. UserInventory を取得。建設レシピの各 (itemId, amount) について quantity >= amount を確認。不足ならエラー。
7. **強制受け取り**を実行（036 の receiveProduction を 1 回）。その後、在庫を再取得し 6 を再検証（受け取りで増えた分を反映）。
8. トランザクション開始。UserInventory を減算。FacilityInstance を INSERT。コミット。返却。

### 6.2 getUnlockedFacilityTypes

1. userId に紐づく UserFacilityTypeUnlock の facilityTypeId 一覧を取得。FacilityType を join して名前等を返す。

### 6.3 getConstructionRecipe

1. facilityTypeId と variantCode で FacilityVariant を取得。その facilityVariantId で FacilityConstructionRecipeInput を取得。Item を join して名前等を返す。

------------------------------------------------------------------------

## 7. 永続化データ / 一時データ

- **永続化**：FacilityVariant, FacilityConstructionRecipeInput, UserFacilityTypeUnlock, FacilityInstance, UserInventory の減算。
- **保存しない**：getConstructionRecipe の返却用の組み立て、getResearchState の集計結果。

------------------------------------------------------------------------

## 8. エラー条件 / NG

- 未解放の設備種別で placeFacility：403 または 400「その設備はまだ解放されていません」。
- 枠超過・コスト超過：400「設置枠が足りません」等。
- 在庫不足：400「〇〇が N 個不足しています」。
- 強制配置の解体依頼：403 または 400。

------------------------------------------------------------------------

## 9. 画面仕様（研究・工業建設）

| 項目 | 内容 |
|------|------|
| **URL** | /dashboard/research, /dashboard/facilities 等 |
| **前提** | 010_auth セッション有効。 |
| **要素** | 研究：解放済み設備一覧・未解放と条件要約。工業建設：設備選択（解放済みのみ）、型選択（MVP では base のみ）、必要資源表示、配置確定ボタン。 |
| **呼び出す API** | getResearchState, getUnlockedFacilityTypes, getConstructionRecipe, placeFacility, dismantleFacility |
| **成功時** | 建設：設備が一覧に追加され、資源が消費されたことを表示。 |
| **エラー時** | 在庫不足・枠超過・未解放をメッセージ表示。 |

------------------------------------------------------------------------

## 10. テスト観点

- 解放済みでない設備種別で placeFacility するとエラーになること。
- 在庫が足りない状態で placeFacility するとエラーになること。
- 在庫が足りる状態で placeFacility すると、建設レシピ分が減り、FacilityInstance が 1 件増えること。強制受け取りが先に 1 回実行されること（036 と連携）。
- 枠いっぱい・コストいっぱいの状態で placeFacility するとエラーになること。

------------------------------------------------------------------------

## 11. MVP スコープと将来拡張

- **MVP**：基本型（variantCode='base'）のみ建設可能。派生型の解放（設計図消費）は実装しない。UserFacilityVariantUnlock は将来 047 または別 spec で追加する。
- **将来**：設計図を研究メニューで消費し、UserFacilityVariantUnlock に挿入。建設選択時に解放済み派生型を選べるようにする。設計図の解放対象は 026 §2.7 に従う。
