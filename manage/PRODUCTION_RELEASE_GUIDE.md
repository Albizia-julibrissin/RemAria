# 本番リリースの考え方・考慮点

**目的**: 本番環境へちゃんとリリースできるように、「テーブル変更」「マスタ投入」「アカウントデータの安全」「アプリ公開」を一通り整理する。  
手順のチェックリストは [RELEASE.md](./RELEASE.md)、デプロイ先の選び方は [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md) を参照。

**基本方針（リリースのやり方）**: 本番 DB に触れる手順（バックアップ・マイグレーション・マスタ同期など）は **Cursor に各手順を依頼して実行してもらう**。運用者側では **manage/production.env** に本番の `DATABASE_URL` を用意しておき、Cursor はこのファイルを参照してコマンドを実行する（production.env は .gitignore 済みでリポジトリに含まれない）。詳細は [§9. Cursor に本番リリースの各手順を依頼する](#9-cursor-に本番リリースの各手順を依頼する標準のやり方) を参照。

---

## 1. 全体の整理（何がシンプルで何に注意するか）

| 項目 | やること | 注意点 |
|------|----------|--------|
| **アプリの公開** | コードを push（または Railway CLI で `railway up`）→ デプロイ先がビルド・デプロイ | **一番シンプル**。環境変数だけ本番用にしておく。 |
| **テーブル変更** | 開発で `prisma migrate dev` → 本番で `prisma migrate deploy` | 本番 DB に対して**手動で 1 回**実行する必要がある。 |
| **マスタデータ** | 正本は「ローカルで管理画面で編集した DB」→ 本番へは初回は復元、以降は**マスタ同期**（`db:sync-masters`）または管理画面で編集 | **本番に既存ユーザーがいる状態でバックアップ復元はしない**（全上書きのため）。 |
| **アカウントデータ** | マイグレーションは DDL のみで既存データは原則触らない。一度きりスクリプトは対象環境を確認して実行 | 復元は「DB 全体の差し替え」なので本番では新規セットアップ時以外使わない。 |

---

## 2. テーブル変更（マイグレーション）

### 開発側

- `prisma/schema.prisma` を編集する。
- **`npm run db:migrate`**（= `prisma migrate dev`）でマイグレーションを作成・適用する。
  - `prisma/migrations/` に SQL が記録される。これが**正本**。
- このマイグレーション履歴を **Git に commit** する（本番で同じ履歴を使う）。

### 本番側

- スキーマを変更したリリースのときだけ、**本番 DB に対して**マイグレーションを実行する。
- コマンド: **`npm run db:migrate:deploy`**（= `prisma migrate deploy`）。
  - 実行場所: Railway の Shell で実行するか、ローカルで **本番の `DATABASE_URL` を一時的に設定**してから実行する。
- **実行タイミング**: デプロイ（push）の**前でも後でもよい**が、**新しいコードが新しいスキーマを前提にしている場合は、先に migrate deploy してからデプロイ**するのが安全。
  - 例: 新カラムを参照するコードをデプロイする → 先に本番で `prisma migrate deploy` を実行してから push。

### アカウントデータへの影響

- `prisma migrate deploy` は **DDL のみ**（CREATE TABLE, ALTER TABLE ADD COLUMN など）。
- 既存のユーザー・キャラ・所持品などの**データは原則として触らない**。
- カラム追加で `DEFAULT` を付ければ既存行にも値が入る。削除・リネームはマイグレーション内容次第なので、破壊的変更のときは事前に doc 化する（[DB_OPERATIONS.md §6](./DB_OPERATIONS.md#6-一度きりのデータ移行本番など) の一度きりスクリプトと同様）。

---

## 3. マスタデータの「正本」と本番への反映

### 正本はどこか

- **「ローカル DB で管理画面を使って編集した結果」が正本**である、という運用でよい。
- マスタはシードでは投入しない。管理画面で編集し、**バックアップ**でその状態を保存する（[BACKUP_RESTORE.md](./BACKUP_RESTORE.md)）。

### 本番への反映のパターン

| 状況 | やり方 |
|------|--------|
| **初回リリース（本番 DB が空）** | ローカルで `npm run db:backup` → その .dump を本番に **`npm run db:restore -- --target "本番のDATABASE_URL"`** で復元する。これでマスタ＋（バックアップに含んでいれば）テスト用ユーザーまで本番に入る。 |
| **本番にすでにユーザーがいる** | **バックアップ復元は使わない**（全テーブル上書きでアカウントデータが消える）。マスタの追加・修正は **マスタ同期（`db:sync-masters`）** でローカルで編集した内容をそのまま本番に反映する（推奨）。手作業で本番の管理画面から編集する方法もあるが、時間がかかり再現ミスも起きやすい。 |
| **別環境（例: ステージング）を「今のローカル」に揃えたい** | ローカルでバックアップ → その環境の DB を復元先に指定して `db:restore`。その環境に重要なアカウントデータがなければ復元してよい。 |

### マスタ同期（本番にユーザーがいる場合）

ローカルで管理画面から編集したマスタを、**ユーザー・キャラ・所持品などには一切触れず**本番に反映する。

- **コマンド**: `npm run db:sync-masters`
- **前提**: 環境変数で **ソース（ローカルなど）** と **ターゲット（本番）** を指定する。
  - `SOURCE_DATABASE_URL` … 編集済みマスタが入っている DB（未設定時は `DATABASE_URL` を使用）
  - `TARGET_DATABASE_URL` … 反映先の本番 DB（**必須**。ここに既存ユーザーがいる）
- **実行例**（ローカルから本番へ同期する場合）:
  ```bash
  set SOURCE_DATABASE_URL=postgresql://remaria:remaria_dev@localhost:5432/remaria
  set TARGET_DATABASE_URL=postgresql://user:pass@host:5432/railway
  npm run db:sync-masters
  ```
  （PowerShell では `$env:SOURCE_DATABASE_URL="..."; $env:TARGET_DATABASE_URL="..."`）
- **挙動**: マスタテーブルだけを「ソースの行」で **id をキーに upsert** する。既存のユーザーデータが参照しているマスタ id はそのまま維持されるので、アカウントデータへの影響はない。新規マスタ行の追加・既存マスタの内容更新が本番に反映される。
- **注意**: ソースとターゲットで**同じマイグレーションが適用済み**（スキーマが一致している）こと。本番で未適用のマイグレーションがある場合は先に `npm run db:migrate:deploy` を実行してから同期する。
- **マイグレーションでマスタ系テーブルを追加・削除した場合**: `prisma/sync-masters-to-target.ts` の **MASTER_DELEGATES_IN_ORDER** を更新する（新規マスタは依存順で追加、削除したマスタは一覧から削除）。

### 運用の整理

- **初回**: マイグレーション → バックアップ復元でマスタ（＋必要ならテストユーザー）を本番に入れる。
- **2 回目以降のマスタ更新**:  
  - **マスタ同期（`db:sync-masters`）** でローカルで編集した内容を本番に一括反映する（手作業の再入力やミスを防げる）。  
  - 小さい修正だけなら本番の管理画面で直接編集してもよい。
- ローカルで「これが正」という状態になったら `npm run db:backup` で .dump を残し、初回セットアップや別環境の再構築・マスタ同期の「ソース」として使う。

---

## 4. トランザクション・アカウントデータを守る考え方

### マイグレーション（migrate deploy）

- スキーマ変更のみ。既存データは**基本的に触らない**（ALTER でカラム追加など）。
- 本番で実行する前に、**どのマイグレーションが適用されるか**をローカルで確認しておくとよい（`prisma migrate status` を本番 URL で実行するなど）。

### 一度きりのデータ移行スクリプト

- 例: `npm run db:migrate:bump-industrial`（[DB_OPERATIONS.md §6](./DB_OPERATIONS.md#6-一度きりのデータ移行本番など)）。
- **対象**: `.env` の `DATABASE_URL` が**本番を指しているか**必ず確認する。
- **回数**: 複数回実行すると加算され続けるので、**1 回だけ**実行する前提で運用する。
- 同様のスクリプトを追加する場合は、対象テーブル・影響範囲・実行回数を doc に明記する。

### バックアップ復元（db:restore）

- **全テーブルを DROP してから復元**するため、**復元先の既存データはすべて消える**。
- 本番で「マスタだけ更新したい」という目的では**使わない**。本番で restore するのは**初回セットアップ時のみ**とする。

### アプリ側のトランザクション

- Server Action やリポジトリで `prisma.$transaction()` を使っている箇所は、1 リクエスト内の整合性を守るためのもの。リリース手順とは別のレイヤー。
- 本番リリース時に「トランザクション範囲」で気にすることは、**マイグレーションや復元を「誰が・いつ・どの環境に」実行するか**を決めておくこと。

---

## 5. アプリの公開（デプロイ）

- **やること**: コードを push する（GitHub 連携なら push で自動ビルド・デプロイ）。GitHub を使わない場合は Railway CLI の `railway up` など。
- デプロイ先の手順は [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) や [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md) を参照。
- 本番の環境変数（`NODE_ENV`, `SESSION_SECRET`, `DATABASE_URL`）が正しく設定されていることを確認する。

---

## 6. DB に関わるときの「念のためバックアップ」

**アプリのコードだけのデプロイ**なら、DB は触らないのでバックアップは必須ではない（ぽんぽん投げてよい）。

**マイグレーションやマスタ同期など、本番 DB に手を入れるとき**は、作業前に**念のためバックアップを取っておく**と安心。

### Railway の機能

- **Volume バックアップ**: Railway の Postgres は Volume を使っているため、**PostgreSQL サービス**の **Settings → Backups** で以下ができる。
  - **手動バックアップ**: 作業前に「Create backup」でその時点のスナップショットを取得できる。
  - **スケジュール**: Daily / Weekly / Monthly を設定しておくと、自動でバックアップが残る（保持日数はスケジュールによる）。
  - **復元（戻す）**: Backups タブで日時を選んで **Restore** を押すと、その時点の Volume に戻る。復元後はステージングされるので、問題なければ Deploy で反映。
- **注意**: 復元すると「その時点より新しいバックアップ」は消える。同じプロジェクト・同じ環境内でのみ復元可能。

### 手動で pg_dump を取る方法

- 本番の `DATABASE_URL` を一時的に指定して **`npm run db:backup`** を実行し、`manage/backups/remaria_YYYYMMDD_HHmmss.dump` をローカルに残す。
  - 例: `set DATABASE_URL=本番の接続URL` のうえで `npm run db:backup`（本番の .env を上書きしないよう、その場だけの環境変数で）。
- メリット: ローカルに .dump が残るので、Railway とは別の「戻し」の選択肢になる。別環境へ復元して検証するときにも使える。

### 運用の目安

| リリースの内容 | バックアップ |
|----------------|----------------|
| コードだけ（push でデプロイ） | 必須ではない |
| マイグレーション実行 | 事前に Railway で手動バックアップ または pg_dump を推奨 |
| マスタ同期（db:sync-masters） | 同上 |

---

## 7. リリース時の実行順序（推奨）

**基本は [§9](#9-cursor-に本番リリースの各手順を依頼する標準のやり方) のとおり、Cursor に各手順を依頼する。** 運用者側は `manage/production.env` に本番の DATABASE_URL を用意し、「念のためバックアップ取って」「マイグレーション実行して」などと依頼する。

上記を Cursor に依頼しない場合の手順の目安は以下のとおり。

1. **リリース前**
   - [RELEASE.md](./RELEASE.md) のチェックリストを実施（lint / build / セキュリティ・DB の確認）。
   - **DB に手を入れる場合**: 上記「6. 念のためバックアップ」を実施（Railway の手動バックアップ or pg_dump）。本番 DB に対して実行するコマンドは **manage/production.env の DATABASE_URL を読み込んで** 実行する。
   - スキーマ変更がある場合: 本番 DB に対して **`npm run db:migrate:deploy`** を実行（production.env を読み込んだうえで）。
   - **初回セットアップの場合のみ**: マスタ用バックアップを本番に **`npm run db:restore -- --target "（production.env の DATABASE_URL）"`** で復元。
   - **本番にすでにユーザーがいる場合でマスタを更新するとき**: **`npm run db:sync-masters`** を実行（SOURCE＝ローカル .env、TARGET＝production.env の DATABASE_URL）。

2. **デプロイ**
   - push（または `railway up`）でアプリをデプロイ。

3. **リリース後**
   - トップ・ログイン・主要画面が開けるか確認。

---

## 8. spec/063 作戦スロット・プリセット別保持のリリース時

063 をリリースする際は「**プリセットデータ（作戦・必要に応じてプリセット一覧）は飛ぶが、アカウントデータには影響しない**」ことを守る。

### 8.1 影響範囲の整理

| 対象 | リリース時の扱い | 備考 |
|------|------------------|------|
| **アカウントデータ**（User, Character, 所持品・通貨・クエスト進捗・施設・探索状態 等） | **一切触らない** | マイグレーションでも一度きりスクリプトでも変更・削除しない。 |
| **TacticSlot** | マイグレーションで **DROP** | 作戦の「旧保存先」。削除すると既存の作戦設定は消える（ユーザには事前に「作戦は作り直し」と案内済み想定）。 |
| **PresetTacticSlot** | マイグレーションで **CREATE** | 作戦の新保存先。既存データの移行は行わない。 |
| **PartyPreset** | **削除しない** | プリセット名・編成枠は残す。作戦だけが空になる。 |

### 8.2 マイグレーションで行うこと・行わないこと

- **行うこと**: PresetTacticSlot テーブルの追加。TacticSlot テーブルの DROP。
- **行わないこと**: User / Character / PartyPreset / その他アカウント・マスタ系テーブルの DROP や TRUNCATE、データの消去。マイグレーションは **DDL で上記 2 テーブルだけ**を対象にする。

### 8.3 リリース前の確認

1. **マイグレーション SQL の確認**: 追加されるマイグレーションに、User / Character 等を触る文が含まれていないことを確認する。
2. **ユーザへの案内**: 「作戦はリセットされますが、アカウント・キャラ・所持品・プリセット一覧には影響しません」と伝えていることを確認する。

### 8.4 実行順序（063 リリース時）

1. 上記 8.3 の確認を実施。
2. **バックアップ**: 本番 DB に手を入れるため、[§6 念のためバックアップ](#6-db-に関わるときの念のためバックアップ) を実施。
3. **マイグレーション**: 本番で `npm run db:migrate:deploy` を実行（PresetTacticSlot 追加 ＋ TacticSlot 削除、および User.partyPresetLimit の追加）。これだけでは User / Character / PartyPreset のデータは変更されない（既存 User 行に partyPresetLimit=5 が入るだけ）。
4. **デプロイ**: コードを push してアプリをデプロイ。
5. **リリース後**: 既存ユーザでログインし、キャラ・所持品・プリセット名・編成がそのままであること、および作戦がリセットされていることを確認する。

---

## 9. Cursor に本番リリースの各手順を依頼する（標準のやり方）

本番 DB に触れる作業（バックアップ・マイグレーション・マスタ同期・復元の --target など）は **基本、Cursor に各手順を依頼する**。本番の接続情報は **manage/production.env** に用意しておき、Cursor はこのファイルを参照してコマンドを実行する（production.env は .gitignore 済みでリポジトリに含まれない）。

### 9.1 運用者側で用意するもの

- **manage/production.env**  
  - 中身: `DATABASE_URL=postgresql://user:password@host:port/database`（本番の実際の URL）の 1 行でよい。  
  - 初回は `manage/production.env.example` をコピーして `production.env` を作成し、`DATABASE_URL=` に本番の値を記入する。  
  - このファイルは **.gitignore に含まれており、Git にコミットされない**。

### 9.2 依頼のしかた（運用者 → Cursor）

次のように「〇〇して」と依頼すればよい。Cursor は **manage/production.env を読み込んだうえで** 該当コマンドを実行する。

| 依頼内容 | Cursor が行うこと |
|----------|-------------------|
| （DB に手を入れる前に）**念のためバックアップ取って** | `manage/production.env` の DATABASE_URL を読み込み、その環境変数で `npm run db:backup` を実行。出力は manage/backups/ に保存される。 |
| **本番にマイグレーション実行して** | `manage/production.env` を読み込み、その環境変数で `npm run db:migrate:deploy` を実行。 |
| **本番にマスタ同期して** | ソースはローカル（.env の DATABASE_URL）、ターゲットは `manage/production.env` の DATABASE_URL として `npm run db:sync-masters` を実行（SOURCE_DATABASE_URL は未設定で .env を使用、TARGET_DATABASE_URL に production.env の値を渡す）。 |
| **本番にバックアップを復元して**（初回セットアップ時のみ） | `npm run db:restore -- --target "（production.env の DATABASE_URL）"` を実行（復元元の .dump は指定または直近を使用）。 |
| **push してデプロイして** | コードを push する（デプロイは Railway 等が自動で行う）。 |

### 9.3 Cursor 側の実行手順（参照用）

リリース関連の依頼を受けたら、次を守って実行する。

1. **manage/production.env の確認**  
   ファイルが存在し、`DATABASE_URL=` が設定されていることを確認する。存在しない・未設定の場合は「manage/production.env に本番の DATABASE_URL を記入してください」と依頼者に伝える。
2. **本番 DB に対するコマンド実行時**  
   そのターミナルで **production.env の内容を環境変数に読み込んでから** コマンドを実行する。  
   - 例（PowerShell）:  
     `Get-Content manage/production.env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process') } }; npm run db:migrate:deploy`  
   - または production.env の `DATABASE_URL=` の行をコピーし、`$env:DATABASE_URL="（値）"` を設定してから `npm run db:migrate:deploy` などを実行する。
3. **マスタ同期の場合**  
   SOURCE はローカル（.env の DATABASE_URL でよい）、TARGET は **production.env の DATABASE_URL** を `TARGET_DATABASE_URL` に渡して `npm run db:sync-masters` を実行する。
4. **デプロイ**  
   「push してデプロイして」と依頼された場合は、git push を実行する。デプロイ先のビルド・反映は自動で行われる。

---

## 参照

| 内容 | 参照先 |
|------|--------|
| チェックリスト・リリース手順 | [RELEASE.md](./RELEASE.md) |
| デプロイ先の選び方 | [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md) |
| Railway での手順 | [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) |
| DB 起動・マイグレーション・シード・一度きりスクリプト | [DB_OPERATIONS.md](./DB_OPERATIONS.md) |
| バックアップ・復元（マスタの正本） | [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) |
| マスタ編集の全体像 | [admin_master_edit_overview.md](./admin_master_edit_overview.md) |
| 063 作戦スロット・プリセット別保持のリリース（アカウントデータ保護） | 上記 §8 |
| Cursor に本番リリースを依頼するとき（production.env 参照） | 上記 §9 |
