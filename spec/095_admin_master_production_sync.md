# Spec: 管理画面「本番マスタ更新」

`manage/admin_master_production_sync_design.md` に基づく。**管理画面から、選択したマスタだけを本番 DB に同期する**機能を定義する。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：セッション有効。本画面は**管理用アカウント（ADMIN_EMAIL）のみ**表示・実行可能。
- **データモデル**：`prisma/schema.prisma` のマスタ系モデル。同期対象一覧は **MASTER_DELEGATES_IN_ORDER**（1 箇所）で管理する。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|------------|
| getMasterSyncCandidates() | 同期対象マスタ一覧とソース DB の件数を返す。画面表示用。 | 本画面 |
| syncMastersToProduction(selectedDelegates, confirmationPhrase) | 選択したマスタを本番 DB に upsert する。 | 本画面 |
| createProductionBackup() | 本番 DB（TARGET_DATABASE_URL）の pg_dump を実行し、manage/backups/ に保存する。成功時はファイル名を返し、ダウンロード用 URL を案内する。 | 本画面 |

------------------------------------------------------------------------

## 1. 目的

- マスタの本番反映を、CLI（`db:sync-masters`）に頼らず、**管理画面から「選択したマスタだけ・厳重確認のうえ」で実行**できるようにする。
- 運用者は管理画面を開き、**画面で本番の接続 URL を入力**（一過性・どこにも保存されない）し、本番に流したいマスタを選んで確認文言を入力したうえで実行する。

------------------------------------------------------------------------

## 2. 用語

- **ソース DB**：このアプリが現在接続している DB（`DATABASE_URL`）。編集済みマスタが入っている想定。
- **ターゲット DB（本番）**：**画面で入力する**本番の接続 URL。一過性で、どこにも保存されない（環境変数やファイルには書かない）。既存ユーザーがいる本番環境を想定。
- **delegate 名**：Prisma のモデル名を camelCase にしたもの（例: `facilityType`, `craftRecipe`）。同期対象一覧 **MASTER_DELEGATES_IN_ORDER** に並ぶ名前。
- **確認文言**：実行前にユーザーが入力する必須文字列。誤操作防止のため、指定文字列と一致しないと実行ボタンを有効にしない。

### 2.1 「マスタの DB」の判断について

アプリは「どれがマスタの DB か」を別フラグでは持っていない。**この画面の文脈では役割で決まる**：

- **ソース**（`DATABASE_URL`）＝ このアプリが今接続している DB ＝ マスタを編集している側（通常はローカル）。同期時は「ここから本番へ流す元」。
- **ターゲット**（画面入力の接続 URL）＝ 本番。同期先であり、**本番のバックアップ取得対象**でもある。

したがって「本番のバックアップ」＝ **画面で入力したターゲット URL** に対して pg_dump を実行する、と判断できる。マスタ編集元（ソース）のバックアップは既存の `npm run db:backup`（DATABASE_URL 対象）で取得する。

------------------------------------------------------------------------

## 3. 環境・前提条件

### 3.1 実行環境

- **本番の接続先**：**画面で入力する**。環境変数やファイルには書かず、この操作でのみ使用する（一過性）。入力された URL が postgresql:// 形式で、かつソース（`DATABASE_URL`）と異なる場合にのみ一覧取得・バックアップ・同期を許可する。
- **有効になる条件**：画面で本番の接続 URL を入力し「一覧を取得」で検証に通ること。サーバ側でソース≠ターゲットをチェックする。
- **無効時**：未入力・形式不正・ソースと同一の場合はエラーメッセージを表示し、一覧・実行は行わない。

### 3.2 スキーマ

- ソースとターゲットで**同じマイグレーションが適用済み**（スキーマが一致している）こと。未適用の場合は先に本番で `npm run db:migrate:deploy` を実行する。

------------------------------------------------------------------------

## 4. 入力・出力

### 4.1 getMasterSyncCandidates（画面用一覧取得）

**入力**：`targetDatabaseUrl: string | null`（画面で入力した本番の接続 URL。一過性で保存されない）。

**出力**：

```ts
{
  available: boolean;           // 入力 URL が有効かつソース≠ターゲット
  message?: string;             // available が false のときの説明文
  candidates?: Array<{
    delegateName: string;       // 例: "facilityType"
    displayLabel?: string;      // 日本語ラベル（任意。未実装時は delegateName を表示）
    sourceCount: number;       // ソース DB の該当テーブル件数
  }>;
}
```

- `candidates` の並び順は **MASTER_DELEGATES_IN_ORDER** に準拠する。
- 件数はソース DB の `prisma[delegateName].findMany()` の length とする。

### 4.2 syncMastersToProduction（同期実行）

**入力**：

```ts
{
  selectedDelegates: string[];  // 同期する delegate 名の配列。MASTER_DELEGATES_IN_ORDER の部分集合であること
  confirmationPhrase: string;   // 確認文言。一致しないと実行しない
  targetDatabaseUrl: string;    // 画面で入力した本番の接続 URL（一過性）
}
```

**出力（成功時）**：

```ts
{
  ok: true;
  results: Array<{
    delegateName: string;
    upserted: number;
  }>;
}
```

**出力（確認文言不一致）**：

```ts
{ ok: false; error: "CONFIRMATION_PHRASE_MISMATCH"; message: string; }
```

**出力（一部テーブルで失敗）**：

```ts
{
  ok: false;
  error: "SYNC_PARTIAL_FAILURE";
  message: string;
  results: Array<{ delegateName: string; upserted: number }>;  // 成功した分まで
  failedAt: string;   // 失敗した delegate 名
  failureMessage: string;
}
```

**出力（実行不可・その他エラー）**：

```ts
{ ok: false; error: string; message: string; }
```

### 4.3 createProductionBackup（本番バックアップ取得）

**入力**：`targetDatabaseUrl: string`（画面で入力した本番の接続 URL。一過性）。

**出力（成功時）**：

```ts
{
  ok: true;
  filename: string;   // 例: "remaria_production_20260315_123456.dump"
  path: string;       // ダウンロード用パス。例: "/api/admin/backup-download?file=remaria_production_20260315_123456.dump"
}
```

**出力（失敗時）**：

```ts
{ ok: false; error: string; message: string; }
```

- バックアップファイルは **manage/backups/remaria_production_YYYYMMDD_HHmmss.dump** に保存する。既存の `prisma/db-backup.ts` と同様、pg_dump を child_process 等で実行する。接続先は **画面で入力した targetDatabaseUrl** のみを使う（DATABASE_URL は使わない）。
- ダウンロードは **GET /api/admin/backup-download?file=ファイル名** で行う。認可は管理用アカウントのみ。ファイル名は **remaria_production_*.dump** に限定し、パストラバーサルを防ぐ。

------------------------------------------------------------------------

## 5. ルール

### 5.1 確認文言

- **正解文字列**：`本番に反映する`（固定。将来、環境変数で上書き可能にしてもよい）。
- 入力がこれと完全一致する場合のみ実行を許可する。前後空白は trim して比較する。
- 一致しない場合は **CONFIRMATION_PHRASE_MISMATCH** を返し、DB には一切書き込まない。

### 5.2 同期対象の選択

- `selectedDelegates` は **MASTER_DELEGATES_IN_ORDER** に含まれる名前のみ許可する。含まれない名前が混ざっている場合は 400 相当のエラーとする。
- 実行時は、**MASTER_DELEGATES_IN_ORDER の順序**のうち、選択された delegate だけをその順で処理する（依存順を崩さない）。
- `dropTable` の特別扱い（1 回目は areaId を null で同期し、後で fixDropTableAreaId で areaId を反映）は、既存の `sync-masters-to-target` と同様に共通ロジックで行う。

### 5.3 同期処理

- ソースは `DATABASE_URL`（このアプリの接続先）、ターゲットは `TARGET_DATABASE_URL`。
- 各テーブルごとに、ソースの全行を id をキーにターゲットへ **upsert** する。ユーザー・キャラ・所持品等は触らない。
- **失敗時**：ある delegate の処理中に例外が発生したら、**その時点で処理を打ち切り**、それまでの成功結果（results）と、失敗した delegate 名・エラーメッセージを返す。部分的なロールバックは行わない（既に upsert された行はそのまま）。

### 5.4 認可

- 本画面の表示・getMasterSyncCandidates・syncMastersToProduction・createProductionBackup・バックアップダウンロード API のいずれも、**管理用アカウント（ADMIN_EMAIL で指定されたユーザー）のみ**許可する。それ以外は 403 とする。

### 5.5 本番バックアップ取得

- **対象 DB**：本番 ＝ **画面で入力した接続 URL**。マスタ編集元（ソース）ではない。
- **実行条件**：画面で入力された URL が有効で、ソース≠ターゲットであること（同期と同一）。未入力・不正時はエラーを返す。
- **保存先**：`manage/backups/remaria_production_YYYYMMDD_HHmmss.dump`。ファイル名は固定プレフィックスとタイムスタンプのみとし、他環境のバックアップ（remaria_*.dump）と区別する。
- **pg_dump**：既存の db-backup.ts と同様にカスタム形式（-Fc）で出力する。接続先が localhost でないため、通常はホストの pg_dump を使う（Docker は本番 URL には使わない）。

------------------------------------------------------------------------

## 6. 処理フロー（概要）

### 6.1 getMasterSyncCandidates

1. セッション確認。管理者でなければ 403。
2. `TARGET_DATABASE_URL` が未設定、またはソース＝ターゲットなら、`available: false` とメッセージを返す。
3. MASTER_DELEGATES_IN_ORDER を参照し、各 delegate についてソース DB の件数を取得。
4. `available: true` と `candidates` を返す。

### 6.2 syncMastersToProduction

1. セッション確認。管理者でなければ 403。
2. `TARGET_DATABASE_URL` が未設定、またはソース＝ターゲットならエラー。
3. `confirmationPhrase` を trim し、正解文字列と比較。不一致なら CONFIRMATION_PHRASE_MISMATCH を返す。
4. `selectedDelegates` の要素がすべて MASTER_DELEGATES_IN_ORDER に含まれるか検証。含まれないものがあればエラー。
5. MASTER_DELEGATES_IN_ORDER の順で、選択された delegate のみループし、各テーブルを upsert。dropTable は既存ロジックどおり areaId の二段階処理を行う。
6. 途中で例外が出たら打ち切り、成功分と失敗情報を返す。全成功なら `ok: true` と results を返す。

### 6.3 createProductionBackup

1. セッション確認。管理者でなければ 403。
2. TARGET_DATABASE_URL が未設定、またはソース＝ターゲットならエラー。
3. manage/backups を存在しなければ作成。
4. TARGET_DATABASE_URL に対して pg_dump（-Fc）を実行し、remaria_production_YYYYMMDD_HHmmss.dump に保存。
5. 成功時は filename とダウンロード用 path（クエリで file= にファイル名）を返す。

### 6.4 バックアップダウンロード（GET /api/admin/backup-download）

1. セッション確認。管理者でなければ 403。
2. クエリ `file` を検証：remaria_production_ で始まり .dump で終わるファイル名のみ許可。パス区切り（../）を含む場合は 400。
3. manage/backups/ とファイル名を結合した実パスが manage/backups 配下に収まることを確認し、該当ファイルをストリームで返す。存在しなければ 404。

------------------------------------------------------------------------

## 7. 永続化データ / 一時データ

### 7.1 永続化するデータ

- **ターゲット DB**：選択されたマスタテーブルの行を upsert する。id をキーに create/update するため、既存のユーザーデータが参照するマスタ id は維持される。
- **本番バックアップ**：createProductionBackup 実行時、manage/backups/ に .dump ファイルが 1 件作成される。永続化はファイルシステムのみ。削除は手動または別運用とする。
- **監査ログ**：本 spec では「誰がいつどのマスタを同期したか」「誰がいつ本番バックアップを取得したか」の DB 保存は**対象外**とする。実行結果は画面表示で留め、必要なら将来、OperationalLog 等に記録する拡張を検討する。

### 7.2 保存しないデータ

- ソースの件数・選択状態・確認文言はリクエストごとの入力であり、永続化しない。

------------------------------------------------------------------------

## 8. 画面仕様

| 項目 | 内容 |
|------|------|
| **URL** | `/dashboard/admin/master-production-sync` |
| **前提** | 010_auth のセッション有効。管理用アカウントのみ表示（それ以外は 403 または管理メニューに表示しない）。 |
| **要素** | （1）**本番 DB の接続 URL を入力する欄**（一過性・保存されない旨を表示）。入力後「一覧を取得」で getMasterSyncCandidates(targetDatabaseUrl) を呼ぶ。無効時はメッセージを表示し、以下を出さない。（2）有効時：注意文「本番 DB に直接書き込みます。対象マスタは上書きされます。」を表示。（3）**「本番のバックアップを取得」**ボタン。押下で createProductionBackup(targetDatabaseUrl) を呼び、成功時は返却された path でダウンロードを開始する。（4）マスタ一覧（MASTER_DELEGATES_IN_ORDER 順）をチェックボックスと delegate 名・ソース件数で表示。「全選択」「全解除」があるとよい。（5）「実行」ボタン押下でモーダルを表示し、確認文言入力欄と「本番に反映する」の説明を表示。入力が一致するまで実行ボタンを無効にする。（6）実行後、結果（各テーブルごとの upsert 件数、またはエラー内容）を画面に表示する。 |
| **呼び出す API** | getMasterSyncCandidates（初期表示）、createProductionBackup（本番バックアップ取得）、syncMastersToProduction（同期実行時）。ダウンロードは GET /api/admin/backup-download?file=... を開く。 |
| **成功時** | 結果エリアに「〇〇: N 件」の一覧を表示。 |
| **エラー時** | 確認文言不一致・部分失敗・その他をメッセージで表示。 |

------------------------------------------------------------------------

## 9. エラー条件 / NG

| 条件 | 挙動 |
|------|------|
| 非管理者アクセス | 403。画面自体も管理メニューに出さない（または出しても 403）。 |
| 本番 URL 未入力・形式不正 | 画面でメッセージを表示。一覧取得・同期・バックアップ API はエラーを返す。 |
| ソース＝ターゲット | 入力 URL が DATABASE_URL と同一の場合はエラー。同期 API は呼ばせない。 |
| 確認文言不一致 | CONFIRMATION_PHRASE_MISMATCH。DB には一切書き込まない。 |
| selectedDelegates に不正な名前 | 400 相当。処理しない。 |
| 同期中の DB エラー | そのテーブルで打ち切り、SYNC_PARTIAL_FAILURE と成功分・失敗情報を返す。 |
| 本番バックアップ時の pg_dump 失敗 | createProductionBackup が ok: false とメッセージを返す。TARGET_DATABASE_URL への接続不可・ホストに pg_dump がない等。 |
| ダウンロードの file が不正 | ファイル名が remaria_production_*.dump でない、またはパストラバーサル含む場合は 400。該当ファイルが存在しない場合は 404。 |

------------------------------------------------------------------------

## 10. 実装上の拘束（共通化）

- **同期ロジックの正本は 1 箇所**とする。`prisma/sync-masters-to-target.ts` の「MASTER_DELEGATES_IN_ORDER ＋ テーブルごと upsert ＋ dropTable の areaId 処理」を、**CLI と Server Action の両方から参照できる共通モジュール**に切り出す（例: `src/server/lib/sync-masters-to-target.ts` または `src/lib/sync-masters.ts`）。
- **MASTER_DELEGATES_IN_ORDER** はその共通モジュール（またはそこから参照する 1 ファイル）にのみ定義し、マイグレーションでマスタテーブルを追加・削除したときは**ここだけ**更新する。CLI の `db:sync-masters` は「全選択」でこのモジュールを呼ぶ形にする。
- 日本語ラベル（displayLabel）は、同じモジュールまたは定数ファイルに「delegate 名 → 表示名」のマッピングを用意するとよい。初版では delegate 名のみ表示でもよい。

------------------------------------------------------------------------

## 11. ドキュメント更新

- 実装後、**manage/PRODUCTION_RELEASE_GUIDE.md** の「マスタ同期」に、「管理画面からも実行可能（ローカルで TARGET_DATABASE_URL を設定した場合）。画面は /dashboard/admin/master-production-sync。」と追記する。
- **manage/DB_OPERATIONS.md** の 4.1 節に、同旨の一文を追加する。

------------------------------------------------------------------------

## 12. テスト観点

- 管理者以外がアクセスすると 403 になること。
- 本番 URL を画面で入力する一過性であること。未入力・不正時は実行不可であること。
- 確認文言が一致しないとき、syncMastersToProduction が DB に書き込まずエラーを返すこと。
- 選択した delegate のみ、MASTER_DELEGATES_IN_ORDER の順で同期されること。
- 途中で失敗した場合、それまでの成功結果と失敗情報が返ること。
- CLI の `db:sync-masters` と、共通モジュール経由で同じ結果になること（全選択時）。
- 本番バックアップ取得で、TARGET_DATABASE_URL に対してのみ pg_dump が実行され、remaria_production_*.dump が保存されること。ダウンロード API は管理者のみ・ファイル名制限で安全であること。
