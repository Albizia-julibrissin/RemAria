# Spec: クエスト（ストーリー・研究・一般）

`docs/054_quest_and_research_design.md` に基づく。**クエスト一覧・進捗・達成判定・報酬（次のクエスト解放）**を定義する。

------------------------------------------------------------------------

## 0. 依存

- **010_auth**：セッション有効。
- **045_inventory_and_items**：報酬アイテム付与（将来）。
- **049_exploration**：探索終了時・戦闘勝利時に進捗加算の契機。

------------------------------------------------------------------------

## 1. 目的

- **ストーリー・研究クエスト**はオート受注（前提クエスト完了で出現＝受注）。一般クエスト（デイリー等）は将来手動受注を検討。
- 達成条件（area_clear / enemy_defeat 等）を満たすと進捗加算し、目標達成で完了。報酬として「次のクエスト解放」（UserQuest 自動作成）を行う。
- クエストは 1 つのクエスト画面で一覧表示し、フィルタでストーリー／研究を切り替える。

------------------------------------------------------------------------

## 2. データ（047 と重複せず概要）

- **Quest**：code, questType, name, description, clearReportMessage, prerequisiteQuestId, achievementType, achievementParam, rewardResearchPoint 等。
- **UserQuest**：userId, questId, state, progress, completedAt, **reportAcknowledgedAt**（クリア報告を画面で確認した日時。null の間は「クリア報告」でメッセージ表示可能）。

------------------------------------------------------------------------

## 3. API（実装済み）

| API | 用途 |
|-----|------|
| getQuestList(filter) | 一覧取得。D1: 前提を満たしているが UserQuest が無いクエストは自動作成する。 |
| addQuestProgressAreaClear(userId, areaId) | 内部用。探索 finish で呼ぶ。 |
| addQuestProgressEnemyDefeat(userId, defeatedEnemyIds) | 内部用。探索戦闘勝利で呼ぶ。 |
| getQuestClearReportMessage(questId) | クリア報告メッセージ取得（表示用）。 |
| acknowledgeQuestReport(questId) | クエスト画面で「クリア報告」を確認したとき呼ぶ。reportAcknowledgedAt を記録。 |

------------------------------------------------------------------------

## 4. 達成タイプ（初期）

- **area_clear**：achievementParam { areaId, count }。探索 finish で該当 areaId なら progress += 1。
- **enemy_defeat**：achievementParam { enemyId, count }。戦闘勝利で defeatedEnemyIds に含まれる敵ごとに progress 加算。

------------------------------------------------------------------------

## 5. 画面

- **URL**：/dashboard/quests。フィルタはクエリ ?filter=story | research。
- **表示**：クエスト名・説明文・進捗・状態（進行中／報告待ち／クリア済み）。達成済みで未報告のとき「クリア報告」ボタンでモーダルに clearReportMessage を表示し、「確認」で acknowledgeQuestReport を呼ぶとクリア済みとして記録される。

詳細な入力出力・エラーは実装（`src/server/actions/quest.ts`）を参照。
