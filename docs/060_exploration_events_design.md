# 探索イベント設計（技能マスタ・エリア紐づけ・将来の他イベント）

探索中の「技能イベント」をマスタ化し、エリアごとにどのイベントが起きるかを紐づける。あわせて、将来の「技能以外のイベント」（ストーリー＋選択肢など）を見据えたテーブル・実装構造の案をまとめる。

**本実装の正式仕様は `spec/073_skill_events_exploration.md` を参照すること。** 以下は設計ドキュメントとしての背景・テーブル案を記載する。

---

## 1. 現状

- **技能イベント**: マスタなし。`getNextExplorationStep` 内で「戦闘 vs 技能」を `baseSkillEventRate` で抽選し、技能のときは **固定文言**「何かが起きた…。どう対処する？」＋ 共通のステータス選択（STR/INT/…）のみ。
- **エリア**: `ExplorationArea` に `baseSkillEventRate` / `skillCheckRequiredValue` を持つ。**どのイベントが起きるか**の紐づけはない。
- **戦闘側の参考**: エリアは `normalEnemyGroupCode` で `EnemyGroup` を参照し、`EnemyGroupEntry` で敵を複数持ち。抽選は「エリア → グループ → グループ内の敵」の流れ。

---

## 2. 目標

1. **技能イベントマスタ**を持ち、文言・必要値などをマスタで管理する。
2. **エリアごとに「どのイベントが起きるか」**を紐づける（エネミーグループと似た「エリア → イベントプール」の形）。
3. **将来**、技能以外のイベント（例: ストーリー文＋「〇〇する/しない」のような選択肢）を追加しやすくする。ただしそれらは技能ほどシンプルにならない想定（選択肢マスタ・効果の多様性など）。

---

## 3. イベント種別の整理

| 種別 | 説明 | 現状 | 複雑さ |
|------|------|------|--------|
| **skill_check** | メッセージ＋基礎ステータス（STR/INT/…）で判定。必要値と照合して成功/失敗。 | 実装済み（マスタなし） | 低 |
| **story_choice**（将来） | ストーリー文＋「する/しない」など、ステータス以外の選択肢。選択ごとに効果が異なる可能性。 | 未実装 | 中〜高 |

実装構造としては **「イベント種別」で分岐し、種別ごとに表示・解決ロジックを分ける**形が扱いやすい。

---

## 4. テーブル案

### 4.1 方針

- **「何が起きうるか」を 1 テーブルで一覧し、種別で分岐**する形にする（`ExplorationEvent` のような共通マスタ）。
- 種別が `skill_check` のときは **技能用の追加情報**を別テーブルまたは JSON で持つ。将来の `story_choice` は **選択肢マスタ**を別テーブルで持つ想定。
- エリアとの紐づけは **「エリア : イベント = N : M、重み付き」** にし、エネミーグループのように「グループ」を挟むか、**エリアに直接イベントプールを持たせる**かの二案がある。ここでは **エリアに直接持たせる案（シンプル）** を推奨する。

### 4.2 推奨: エリアに直接イベントプール

- **ExplorationEvent**（探索イベントの共通マスタ）
  - `id`, `code`（ユニーク）, `eventType`（`skill_check` | `story_choice` 等）, `name`（管理用）, `description`（任意）
  - 種別ごとの詳細は下記の「種別ごとのデータ」で保持。

- **SkillEventDetail**（技能イベント専用。1 対 1）
  - `explorationEventId`（PK 兼 FK → ExplorationEvent）
  - **`occurrenceMessage`**（発生時共通メッセージ。「〇〇が起きた！」のように、何が起きたかだけを表す文言。選択前の画面で表示）

- **SkillEventStatOption**（技能イベントの「ステータスごとの設定」。1 イベントあたり最大 7 行＝STR/INT/VIT/WIS/DEX/AGI/LUK）
  - `skillEventDetailId`（FK → SkillEventDetail）, `statKey`（`STR` | `INT` | … | `LUK`）, `sortOrder`（表示順）
  - **`difficultyCoefficient`**（Float, デフォルト 1.0）  
    **そのステータスで判定するときの要求値 = エリアの skillCheckRequiredValue × difficultyCoefficient**。  
    STR を 1.0・INT を 1.5 にすれば「力が有効で、知恵だと厳しい」といった差別化ができる。
  - **`successMessage`**（そのステータスで**成功**したときに出す解決メッセージ）
  - **`failMessage`**（そのステータスで**失敗**したときに出す解決メッセージ）  
  → 発生内容は共通、**どのステータスでどう解決したか**はステータスごとに文言を変えられる。

- **AreaExplorationEvent**（エリア × イベントの紐づけ、重み付き）
  - `areaId`, `explorationEventId`, `weight`（出現重み。抽選で使用）
  - 同一エリアに同一イベントは 1 行（ユニーク）。重み 0 で「無効」扱いも可。

この形なら「どのエリアでどのイベントがどれくらいの重みで出るか」が一覧でき、エネミーグループと似た「エリア → 複数候補から重み抽選」が実現できる。

#### 同じイベントの使い回しと難易度（ステータス別係数）

- **やりたいこと**: 同じ技能イベントを序盤・終盤で使い回しつつ、要求値はエリアに合わせる。さらに「STR が有効なイベント」「INT だと厳しい」などステータスごとの差別化をしたい。
- **案**: **初期からステータス別係数**を持つ（`SkillEventStatOption` の `difficultyCoefficient`）。  
  **そのステータスでの実要求値 = エリアの skillCheckRequiredValue × そのステータスの difficultyCoefficient**（端数は四捨五入などで統一）。
- 例: STR 係数 1.0・INT 係数 1.5 のイベント → 序盤（基準 80）で STR なら 80、INT なら 120。終盤（基準 100）で STR なら 100、INT なら 150。
- イベントマスタは 1 本で済み、エリアごとに別イベントを用意しなくてよい。

#### メッセージの役割分担

- **発生メッセージ（共通）**: `SkillEventDetail.occurrenceMessage`。「〇〇が起きた！」のように**何が起きたか**だけ。選択前の画面で 1 回表示。
- **解決メッセージ（ステータス別）**: `SkillEventStatOption.successMessage` / `failMessage`。**どのステータスを選んで、成功したか失敗したか**で出し分ける。例: STR 成功時「力づくで押し切った。」、INT 成功時「知恵で打開した。」など。

### 4.3 代替: イベントグループを挟む案

- **ExplorationEventGroup**（コードで参照）
  - `id`, `code`（ユニーク）
- **ExplorationEventGroupEntry**
  - `eventGroupId`, `explorationEventId`, `weight`
- **ExplorationArea**
  - `skillEventGroupCode`（NULL のときは技能イベントなし or 旧仕様フォールバック）

エリアごとに「グループ」を変えずに「複数エリアで同じイベントプールを共有」したい場合に有利。必要になったら後から「グループ」を追加してもよい。

### 4.4 将来の story_choice 用（拡張案）

- **ExplorationEvent** の `eventType = 'story_choice'` のレコードを追加。
- **StoryEventDetail**（1 対 1）
  - `explorationEventId`
  - `message`（長文可）
- **StoryEventChoice**
  - `storyEventDetailId`（または explorationEventId）, `label`（「〇〇する」）, `sortOrder`, 必要なら `effectType` / パラメータ（JSON など）

解決時は「選択肢 ID」をサーバーに送り、効果を種別ごとに実行する。

---

## 5. 実装構造の提案

### 5.1 層の分離

1. **抽選**（`getNextExplorationStep` 相当）
   - 「戦闘 vs イベント」の確率は現状どおり `baseSkillEventRate` でよい。
   - イベントに振れた場合だけ、「そのエリアのイベントプール（AreaExplorationEvent）」から重み抽選で 1 件選ぶ。
   - 選んだ `ExplorationEvent` の `eventType` に応じて、返却する `step` の形を変える（`skill_check` なら現行に近い形、`story_choice` なら選択肢一覧付き）。

2. **表示**
   - `step.kind === 'skill_check'` → 既存の `ExplorationSkillEventBlock`。**発生時**は `SkillEventDetail.occurrenceMessage` を表示。選択肢は STR/INT/… の 7 つ（マスタに存在する stat のみ表示する運用も可）。
   - `step.kind === 'story_choice'`（将来）→ 別コンポーネント（ストーリー文＋選択肢ボタン）。

3. **解決（resolve）**
   - 技能: 現行の `resolveExplorationSkillEvent(stat)`。  
     - 要求値 = **area.skillCheckRequiredValue × そのイベントのその stat の difficultyCoefficient**（端数は四捨五入などで統一）。  
     - 判定後、表示するログ文言は **その stat の successMessage / failMessage** を使用。
   - ストーリー（将来）: `resolveExplorationStoryEvent(choiceId)` のような API を追加し、選択肢に紐づく効果を実行。

### 5.2 技能イベントのマスタ構成

- 技能イベントは **「発生メッセージ（共通）＋ ステータス選択 ＋ ステータスごとの要求値判定 ＋ ステータスごとの解決メッセージ」**。
- **SkillEventDetail**: 発生時だけ使う共通文言（`occurrenceMessage`）。
- **SkillEventStatOption**: ステータスごとに 1 行。係数（エリア基準×係数＝要求値）と、成功時・失敗時の解決メッセージ。**初期からステータス別係数**で「STR が有利なイベント」などを表現する。
- 選択肢は **STR/INT/VIT/WIS/DEX/AGI/LUK** の 7 つを原則とするが、マスタにその stat の行が無ければ非表示にする、といった運用も可能（「このイベントは STR/INT/VIT のみ」など）。

### 5.3 マイグレーション・後方互換

- 既存エリアで `AreaExplorationEvent` が 0 件の場合は、「技能イベントに振れたら従来どおり固定文言＋エリアの skillCheckRequiredValue（全 stat 係数 1.0 相当）」とするフォールバックを残すと、既存エリアを壊さずにマスタを段階的に追加できる。
- ある stat の `SkillEventStatOption` が存在しない場合は、係数 1.0・メッセージは汎用文言で補う、などのフォールバックを決めておくとよい。
- または、全エリアに「デフォルト技能イベント 1 件」をマスタ登録し、その 1 件だけ weight 付きで紐づける、という運用でもよい。

---

## 6. まとめ（推奨アクション）

| 項目 | 推奨 |
|------|------|
| テーブル | `ExplorationEvent`（共通）＋ `SkillEventDetail`（技能用・発生メッセージのみ）＋ **`SkillEventStatOption`**（ステータス別係数・成功/失敗メッセージ）＋ `AreaExplorationEvent`（エリア×イベント、重み）。将来は `StoryEventDetail` ＋ `StoryEventChoice` を追加。 |
| エリア紐づけ | エリアに直接 `AreaExplorationEvent` で複数イベントを重み付きで紐づけ（グループは必須にしない）。 |
| 抽選 | イベント発生時、そのエリアの `AreaExplorationEvent` から重み抽選で 1 件選択。 |
| 実装 | `getNextExplorationStep` でイベント種別に応じた step を返す。表示・解決は種別ごとにコンポーネント／Server Action を分ける。技能は現行のシンプルなフローを維持。 |
| 後方互換 | エリアに紐づくイベントが 0 件のときは現行の固定文言＋エリア必要値で動作させる。 |

この形にしておけば、**いまは技能イベントのマスタ化とエリア紐づけだけ実装**し、ストーリーイベントは「テーブルと API の枠だけ用意」または「仕様が固まってから追加」で対応できる。

---

## 7. 本実装

- **実装用の正式仕様**: **`spec/073_skill_events_exploration.md`**
- 本 doc は設計・テーブル案の背景として参照し、データ構造・閾値計算・フロー・後方互換・開拓任務との接続は 073 に従う。
