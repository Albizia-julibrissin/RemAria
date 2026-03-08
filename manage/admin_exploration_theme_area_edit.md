# 探索テーマ・エリア編集（管理者用）

ExplorationTheme と ExplorationArea の編集・新規作成。spec/049・docs/020 に基づく。

- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/exploration-themes/` と `exploration-areas/`（画面）。

---

## 1. 目的・前提

- **目的**: 探索のテーマ名・表示順、エリアの code/name・敵グループ・体数確率・強敵・領域主などを、コードを触らずに変更・追加できるようにする。
- **前提**: 対象は **テストユーザー1** でログインしている場合のみ。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **テーマ一覧** | `/dashboard/admin/exploration-themes`。テーマごとに表示順・名前・配下エリア一覧。「テーマ編集」「エリア編集」リンク、「新規テーマ」ボタン。 |
| **テーマ新規** | `/dashboard/admin/exploration-themes/new`。code / name / description / 表示順。作成後はテーマ編集画面へ。 |
| **テーマ編集** | `/dashboard/admin/exploration-themes/[id]`。テーマの基本項目編集。「配下のエリア」一覧と「新規エリア」リンク。 |
| **エリア新規** | `/dashboard/admin/exploration-areas/new`。`?themeId=xxx` でテーマ指定可。テーマ・code/name・難易度・ドロップ・技能・敵設定。作成後はエリア編集へ。 |
| **エリア編集** | `/dashboard/admin/exploration-areas/[id]`。エリアの全項目編集。**通常戦の雑魚グループ**を選択している場合、同じ画面内で「このグループのメンバー」を編集できる（出てくる敵と重みの追加・削除・保存）。ドロップテーブルは「エリアドロップ編集」リンクで別画面。 |
| **入口** | コンテンツ管理（`/dashboard/admin/content`）の「探索テーマ・エリア編集」リンク。 |

---

## 3. API（Server Actions）

いずれも `src/server/actions/admin.ts`。テストユーザー1のみ。

| 関数名 | 役割 |
|--------|------|
| `getAdminEnemyGroupCodeList()` | 敵グループの code 一覧（通常戦雑魚用ドロップダウン）。 |
| `getAdminExplorationThemeList()` | テーマ一覧（code, name, description, displayOrder, areas）。 |
| `getAdminExplorationTheme(themeId)` | テーマ1件（編集用）。 |
| `updateAdminExplorationTheme(themeId, input)` | テーマ更新。 |
| `createAdminExplorationTheme(input)` | テーマ新規。成功時 `{ success: true, themeId }`。 |
| `getAdminExplorationAreaEditData(areaId)` | エリア1件＋敵グループ code 一覧＋敵一覧（編集・新規用）。 |
| `updateAdminExplorationArea(areaId, input)` | エリア更新。 |
| `createAdminExplorationArea(input)` | エリア新規。input に themeId 必須。成功時 `{ success: true, areaId }`。 |
| `saveEnemyGroupEntries(enemyGroupId, entries)` | 通常戦雑魚グループのメンバーを一括更新。entries は `{ enemyId, weight }[]`。既存を削除して置き換え。 |

---

## 4. 編集項目

- **テーマ**: code（ユニーク）, name, description, displayOrder。
- **エリア**: code（ユニーク）, name, description, difficultyRank, recommendedLevel, baseDropMin/Max, baseSkillEventRate, skillCheckRequiredValue, normalBattleCount, normalEnemyGroupCode（EnemyGroup.code）, enemyCount1Rate / 2 / 3（合計100）, strongEnemyEnemyId, areaLordEnemyId, **areaLordAppearanceRate**（強敵勝利後の領域主出現率 0～100％）。ドロップテーブル（base/battle/skill/strongEnemy/areaLord）はエリアドロップ編集画面で設定。
- **通常戦グループのメンバー**: エリアで「通常戦 雑魚グループ」にコードを選んで保存すると、同じ画面に「このグループのメンバー」が表示される。敵を追加・削除・重み変更して「メンバーを保存」で EnemyGroupEntry を一括更新できる。

---

## 5. 運用メモ

- code の重複はテーマ・エリアそれぞれで不可。既存 code と被るとエラー。
- 体数確率（enemyCount1/2/3Rate）は 0～100 で保存時クランプ。合計100でなくても保存は通る（バランスは運用で調整）。
- 強敵・領域主は Enemy を1体ずつ指定。未設定の場合は null。
