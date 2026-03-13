# Spec: レベルキャップとキャップ到達後の経験値→アイテム付与

ゲーム全体の**レベルキャップ**を設け、キャップ到達後はレベルを上げず、代わりに「レベル 1 分の経験値が貯まるごとに振り直しアイテムを 1 個付与する」仕様を定義する。設計の詳細は **`docs/074_level_cap_and_cap_break_item.md`** を参照。

---

## 0. 依存・横断

### 0.1 依存する docs / spec

- `docs/074_level_cap_and_cap_break_item.md` … レベルキャップ・キャップ超過時のアイテム付与の設計
- `spec/048_level_and_status_allocation.md` … レベルと CAP、経験値付与 API（§2.5, §8）
- `docs/048_experience_and_levelup.md` … 経験値式・レベル計算
- `docs/09_character_implementation_notes.md` … CAP 式・ステ割合

### 0.2 影響する API / 利用者

| API | 変更内容 | 呼び出し元 |
|-----|----------|------------|
| `grantCharacterExp` | レベルを LEVEL_CAP で打ち止め。キャップ到達後はオーバーフローをアイテム付与に変換。 | 探索報酬（finishExploration）、将来のクエスト等 |

- 既存の `grantCharacterExp` のシグネチャは維持する。呼び出し元の変更は不要。

---

## 1. 目的

- ゲーム全体で**最大レベル（レベルキャップ）**を定め、経験値付与ではレベルをキャップで止める。
- キャップ到達後は**レベルは上げない**。代わりに「レベル 1 分の経験値」が貯まるごとに**振り直しアイテムを 1 個ユーザーに付与**する。
- キャップ値の変更頻度は低い想定のため、**レベルキャップはプログラムの定数**として持つ（DB には載せない）。将来のキャップ解放時は定数変更＋通常リリースで対応する。

---

## 2. 定数

### 2.1 LEVEL_CAP

- **意味**: ゲーム全体の最大レベル。経験値付与では `level` がこの値を超えない。
- **値**: 整数。**段階解放**する場合は 30 → 40 → … → 100 のようにリリースごとに定数を変更する（例: 初期は 30）。
- **配置**: `src/lib/constants/level.ts`。`grantCharacterExp` などから import して参照する。
- **ビルド時**: 定数はコンパイル時にインライン化されるため、実行時負荷は気にしなくてよい。

### 2.2 EXP_PER_LEVEL_AT_CAP（キャップ超過時の「1 レベル分」経験値・固定）

- **意味**: キャップ到達後、超過経験値を「何 exp で 1 個アイテム」に換算するかの単位。**常に 1000**。
- **理由**: キャップが 30 のときも 100 のときも「次のレベル（未解放）まで 1000」と揃え、表示・仕様を統一する。Lv29→30 は 290 だが、30→31（未解放）は 1000 扱いにする。
- **配置**: `src/lib/constants/level.ts`。`LEVEL_CAP * 10` ではなくこの定数を使う。

### 2.3 LEVEL_CAP_REWARD_ITEM_CODE（キャップ超過時付与アイテム）

- **意味**: キャップ到達後に「レベル 1 分の経験値」が貯まったときに付与するアイテムの **Item.code**。振り直し用アイテム。
- **現在の値**: `reconstitution_ampoule_alpha`（表示名: 再構築アンプルα）。
- **配置**: `src/lib/constants/level.ts`。付与時は code で Item を検索し、得た id で `grantStackableItem` を呼ぶ。

---

## 3. 経験値・レベルの式（048 準拠・参照のみ）

- Lv N に達する累計経験値: **`10 × (N-1) × N / 2`**
- Lv N → N+1 に必要な経験値: **`N × 10`**
- キャップ時「1 レベル分」の経験値（アイテム換算単位）: **`EXP_PER_LEVEL_AT_CAP` = 1000（固定）**
- キャップ到達に必要な累計: **`getRequiredExpForLevel(LEVEL_CAP)`**（例: 100 なら 49,500）

---

## 4. API: grantCharacterExp の拡張仕様

既存 API `grantCharacterExp(userId, characterIds, amount, tx?)` の挙動を以下で拡張する。

### 4.1 入力・出力

- 入力・出力の型は変更しない。戻り値は従来どおり `Promise<void>`。
- トランザクション `tx` を渡した場合はその中で実行する（探索報酬と同一 tx でアイテム付与する）。

### 4.2 処理フロー（キャップ適用後）

1. 対象キャラ（主人公・仲間。メカはスキップ）ごとに:
   - `newExp = experiencePoints + amount`
   - `newLevel = computeLevelFromTotalExp(newExp)`
   - **適用レベル**: `effectiveNewLevel = min(newLevel, LEVEL_CAP)`（レベルはキャップで打ち止め）

2. **effectiveNewLevel > oldLevel の場合**（キャップ未満でレベルアップする場合）:
   - `level` を `effectiveNewLevel`、`CAP` と 7 ステを spec/048 §2.6 に従って更新。
   - `experiencePoints = newExp` とする。
   - さらに **effectiveNewLevel === LEVEL_CAP** かつ **newLevel > LEVEL_CAP** なら、キャップ超過分のオーバーフロー処理（4.3）を行う。

3. **effectiveNewLevel === oldLevel かつ oldLevel === LEVEL_CAP の場合**（すでにキャップにいる）:
   - オーバーフロー処理（4.3）のみ行う。

4. 上記以外（レベルアップもキャップ超過もない）:
   - `experiencePoints = newExp` のみ更新。

### 4.3 キャップ超過時のオーバーフロー処理

- **条件**: キャラが `level === LEVEL_CAP` で、`newExp > getRequiredExpForLevel(LEVEL_CAP)` である。
- **計算**:
  - `requiredForCap = getRequiredExpForLevel(LEVEL_CAP)`
  - `overflow = newExp - requiredForCap`
  - `itemsToGrant = floor(overflow / EXP_PER_LEVEL_AT_CAP)`（EXP_PER_LEVEL_AT_CAP = 1000）

- **アイテム付与**: ユーザー（`userId`）の所持に、`LEVEL_CAP_REWARD_ITEM_CODE` で指定したアイテム（code で Item を検索して id を取得）を **itemsToGrant 個**付与する。`grantStackableItem`（`src/server/lib/inventory.ts`）を同一トランザクション内で呼ぶ。

- **experiencePoints の更新**（**余りを保持しない**方式）:
  - `experiencePoints = getRequiredExpForLevel(LEVEL_CAP)` に更新する。オーバーフローの端数は捨てる。
  - これにより「Lv100 の人は常にあと 1,000 で Lv101」と表示・仕様を統一できる（docs/074 §2.4）。

### 4.4 キャップ未満から一気にキャップを超える場合

- 加算後 `newLevel > LEVEL_CAP` となる場合:
  1. まず **LEVEL_CAP まで**レベルアップ処理を 1 回行う（`level`, `CAP`, 7 ステを LEVEL_CAP 相当に更新）。
  2. 残り経験値として「キャップ到達分」を超えた部分をオーバーフローとみなし、4.3 と同様に `itemsToGrant` を算出し、アイテム付与と `experiencePoints = getRequiredExpForLevel(LEVEL_CAP)` の更新を行う。

---

## 5. データ・永続化

### 5.1 変更しないデータ

- **Character**: 既存の `level`, `experiencePoints`, `CAP`, 7 種基礎ステのカラムをそのまま使用。スキーマ変更は不要。

### 5.2 付与先

- キャップ超過時付与アイテムは**ユーザー（userId）の所持**に加える（UserItem や所持品テーブル）。キャラに紐づけず、バッグなどに 1 個ずつ付与する。

---

## 6. 実装場所の対応

| 項目 | 実装場所 |
|------|----------|
| LEVEL_CAP / LEVEL_CAP_REWARD_ITEM_CODE | `src/lib/constants/level.ts` |
| レベル計算（既存） | `src/lib/level.ts`（変更は最小限。定数は constants から import） |
| grantCharacterExp の拡張 | `src/server/actions/character-exp.ts` |
| アイテム付与 | 既存の所持品追加 API を利用。無ければ付与用関数を用意し、character-exp から呼ぶ。 |

---

## 7. 実装フェーズ

1. **Phase 1**: `LEVEL_CAP` 定数を `src/lib/constants/level.ts` に追加。`grantCharacterExp` 内で `effectiveNewLevel = min(newLevel, LEVEL_CAP)` を適用し、キャップ超過時の `experiencePoints = getRequiredExpForLevel(LEVEL_CAP)` までの処理を実装（アイテム付与は仮でもよい）。
2. **Phase 2**: `LEVEL_CAP_REWARD_ITEM_CODE` の定数と、ユーザーへのアイテム付与処理を実装（code で Item 取得 → grantStackableItem）。
3. **Phase 3**: （任意）探索報酬画面などで「振り直しアイテムを N 個獲得」と表示する UI。
4. **Phase 4**: 振り直しアイテムの本来の用途（ステータス振り直し）を別 spec で実装する際、本 spec の付与アイテムと同一とする。

---

## 8. キャップ解放時・段階解放（30 → 40 → … → 100）

- レベルキャップを引き上げる場合は、**LEVEL_CAP 定数を変更してリリース**する（例: 30 → 40）。DB 変更は不要。
- **次回の経験値付与時**に、`newLevel = computeLevelFromTotalExp(newExp)` を計算し `effectiveNewLevel = min(newLevel, LEVEL_CAP)` で反映するため、**その 1 回の付与量が大きければ複数レベルアップ**する（例: キャップ 40 解放後、Lv30 のキャラに 5000 一気に入れば 30→40 になる）。付与量が 1000 なら 30→31 のみ。
- 余りを保持しない方式のため、キャップ到達時点では `experiencePoints = getRequiredExpForLevel(LEVEL_CAP)` にリセットされている。解放後も「あと 1000 で次のレベル」と表示を統一できる（EXP_PER_LEVEL_AT_CAP = 1000）。
