# Spec: 開拓任務による機能解放（探索テーマ・研究グループ）

`docs/068_quest_unlock_themes_and_research.md` に基づく。**任務クリア報告時にテーマ/研究グループの解放フラグを付与し、探索・研究メニューでそれを参照する**仕様。

------------------------------------------------------------------------

## 0. 依存

- **010_auth**：セッション有効。
- **054_quests**：`acknowledgeQuestReport` の拡張（報告時に解放フラグ付与）。
- **049_exploration**：`getExplorationMenu` の返却条件変更。
- **047_research_unlock_construction**（研究解放）：`getResearchMenu` の `isAvailable` 判定変更。

------------------------------------------------------------------------

## 1. 目的

- 開拓任務の**クリア報告**を押したタイミングで、その任務に紐づく**探索テーマ**・**研究グループ**をユーザに「解放済み」として記録する（フラグ方式）。画面を開くたびに任務完了を再計算しない。
- 探索メニューは「解放済みテーマ」または「任務紐づきでないテーマ」のみ返す。研究メニューは「解放済みグループ」または「任務紐づきでないグループ」のみ `isAvailable: true` とする。研究の前提グループは使わない。

------------------------------------------------------------------------

## 2. データ

正本は `prisma/schema.prisma`。以下は追加するモデルと既存への関係のみ記載。

### 2.1 追加モデル

**QuestUnlockExplorationTheme**（任務 → テーマの紐づけ。この任務をクリア報告するとこのテーマが解放される）

- `questId` String, FK → Quest, onDelete: Cascade
- `themeId` String, FK → ExplorationTheme, onDelete: Cascade
- @@unique([questId, themeId])
- @@index([themeId])  // メニュー側で「このテーマは任務紐づきか」の逆引き用

**UserExplorationThemeUnlock**（ユーザごとの解放済みテーマ）

- `userId` String, FK → User, onDelete: Cascade
- `themeId` String, FK → ExplorationTheme, onDelete: Cascade
- @@unique([userId, themeId])
- @@index([userId])

**QuestUnlockResearchGroup**（任務 → 研究グループの紐づけ）

- `questId` String, FK → Quest, onDelete: Cascade
- `researchGroupId` String, FK → ResearchGroup, onDelete: Cascade
- @@unique([questId, researchGroupId])
- @@index([researchGroupId])

**UserResearchGroupUnlock**（ユーザごとに解禁済みの研究グループ）

- `userId` String, FK → User, onDelete: Cascade
- `researchGroupId` String, FK → ResearchGroup, onDelete: Cascade
- @@unique([userId, researchGroupId])
- @@index([userId])

### 2.2 既存モデルへの関係追加

- **Quest**: `unlockExplorationThemes QuestUnlockExplorationTheme[]`, `unlockResearchGroups QuestUnlockResearchGroup[]`, **unlocksMarket**（Boolean, この任務のクリア報告で市場を解放する。管理画面で設定。spec/075）
- **User**: `explorationThemeUnlocks UserExplorationThemeUnlock[]`, `researchGroupUnlocks UserResearchGroupUnlock[]`
- **ExplorationTheme**: `questUnlocks QuestUnlockExplorationTheme[]`, `userUnlocks UserExplorationThemeUnlock[]`
- **ResearchGroup**: `questUnlocks QuestUnlockResearchGroup[]`, `userUnlocks UserResearchGroupUnlock[]`

------------------------------------------------------------------------

## 3. API

### 3.1 クリア報告時の解放付与（quest.ts）

**acknowledgeQuestReport(questId)** の拡張

- 報告受理で任務を完了扱いにする**直後**（`unlockNextQuests` と報酬付与の前後は問わないが、同一トランザクションまたは同一処理内で）次を行う。
  1. 当該 `questId` に紐づく **QuestUnlockExplorationTheme** を取得。
  2. 各 `themeId` について **UserExplorationThemeUnlock** に `(userId, themeId)` が無ければ挿入（upsert または findFirst + create。重複は無視）。
  3. 当該 `questId` に紐づく **QuestUnlockResearchGroup** を取得。
  4. 各 `researchGroupId` について **UserResearchGroupUnlock** に `(userId, researchGroupId)` が無ければ挿入。
  5. 当該任務の **unlocksMarket** が true の場合、**User.marketUnlocked** を true に更新する（spec/075）。
- 既に `reportAcknowledgedAt` が設定されている場合は何もしない（従来どおり早期 return）。

### 3.2 探索メニュー（exploration.ts）

**getExplorationMenu()**

- 返却するテーマを次の条件で**限定**する。
  - テーマが「解放済み」になる条件: **UserExplorationThemeUnlock に (userId, themeId) が存在する** または **その themeId が QuestUnlockExplorationTheme に 1 件も紐づいていない**（任務不要で初期開放）。
- 実装: 全 ExplorationTheme を取得し、当該 userId の UserExplorationThemeUnlock 一覧と、QuestUnlockExplorationTheme で「紐づく themeId の集合」を取得。各テーマについて上記条件でフィルタ。`isUnlocked: true` は上記を満たすときのみ true。
- 返却に含めないテーマは**リストから除外**する（または「？？？」表示は UI 側で行う場合は非解放テーマも返し isUnlocked: false で渡す。仕様上は「返すテーマを限定」= 除外でよい）。

### 3.3 研究メニュー（research.ts）

**getResearchMenu()**

- グループの **isAvailable** を次の条件**のみ**で判定する（前提グループは見ない）。
  - **その researchGroupId が QuestUnlockResearchGroup に 1 件も無い** または **UserResearchGroupUnlock に (userId, researchGroupId) が存在する** → true。
- 実装: ResearchGroup 取得時に QuestUnlockResearchGroup で「紐づく researchGroupId の集合」を取得し、当該 userId の UserResearchGroupUnlock 一覧を取得。各グループについて上記で isAvailable を算出。※前提グループ（prerequisiteGroupId）はスキーマから削除済み。解放は開拓任務のみ。

### 3.4 管理画面（admin.ts）

- **getAdminQuest(questId)**  
  - 返却型 **AdminQuestDetail** に `unlockThemeIds: string[]`, `unlockResearchGroupIds: string[]`, **unlocksMarket: boolean** を追加。  
  - 当該任務の QuestUnlockExplorationTheme / QuestUnlockResearchGroup から themeId / researchGroupId の配列を返す。unlocksMarket は Quest の同名フィールド。

- **updateAdminQuest(questId, input)**  
  - **UpdateAdminQuestInput** に `unlockThemeIds: string[]`, `unlockResearchGroupIds: string[]`, **unlocksMarket: boolean** を追加。  
  - 保存時: 当該 questId の QuestUnlockExplorationTheme / QuestUnlockResearchGroup を deleteMany したうえで、input の ID 配列で create する（前提の QuestPrerequisite と同様のパターン）。Quest の unlocksMarket を input の値で更新する。

- 管理画面用の**一覧取得**（既存で流用可能か確認）  
  - 探索テーマ一覧: 既存の `getAdminExplorationThemeList` 等で取得。  
  - 研究グループ一覧: 管理用に ID/名前の一覧が取得できること。無ければ `getAdminResearchGroupList` 相当を追加。

------------------------------------------------------------------------

## 4. 実装フェーズ

| Phase | 内容 | 主な変更箇所 |
|-------|------|----------------|
| **1** | スキーマ追加・マイグレーション | prisma/schema.prisma, docs/08_database_schema.md |
| **2** | 報告時の解放付与 | quest.ts: acknowledgeQuestReport 内で QuestUnlock* 取得 → User*Unlock に upsert |
| **3** | 探索メニューでテーマ制限 | exploration.ts: getExplorationMenu で UserExplorationThemeUnlock と QuestUnlockExplorationTheme を参照し、返すテーマを限定・isUnlocked を設定 |
| **4** | 研究メニューで isAvailable を任務解放のみに | research.ts: getResearchMenu で prerequisiteGroup をやめ、UserResearchGroupUnlock と QuestUnlockResearchGroup のみで isAvailable 判定 |
| **5** | 管理画面で解放先を編集可能に | admin.ts: getAdminQuest / updateAdminQuest の入出力に unlockThemeIds / unlockResearchGroupIds を追加。QuestUnlock* の deleteMany + create。admin の開拓任務編集フォームでテーマ・研究グループを複数選択して保存 |

Phase 1 のあと 2〜4 は論理的に独立しているが、2 を先に行うと「報告してもまだメニューに反映されない」だけなので、2・3・4 をまとめて実装してもよい。5 は管理側のため最後でもよい。

------------------------------------------------------------------------

## 5. 参照

- 設計メモ: docs/068_quest_unlock_themes_and_research.md
- 開拓任務: spec/054_quests.md
- 探索: spec/049_exploration
- 研究: spec/047_research_unlock_construction.md
