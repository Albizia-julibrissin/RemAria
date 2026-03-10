# 探索テーブル「1行 per ユーザー」リファクタ案

## 1. 背景・問題

- 現状: 探索開始のたびに `Expedition` に **1行 INSERT** している（`startExploration` → `prisma.expedition.create`）。
- 探索はユーザーにヘビーに回されるコンテンツであり、将来的に「100人が1日1000回」回すと **10万行/日** 級で増える。
- 行が増え続けると、インデックス効率・バックアップ・CSVエクスポート・運用コストが悪化する。

## 2. 方針: 1行を UPDATE で使い回す

- **1ユーザーあたり Expedition は最大1行** にし、同じ行を「開始時に初期化・進行中は UPDATE・終了後に再利用」する。
- 初回だけ「そのユーザー用の行がなければ CREATE」し、2回目以降は **UPDATE で上書き** する。

### 2.1 制約・前提

- MVP では **1ユーザー同時1探索** のみ（既に「進行中があれば開始拒否」の仕様）。
- 履歴・分析用に「完了した探索のサマリ」が必要な場合は、別テーブル **ExpeditionHistory** に 1行 per 完了 run を書き、本テーブルは「現在の1本」だけ持つ。

## 3. スキーマ案

### 3.1 Expedition（現行を拡張）

- **`userId` に unique 制約を追加** → 1ユーザー1行に制限。
- **`startedAt` を追加**（DateTime, nullable 可）  
  - 行を再利用するため、`createdAt` は「その行が初めて作られた日」のままになる。  
  - 「今回の探索の開始日時」は `startedAt` に格納し、開始のたびに UPDATE で上書きする。

```prisma
model Expedition {
  id        String   @id @default(cuid())
  userId    String   @unique   // 追加: 1ユーザー1行
  user      User     @relation(...)

  areaId    String
  area      ExplorationArea @relation(...)
  partyPresetId String
  partyPreset   PartyPreset @relation(...)

  state     String   @default("in_progress")  // in_progress | ready_to_finish | finished | aborted

  /// 今回の探索の開始日時。行を再利用するため、開始のたびに UPDATE で上書きする。
  startedAt DateTime?

  remainingNormalBattles Int   @default(0)
  strongEnemyCleared     Boolean @default(false)
  areaLordCleared        Boolean @default(false)
  battleWinCount         Int     @default(0)
  skillSuccessCount      Int     @default(0)
  currentHpMp            Json?
  explorationState       Json?
  totalExpGained         Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])   // unique で検索するので必須ではないが既存のまま可
  @@index([areaId])
  @@index([partyPresetId])
  @@index([state])
}
```

### 3.2 ExpeditionHistory（新規・任意）

- 完了/中断した探索の **サマリのみ** を保存するテーブル。重い `explorationState` は持たない。
- 用途: 分析・CSVエクスポート・「過去N本の結果」表示など。
- 1完了 run = 1行。こちらは増え続けてよい（行が軽い）。

```prisma
model ExpeditionHistory {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  areaId    String
  partyPresetId String

  state     String   // "finished" | "aborted"
  startedAt DateTime
  finishedAt DateTime

  battleWinCount    Int @default(0)
  skillSuccessCount Int @default(0)
  totalExpGained    Int @default(0)

  createdAt DateTime @default(now())

  @@index([userId])
  @@index([finishedAt])
}
```

- User に `expeditionHistories ExpeditionHistory[]` を追加する必要あり。

## 4. 処理フローの変更

### 4.1 探索開始（startExploration）

1. `prisma.expedition.findUnique({ where: { userId } })` でそのユーザーの行を取得。
2. **存在しない** → `prisma.expedition.create`（従来どおり初期値で 1 行作成）。`startedAt = now()`。
3. **存在する**
   - `state` が `in_progress` または `ready_to_finish` → 従来どおり「進行中があります」でエラー。
   - `state` が `finished` または `aborted` → **UPDATE** で上書き:  
     `areaId`, `partyPresetId`, `state = "in_progress"`, `remainingNormalBattles`, `strongEnemyCleared = false`, `areaLordCleared = false`, `battleWinCount = 0`, `skillSuccessCount = 0`, `currentHpMp`, `explorationState`, `totalExpGained = 0`, **`startedAt = now()`**。
4. 戻り値: 既存の `id` を使う（CREATE 時も UPDATE 時も「その1行の id」を返す）。

### 4.2 進行中・終了処理

- **進行中**（advanceExplorationStep, runExplorationBattle, finishExploration 内の update など）  
  → これまでどおり `findFirst({ where: { userId, state: in_progress | ready_to_finish } })` の代わりに、**`findUnique({ where: { userId } })`** で取得し、`state` が `in_progress` または `ready_to_finish` であることを確認してから UPDATE。  
  - 1ユーザー1行にしたことで、「どの行を更新するか」の曖昧さがなくなる。
- **終了時**（finishExploration / 報酬受け取り）  
  → 現行どおり `state = "finished"`, `totalExpGained` を UPDATE。  
  - **ExpeditionHistory を導入する場合**: このタイミングで `ExpeditionHistory` に 1 行 INSERT（userId, areaId, partyPresetId, state, startedAt, finishedAt=now(), battleWinCount, skillSuccessCount, totalExpGained）。
- **中断**（abortCurrentExpedition）  
  → `state = "aborted"` に UPDATE。必要なら同様に History に INSERT。

### 4.3 取得まわり

- 「進行中探索があるか」は `findUnique({ where: { userId } })` の結果の `state` で判定。
- `getCurrentExpeditionSummary`, `getNextExplorationStep`, `getExplorationLastBattleDisplay` など、これまで `findFirst({ where: { userId, state: ... } })` していた箇所は、**findUnique(userId) して state を確認** する形に変更。

## 5. マイグレーション

### 5.1 メンテナンス画面でユーザー操作を止める

- マイグレーション実行中は **探索・ダッシュボードなどへのアクセスを止めたい** ため、**メンテナンスモード** を使う。
- 本番（または対象環境）の環境変数に **`MAINTENANCE=1`** を設定し、アプリを再起動（または再デプロイ）する。
  - `/dashboard`, `/character`, `/battle` へのアクセスは **`/maintenance`** にリダイレクトされ、「メンテナンス中」と表示される。探索の開始・進行・報酬受け取りは行われない。
- マイグレーション（および必要なら一度きりデータ移行）を実行したあと、**`MAINTENANCE` を外す（または 0 にする）** と通常運用に戻る。

### 5.2 手順案

- **既存データ**: 現行は「1 run = 1 行」で、同一 userId で複数行あり得る。
- **手順案**:
  1. **ExpeditionHistory** を導入する場合: 既存の `state IN ('finished','aborted')` の行を **ExpeditionHistory** にコピー（サマリのみ）。必要なら `startedAt` は `createdAt` で代用。
  2. 同一 `userId` で複数行ある場合、**残す1行** を決める（例: `state IN ('in_progress','ready_to_finish')` のうち最新 1 件、なければ finished/aborted の最新 1 件）。
  3. それ以外の行は削除（または別テーブルに退避後に削除）。
  4. `userId` に unique 制約を追加し、`startedAt` カラムを追加するマイグレーションを実行。

- **ExpeditionHistory をやらない場合**: 完了済み行は削除または別バックアップに退避し、ユーザーごとに 1 行だけ残して unique を付与。

## 6. CSV エクスポート

- **現行**: `Expedition` を全件エクスポート → 行数が多くなると重い。
- **リファクタ後**:
  - **Expedition**: 「現在の1本」のみなので、進行中・完了を問わずユーザー数程度の行数。必要なら `state` 付きでエクスポート。
  - **ExpeditionHistory**: 完了 run の履歴。エクスポート用の「過去の探索一覧」はこちらから出力する。

## 7. まとめ・推奨

| 項目 | 内容 |
|------|------|
| 方針 | 1ユーザー1行で UPDATE 使い回し（初回のみ CREATE） |
| スキーマ | Expedition に `userId @unique` と `startedAt` 追加 |
| 履歴 | 必要なら ExpeditionHistory で「完了 run のサマリ」を別保存 |
| 開始処理 | findUnique(userId) → 無ければ create、あれば state を見てエラー or UPDATE |
| 進行・終了 | findUnique(userId) で行を特定し、従来どおり UPDATE |

この形にすれば、**Expedition の行数は「ユーザー数」で頭打ち**になり、100人が1日1000回回してもテーブルサイズは増えず、運用負荷を抑えられる。
