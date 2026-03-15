# 開拓任務（クエスト）の実装状況

**参照**: `spec/054_quests.md`、`docs/054_quest_and_research_design.md`、`src/server/actions/quest.ts`。初回チュートリアルで使う任務フローは **`docs/091_tutorial_and_opening_quest_scope.md`**。

---

## 1. 実装済み

| 項目 | 内容 |
|------|------|
| **データ** | Quest マスタ・UserQuest（進行）は Prisma で定義済み。rewardResearchPoint / rewardTitleId のカラムあり。 |
| **一覧・出現＝受注** | `getQuestList(filter)`。前提クエストを満たしているが UserQuest が無いクエストは**自動作成（出現＝受注）**。初回アクセスで最初のストーリークエストが 1 件作られる。 |
| **達成タイプ** | **area_clear**（探索 finish で該当 areaId なら progress+1）、**enemy_defeat**（戦闘勝利で撃破敵を進捗加算）。探索側から `addQuestProgressAreaClear` / `addQuestProgressEnemyDefeat` を呼び出し済み。 |
| **完了時の報酬** | **次のクエスト解放**のみ実装。`unlockNextQuests` で prerequisiteQuestId が完了クエストのものの UserQuest を自動作成。 |
| **クリア報告** | `getQuestClearReportMessage(questId)`、`acknowledgeQuestReport(questId)`。報告待ちのとき「クリア報告」ボタン→モーダルで clearReportMessage 表示→「確認」で reportAcknowledgedAt を記録。 |
| **画面** | `/dashboard/quests`。フィルタ（すべて／ストーリー／研究）、一覧、進捗バー、状態（進行中／報告待ち／クリア済み）、クリア報告モーダル。 |
| **新規任務受注の通知** | UserQuest を新規作成した直後に「新しい任務を受注しました。」と通知を登録。リンクは `/dashboard/quests`。`getQuestList`（出現＝受注）と `unlockNextQuests`（次クエスト解放）の両方で呼ぶ。 |

---

## 2. 未実装・仕様拡張予定

| 項目 | 内容 |
|------|------|
| **研究ポイント報酬** | Quest.rewardResearchPoint は DB にあるが、**クエスト完了時にユーザーに加算する処理がない**。研究クエストクリアで研究ポイント付与は未実装。 |
| **称号報酬** | Quest.rewardTitleId は DB にあるが、**クエスト完了時に称号付与（UserTitleUnlock 等）する処理がない**。 |
| **アイテム報酬** | クエストクリアでアイテム（例：緊急製造指示書）を付与する仕様・API は未実装。報酬テーブルや「報酬付与」の共通処理の設計が必要。 |
| **その他達成タイプ** | **skill_success_count**（技能イベント N 回）、**equipment_craft**（特定装備クラフト N 回）は設計 doc にあり、quest.ts には未実装。**skill_event_specific**（特定技能イベント・特定ステータス N 回）は **spec/054_quests.md** §4・§6・§7 で定義済み。実装フェーズ：任務 API → 探索側呼び出し → 管理画面編集 UI。 |
| **新規達成タイプ（初回チュートリアル用）** | **実装済み**。**item_received**（addQuestProgressItemReceived、receiveProduction から呼び出し）、**skill_level**（getQuestList 内で CharacterSkill を参照して進捗評価・更新）、**screen_visit**（addQuestProgressScreenVisit、作戦室ページで呼び出し）。管理画面で 3 種の達成条件を編集可能。初回フローは docs/091。 |

## 3. まとめ

- **動いているところ**: 一覧・出現＝受注・area_clear / enemy_defeat の進捗・完了時の「次クエスト解放」・クリア報告の表示と確認・**受注時の通知**。
- **まだないところ**: 研究ポイント付与・称号付与・アイテム報酬・技能/クラフト系達成タイプ。

ガイド（`docs/056`）の「クエストは実装途中」という記載は、上記の報酬まわりと達成タイプが未揃いであることを指している。
