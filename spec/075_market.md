# Spec: 市場（出品・購入・成約）

`docs/065_market_design.md` に基づき、**プレイヤー間のアイテム売買**（出品・最安から購入・手数料・成約ログ）の API・データ・ルールを定義する。機能解放は開拓任務側で制御し、本 spec の範囲外とする。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：セッションが有効であること。すべての市場 API は getSession（userId）を前提とする。
- **045_inventory_and_items**：UserInventory（所持数）の増減・Item マスタ（category, marketListable 等）を参照する。
- **054_quests**：市場の利用可能かは**ユーザーごとの解放フラグ**で制御する。任務側でそのフラグをオンにする処理は後から追加する。本 spec では、各市場 API の冒頭で「当該ユーザーが市場解放済みか」をフラグで判定し、未解放ならエラーを返す。

### 0.2 提供する API / 利用者

| API 名 | 用途 | 呼び出し元 |
|--------|------|------------|
| listMarketItem | 指定アイテムを指定数量・単価で出品する。在庫を減らし MarketListing に追加。 | 市場・**出品**画面 |
| buyFromMarket | 指定アイテムを指定数量だけ購入。最安 listing から部分消化し、通貨移動・在庫付与・成約ログを 1 トランザクションで実行。 | 市場・**購入**画面 |
| cancelMarketListing | 指定 listing を取り下げ、在庫を出品者に戻す。 | 市場・**取下げ**画面 |
| getMarketList | 出品一覧（アイテム別の最安単価・その価格で買える数量、または全 listing の取得）を返す。 | 市場・**購入**画面 |
| getMyListings | 当該ユーザーの現在出品中の listing 一覧を返す。**getMarketList の filter ではなく、別 API** とする。 | 市場・**取下げ**画面 |
| getMarketPriceHistory | 指定アイテムの成約履歴から価格統計（直近 50 件の AVG / MEDIAN / MIN / MAX 等）を返す。 | 市場・購入画面（アイテム詳細等） |
| getMarketUserHistory | 当該ユーザーの市場履歴（成約・手動取り下げ・期限切れ自動取下げ）を返す。 | 市場・**履歴**画面 |

------------------------------------------------------------------------

## 1. 目的

- **スタック型アイテム**のうち **Item.marketListable = true** のものだけを出品可能とし、プレイヤー間で **GRA**（`User.premiumCurrencyFreeBalance` / `premiumCurrencyPaidBalance`）による売買を行う。購入時は**無償 GRA から先に消費**し、売り手への成約金は**すべて無償 GRA**で付与する（docs/076）。
- **購入は常に最安の listing から消化**（部分消化・partially fill）し、特定の出品者を指定できないようにして実質トレードを防ぐ。
- 成約時は**手数料 10％を売り手から控除**し、通貨は購入時に即確保する。**購入処理は 1 つの DB トランザクション**で完結させる。

------------------------------------------------------------------------

## 2. 用語

- **listing**：1 件の出品。MarketListing の 1 行。itemId, quantity（出品数量）, pricePerUnit（単価）, userId（出品者）を持つ。購入のたびに quantity を減らし、0 で削除する（部分消化）。
- **partially fill**：1 つの listing を複数回の成約で少しずつ減らすこと。同一 listing が 10 個 → 3 個買われる → 7 個残る → さらに 5 個買われる → 2 個残る … 0 になったら listing 削除。
- **成約**：購入が実行され、買い手の通貨減算・売り手の通貨加算（手数料控除後）・listing の quantity 減少・買い手の UserInventory 加算・MarketTransaction への挿入が一括で行われること。1 回の購入で複数 listing をまたぐ場合は、**listing ごとに MarketTransaction に 1 行**挿入する。
- **最安取得**：同一 itemId の listing のうち、pricePerUnit 昇順・同額なら createdAt 昇順で先頭の listing を取得すること。インデックス (itemId, pricePerUnit, createdAt) で高速化する。

------------------------------------------------------------------------

## 3. 永続化データ

### 3.1 Item の拡張（045 への追加）

| カラム | 型 | 説明 |
|--------|-----|------|
| **marketListable** | Boolean, NOT NULL, default false | true のアイテムのみ出品可能。運営がマスタで制御。 |
| **marketMinPricePerUnit** | Int?, NULL 可 | このアイテムの出品時の単価下限。NULL のときは**グローバル定数**を使用。 |
| **marketMinQuantity** | Int?, NULL 可 | このアイテムの出品時の数量下限。NULL のときは**グローバル定数**を使用。 |

- 既存 Item は marketListable = false のまま。出品を許可するアイテムだけ管理画面で true に変更する。**最低価格・最低出品単位はアイテムごとにマスタで編集**し、NULL のときのみ**グローバル定数**を使用する。

### 3.2 市場解放（ユーザーフラグ）

- **User に「市場解放済み」フラグ**（例: marketUnlocked, Boolean, default false）を持たせる。各市場 API の冒頭で、当該ユーザーのフラグを確認し、**false の場合はエラーを返す**。
- **フラグを true にする処理**は開拓任務のクリア報告時に行う。Quest に **unlocksMarket**（Boolean）を持たせ、管理画面で「この任務で市場を解放する」を ON にした任務をユーザーが報告すると、そのユーザーの marketUnlocked を true にする。実装は spec/068 の解放付与（grantQuestUnlocks）に市場解放を追加し、管理画面の任務編集で unlocksMarket を設定可能。

### 3.3 MarketListing（出品）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| userId | String, FK→User | 出品者 |
| itemId | String, FK→Item | 出品アイテム |
| quantity | Int, NOT NULL | 出品数量（部分消化で減る。0 で削除） |
| pricePerUnit | Int, NOT NULL | 単価（GRA） |
| createdAt | DateTime | 出品日時。同額最安時の消化順に利用。 |
| expiresAt | DateTime? | 有効期限（Phase 2 で使用。NULL は無期限） |

- **複合インデックス**: **(itemId, pricePerUnit, createdAt)** を定義し、最安取得クエリ `ORDER BY pricePerUnit, createdAt LIMIT ...` を高速化する（必須）。
- @@index([userId]) で「マイ出品」一覧取得を効率化する。
- **有効な listing**（Phase 2 で使用）：最安取得・一覧取得・同時出品数カウントの対象は、**有効な listing** のみとする。有効 = `expiresAt IS NULL OR expiresAt > now()`。**期限切れ**（expiresAt ≤ now()）の listing は**自動で取り下げ**する：在庫を UserInventory に戻し、listing を削除する。**一覧参照時または購入時に検知して処理**する方針（バッチは使わない）。**getMarketList**・**getMyListings**・**buyFromMarket**・**listMarketItem** の各処理のなかで、**今回取得・参照の対象となる itemId（または listing）に紐づく期限切れのみ**を検知し、自動取下げ（在庫戻し＋履歴記録＋listing 削除）を実行してから本処理を行う。全 listing のスキャンは行わない。**自動取下げが発生したことをユーザーに伝えるため、履歴に「期限切れで自動戻し」として記録**する（§3.5 履歴）。**listMarketItem** では、主に当該ユーザーの同時出品数判定に影響する期限切れ listing を整理する。

### 3.4 MarketTransaction（成約ログ・価格履歴の元データ）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| itemId | String, FK→Item | 成約したアイテム |
| pricePerUnit | Int | 成約単価 |
| quantity | Int | 成約数量 |
| buyerUserId | String, FK→User | 買い手。**匿名性のため画面・API では返さない。不正調査用に DB に残す。** |
| sellerUserId | String, FK→User | 売り手。同上。 |
| createdAt | DateTime | 成約日時 |

- 価格履歴はこのテーブルのみを参照し、UI または getMarketPriceHistory で直近 N 件の AVG / MEDIAN / MIN / MAX を算出する。専用の「価格履歴テーブル」は設けない。

### 3.5 履歴（ユーザー向け・Phase 2）

- **画面の「履歴」タブ**で、成約・手動取り下げ・**期限切れ自動取下げ**を一覧し、プレイヤーに「何が起きたか」を伝える。
- **成約**：MarketTransaction から、当該ユーザーが buyer または seller のものを取得すれば「買った」「売れた」が分かる。
- **手動取り下げ**・**期限切れ自動取下げ**：これらを記録するため、**MarketListingEvent**（または同等）を用意する。1 行の例: userId, kind（'cancelled' | 'expired'）, itemId, quantity, pricePerUnit, createdAt。cancelMarketListing 時に kind=cancelled で 1 行挿入。期限切れで自動戻しを行ったときに kind=expired で 1 行挿入。listing は削除されるので、表示用に itemId / quantity / pricePerUnit をスナップショットで持つ。
- **getMarketUserHistory**：MarketTransaction（成約）と MarketListingEvent（取り下げ・自動取下げ）をマージし、当該ユーザー分を createdAt 降順で返す。種別（成約/買い/売り・手動取り下げ・期限切れ自動戻し）を判別できるようにする。
- **遺物の履歴**：成約・取下げに遺物を含める想定。MarketListingEvent の例は itemId ベースだが、Phase 2 の遺物実装時に **itemId nullable + relicInstanceId nullable** で拡張するか、**遺物用の別イベントテーブル**を用意すればよい。その時点で選択する。

### 3.6 通貨履歴（GRA・監査・法的要件）

- 市場では **GRA**（無償・有償の両方）を使用する。有償通貨の利用もあり得るため、**訴訟・監査・法的要件**に備え、**通貨の増減はすべて履歴に残す**必要がある（manage/SECURITY_READINESS.md §2、manage/ECONOMY_DESIGN.md、manage/OPERATIONAL_LOGS.md 参照）。
- **成約時の記録**：買い手の GRA 減算（無償→有償の順で消費）ごとに **CurrencyTransaction** に `currencyType: premium_free` または `premium_paid`、`amount`（負）、`reason: "market_purchase"` で記録する。売り手への入金（手数料控除後・無償 GRA）ごとに **CurrencyTransaction** に `currencyType: premium_free`、`amount`（正）、`reason: "market_sale"` で記録する。
- Phase 1 の buyFromMarket 実装では上記のとおり **CurrencyTransaction への挿入をすでに行っている**。Phase 2 で履歴画面を追加しても、通貨の流れは CurrencyTransaction で追跡可能である。
- **運営による確認**：問い合わせ・不正検知のために、特定ユーザーの CurrencyTransaction 一覧を管理画面や簡易コマンドで確認できるようにするのは、manage/OPERATIONAL_LOGS.md §2.3（課金開始後）で想定している。市場利用開始後、必要に応じて Phase 3 で通貨履歴の強化（before/after 残高・reasonCode 化・運営ビュー）を行う。

### 3.7 グローバル規定（定数または設定テーブル）

- **最低価格・最低出品単位**：**アイテムごとに Item マスタ**の marketMinPricePerUnit / marketMinQuantity で持つ。管理画面のアイテムマスタで編集可能。NULL のときは**グローバル定数**（例: MARKET_MIN_PRICE_PER_UNIT_GLOBAL, MARKET_MIN_QUANTITY_GLOBAL）を使用する。
- **手数料率**：成約額の 10％を売り手から控除。**端数は切り捨て**（整数のみ。例: 成約額 33 なら手数料 3、売り手受け取り 30）。
- **価格履歴の件数**：getMarketPriceHistory で参照する直近成約の件数 N は**定数 50**で持つ（例: MARKET_PRICE_HISTORY_LIMIT = 50）。
- **出品の有効期限**（Phase 2）：出品時に expiresAt = now + N 日とする。**N は定数**で持つ（例: MARKET_LISTING_DEFAULT_DAYS = 7）。定数で十分。変更したい場合はコードまたは後から設定テーブル化。
- **同時出品数上限**（Phase 2）：1 ユーザーあたりの有効な listing 件数上限。**プレイヤーごとに変えたい**（サブスクで増やす想定）ため、**通常用とサブスク用の2つを定数**で持つ（例: MARKET_MAX_LISTINGS_DEFAULT = 10, MARKET_MAX_LISTINGS_SUBSCRIPTION = 20）。listMarketItem 時に、そのユーザーがサブスク中かどうかで上限値を選ぶ。サブスク未実装時は常に通常の定数を使用。運営が数値をデプロイなしで変えたくなったら、その時点で設定テーブルやサブスクプランマスタへ移す。

------------------------------------------------------------------------

## 4. API 概要（入力・出力・ルール）

### 4.1 listMarketItem（出品）

- **入力**: itemId, quantity, pricePerUnit。
- **検証**: セッションの userId の UserInventory に itemId が quantity 以上あること。Item.marketListable が true であること。pricePerUnit が Item または**グローバル定数**の最低価格以上であること。quantity が Item または**グローバル定数**の最低出品単位以上であること。同時出品数上限を超えないこと（Phase 2）。
- **処理**: UserInventory から quantity を減算し、MarketListing に 1 行挿入。同一トランザクションで完了。減算後 quantity が 0 になった行は**0 のまま更新**（DELETE しない）。045 の UserInventory の扱いに合わせる。
- **出力**: 作成された listing の id 等。エラー時は理由（在庫不足・出品不可・価格/数量違反）を返す。

### 4.2 buyFromMarket（購入）

- **入力**: itemId, quantity（購入希望数量）。
- **検証**: セッションの userId が買い手。在庫・通貨はトランザクション内で確認。
- **処理**（**1 つの DB トランザクション内で完結**）:
  1. 対象 itemId の最安 listing を **FOR UPDATE** で取得（複数買う場合は複数 listing を順に処理するまでループ）。
  2. 必要総額 = Σ(各 listing の pricePerUnit × 今回そこから買う数量) を計算。買い手の GRA（無償＋有償合計）≥ 必要総額であることを確認。
  3. 買い手の GRA を減算（**無償分から先に消費**。足りなければ有償から）。
  4. 各 listing の quantity を減らす（0 になった行は削除）。売り手ごとに受け取り額（手数料 10％控除後）を集計。
  5. 各売り手の **premiumCurrencyFreeBalance** に加算（成約金はすべて無償 GRA）。
  6. 成約ごとに MarketTransaction に 1 行挿入。
  7. 買い手の UserInventory に itemId を quantity 分加算（既存行があれば quantity 加算、なければ INSERT）。**加算後の所持数が Item.maxOwnedPerUser を超える場合は購入を拒否**し、トランザクションをロールバックする。
  8. コミット。
- **出力**: 成約した数量・消費した通貨・取得した itemId/quantity。在庫不足・通貨不足・所持上限超過の場合はエラー。
- **自己取引**: **許可**する。自分の listing が最安の場合でも除外せず、そのまま購入してよい。

### 4.3 cancelMarketListing（出品取り下げ）

- **入力**: listingId。
- **検証**: セッションの userId がその listing の出品者であること。
- **処理**: 該当 MarketListing の quantity を UserInventory に戻し、MarketListing の行を削除（または論理削除）。**戻した結果、Item.maxOwnedPerUser を超えても取り下げは拒否しない**（在庫は必ず戻す）。Phase 2 では**履歴**に残すため、MarketListingEvent に kind=cancelled, itemId, quantity, pricePerUnit をスナップショットで 1 行挿入する。
- **出力**: 成功またはエラー（他人の listing・存在しない listing）。

### 4.4 getMarketList（一覧取得）

- **入力**: 任意で itemId フィルタ、ページネーション。
- **出力**: アイテムごとの「現在の最安単価」「その単価で買える数量」、または全 listing の一覧。同一 itemId では**最安単価 1 つ**と、**その単価の listing の quantity 合計**を返す。MarketListing を itemId, pricePerUnit, createdAt でソートして集約する。Phase 2 以降は有効な listing のみ対象。

### 4.5 getMyListings（マイ出品一覧）

- **出力**: 当該ユーザーの現在出品中の listing 一覧。**getMarketList の filter ではなく、別 API** とする。Phase 2 で期限切れを API 内で検知して自動取下げするため、**getMyListings は自動取下げ処理後の、有効な現在出品中 listing のみを返す**。

### 4.6 getMarketPriceHistory（価格履歴）

- **入力**: itemId（limit は**定数 50**（MARKET_PRICE_HISTORY_LIMIT）を使用し、API の引数にはしない）。
- **出力**: MarketTransaction を itemId で絞り、直近 **50 件**の pricePerUnit から算出した **AVG / MEDIAN / MIN / MAX** および必要なら件数。実装は DB 集計またはアプリ側集計でよい。

### 4.7 getMarketUserHistory（自分の市場履歴・Phase 2）

- **入力**: 任意で limit, ページネーション。
- **出力**: 当該ユーザーに関する市場の出来事一覧。**成約**（買った/売った：MarketTransaction の buyerUserId / sellerUserId で判定）、**手動取り下げ**（MarketListingEvent kind=cancelled）、**期限切れ自動取下げ**（MarketListingEvent kind=expired）をマージし、createdAt 降順で返す。各件で種別・itemId・quantity・pricePerUnit・日時などを返し、履歴タブで「〇〇を〇個 〇G で出品 → 成約」「〇〇を〇個 〇G で出品 → 取り下げ」「〇〇を〇個 〇G で出品 → 期限切れで自動戻し」のように表示できるようにする。

------------------------------------------------------------------------

## 5. ビジネスルール（まとめ）

- **出品**: Item.marketListable = true のみ。単価は最低価格以上、数量は最低出品単位以上。在庫を減らして listing を 1 行追加。
- **購入**: 同一 itemId の最安 listing から順に消化（部分消化）。同額最安が複数ある場合は createdAt の古い順。購入処理は 1 トランザクションで、listing の行ロック（FOR UPDATE）を使用。
- **手数料**: 成約額の 10％を売り手から控除。**端数は切り捨て**。買い手には手数料なし。
- **通貨**: 成約時のみ移動。購入時に買い手から減算し、売り手に手数料控除後を加算。手数料分はどこにも付与しない（デフレ維持）。
- **価格履歴**: MarketTransaction のみ参照。UI で AVG / MEDIAN / MIN / MAX を算出。
- **期限切れ**（Phase 2）：期限切れの listing は**自動で取り下げ**する（在庫を UserInventory に戻し、listing を削除）。自動取下げした旨を**履歴**に記録し、プレイヤーは「履歴」タブで確認できる。

------------------------------------------------------------------------

## 6. エラー条件

- 出品: 在庫不足、itemId が marketListable でない、単価/数量が下限未満、同時出品数上限超過（Phase 2）。
- 購入: 指定数量を満たす listing が不足、買い手の通貨不足、itemId が存在しない、**購入後の所持数が Item.maxOwnedPerUser を超える**。
- 取り下げ: listingId が存在しない、または他人の listing。（取り下げによる所持上限超過は拒否しない）

------------------------------------------------------------------------

## 7. 実装フェーズ

設計 doc（065）と本 spec を満たすために、実装を次のフェーズに分ける。各フェーズで「完了すると何が動くか」を明示する。

### Phase 1：最小限の出品・購入・一覧

- **スキーマ**
  - User に市場解放フラグ（例: marketUnlocked, Boolean, default false）を追加。各市場 API で未解放ならエラー。
  - Item に marketListable（必須）、marketMinPricePerUnit / marketMinQuantity（任意）を追加。
  - MarketListing を新規作成。複合インデックス (itemId, pricePerUnit, createdAt) を定義。
  - MarketTransaction を新規作成。MarketListingEvent（履歴用）は **Phase 2.1** で新規作成。
- **グローバル規定**
  - 最低価格・最低出品単位の **NULL 時フォールバックは定数**で 1 セット用意（例: MARKET_MIN_PRICE_PER_UNIT_GLOBAL, MARKET_MIN_QUANTITY_GLOBAL）。
- **API**
  - listMarketItem（出品）、buyFromMarket（購入・1 トランザクション・部分消化・行ロック）、cancelMarketListing（取り下げ）、getMarketList（一覧・最安/在庫）。getMarketUserHistory（履歴）は **Phase 2.1** で追加。
- **管理**
  - Item マスタ編集で marketListable（と任意で marketMinPricePerUnit / marketMinQuantity）を編集可能にする。
- **画面**
  - 画面構成・遷移は **§9 市場画面の構成・遷移** を参照。**購入・出品・取下げ**の 3 画面を実装する。**履歴**画面は **Phase 2.1** で追加し、Phase 2.2 で期限切れ自動取下げが履歴に載る。
- **範囲外**
  - 価格履歴表示・出品有効期限・同時出品数上限・上限価格は Phase 2 以降。市場の「解放条件」は開拓任務側で制御し、本 Phase では「解放済みなら使える」前提のみ。
- **Phase 1 完了時**：スタック型の出品・購入・取り下げ・一覧（getMarketList）が動き、**購入・出品・取下げ**の 3 画面が利用可能。履歴画面・履歴 API は未実装。価格履歴・有効期限・同時出品数上限は未実装。

### Phase 2.1：履歴基盤

- **スキーマ**
  - **MarketListingEvent** を新規作成（userId, kind: 'cancelled' | 'expired', itemId, quantity, pricePerUnit, createdAt 等。§3.5 参照）。
- **API**
  - **getMarketUserHistory** を実装。MarketTransaction（成約）と MarketListingEvent（手動取り下げ）をマージし、当該ユーザー分を createdAt 降順で返す。Phase 2.2 で kind=expired（期限切れ自動取下げ）が追加される。
- **処理**
  - cancelMarketListing 実行時に MarketListingEvent に kind=cancelled で 1 行挿入（§3.5）。
- **画面**
  - **履歴**画面を追加。成約（買った/売った）と手動取り下げを時系列表示。期限切れ自動取下げは Phase 2.2 で履歴に載る。
- **Phase 2.1 完了時**：履歴画面が利用可能。成約・手動取り下げが履歴で確認できる。期限切れ自動取下げの記録・表示は未実装。

### Phase 2.2：有効期限と自動取下げ

- **スキーマ**
  - MarketListing に **expiresAt**（DateTime?, Phase 2 で使用。NULL は無期限）を追加。
- **定数**
  - 出品時の有効期限 N 日を**定数**で持つ（例: MARKET_LISTING_DEFAULT_DAYS = 7）。
- **処理**
  - listMarketItem 時に expiresAt = now + N 日をセットする。
  - **期限切れの自動取下げ**：在庫を UserInventory に戻し、listing を削除。**getMarketList・getMyListings・buyFromMarket・listMarketItem** の各処理で、対象となる itemId（または listing）に紐づく期限切れのみを検知して自動取下げ（§3 参照）。listMarketItem では主に当該ユーザーの同時出品数判定に影響する期限切れを整理する。
  - 自動取下げ時に **MarketListingEvent に kind=expired** で 1 行挿入。getMarketUserHistory で「期限切れで自動戻し」として表示する。
- **Phase 2.2 完了時**：出品に有効期限が付き、期限切れは自動で取り下げられ、履歴に「期限切れで自動戻し」が表示される。

### Phase 2.3：価格履歴

- **API**
  - **getMarketPriceHistory** を実装。指定 itemId の直近 **50 件**（定数 MARKET_PRICE_HISTORY_LIMIT = 50）の成約から AVG / MEDIAN / MIN / MAX を返す。
- **画面**
  - 購入画面で、アイテム詳細・価格履歴を表示する（§8.2）。
- **Phase 2.3 完了時**：購入画面で価格履歴（直近成約の統計）が確認できる。

### Phase 2.4：出品制約の強化

- **定数**
  - 同時出品数上限を**定数**で持つ（例: MARKET_MAX_LISTINGS_DEFAULT = 10、将来サブスク用 MARKET_MAX_LISTINGS_SUBSCRIPTION = 20）。ユーザーのサブスク状態に応じて listMarketItem 時に上限をチェック。サブスク未実装時は通常の定数のみ使用。
- **バリデーション**
  - listMarketItem で**同時出品数上限**をチェック（有効な listing 件数が上限未満であること）。getMyListings は自動取下げ処理後の有効な listing のみ返すため、件数判定は有効なもののみでよい。
  - **Item 別** marketMinPricePerUnit / marketMinQuantity を listMarketItem のバリデーションで使用する（NULL ならグローバル定数）。
  - **上限価格**（グローバルまたは Item 別）を任意で導入し、出品時の単価が上限を超えないようにする。
- **Phase 2.4 完了時**：同時出品数上限・Item 別最低価格/数量（と任意で上限価格）が効く。Phase 2 のスタック型まわりの仕様が一通り揃う。

### Phase 3：通貨履歴の強化（監査・法的要件）

- 市場では GRA（無償・有償）を使用するため、**通貨の履歴**が訴訟・監査・法的要件に影響する（§3.6 通貨履歴、manage/SECURITY_READINESS.md、manage/OPERATIONAL_LOGS.md 参照）。
- **やること**：
  - **CurrencyTransaction の拡張**：manage の PRE-PAID 要件に合わせ、**beforeBalance / afterBalance**（または delta と整合する残高）を記録する。有償付与時は Order との紐づけを維持する。
  - **reasonCode 化**：reason をコード（例: `market_purchase`, `market_sale`, `companion_hire_purchase`, `game_start`）で一覧管理し、運営・監査で参照しやすくする。
  - **通貨履歴の運営ビュー**：特定ユーザーの CurrencyTransaction 一覧を管理画面または簡易コマンドで確認できるようにする（問い合わせ対応・不正検知）。manage/OPERATIONAL_LOGS.md §2.3。
- **Phase 3 完了時**：通貨の増減経路が before/after 残高付きで追跡可能になり、運営がユーザー別の通貨履歴を確認できる。

### Phase 4：運用・UX の調整（任意）

- 有効期限のデフォルト値（例: 7 日）の見直し、価格履歴の N や表示形式の調整。
- 成約通知（売り手向け「成約しました」）の有無・匿名性の調整。
- その他、065 で触れている「売り手の匿名性」「成約履歴で誰に売れたか」などの運用方針の実装。

------------------------------------------------------------------------

## 8. 取引対象の種別と購入・出品の画面想定

### 8.1 売れるもの・売れないもの

| 種別 | 売却 | データの持ち方 | 備考 |
|------|------|----------------|------|
| **資源**（material） | ○ | Item + UserInventory（数量） | スタック型。在庫の増減で出品・購入を扱う。 |
| **消耗品**（consumable） | ○ | 同上 | 同上。 |
| **設計図**（blueprint） | ○ | 同上 | 同上。 |
| **スキル分析書**（skill_book） | ○ | 同上 | 同上。 |
| **遺物**（relic） | ○ | RelicInstance（1個1行・個体ごとにステ等が異なる） | **1個ずつ**出品・購入。見せ方と処理がスタック型と異なる（§8.2, 8.3）。 |
| **特別・課金**（paid 等） | × | Item | marketListable = false で出品不可。 |
| **装備**（EquipmentInstance） | × | 個体管理 | 市場では扱わない。将来は部品（Item）のみ出品可にする方針。 |
| **メカパーツ**（MechaPartInstance） | × | 個体管理 | 市場では扱わない。 |

- スタック型（資源・消耗品・設計図・スキル分析書）は **Item.marketListable** と UserInventory の数量で出品・購入を表現する。同一アイテムは在庫数の増減のみで済む。
- **遺物**は 1 個ずつステータスが違うため、**出品は「この RelicInstance を出品」**、**購入は「この 1 個を購入」**となり、データの持ち方・一覧の見せ方・API がスタック型と分かれる。実装は Phase 2 以降で別枠とする。

### 8.2 購入側の画面・機能（スタック型）

- **一覧**: 買える**アイテム**を種別（資源／消耗品／設計図／スキル分析書）でフィルタ可能にし、アイテムごとに「最安単価」「その価格で買える数量」を表示する。
- **購入フロー**: アイテムを選び、**購入数量**を入力して購入。成約すると **UserInventory の数量が増える**（在庫の変動のみで完結）。
- **詳細・価格履歴**: アイテム行のクリックで詳細や価格履歴（直近の成約価格・AVG 等）を表示。**Phase 2.3** で表示。
- **所持上限**: 購入後の所持数が Item.maxOwnedPerUser を超える場合は購入を拒否（075 既存）。

### 8.3 購入側の画面・機能（遺物・別枠）

- **一覧**: 出品されている**遺物を 1 個ずつ**並べる。各 listing は 1 つの RelicInstance に対応。表示は「遺物タイプ名・ステ補正サマリ・耐性サマリ・単価」など、個体ごとの差が分かるようにする（一覧が長くなりやすいので、フィルタ・ソート・ページネーションが必要）。
- **購入フロー**: **「この 1 個を購入」**のみ。数量指定はなく、その RelicInstance の**所有者を買い手に変更**する。購入後は買い手の RelicInstance としてバッグ（遺物一覧）に現れる。
- **出品フロー**（遺物）: 「この遺物を出品」で、**装備していない** RelicInstance を 1 個選び、単価を入力して出品。**出品 UI には装着中の遺物は出さない**（選択候補は未装着の遺物のみ）。在庫の「数量」は減らさず、**その RelicInstance を市場に載せる**（listing に relicInstanceId を紐づけるか、別テーブルで管理）。取り下げ時は RelicInstance を出品者に戻す。
- **データ**: スタック型は現行の MarketListing（itemId, quantity, pricePerUnit）。遺物用は **MarketListing に relicInstanceId を optional で持つ**、または **MarketRelicListing** を別テーブルにする。実装 Phase でどちらにするか決める。遺物の最安取得は「同一 RelicType で最安」か「全遺物を単価順」かは仕様で決める。

### 8.4 出品側の画面（スタック型 vs 遺物）

- **スタック型の出品**: 所持アイテム一覧からアイテムを選び、**数量**と**単価**を入力して出品。UserInventory の数量を減らし、MarketListing に 1 行追加（itemId, quantity, pricePerUnit）。
- **遺物の出品**: 所持遺物のうち**装着していない**ものだけを出品 UI に表示し、1 個選んで**単価**を入力して出品。装着中の遺物は出品候補に出さない。その RelicInstance を市場に紐づけ（listing 作成）。取り下げ時は紐づけを外し、RelicInstance を出品者に戻す。

------------------------------------------------------------------------

## 9. 市場画面の構成・遷移（設計）

実装前に画面の切り分けと遷移を決めておく。**購入・出品・取下げ・履歴**の **4 つのボタン**で分岐し、それぞれ**別画面**として構成する（タブではなく画面単位で切り替える）。**購入**と**出品**は同一画面にせず、分ける。

### 9.1 画面構成（4 ボタン・4 画面）

| ボタン／画面 | 内容 | 主な API |
|--------------|------|----------|
| **購入** | 購入専用画面。スタック型はアイテム一覧（種別フィルタ）・最安・在庫・数量入力で購入。遺物は遺物出品一覧（1個ずつ・サマリ表示）で「この1個を購入」。価格履歴は Phase 2.3 で表示。 | getMarketList, getMarketRelicList（遺物用・別枠）, buyFromMarket, buyRelicFromMarket（遺物用・別枠）, getMarketPriceHistory |
| **出品** | 出品専用画面。スタック型は itemId・数量・単価入力で出品。遺物は「この遺物を出品」で 1 個＋単価（装着中は出品候補に出さない）。 | listMarketItem, listRelicOnMarket（遺物用・別枠） |
| **取下げ** | 現在出品中の **スタック型 listing** と **遺物 listing** を一覧。各行に「取り下げ」。 | getMyListings, getMyRelicListings（遺物用）, cancelMarketListing, cancelRelicListing（遺物用） |
| **履歴** | 成約・手動取り下げ・期限切れ自動取下げを時系列表示。遺物の成約も履歴に含める。 | getMarketUserHistory |

- 市場に遷移したあと、**4 つのボタン**（購入／出品／取下げ／履歴）のどれを押すかで、表示する画面が切り替わる。購入と出品は**別画面**なので、購入したいときは「購入」、売りたいときは「出品」を選ぶ。

### 9.2 遷移の想定

- **入口**：**ダッシュボード**に「市場」ボタンを置き、そこから市場画面へ遷移する。URL は例: `/dashboard/market`。**ボタンは常に表示**するが、市場解放済みでないユーザーは**無効化**し、**ツールチップで理由**（例: 「〇〇任務をクリアすると利用可能」）を表示する。遷移は解放済みの場合のみ可能（解放条件は開拓任務側で制御）。
- **市場画面**に遷移すると、**4 つのボタン**（購入・出品・取下げ・履歴）を表示し、押したボタンに対応する**画面**を表示する。デフォルトでどれを表示するかは実装で決める（例: 購入）。
- **購入**画面: 種別（スタック型：資源/消耗品/設計図/スキル分析書、遺物）で切り替え、一覧・購入フォーム。スタック型はアイテム一覧 → 詳細・価格履歴（Phase 2.3）→ 数量入力 → 購入。遺物は遺物出品一覧（1個ずつ）→ 詳細 → 「この1個を購入」。
- **出品**画面: スタック型は所持アイテムから選択・数量・単価入力。遺物は装着していない遺物のみ選択・単価入力。
- **取下げ**画面: 自分の出品一覧（スタック型＋遺物）。取り下げ後は一覧再取得・トースト等。
- **履歴**画面: getMarketUserHistory で成約・取り下げ・期限切れ自動取下げを種別表示。

### 9.3 Phase ごとの対応

- **Phase 1**：**スタック型のみ**（資源・消耗品・設計図・スキル分析書）。3 画面（購入・出品・取下げ）。履歴画面は未実装。
- **Phase 2.1**：履歴画面を追加。成約・手動取り下げを履歴で表示。
- **Phase 2.2**：有効期限・期限切れ自動取下げ。履歴に「期限切れで自動戻し」を表示。
- **Phase 2.3**：購入画面で価格履歴を表示。
- **Phase 2.4**：同時出品数上限・Item 別最低価格/数量（と任意で上限価格）。
- **通貨履歴**：成約時の GRA 増減は Phase 1 から **CurrencyTransaction** に記録済み（§3.6）。有償利用もあり得るため監査・法的要件を考慮する。強化（before/after 残高・運営ビュー）は **Phase 3**。
- **Phase 3**：通貨履歴の強化（before/after 残高・reasonCode 化・運営ビュー）。manage/SECURITY_READINESS §2、OPERATIONAL_LOGS §2.2–2.3 参照。
- **Phase 4**：運用・UX の調整（有効期限見直し、成約通知、匿名性など）。
- **遺物の出品・購入**は Phase 2 以降の別枠で実装（データ構造・API・画面を §8.3, 8.4 に合わせて追加）。

------------------------------------------------------------------------

## 10. 参照

- 取引対象の種別・購入・出品の画面想定: 本 spec **§8**。市場画面の構成・遷移: 本 spec **§9**。通貨履歴・監査: 本 spec **§3.6**、**Phase 3**。
- 設計の正本: `docs/065_market_design.md`
- 通貨・監査要件: `manage/SECURITY_READINESS.md` §2、`manage/ECONOMY_DESIGN.md`、`manage/OPERATIONAL_LOGS.md`
- アイテム・所持: `spec/045_inventory_and_items.md`
- クエスト・任務: `spec/054_quests.md`
- DB スキーマ概要: `docs/08_database_schema.md`
