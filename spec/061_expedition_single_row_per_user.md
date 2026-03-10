## 0. 依存・横断

### 0.1 依存する spec

- `049_exploration.md` 探索全体の仕様（Expedition テーブル定義・状態遷移の元仕様）
- `010_auth.md` 認証・セッション（ログイン済みユーザーの前提）

### 0.2 提供する API / 利用者

- この spec は主に「探索まわりの Server Action / Repository 実装」が参照する。
- 外部から直接呼び出される API ではなく、既存の探索機能の内部仕様変更（「1 run = 1 行」→「1ユーザー = 1 行」）を定義する。

------------------------------------------------------------------------

## 1. 目的

- `Expedition` テーブルの行数増加を抑え、運用（バックアップ・CSV エクスポート・インデックス）の負荷を下げるために、**「1 ユーザー 1 行」モデル**に変更する。
- 探索開始時に毎回行を INSERT するのではなく、**ユーザーごとの 1 行を UPDATE で再利用する**方式にリファクタリングする。
- 必要な場合、完了済み探索の履歴は軽量な `ExpeditionHistory` に保持し、分析や履歴表示と分担する。

------------------------------------------------------------------------

## 2. 用語

- Expedition: 探索の進行状態を保持するテーブル。**この spec では「各ユーザーについて現在の 1 本だけを保持するテーブル」として扱う。**
- ExpeditionHistory: 完了/中断した探索 run のサマリのみを保持する履歴テーブル。1 run = 1 行。
- run: 「探索開始から終了/中断まで」の 1 単位。従来は 1 run = `Expedition` 1 行だった。

------------------------------------------------------------------------

## 3. 入力（Input）

この spec は特定の 1 API のみを定義するものではなく、探索開始〜進行〜終了の一連の処理の前提を変更するものである。
主要な利用ケースの入力は以下のとおり。

### 3.1 探索開始（startExploration）

- `userId: string`（ログイン中ユーザー）
- `areaId: string`（探索エリア）
- `partyPresetId: string`（編成プリセット）
- その他、探索開始時に必要なパラメータ（`spec/049_exploration.md` に準拠）

### 3.2 進行系（advanceExplorationStep, runExplorationBattle 等）

- `userId: string`
- 呼び出しごとに必要な入力（コマンド・選択肢等）は `spec/049_exploration.md` に準拠。ただし **「どの Expedition 行を対象とするか」は userId から一意に決まる**。

### 3.3 終了系（finishExploration, 報酬受け取り, abortCurrentExpedition）

- `userId: string`
- 必要に応じて、報酬選択や UI 状態に対応した入力（詳細は既存 spec/049 に従う）。

------------------------------------------------------------------------

## 4. 出力（Output）

この spec 自体は新しい API を追加せず、既存の探索関連の Server Action の出力形式も原則維持する。
ただし、**内部的に参照する Expedition 行が「1 ユーザー 1 行」に固定される**ため、以下の点が前提となる。

- 「現在の探索サマリ」を返す系の API は、`userId` から `Expedition` 行を 1 件だけ取得して組み立てる。
- 「履歴一覧」を返したい場合は `ExpeditionHistory` を参照する（本 spec で導入する場合）。

------------------------------------------------------------------------

## 5. ルール

### 5.1 共通前提

- MVP の仕様として、**1 ユーザー同時 1 探索**のみをサポートする。
- `Expedition` テーブルは **「各ユーザーの現在の探索状態を 1 行だけ保持するテーブル」**とし、同一 `userId` で複数行を持たない。
- 完了/中断済み run の履歴を保持したい場合は、本 spec で定義する `ExpeditionHistory` を使用する。

### 5.2 Expedition テーブル（1 ユーザー 1 行モデル）

- `Expedition.userId` は **必ず 1 ユーザー 1 行**に制限する。Prisma レベルでは `@unique` 制約を付与する。
- `Expedition` モデルに `startedAt: DateTime?` を追加する。
  - 「今回の探索 run の開始日時」を表す。
  - 行は再利用するため、`createdAt` は「この行が初めて作られた日時」のまま固定される。
  - 探索開始のたびに `startedAt = now()` に UPDATE する。
- 従来 `state` によって区別していた「どの run を対象とするか」は、`userId` 一意制約により「対象行 = そのユーザーの 1 行」に簡略化する。

#### 5.2.1 Expedition の状態

- `state` には以下を利用する（従来仕様と同じ意味を保つ）。
  - `"in_progress"`: 探索進行中。
  - `"ready_to_finish"`: 終了待ち（報酬確認など）。
  - `"finished"`: 終了済み（報酬受け取り可能 or 済）。
  - `"aborted"`: 中断済み。
- `Expedition` の行を再利用する場合でも、**終了/中断時点では必ず `state` を `"finished"` または `"aborted"` に設定**してから次の run を開始する。

### 5.3 ExpeditionHistory テーブル（任意だが推奨）

必要に応じて、以下の仕様で `ExpeditionHistory` テーブルを導入する。

- 行粒度: `1 run = 1 行`。
- 保持情報（サマリのみとし、重い JSON 状態は保持しない）:
  - `userId: string`
  - `areaId: string`
  - `partyPresetId: string`
  - `state: "finished" | "aborted"`
  - `startedAt: DateTime`（Expedition.startedAt のコピー／既存データ移行時は Expedition.createdAt で代用可）
  - `finishedAt: DateTime`
  - `battleWinCount: Int`
  - `skillSuccessCount: Int`
  - `totalExpGained: Int`
- インデックス方針:
  - `@@index([userId])`
  - `@@index([finishedAt])`（日時順での分析や一覧表示を想定）
- `User` モデルには `expeditionHistories ExpeditionHistory[]` を追加する。

### 5.4 Server Action / Repository の仕様変更

#### 5.4.1 探索開始（startExploration）

1. `prisma.expedition.findUnique({ where: { userId } })` で、そのユーザーの行を 1 件だけ取得する。
2. 行が **存在しない場合**:
   - 従来どおり、初期値で 1 行 `create` する。
   - このとき、`state = "in_progress"`, カウンタ/フラグ類の初期化, `startedAt = now()` を設定する。
3. 行が **存在する場合**:
   - `state in ("in_progress", "ready_to_finish")` の場合:
     - 現行どおり、「進行中の探索があります」としてエラーを返し、新しい探索は開始しない。
   - `state in ("finished", "aborted")` の場合:
     - **再利用 UPDATE** を行う。
     - 以下のフィールドを、今回の探索開始パラメータに応じて上書き/初期化する。
       - `areaId`, `partyPresetId`
       - `state = "in_progress"`
       - `remainingNormalBattles`（仕様に沿った初期値）
       - `strongEnemyCleared = false`
       - `areaLordCleared = false`
       - `battleWinCount = 0`
       - `skillSuccessCount = 0`
       - `currentHpMp`（開始時点の HP/MP 状態）
       - `explorationState`（開始時点の探索状態）
       - `totalExpGained = 0`
       - `startedAt = now()`
4. 戻り値は、`create` 時も `update` 時も **同じ行の `id`** とし、既存の呼び出し側がそのまま利用できるようにする。

#### 5.4.2 進行系（advanceExplorationStep, runExplorationBattle など）

- これまで `findFirst({ where: { userId, state: in_progress | ready_to_finish } })` 等で「進行中行」を取得していた処理は、すべて以下の形に統一する。
  - `expedition = prisma.expedition.findUnique({ where: { userId } })`
  - 取得結果が存在し、かつ `expedition.state in ("in_progress", "ready_to_finish")` であることを確認する。
  - 条件を満たさない場合は、仕様に応じてエラーまたは「進行中探索なし」扱いとする。
- 探索中のステップ進行・戦闘実行・内部カウンタの更新は、従来どおり `Expedition` の 1 行に対して UPDATE する。

#### 5.4.3 終了系（finishExploration / 報酬受け取り）

- `userId` から `Expedition` 1 行を取得し、`state in ("in_progress", "ready_to_finish")` を確認する。
- 探索終了時には、少なくとも以下を UPDATE する。
  - `state = "finished"`
  - `totalExpGained`（合計獲得経験値）
  - その他、従来仕様で終了時に確定する値
- `ExpeditionHistory` を導入する場合、終了時に 1 行 INSERT する。
  - `userId, areaId, partyPresetId, state = "finished", startedAt, finishedAt = now(), battleWinCount, skillSuccessCount, totalExpGained`

#### 5.4.4 中断系（abortCurrentExpedition）

- `userId` から `Expedition` 1 行を取得し、`state = "in_progress"` または `"ready_to_finish"` の場合に中断可能とする。
- 中断時には、`state = "aborted"` に UPDATE する。
- 必要に応じて、`ExpeditionHistory` に `state = "aborted"` として INSERT する。

#### 5.4.5 参照系（サマリ・表示用）

- 「現在の探索があるか」の判定やサマリ取得は、`userId` から 1 行取得した結果と `state` で行う。
  - 例: `state in ("in_progress", "ready_to_finish")` であれば「進行中探索あり」とみなす。
- 表示用ヘルパー（例: `getCurrentExpeditionSummary`, `getNextExplorationStep`, `getExplorationLastBattleDisplay` 等）は、`findUnique({ userId })` を前提に実装する。

### 5.5 CSV エクスポート / 分析

- `Expedition` テーブルは「現在の 1 本」を保持するため、行数は概ね「ユーザー数」と同程度になる。
- `ExpeditionHistory` を導入した場合、「過去の探索一覧」「分析用集計」は原則として `ExpeditionHistory` から取得する。
- 既存の CSV エクスポート処理は、以下を目安に参照先を決める。
  - 「現在の状態」や「進行中も含めた最新の状態」を出したい → `Expedition`
  - 「完了済みの履歴一覧」を出したい → `ExpeditionHistory`

------------------------------------------------------------------------

## 6. 処理フロー（概要）

### 6.1 探索開始

1. 認証済み `userId` を取得する（`010_auth.md` 参照）。
2. `Expedition` を `findUnique({ userId })` で取得する。
3. 行がなければ初期値で `create` し、`startedAt = now()`, `state = "in_progress"` とする。
4. 行があり `state in ("in_progress", "ready_to_finish")` ならエラー（既存仕様どおり）。
5. 行があり `state in ("finished", "aborted")` なら、今回の探索パラメータでフィールドを初期化する UPDATE を行い、`startedAt = now()`, `state = "in_progress"` とする。
6. この 1 行の `id` を返し、以降の進行処理はこの `id` を前提とした既存仕様どおりに動く。

### 6.2 進行ステップ

1. `userId` から `Expedition` 1 行を取得する。
2. `state in ("in_progress", "ready_to_finish")` を確認する。
3. ステップ実行・戦闘実行ロジック（`spec/049_exploration.md` 準拠）に従い、`remainingNormalBattles` や `explorationState` などを UPDATE する。
4. `state` が終了条件を満たした場合は `"ready_to_finish"` へ遷移させる。

### 6.3 終了・中断

1. `userId` から `Expedition` 1 行を取得する。
2. 終了時は `state = "finished"` に、 中断時は `state = "aborted"` に更新する。
3. 必要に応じて `ExpeditionHistory` に 1 行 INSERT する。
4. 報酬受け取りやクエスト進行など、従来の終了時処理を行う。

------------------------------------------------------------------------

## 7. 永続化データ / 一時データ

### 7.1 永続化するデータ

- `Expedition`:
  - 各ユーザーについて「現在の 1 本」のみを保持する。
  - run ごとの詳細な進行状態（`explorationState` や `currentHpMp` 等）は従来どおり `Expedition` に保存する。
- `ExpeditionHistory`（導入する場合）:
  - 完了/中断した run のサマリ（件数が多くなっても軽量であることを前提）。

### 7.2 保存しないデータ

- 探索中の一時的な計算状態で、`Expedition` または `ExpeditionHistory` に不要なものは保存しない。
- 詳細は `docs/04_persistence_principles.md` に従う。

------------------------------------------------------------------------

## 8. 例（最低3ケース）

### ケース1：進行中探索がなく、新規に開始する

- 前提:
  - ユーザー A に対応する `Expedition` 行が存在しない。
- 入力:
  - `startExploration(userId = A, areaId = "AREA_1", partyPresetId = "PRESET_1")`
- 期待結果:
  - `Expedition` に新しい 1 行が作成される。
  - `userId = A`, `areaId = "AREA_1"`, `partyPresetId = "PRESET_1"`, `state = "in_progress"`, `startedAt = now()`。
  - 以降の進行処理はこの 1 行のみを対象とする。

### ケース2：終了解除後に同じユーザーが再度探索開始

- 前提:
  - ユーザー A の `Expedition` 行が 1 行存在し、`state = "finished"`。
  - その行には以前の探索の `areaId`, `partyPresetId`, カウンタ類が残っている。
- 入力:
  - `startExploration(userId = A, areaId = "AREA_2", partyPresetId = "PRESET_2")`
- 期待結果:
  - 既存の 1 行に対して UPDATE が行われる（新規 CREATE はされない）。
  - `areaId = "AREA_2"`, `partyPresetId = "PRESET_2"`, `state = "in_progress"`, 各種カウンタリセット, `startedAt` が現在時刻に更新される。

### ケース3：進行中の探索がある状態で開始を試みる

- 前提:
  - ユーザー A の `Expedition` 行が 1 行存在し、`state = "in_progress"`。
- 入力:
  - `startExploration(userId = A, areaId = "AREA_3", partyPresetId = "PRESET_3")`
- 期待結果:
  - 新規の探索開始は拒否される。
  - エラー内容は従来どおり「進行中の探索があります」（文言は実装側で定義）。
  - `Expedition` 行は変更されない（`state` も変わらない）。

------------------------------------------------------------------------

## 9. エラー条件 / NG

- `userId` に対応する `Expedition` 行が存在しないにもかかわらず、進行/終了/中断系 API を呼び出した場合:
  - 実装方針に応じて「探索なし」扱い or エラーを返すが、**サーバーエラーではなく想定内のエラーとして扱う**。
- `state` が `"finished"` または `"aborted"` にもかかわらず進行系 API を呼び出した場合:
  - 探索が終了/中断済みである旨を返し、状態を変更しない。
- `userId` に対して複数行の `Expedition` が存在する状態は、本 spec では NG 状態（データ不整合）とみなす。
  - マイグレーション時に必ず解消する（10 章参照）。

------------------------------------------------------------------------

## 10. テスト観点

- 1 ユーザー 1 行の制約が守られていること（複数回の開始/終了を繰り返しても行数が増えない）。
- `state` に応じて開始/進行/終了/中断が正しく制御されること。
- `ExpeditionHistory` を導入した場合:
  - 終了/中断ごとに 1 行ずつ記録されること。
  - `startedAt` と `finishedAt` の関係が正しいこと。
- 既存の探索機能（進行表示、戦闘、報酬、クエスト連携など）が新モデルでも同じように動作すること。

------------------------------------------------------------------------

## 11. 画面仕様

- 本 spec は主にバックエンド（Server Action / Repository）側の仕様変更であり、UI 仕様の変更は伴わない。
- ただし、将来的に「探索履歴一覧」などの画面を追加する場合は、`ExpeditionHistory` を参照することを前提とする。

------------------------------------------------------------------------

## 12. 実装フェーズ（段階的な作業分解）

この章では、「spec ベースで実装に落とし込むときのフェーズ分け」を定義する。  
実装時は、基本的に **フェーズ番号順** に進める。

### フェーズ 1: Prisma スキーマ定義の更新

- 対象:
  - `prisma/schema.prisma`
  - `docs/08_database_schema.md`
- 作業内容:
  - `Expedition` モデルに `startedAt: DateTime?` を追加する。
  - `Expedition.userId` に `@unique` 制約を付与する（マイグレーション時に一意となる前提で定義）。
  - `ExpeditionHistory` モデルを、本 spec の 5.3 の内容に従って追加する（導入する場合）。
  - `User` モデルに `expeditionHistories ExpeditionHistory[]` のリレーションを追加する。
- 成果物:
  - Prisma スキーマが「1 ユーザー 1 行モデル」と `ExpeditionHistory`（任意）の定義に対応する。
  - `docs/08_database_schema.md` にも同等の構造が反映されている。

### フェーズ 2: Server Action / Repository のリファクタ

- 対象（例）:
  - `src/server/actions/exploration.ts`（探索開始・進行・終了・中断）
  - 探索状態を参照している Repository / Lib 関数
- 作業内容:
  - `startExploration` を 5.4.1 の仕様に従って実装/修正する。
    - `findFirst({ userId, state: ... })` などを廃止し、`findUnique({ userId })` ＋ `state` 判定に置き換える。
    - 行が存在しない場合の `create` と、存在する場合の「再利用 UPDATE」を実装する。
  - 進行系（`advanceExplorationStep`, `runExplorationBattle` 等）を 5.4.2 に従って `findUnique({ userId })` 前提の取得に変更する。
  - 終了系（`finishExploration` / 報酬受け取り）を 5.4.3 に従って修正し、必要に応じて `ExpeditionHistory.create` を追加する。
  - 中断系（`abortCurrentExpedition`）を 5.4.4 に従って修正し、必要に応じて `ExpeditionHistory.create` を追加する。
  - サマリ表示系（`getCurrentExpeditionSummary`, `getNextExplorationStep`, `getExplorationLastBattleDisplay` など）を 5.4.5 に従って `findUnique({ userId })` 前提に変更する。
- 成果物:
  - アプリケーションコードが「1 ユーザー 1 行モデル」に対応し、ローカル環境の新規 DB では問題なく動作する状態になる。

### フェーズ 3: 既存データ移行ロジック（スクリプト）作成

- 対象:
  - `manage/` 配下（例: `manage/scripts/`）に新規スクリプトを追加
  - 既存の `Expedition` データ
- 作業内容:
  - 本番/ステージング DB 上の既存 `Expedition` 行を「1 ユーザー 1 行」ルールに整形する一度きりの移行スクリプトを実装する。
  - 5.3, 5.5, 9 のルールに従い、以下の処理を行う:
    - `state in ("finished","aborted")` の行を `ExpeditionHistory` に INSERT する（導入する場合。`startedAt` が無ければ `createdAt` を利用）。
    - 同一 `userId` で複数行ある場合に、「残す 1 行」を決定するロジックを実装する。
      - 優先度の一例:
        1. `state in ("in_progress","ready_to_finish")` の最新 1 件
        2. 無ければ `state in ("finished","aborted")` の最新 1 件
    - 残さない行は削除するか、必要に応じて一時テーブルに退避してから削除する。
- 成果物:
  - 実行後に、`Expedition` において **各 `userId` につき 1 行だけ** が残る状態を作れる移行スクリプト。

### フェーズ 4: Prisma マイグレーション（制約の有効化）

- 対象:
  - Prisma マイグレーションファイル
- 作業内容:
  - フェーズ 3 の移行スクリプトでデータが整備された前提で、以下を行うマイグレーションを用意する。
    - `Expedition.userId` に `@unique` 制約を付与する。
    - `Expedition.startedAt` カラムを追加する（まだ追加していない場合）。
    - `ExpeditionHistory` テーブルを作成する（導入する場合）。
  - ローカル環境でマイグレーションを実行し、フェーズ 2 のコードと併せてテストする。
- 成果物:
  - 本番環境でも `Expedition.userId` の重複が発生しないよう、DB レベルで制約が有効になった状態。

### フェーズ 5: 運用手順・メンテナンスモード連携

- 対象:
  - `manage/OPERATIONAL_LOGS.md`
  - `manage/PRODUCTION_RELEASE_GUIDE.md`
- 作業内容:
  - 本番/ステージングでの適用手順をドキュメント化する。
    - 例:
      1. 対象環境の `MAINTENANCE=1` を設定し、アプリを再起動（または再デプロイ）する。
      2. 探索・ダッシュボードなどのユーザー操作が止まっていることを確認する。
      3. フェーズ 3 で作成した移行スクリプトを実行する。
      4. Prisma マイグレーション（フェーズ 4）を実行する。
      5. 必要であれば簡易的な検証（レコード件数・代表ユーザーでの探索開始/進行）が通ることを確認する。
      6. `MAINTENANCE` を外して再起動し、通常運用に戻す。
  - 実行コマンド例（`npm run` 等）や、失敗時のロールバック方針（バックアップからの復元手順）も記載する。
- 成果物:
  - 将来の運用担当者が、この spec に従って「1 ユーザー 1 行モデル」へ安全に移行できるチェックリスト。

