# 073: 探索 技能イベント本実装

探索中の技能イベントをマスタ化し、エリアごとの発生イベント紐づけ・基礎ステ係数・発生/クリアメッセージを正式に実装する。  
設計の背景は `docs/060_exploration_events_design.md` を参照。

------------------------------------------------------------------------

## 1. 目的・前提

### 1.1 想定する仕様

- **各エリアごとにイベント発生率がある**（実装済み: `ExplorationArea.baseSkillEventRate`）。
- **各エリアごとに「発生しうる技能イベント」を紐づける**（重み付き抽選）。
- **技能イベントは基礎ステ 6 種（STR/INT/VIT/WIS/DEX/AGI）の係数を持つ**（LUK を含め 7 種にも対応可能。マスタで stat ごとに有無を切る）。
- **各エリアに設定された基礎値**（実装済み: `skillCheckRequiredValue`）**に係数をかけて、そのイベント・そのステでの実際の閾値を決定する。**
- **イベント発生時**: イベントごとの**発生メッセージ**を表示する。
- **イベントクリア時**: イベントごと・**どの技能（ステータス）でクリアしたか**に応じた**クリアメッセージ**を表示する。
- **開拓任務**: 「特定イベントの特定技能クリア」をクリア条件にする場合は**開拓任務側（quest / 達成タイプ）で扱う**。本 spec では探索側で「どのイベントをどの技能で成功したか」を記録できる形にし、任務側がそれを参照できるようにする。

### 1.2 依存

- `spec/049_exploration`：探索フロー・`getNextExplorationStep` / `advanceExplorationStep` / `resolveExplorationSkillEvent`。
- `docs/020_exploration_design.md`：技能判定の基準値・補正の考え方。
- `docs/060_exploration_events_design.md`：テーブル案・メッセージ役割・後方互換方針。

------------------------------------------------------------------------

## 2. データモデル

### 2.1 テーブル一覧

| テーブル | 役割 |
|----------|------|
| **ExplorationEvent** | 探索イベントの共通マスタ（種別で技能/将来のストーリー等に分岐）。 |
| **SkillEventDetail** | 技能イベント専用。発生時メッセージ（1 対 1）。 |
| **SkillEventStatOption** | 技能イベントの「ステータスごとの設定」。係数・成功/失敗メッセージ。 |
| **AreaExplorationEvent** | エリア × イベントの紐づけ（重み付き）。 |

### 2.2 ExplorationEvent

- `id`, `code`（ユニーク）, `eventType`（`skill_check` 等。将来 `story_choice` 等を拡張）, `name`（管理用）, `description`（任意）。

### 2.3 SkillEventDetail

- `explorationEventId`（PK 兼 FK → ExplorationEvent）。
- **occurrenceMessage**（発生時共通メッセージ。選択前の画面で 1 回表示）。

### 2.4 SkillEventStatOption

- `skillEventDetailId`（FK → SkillEventDetail）, `statKey`（`STR` \| `INT` \| `VIT` \| `WIS` \| `DEX` \| `AGI` \| `LUK`）, `sortOrder`（表示順）。
- **difficultyCoefficient**（Float, デフォルト 1.0）  
  → **そのステータスで判定するときの閾値 = エリアの skillCheckRequiredValue × difficultyCoefficient**（端数は四捨五入などで統一）。
- **successMessage**（そのステで成功したときの解決メッセージ）。
- **failMessage**（そのステで失敗したときの解決メッセージ）。

### 2.5 AreaExplorationEvent

- `areaId`, `explorationEventId`, `weight`（出現重み。抽選で使用）。
- 同一エリアに同一イベントは 1 行（ユニーク）。重み 0 で無効扱い可。

------------------------------------------------------------------------

## 3. 閾値と判定

### 3.1 閾値の算出

- **requiredValue(area, event, stat) = round(area.skillCheckRequiredValue × option.difficultyCoefficient)**  
  - `option` はそのイベントの `SkillEventStatOption` のうち `statKey === stat` の行。無い場合は係数 1.0 として扱う（フォールバック）。

### 3.2 判定ロジック（現行維持）

- パーティ内で選択したステが**最高のキャラ**のその基礎ステを使用。
- **成功**: その値 ≥ requiredValue → 確定成功。  
- **未満**: 成功率 = その値 / requiredValue でランダム判定（docs/020 準拠）。

------------------------------------------------------------------------

## 4. フロー

### 4.1 次ステップ抽選（getNextExplorationStep）

- 「戦闘 vs 技能」は現状どおり `baseSkillEventRate` で抽選。
- **技能に振れた場合**:
  - そのエリアに紐づく `AreaExplorationEvent`（weight > 0）から**重み付き抽選**で 1 件選ぶ。
  - **紐づきが 0 件のとき**: 従来どおり**フォールバック**（後方互換）: 固定文言「何かが起きた…。どう対処する？」＋ エリアの `skillCheckRequiredValue` のみ（全ステ係数 1.0 相当）。このときは「マスタ未登録の技能イベント」として扱い、`explorationEventId` は null。
  - 選んだイベントが `eventType === 'skill_check'` の場合、`SkillEventDetail.occurrenceMessage` を step に含める。返却する step に **explorationEventId**（および必要なら eventCode）を含め、後続の resolve で参照する。

### 4.2 表示（発生時）

- **発生メッセージ**: step に含めた `occurrenceMessage` をそのまま表示（イベントごと）。

### 4.3 解決（resolveExplorationSkillEvent）

- 入力: 従来どおり `stat`。加えて **進行中 Expedition の explorationState.pendingSkillEvent に保存した explorationEventId** を参照する。
- **explorationEventId が null または未設定（フォールバック）**:  
  - 閾値 = `area.skillCheckRequiredValue`。  
  - ログ文言 = 従来どおり「R${roundIndex}: 技能判定（${stat}）成功。」/ 失敗。
- **explorationEventId が有効**:
  - 閾値 = 上記 §3.1 の requiredValue(area, event, stat)。  
  - 成功時: そのイベントのその stat の **successMessage** を表示。  
  - 失敗時: そのイベントのその stat の **failMessage** を表示。  
  - （必要ならログ用に「R${roundIndex}: …」のプレフィックスは付与してよい。）
- クリア結果は従来どおり `skillSuccessCount` やログ配列に反映。**開拓任務用**に「どのイベントをどの技能で成功したか」を記録する場合は、resolve の結果または explorationState に `lastSkillEventResult: { explorationEventId?, statKey, success }` のような形で保持し、任務側で `addQuestProgressSkillEventSuccess(userId, explorationEventId, statKey)` などを呼べるようにする（任務側の達成タイプ拡張は別 spec）。

### 4.4 pendingSkillEvent の拡張

- 現在の `PendingSkillEventDisplay` に **explorationEventId**（および必要なら **eventCode**）を追加する。
- `advanceExplorationStep` で技能 step を返すときに、抽選で選んだイベントの id を explorationState.pendingSkillEvent に書き込む。フォールバック時は null。

------------------------------------------------------------------------

## 5. メッセージの役割

| タイミング | 内容 |
|------------|------|
| **発生時** | イベントごとの「何が起きたか」だけ（`SkillEventDetail.occurrenceMessage`）。選択前の画面で 1 回表示。 |
| **クリア時** | イベントごと × 選択した技能（ステータス）× 成功/失敗で出し分け（`SkillEventStatOption.successMessage` / `failMessage`）。 |

------------------------------------------------------------------------

## 6. 後方互換

- エリアに `AreaExplorationEvent` が 0 件のときは、技能に振れた場合 **現行の固定文言 ＋ エリアの skillCheckRequiredValue（全ステ係数 1.0）** で動作させる。
- ある stat の `SkillEventStatOption` が存在しない場合は、係数 1.0・メッセージは汎用文言で補う。

------------------------------------------------------------------------

## 7. 開拓任務との接続

- 「特定イベントの特定技能クリア」をクリア条件にする機能は**開拓任務側で実装**する。
- 探索側では、技能イベント解決時に **explorationEventId** と **statKey** と **success** を記録できる形にし、任務の進捗更新 API（例: `addQuestProgressSkillEventSuccess`）から参照できるようにする。達成タイプ・achievementParam の設計は quest spec / 067 で行う。

------------------------------------------------------------------------

## 8. 実装フェーズ（目安）

| Phase | 内容 |
|-------|------|
| 1 | Prisma に ExplorationEvent / SkillEventDetail / SkillEventStatOption / AreaExplorationEvent を追加。マイグレーション。 |
| 2 | getNextExplorationStep: 技能時に AreaExplorationEvent から重み抽選。step に explorationEventId と occurrenceMessage を付与。フォールバック（0 件時）維持。 |
| 3 | advanceExplorationStep / pendingSkillEvent: explorationEventId を保存。getExplorationPendingSkillDisplay で返す。 |
| 4 | resolveExplorationSkillEvent: pendingSkillEvent の explorationEventId を参照。閾値 = area.skillCheckRequiredValue × coefficient。成功/失敗メッセージを SkillEventStatOption から取得して返す。 |
| 5 | UI: 発生メッセージは step の occurrenceMessage、クリアメッセージは resolve の返却メッセージを表示。 |
| 6 | 管理画面: 技能イベントマスタの CRUD・エリアへの紐づけ（AreaExplorationEvent の編集）。 |

以上を満たせば、各エリアごとの発生率・エリアごとの発生イベント紐づけ・基礎ステ係数による閾値・発生/クリアメッセージの本実装が完了する。
