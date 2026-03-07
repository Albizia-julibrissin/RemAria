# 050: エネミーマスター（敵マスタ・作戦・選出）

探索・戦闘で使う**敵**をマスタで定義し、エリアに紐づけた敵グループ／ボスから**1～3体を選出**して、**体ごとに作戦スロット・デフォルト配置**を持たせる仕様。

---

## 0. 現状

- 戦闘は `runBattleWithParty(partyInput, enemyBase, enemyPositions, ..., enemyTacticSlots, enemySkills, ...)` で実行。
- 敵は**全員同じ** `enemyBase`・`enemyTacticSlots`・`enemySkills` を共有（default-enemy のスライム固定）。
- `ExplorationArea` に `normalEnemyGroupCode` / `strongEnemyEnemyGroupCode` / `areaLordEnemyGroupCode` の**コードのみ**があり、実体のマスタは未整備。

---

## 1. 目的

- **敵の種類（エネミーマスター）**を DB で定義し、**作戦スロット・使用スキル・デフォルト配置**を敵種ごとに持たせる。
- **通常戦**はエリアの**雑魚用グループ**から 1～3 体を**エリアごとの確率**で選出。**未使用枠は出さない**（1体なら1体だけ、2体なら2体だけ戦闘に登場）。
- **強敵戦・領域主戦**はエリアに紐づいた**その1体が確定**で出現。さらに**体数 1～3 の抽選**に応じて、1＝その1体のみ／2＝その1体＋雑魚1体／3＝その1体＋雑魚2体。雑魚は通常戦用グループから選ぶ。
- 選出された**1体ごと**に、その敵種の base・作戦スロット・スキル・デフォルト配置を渡して戦闘する。

---

## 2. 用語

| 用語 | 説明 |
|------|------|
| **敵種（Enemy）** | 1種類の敵のマスタ。名前・アイコン・基礎ステータス・デフォルト配置・作戦スロット（最大10件）・使用可能スキル（Skill 参照）を持つ。 |
| **敵グループ（EnemyGroup）** | 雑魚用。複数敵種をまとめたセット。重み付きで抽選する。エリアの通常戦で参照。 |
| **選出** | 戦闘開始時、戦闘種別に応じて「体数 1～3」を抽選し、通常戦ならその数だけグループから選出。強敵/領域主戦ならその1体＋(体数−1) 体を雑魚グループから選出。同じ敵種が複数選ばれてもよい。 |

---

## 3. データモデル

### 3.1 敵種（Enemy）

- **Enemy**
  - `id`, `code`（一意・安定参照用）, `name`, `iconFilename?`, `description?`
  - 基礎ステータス: `STR`, `INT`, `VIT`, `WIS`, `DEX`, `AGI`, `LUK`, `CAP`（Character と同様）
  - **デフォルト配置**: `defaultBattleRow`（1～3）, `defaultBattleCol`（1～3）。**探索戦闘では使用しない**（探索では選出順で上から固定配置。§4.3）。練習戦闘など他コンテキストで参照する場合は利用可。
- **EnemyTacticSlot**: 敵種ごとに最大10件。**主語・条件・行動の仕様は spec/039（作戦室）の TacticSlot と同一。** 実装では `src/app/dashboard/tactics/tactics-constants.ts` の選択肢を共有し、敵マスタ編集画面（`/dashboard/admin/enemies`）で編集する。作戦スロット関連のアップデート（条件種別追加・主語追加など）は spec/039 と本 spec の両方に影響しうる。まとめは `docs/14_tactics_slot_shared.md` を参照。
  - `enemyId`, `orderIndex`, `subject`, `conditionKind`, `conditionParam`, `actionType`, `skillId`
- **使用スキル**: **Skill を共有**。敵専用スキル（前進突撃など）も既存 `Skill`（category=battle_active）に登録し、敵種は「使えるスキル」の紐づけだけ持つ。
  - **EnemySkill**: `enemyId`, `skillId`（Skill への FK）。同一敵種で同じスキルは1行。

### 3.2 敵グループ（雑魚用）

- **EnemyGroup**
  - `id`, `code`（一意）。例: `normal_forest_road`
- **EnemyGroupEntry**
  - `enemyGroupId`, `enemyId`, `weight`（整数。抽選時の重み。省略時は 1）
  - 同一グループ内で同じ敵種は1行。

### 3.3 エリアとの紐づけ

- **ExplorationArea**
  - **通常戦**: `normalEnemyGroupCode` → `EnemyGroup.code` で参照。体数 1～3 は**エリアごとの確率**で決定。
    - `enemyCount1Rate`, `enemyCount2Rate`, `enemyCount3Rate`（0～100の整数、合計100）。例: 20, 50, 30 → 1体20%、2体50%、3体30%。
  - **強敵**（旧・中ボス）: `strongEnemyEnemyId`（Enemy への FK）。その戦闘では**必ずこの1体が出現**。体数 2・3 のときは残りを雑魚グループから選出。
  - **領域主**（旧・大ボス）: `areaLordEnemyId`（Enemy への FK）。同様に必ず1体出現。体数 2・3 のときは雑魚を追加。
  - ※ 従来の `strongEnemyEnemyGroupCode` / `areaLordEnemyGroupCode` は廃止し、強敵・領域主はエリアに1体ずつ直接紐づけ。

---

## 4. 戦闘開始時の選出ルール

### 4.1 体数の抽選

- **通常戦**: エリアの `enemyCount1Rate` / `enemyCount2Rate` / `enemyCount3Rate` で 1～3 を抽選 → その数だけ `normalEnemyGroupCode` のグループから重み付きランダムで敵種を選ぶ。
- **強敵戦**: 同じくエリアの体数確率で 1～3 を抽選。
  - 1 → 出撃するのは **強敵1体のみ**（`strongEnemyEnemyId`）。
  - 2 → **強敵1体 ＋ 雑魚1体**（雑魚は normalEnemyGroup から重み付き抽選）。
  - 3 → **強敵1体 ＋ 雑魚2体**。
- **領域主戦**: 同様。1 → 領域主のみ。2 → 領域主＋雑魚1。3 → 領域主＋雑魚2。

### 4.2 未使用枠

- **出さない**。抽選で 2 体なら、戦闘に登場する敵は 2 体だけ（3枠のうち1枠を HP0 で埋めるのではなく、配列長そのものを 2 にする）。

### 4.3 配置（探索戦闘：上から埋まる）

- **探索戦闘**では、選出された順に **スロット index 0, 1, 2** を割り当て、**選出順で上から固定位置に並べる**（敵種のデフォルト配置は使わない）。
  - 1体目（index 0）→ 上段：`(row: 1, col: 2)`
  - 2体目（index 1）→ 中段：`(row: 2, col: 2)`
  - 3体目（index 2）→ 下段：`(row: 3, col: 2)`
- これにより、同じ敵種が複数選ばれても被らず、体数に応じて上から順に埋まる。
- 敵マスタの **`defaultBattleRow` / `defaultBattleCol`** は、探索戦闘の配置には用いない。練習戦闘など別コンテキストで「敵の初期位置」を参照する場合は利用してよい。

### 4.4 戦闘 API への渡し方

- 選出結果を **体ごと** の配列で組み立て: 各要素に `base`, `tacticSlots`, `skills`, `displayName`, `iconFilename`, `position: { row, col }` を持たせる。長さは 1～3。
- **探索戦闘**では `position` は選出順で上から固定（§4.3）とする。index 0 → (1,2)、index 1 → (2,2)、index 2 → (3,2)。
- `runBattleWithParty` は「敵を体ごとの入力＋位置の配列」で受け取り、未使用枠は作らない。

---

## 5. 戦闘 API の変更

- **現状**: 敵は常に3体・同一 base/tacticSlots/skills。`enemyPositions` は長さ3固定。
- **変更**: 敵を「体ごとの入力」で渡す。
  - `enemyInputs: { base, tacticSlots, skills, displayName?, iconFilename?, defaultPosition: { row, col } }[]`（長さ 1～3）
  - 戦闘内部では「敵の数 = enemyInputs.length」とし、3枠固定のロジックを「敵数に応じたループ」に変更。未使用枠は作らない（敵2体なら enemyAlive も長さ2など）。

---

## 6. スキル参照（確定）

- **共有**。敵も既存 `Skill` + `SkillEffect` を参照。敵専用スキル（前進突撃など）は Skill に `category=battle_active` で登録し、EnemySkill（enemyId, skillId）で「この敵はこのスキルを使用可能」と紐づける。

---

## 7. 次のステップ

1. Prisma スキーマに `Enemy`, `EnemyTacticSlot`, `EnemySkill`, `EnemyGroup`, `EnemyGroupEntry` を追加。`ExplorationArea` に `enemyCount1Rate` / `enemyCount2Rate` / `enemyCount3Rate`、`strongEnemyEnemyId`、`areaLordEnemyId` を追加（既存の強敵/領域主グループコードは削除または移行）。
2. Seed: スライム1種（前進突撃スキル・作戦・デフォルト配置）、通常戦用グループ1つ、遊覧舗装路跡のエリアに紐づけ。強敵・領域主用の敵種とエリア紐づけは必要なら追加。
3. 探索の戦闘開始処理で「戦闘種別 → 体数抽選 → 強敵/領域主確定＋雑魚選出 → 体ごとに base/tacticSlots/skills/position を組み立て → runBattleWithParty に渡す」を実装。
4. `runBattleWithParty` を「敵を体ごと・長さ 1～3」で受け取る形に拡張。既存の練習戦闘は default-enemy 固定のまま互換を保つ。
