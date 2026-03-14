# Spec: 緊急製造指示書（全設備2時間加速）

**緊急製造指示書**（Item.code = `emergency_production_order`）を 1 枚消費し、**設置済みの全設備**の生産を **2 時間分**加速する。設計は `docs/065_special_items_and_facility_speed.md` §7 に基づく。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec / docs

- **010_auth**：セッションが有効であること。API は getSession を前提とする。
- **035_initial_area_facilities**：FacilityInstance・設備一覧。工業画面は既存。
- **036_production_receive**：lastProducedAt の意味・更新ルール。本機能は lastProducedAt を「2時間前」にずらすのみで、受け取り処理は変更しない。
- **045_inventory_and_items**：UserInventory・所持数減算。
- **docs/065** §7：効果・対象・更新ルール・UI パターン。
- **docs/081_special_items_policy**：特別アイテム消費時に ItemUsageLog に記録。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| （設備画面用データの拡張） | 緊急製造指示書の所持数を返す。既存 getIndustrial の返却に追加するか、同一画面で取得する別クエリで返す。 | 設備画面（モーダルで枚数表示） |
| useEmergencyProductionOrder | 緊急製造指示書を 1 枚消費し、全設備の lastProducedAt を 2 時間前に更新。ItemUsageLog に 1 件挿入。 | 設備画面モーダル内「使う」ボタン |

------------------------------------------------------------------------

## 1. 目的

- プレイヤーが設備画面で「緊急製造指示書を使う」を押し、所持枚数を確認したうえで 1 枚消費すると、**全設置済み設備**の lastProducedAt が 2 時間分だけ過去にずれ、次回受け取り時に 2 時間分の生産が多く受け取れるようにする。
- UI は居住区の推薦紹介状と同様に、**ボタンは常に押せる**。押すとモーダルで枚数表示と案内（0 枚時は黒市後援契約の案内＋闇市へのリンク）を出し、1 枚以上あるときだけ「使う」を有効にする。

------------------------------------------------------------------------

## 2. 用語

- **緊急製造指示書**：Item.code = `emergency_production_order` のアイテム。1 枚消費で全設備に 2 時間加速。
- **2時間加速**：各設備の lastProducedAt を「effectiveStart - 2時間」に更新する。クランプは行わない（docs/065 採用方針）。

------------------------------------------------------------------------

## 3. 入力・出力

### 3.1 設備画面で必要なデータ（入力側）

- **緊急製造指示書の所持数**：モーダル表示用。0 のときは案内文と闇市リンクを表示し、「使う」は disabled。
- **設置済み設備数と上限**：usedSlots と maxSlots。設備数が上限未満のときは実行前に確認を求めるために必要。
- 取得方法は実装方針で決める（§6 フェーズ、§7 不明瞭な点 参照）。

### 3.2 useEmergencyProductionOrder の入力

- **セッション**：getSession() の userId。引数は不要（ボタン 1 クリックで実行）。

### 3.3 useEmergencyProductionOrder の出力

- **成功時**  
  `{ success: true, message?: string }`  
  例：`message: "全設備の生産が2時間分進みました"`

- **失敗時**  
  `{ success: false, error: string, message: string }`  
  - `error: "UNAUTHORIZED"` / `message: "ログインしてください。"`
  - `error: "NO_ITEM"` / `message: "緊急製造指示書を所持していません。"`
  - その他サーバエラー

------------------------------------------------------------------------

## 4. 処理内容

### 4.1 lastProducedAt の更新ルール（docs/065 準拠）

- 設備ごとの **effectiveStart**  
  `inst.lastProducedAt ?? (inst.isForced ? user.createdAt : inst.createdAt)`
- **更新後**  
  `newLastProducedAt = effectiveStart - EMERGENCY_PRODUCTION_ACCELERATION_MINUTES`（分をミリ秒に換算して減算）。
- **クランプ**：行わない（設置直後の設備にも 2 時間分付与する）。

### 4.2 useEmergencyProductionOrder の処理フロー

1. getSession()。未ログインなら `{ success: false, error: "UNAUTHORIZED", ... }` を返す。
2. トランザクション開始。
3. Item を `code = emergency_production_order` で 1 件取得。無ければエラー（マスタ未登録）。
4. UserInventory で当該 userId + itemId の quantity を取得。1 未満なら `{ success: false, error: "NO_ITEM", ... }` を返してロールバック。
5. 当該 userId の全 FacilityInstance を取得。User の createdAt も取得（強制配置の effectiveStart 用）。
6. 各 FacilityInstance について `newLastProducedAt = effectiveStart - 2時間` を算出し、一括で lastProducedAt を更新（0 件なら更新処理はスキップ）。
7. UserInventory の当該行の quantity を 1 減算。
8. ItemUsageLog に 1 件挿入：userId, itemId, quantity=1, reason=ITEM_USAGE_REASON_FACILITY_SPEED, referenceType="all_facilities", referenceId=null。
9. トランザクションコミット。
10. revalidatePath("/dashboard/facilities")。返却 `{ success: true, message: "..." }`。

------------------------------------------------------------------------

## 5. UI 仕様（docs/065 §7.6 準拠）

- **配置**：設備画面（`/dashboard/facilities`）に「緊急製造指示書を使う」ボタンを 1 つ。居住区の「推薦紹介状を使う」と同様、**常に押せる**（0 枚でも無効化しない）。
- **モーダル**  
  - タイトル例：「緊急製造指示書」  
  - 所持枚数表示：「所持枚数 ○○ 枚」  
  - 0 枚のとき：案内文「黒市で黒市後援契約を購入すると支給されます。」と、`/dashboard/underground-market` へのリンク（表示「闇市へ」など）。  
  - 実行ボタン：「使う」または「全設備を2時間分加速」。**1 枚以上あるときのみ有効**（0 枚のときは disabled）。  
  - 閉じるボタン。
- **実行前確認（設備が上限未満のとき）**  
  **設置済み設備数（usedSlots）が設置上限（maxSlots）より少ない場合**は、実行ボタン押下時に「本当に実行しますか？」などと**確認**を表示し、ユーザーが了承した場合のみ `useEmergencyProductionOrder()` を呼ぶ。上限いっぱいのときは確認なしで実行してよい。
- **参照実装**：`src/app/dashboard/characters/use-letter-button.tsx`。

------------------------------------------------------------------------

## 6. フェーズ分け

### Phase 1：定数・Server Action・ログ

- **定数**  
  - `src/lib/constants/production.ts` に `EMERGENCY_PRODUCTION_ACCELERATION_MINUTES = 120` を追加。  
  - 緊急製造指示書の Item.code は `emergency_production_order`。定数化する場合は `src/lib/constants/` に新規または既存ファイル（例：companion.ts と同様の item-codes.ts）で `EMERGENCY_PRODUCTION_ORDER_ITEM_CODE` を定義。
- **Server Action**  
  - `useEmergencyProductionOrder()` を実装。配置は `src/server/actions/`（既存の `receive-production.ts` に追加するか、`emergency-production-order.ts` を新規作成）。  
  - 上記 §4.2 のフローで実装。ItemUsageLog は `ITEM_USAGE_REASON_FACILITY_SPEED`（`src/lib/constants/item-usage-reasons.ts` に既存）を使用。
- **受け取りとの同時実行**：**同時には行わない**。利用フローは「緊急製造指示書を使う → 画面リフレッシュで表示更新 → その後受け取るかはユーザー任意」とするため、受け取り用のロックは不要。

### Phase 2：設備画面用データ（所持数）

- 設備画面で「緊急製造指示書の所持数」を表示するため、**取得方法を決めて実装**する。  
  - 案 A：`getIndustrial()` の返却型に `emergencyProductionOrderCount: number`（および必要なら `emergencyProductionOrderItemId: string`）を追加し、同一クエリで在庫を取得して返す。  
  - 案 B：設備画面で別の Server Action または getIndustrial とは別のデータ取得（例：getFacilityPageState）で所持数のみ取得する。  
- Item は `code = emergency_production_order` で 1 件取得し、その id で UserInventory の quantity を参照する。

### Phase 3：設備画面 UI（ボタン・モーダル）

- 設備画面に「緊急製造指示書を使う」ボタンを追加。常に押せる。
- 押下でモーダルを開く。モーダル内に所持枚数、0 枚時の案内文「黒市で黒市後援契約を購入すると支給されます。」と闇市へのリンク、実行ボタン（1 枚以上で有効）、閉じるボタンを実装。
- **usedSlots < maxSlots のとき**：実行ボタン押下でまず「本当に実行しますか？」の確認を表示し、了承時のみ `useEmergencyProductionOrder()` を呼ぶ。usedSlots >= maxSlots のときは確認なしで実行。
- 実行成功時はトーストまたはインラインで「全設備の生産が2時間分進みました」を表示し、モーダルを閉じる。失敗時はエラーメッセージを表示。
- 成功後は設備画面のデータを再取得する（revalidate または refetch）ので、所持枚数と受け取り可能サイクルが更新される。**受け取り**はユーザーが任意のタイミングで行う（緊急製造指示書使用とは同時実行しない想定）。

------------------------------------------------------------------------

## 7. 確定事項・不明瞭な点

### 7.1 確定済み

- **設備が 0 件のとき**：**使用を許可して成功とする**（1 枚消費・lastProducedAt 更新は 0 件でスキップ・ItemUsageLog は記録）。
- **アイテムマスタ**：Item.code = `emergency_production_order` は**実装済み**。マスタに登録済みを前提とする。
- **受け取りとの同時実行**：**同時には行わない**。フローは「緊急製造指示書を使用 → リフレッシュで表示更新 → 受け取るかはユーザー任意」。受け取り用のロックは不要。

### 7.2 実装時に決めること

- **所持数の取得元**  
  設備画面で緊急製造指示書の所持数を出すために、**getIndustrial を拡張するか、別 API で取得するか**を決める。  
  **推奨**：**getIndustrial の返却に `emergencyProductionOrderCount` を追加**（既に inventories を取得しているため変更が少ない）。

------------------------------------------------------------------------

## 8. 参照

- 設計：`docs/065_special_items_and_facility_speed.md` §7  
- 生産・lastProducedAt：`docs/019_production_receive.md`、`spec/036_production_receive.md`  
- 特別アイテム使用履歴：`docs/081_special_items_policy.md`、`src/lib/constants/item-usage-reasons.ts`  
- UI 参照：`src/app/dashboard/characters/use-letter-button.tsx`  
- 設備画面：`src/app/dashboard/facilities/page.tsx`、`src/server/actions/initial-area.ts`（getIndustrial）
