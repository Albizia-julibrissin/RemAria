# Spec: クエスト（ストーリー・研究・一般）

`docs/054_quest_and_research_design.md` に基づく。**クエスト一覧・進捗・達成判定・報酬（次のクエスト解放）**を定義する。

------------------------------------------------------------------------

## 0. 依存

- **010_auth**：セッション有効。
- **045_inventory_and_items**：報酬アイテム付与（将来）。
- **049_exploration**：探索終了時・戦闘勝利時に進捗加算の契機。
- **073_skill_events_exploration**：技能イベント解決時に「どのイベントをどのステータスで成功したか」を任務進捗 API に渡す（`skill_event_specific` 達成タイプ用）。

------------------------------------------------------------------------

## 1. 目的

- **ストーリー・研究クエスト**はオート受注（前提クエスト完了で出現＝受注）。一般クエスト（デイリー等）は将来手動受注を検討。
- 達成条件を満たすと進捗加算するが、**目標達成時点では完了にしない**（B 案）。**クリア報告を押したタイミング**で、完了・reportAcknowledgedAt 記録・**報酬付与**（GRA・研究記録書・アイテム）・**次のクエスト解放**（UserQuest 自動作成）を行う。
- クエストは 1 つのクエスト画面で一覧表示し、フィルタでストーリー／研究を切り替える。

------------------------------------------------------------------------

## 2. データ（047 と重複せず概要）

- **Quest**：code, questType, name, description, clearReportMessage, achievementType, achievementParam, **rewardGra**, **rewardResearchPoint**, **rewardItems**, rewardTitleId 等。**前提**は **QuestPrerequisite**（questId, prerequisiteQuestId）で複数持てる。すべて完了で出現。
- **User**：**researchPoint**（研究記録書の所持数。クエスト報酬等で加算、研究解放で消費）。
- **UserQuest**：userId, questId, state, progress, completedAt, **reportAcknowledgedAt**（クリア報告を画面で確認した日時。null の間は「クリア報告」でメッセージ表示可能）。

------------------------------------------------------------------------

## 3. API（実装済み）

| API | 用途 |
|-----|------|
| getQuestList(filter) | 一覧取得。D1: **前提をすべて**満たしているが UserQuest が無いクエストは自動作成する。前提は QuestPrerequisite で複数可。 |
| addQuestProgressAreaClear(userId, areaId) | 内部用。探索 finish で呼ぶ。進捗加算のみ（目標達成時も state は変更しない）。 |
| addQuestProgressEnemyDefeat(userId, defeatedEnemyIds) | 内部用。探索戦闘勝利で呼ぶ。進捗加算のみ。 |
| addQuestProgressSkillEventSuccess(userId, explorationEventId, statKey) | 内部用。技能イベントを指定ステータスで成功したときに探索側から呼ぶ。進捗加算のみ。achievementType が `skill_event_specific` かつ achievementParam の explorationEventId・statKey が一致する進行中任務のみ加算。 |
| addQuestProgressItemReceived(userId, itemId, amount) | 内部用。製造一括受け取りでアイテムを受け取ったときに呼ぶ。achievementType が `item_received` かつ achievementParam.itemId が一致する進行中任務の progress を amount 加算。 |
| addQuestProgressScreenVisit(userId, path) | 内部用。指定パスの画面を開いたときに 1 回だけ呼ぶ。achievementType が `screen_visit` かつ achievementParam.path が一致する進行中任務のうち progress が未達のものを progress = 1 に更新（複数回呼んでも 1 のまま）。 |
| getQuestClearReportMessage(questId) | クリア報告メッセージ取得（表示用）。 |
| acknowledgeQuestReport(questId) | クエスト画面で「クリア報告」を押したとき呼ぶ。進行中で progress≥目標ならここで完了・報酬付与（GRA・研究記録書・アイテム）・次クエスト解放。返却で報酬内容（gra, researchPoint, items）を返し、モーダルで「報酬を受け取った。」と一覧表示。既に完了で未報告なら reportAcknowledgedAt のみ記録。 |

------------------------------------------------------------------------

## 4. 達成タイプ

- **area_clear**：achievementParam `{ areaId, count }`。探索 finish で該当 areaId なら progress += 1。
- **enemy_defeat**：achievementParam `{ enemyId, count }`。戦闘勝利で defeatedEnemyIds に含まれる敵ごとに progress 加算。
- **skill_event_specific**：achievementParam `{ explorationEventId, statKey, count }`。探索中に技能イベントを**指定した explorationEventId のイベント**を**指定した statKey（STR / INT / VIT / WIS / DEX / AGI / LUK）**で成功したときに progress += 1。探索側の `resolveExplorationSkillEvent` 成功時に `addQuestProgressSkillEventSuccess(userId, explorationEventId, statKey)` を呼ぶ。目標は count（省略時は 1）。同一探索内で同じイベント・同じ stat で複数回成功した場合は呼ばれる回数だけ加算（通常は 1 回の探索で同一イベントは 1 回しか発生しない想定）。
- **item_received**：achievementParam `{ itemId, count }`。**特定アイテムを合計 N 個「生産受け取り」したら達成**。製造一括受け取り（receiveProduction）の処理内で、受け取った各 itemId について `addQuestProgressItemReceived(userId, itemId, amount)` を呼ぶ。該当する進行中任務の progress を amount 加算。progress ≥ count で目標達成。汎用（他任務でも「〇〇を N 個受け取り」に利用可）。
- **skill_level**：achievementParam `{ skillId, level }`。**指定スキルが指定レベル以上になっている**（主人公・仲間のいずれか 1 体でも可）。進捗は「加算」ではなく**状態の評価**。getQuestList 取得時に、achievementType === `skill_level` の進行中任務について、当該ユーザの主人公・仲間の CharacterSkill を参照し、指定 skillId の level が param.level 以上なら progress = 1（そうでなければ 0）とする。スキル分析書使用でレベルが変わったあと、次回クエスト一覧を開いた時点で「報告待ち」になる。汎用（「〇〇スキルを Lv2 に」等）。
- **screen_visit**：achievementParam `{ path, count }`（count 省略時は 1）。**指定画面（パス）を 1 回でも開いたら達成**。該当ページを表示したときに `addQuestProgressScreenVisit(userId, path)` を 1 回呼ぶ。一致する進行中任務の progress を 1 に更新（既に 1 以上なら更新しない）。目標は count（通常 1）。作戦室は path = `"/dashboard/tactics"` など。汎用（研究画面・クラフト画面など他誘導にも使える）。

------------------------------------------------------------------------

## 5. 画面

- **URL**：/dashboard/quests。フィルタはクエリ ?filter=story | research。
- **表示**：クエスト名・説明文・進捗・状態（進行中／報告待ち／クリア済み）。**報告待ち**は progress ≥ 目標かつ未報告のとき。「クリア報告」→ モーダルに clearReportMessage →「確認」で acknowledgeQuestReport を呼ぶと完了・報酬付与・次クエスト出現。続けてモーダルに「報酬を受け取った。」と、〇〇 GRA（ダッシュボードの GRA 色）・研究記録書〇〇枚・アイテム名 N個 の一覧を表示し、「閉じる」で閉じる。

詳細な入力出力・エラーは実装（`src/server/actions/quest.ts`）を参照。

------------------------------------------------------------------------

## 6. 実装フェーズ（skill_event_specific 達成タイプ）

| Phase | 内容 |
|-------|------|
| **1** | **任務側 API**：`addQuestProgressSkillEventSuccess(userId, explorationEventId, statKey)` を quest.ts に追加。achievementType === `skill_event_specific` かつ achievementParam の explorationEventId・statKey が一致する進行中 UserQuest の progress を +1。目標達成時の通知は addQuestProgressAreaClear と同様。targetCount 取得は既存の achievementParam.count でよい。 |
| **2** | **探索側の呼び出し**：`resolveExplorationSkillEvent` の成功時に、pendingSkillEvent の explorationEventId とユーザー選択 statKey を渡して `addQuestProgressSkillEventSuccess` を呼ぶ。spec/073 §4.3 の lastSkillEventResult を参照する形でよい。 |
| **3** | **管理画面（開拓任務編集）**：達成条件の種類に「技能イベント（特定・特定ステータス）」を追加。achievementParam に explorationEventId・statKey・count を編集できる UI を追加（§7 参照）。 |

------------------------------------------------------------------------

## 7. 管理画面（開拓任務編集）

- **達成条件の種類**：`area_clear`（エリア探索）・`enemy_defeat`（エネミー撃破）・**skill_event_specific**（技能イベント・特定イベント・特定ステータス）に加え、**item_received**（特定アイテム受け取り）・**skill_level**（特定スキルを特定レベルに）・**screen_visit**（特定画面を開く）を選択可能にする。
- **skill_event_specific のときの入力項目**：
  - **探索イベント**：ExplorationEvent（eventType === skill_check）の一覧から 1 件選択。achievementParam.explorationEventId に保存。取得は既存の `getAdminExplorationEventList()` でよい。
  - **ステータス**：STR / INT / VIT / WIS / DEX / AGI / LUK から 1 つ選択。achievementParam.statKey に保存。
  - **回数**：何回成功で達成とするか（count）。1 以上。デフォルト 1。
- **item_received のときの入力項目**：
  - **アイテム**：Item マスタから 1 件選択。achievementParam.itemId に保存。
  - **個数**：何個受け取りで達成とするか（count）。1 以上。
- **skill_level のときの入力項目**：
  - **スキル**：Skill マスタから 1 件選択。achievementParam.skillId に保存。
  - **レベル**：何レベル以上で達成とするか（level）。1 以上。主人公・仲間のいずれかがそのスキルをそのレベル以上にしていればよい。
- **screen_visit のときの入力項目**：
  - **パス**：画面パス（例：`/dashboard/tactics`）。achievementParam.path に保存。
  - **回数**：何回開いたら達成とするか（count）。省略時は 1。通常は 1。
- **保存時**：各 achievementType に応じた achievementParamJson を保存する（skill_event_specific は既存どおり。item_received は `{ "itemId": "<id>", "count": N }`。skill_level は `{ "skillId": "<id>", "level": N }`。screen_visit は `{ "path": "/dashboard/tactics", "count": 1 }` など）。
- **表示**：任務一覧・詳細の目標表示で、各タイプに応じた読める文言にする（任意。管理用に code や id のみでも可）。
