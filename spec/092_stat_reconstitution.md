# Spec: ステータス振り直し（再構築アンプル）

再構築アンプルα・βを用いたステータス振り戻し・振り直し機能。  
設計は **docs/092_stat_reconstitution_design.md**。**部分再構築**・**完全再構築**・**完全再構築β** の三つを実装し、プレイヤーが選択して実行する。

---

## 0. 依存

- **spec/048** … レベル・CAP・ステータス割合（10% 下限・30% 上限）、allocateCharacterStats
- **spec/074** … LEVEL_CAP_REWARD_ITEM_CODE = `reconstitution_ampoule_alpha`
- **spec/045** … 所持品（UserInventory）、アイテム消費
- **docs/081** … 特別アイテム消費時の ItemUsageLog 記録

---

## 1. 目的

- キャラ詳細のステータス「配分」画面から、再構築アンプルαを使って**ステータスを振り戻し、再配分できる**ようにする。
- 対象は**主人公・仲間のみ**。メカは対象外。
- 部分再構築・完全再構築・完全再構築βの三つの Server Action と UI を実装する。

---

## 2. 定数・アイテム

- **再構築アンプルα**: `Item.code === "reconstitution_ampoule_alpha"`。  
  定数は既存の `LEVEL_CAP_REWARD_ITEM_CODE`（`src/lib/constants/level.ts`）を流用。部分再構築・完全再構築で消費。
- **再構築アンプルβ**: `Item.code === "reconstitution_ampoule_beta"`。  
  定数は `RECONSTITUTION_AMPOULE_BETA_ITEM_CODE` 等を `src/lib/constants/level.ts` または `reconstitution.ts` に追加。完全再構築βで消費。
- **部分再構築の「1レベル分」ポイント**: `POINTS_PER_RECONSTITUTION_ITEM = 18`（60 × 0.30。spec/048 §2.6 の自由配分分）。

---

## 3. 部分再構築（案A）

### 3.1 概要

- **施術名称**: 部分再構築。
- 再構築アンプルα **N 個**を消費し、**N×18 ポイント**を振り戻して再配分する。**1回の送信にまとめ、状態を持たない**。送信内容は「使用個数 N」「振り戻し量（合計 N×18、各ステは CAP の 10% を下回らない）」および **再配分後の 7 ステ**。サーバで検証し、アイテム消費 ＋ ステータスを再配分後の値で更新する。

### 3.2 API（部分再構築）

| API | 用途 |
|-----|------|
| getReconstitutionState(characterId) | キャラの CAP・7ステ・所持再構築アンプルα数・振り戻し可能最大ポイントを返す。 |
| executePartialReconstitution(characterId, quantity, finalStats) | アイテム quantity 個消費。finalStats は再配分後の 7 ステ（合計 = 現在合計、つまり振り戻し量だけ減らしたうえで再配分した結果）。内部で「current - revert = 減少量の合計 = quantity×18」「各ステ ≥ floor(CAP×0.10)」「合計 ≤ CAP」を満たすか検証し、通過すれば Character を finalStats で更新。 |

### 3.3 入力・バリデーション（部分再構築）

- `quantity`: 使用するアイテム個数（1 以上、所持数以下）。
- `finalStats`: `{ STR, INT, VIT, WIS, DEX, AGI, LUK }` 再配分後の値（整数）。クライアントは「振り戻し＋再配分」の結果のみ送る（状態を持たない）。
  - 合計 = 現在の 7 ステ合計（総ポイントは不変。N×18 をどこかから減らして別のステに振り直した結果）。
  - サーバ検証: (1) finalStats 合計 = 現在の 7 ステ合計。(2) 各 finalStats[key] は floor(CAP×0.10) 以上 floor(CAP×0.30) 以下。(3) 「移動量」が N×18 であること。すなわち `sum over k of |finalStats[k] - current[k]| = 2 × quantity × 18`（減った分の合計＝増えた分の合計＝quantity×18）。
- 実行時: 対象キャラの userId がセッションと一致すること、メカでないこと、所持アイテム ≥ quantity を確認。  
  消費時は ItemUsageLog に理由 `stat_reconstitution_partial` を記録（docs/081、item-usage-reasons に追加）。

### 3.4 処理フロー（部分再構築）

1. セッション・キャラ取得・所持数確認。
2. 検証: 現在合計 − finalStats 合計 = quantity×18。各 finalStats が floor(CAP×0.10) 以上 floor(CAP×0.30) 以下、合計 ≤ CAP。
3. トランザクション内: UserInventory から再構築アンプルαを quantity 減算、Character の 7 ステを finalStats に更新、ItemUsageLog に記録。
4. revalidatePath でキャラ詳細を再検証。

---

## 4. 完全再構築（案B）

### 4.1 概要

- **施術名称**: 完全再構築。
- **消費**: 再構築アンプルα **1 個**。
- レベルを **5 下げる**。**現在レベルが 5 以下の場合は使用不可**。表示: 「身体への負担が大きく施術不可能」。  
  経験値は `getRequiredExpForLevel(newLevel)` にリセット（**戻したレベル分の経験値は消失**）。実行時にその旨の**注意**を表示する。  
  CAP は `getCapForLevel(newLevel)`、7 ステは各 **floor(newCAP×0.10)** に設定。未割り振り分はプレイヤーが後で配分する（未割り振りのまま保存してよい）。

### 4.2 API（完全再構築）

| API | 用途 |
|-----|------|
| getReconstitutionState(characterId) | キャラの level・CAP・7ステ・所持アンプルα数・所持アンプルβ数。完全再構築実行可能か（level > 5、α ≥ 1）。完全再構築β実行可能か（β ≥ 1）。不可時は理由を返す。 |
| executeFullReconstitution(characterId) | アンプルα 1 個消費。5レベルダウン＋ステータスを下限のみにリセット。level ≤ 5 の場合はエラー（「身体への負担が大きく施術不可能」）。 |

### 4.3 バリデーション・処理（完全再構築）

- 対象キャラのオーナー確認、メカでないこと。**level > 5** を必須。満たさない場合は `{ success: false, error: "LEVEL_TOO_LOW", message: "身体への負担が大きく施術不可能" }` を返す。
- 所持アイテム ≥ 1 を確認。
- トランザクション内:  
  - `newLevel = character.level - 5`。  
  - `experiencePoints = getRequiredExpForLevel(newLevel)`、`level = newLevel`、`CAP = getCapForLevel(newLevel)`。  
  - 7 ステを各 `floor(CAP * 0.10)` に更新。  
  - UserInventory から再構築アンプルαを 1 減算、ItemUsageLog に理由 `stat_reconstitution_full` を記録。
- revalidatePath でキャラ詳細を再検証。

---

## 5. 完全再構築β

### 5.1 概要

- **施術名称**: 完全再構築β。
- **消費**: 再構築アンプルβ（`reconstitution_ampoule_beta`）**1 個**。
- **デメリット**: **レベルダウンなし**。経験値も変更しない。
- **効果**: **レベル・CAP はそのまま**。7 ステのみ各 **floor(CAP×0.10)** に設定し、残りを未割り振りにする。プレイヤーが後で配分する（未割り振りのまま保存してよい）。
- **制限**: レベルによる使用不可はない（レベル 1 でも実行可）。所持アンプルβ ≥ 1 のみ。

### 5.2 API（完全再構築β）

| API | 用途 |
|-----|------|
| getReconstitutionState(characterId) | 上記のとおり、所持アンプルβ数・完全再構築β実行可能か（β ≥ 1）を返す。 |
| executeFullReconstitutionBeta(characterId) | アンプルβ 1 個消費。レベル・経験値・CAP は変更せず、7 ステを各 floor(CAP×0.10) に更新。 |

### 5.3 バリデーション・処理（完全再構築β）

- 対象キャラのオーナー確認、メカでないこと。
- 所持アンプルβ ≥ 1 を確認。
- トランザクション内:  
  - Character の 7 ステを各 `floor(CAP * 0.10)` に更新。level, experiencePoints, CAP は変更しない。  
  - UserInventory から再構築アンプルβを 1 減算、ItemUsageLog に理由 `stat_reconstitution_full_beta` を記録。
- revalidatePath でキャラ詳細を再検証。

---

## 6. 画面

- **配置**: `/dashboard/characters/[id]` のステータスブロック内。**「配分」を選択したとき**に「部分再構築」「完全再構築」「完全再構築β」のボタンを表示する（メカの場合は配分・再構築ともに表示しない）。
- **部分再構築**: 使用個数 N 選択 → 振り戻し量（合計 N×18・各ステ下限遵守）と再配分後の 7 ステを**同一フォーム**で入力 → 1回送信。状態は持たない。
- **完全再構築**: ボタン押下時、level ≤ 5 なら「身体への負担が大きく施術不可能」と表示して実行不可。実行可能なら確認モーダルで**注意**（5レベルダウン・**経験値は消失**・ステは下限のみになる旨）を表示 → 実行。実行後は未割り振りのまま保存可。
- **完全再構築β**: 確認モーダル（ステが下限のみになり未割り振りになる旨。レベル・経験値は変わらない旨）→ 実行。レベル制限なし。実行後は未割り振りのまま保存可。既存の配分UIで振り直して確定してもよい。

---

## 7. データ・永続化

- **Character**: 部分再構築は 7 ステのみ更新。完全再構築は level/experiencePoints/CAP/7 ステすべて更新。完全再構築βは 7 ステのみ更新（level, experiencePoints, CAP は変更しない）。
- **UserInventory**: アンプルαまたはアンプルβの quantity を減算。
- **ItemUsageLog**: 消費時は reason を `stat_reconstitution_partial`（部分再構築）、`stat_reconstitution_full`（完全再構築）、`stat_reconstitution_full_beta`（完全再構築β）とし、`src/lib/constants/item-usage-reasons.ts` に定義を追加する。

---

## 8. 実装場所

| 項目 | 場所 |
|------|------|
| 定数（RECONSTITUTION_ITEM_CODE, POINTS_PER_ITEM 等） | `src/lib/constants/level.ts` または `src/lib/constants/reconstitution.ts` |
| getReconstitutionState / executePartialReconstitution / executeFullReconstitution / executeFullReconstitutionBeta | `src/server/actions/character-stats.ts` または `src/server/actions/reconstitution.ts` |
| 配分画面に「部分再構築」「完全再構築」「完全再構築β」ボタン・モーダル/確認UI | `src/app/dashboard/characters/[id]/character-stat-section.tsx` |
| ItemUsageLog 理由コード | `src/lib/constants/item-usage-reasons.ts` |

---

## 9. 実装方針

- **部分再構築（§3）**・**完全再構築（§4）**・**完全再構築β（§5）** の三つを実装する。
- 再構築実行後、未割り振りポイントを残したまま保存してよい（合計 ≤ CAP）。配分確定を必須にしない。

---

## 10. 実装フェーズ（実施済み）

| Phase | 内容 |
|-------|------|
| **1** | 定数（level.ts: POINTS_PER_RECONSTITUTION_ITEM）、ItemUsageLog 理由コード（item-usage-reasons.ts）追加。 |
| **2** | getReconstitutionState・executeFullReconstitutionBeta（reconstitution.ts）。 |
| **3** | executeFullReconstitution・executePartialReconstitution（reconstitution.ts）。 |
| **4** | キャラ詳細ページで getReconstitutionState 取得して CharacterStatSection に渡す。配分表示時に「部分再構築」「完全再構築」「完全再構築β」ボタンと各確認・入力モーダルを表示。 |
