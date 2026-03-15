# 開拓任務（Quest）編集

**画面**: `/dashboard/admin/quests` → 一覧から 1 件選択で編集画面。  
**Spec**: **spec/054_quests.md**（達成タイプ・API・管理画面は §4・§6・§7）。

---

## 1. 編集項目概要

- **基本**: code（ユニーク）/ 種別（使命・研究・特殊・一般）/ name / description / clearReportMessage / 前提開拓任務（複数可）
- **達成条件**: achievementType ＋ achievementParam（§2 参照）
- **機能解放（spec/068）**: この任務クリアで解放する探索テーマ・解禁する研究グループ（複数可）
- **報酬**: GRA / 研究記録書 / 称号ID / 報酬アイテム（複数行）

---

## 2. 達成条件の種類（achievementType）

| 種類（value） | ラベル（管理画面表示例） | achievementParam | 計上元 |
|---------------|--------------------------|------------------|--------|
| **area_clear** | エリア探索 | `{ areaId, count }` | 探索 finish で該当 areaId のとき progress += 1 |
| **enemy_defeat** | エネミー撃破 | `{ enemyId, count }` | 戦闘勝利で撃破敵を進捗に加算 |
| **skill_event_specific** | 技能イベント（特定・特定ステータス） | `{ explorationEventId, statKey, count }` | 探索中に指定イベントを指定ステータスで成功したとき progress += 1。探索側の resolveExplorationSkillEvent 成功時に addQuestProgressSkillEventSuccess を呼ぶ。 |

### skill_event_specific の編集項目（spec/054 §7）

- **探索イベント**: ExplorationEvent（eventType === skill_check）の一覧から 1 件選択 → `explorationEventId`。取得は `getAdminExplorationEventList()`。
- **ステータス**: STR / INT / VIT / WIS / DEX / AGI / LUK から 1 つ選択 → `statKey`。
- **回数**: 何回成功で達成とするか（1 以上）→ `count`。デフォルト 1。

実装フェーズは **spec/054_quests.md §6**（任務 API → 探索側呼び出し → 管理画面 UI）。

---

## 3. 参照

- 開拓任務仕様: spec/054_quests.md, docs/067_quest_implementation_status.md
- 技能イベント（探索側）: spec/073_skill_events_exploration.md
- 任務によるテーマ・研究解放: docs/068_quest_unlock_themes_and_research.md, spec/068
