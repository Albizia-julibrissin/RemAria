# DB バックアップ・復元

マスタやプレイデータは**管理画面・アプリで編集**する。シードでマスタを投入しない方針のため、**今の DB をバックアップし、必要時に復元する**運用にする。

---

## 0. シードとバックアップの役割（ずれないようにする考え方）

**「みんな基本シード」ではない。** 多くのプロジェクトでは次のように役割を分ける。

| 役割 | 中身 | 正本（ずれたら困るもの） |
|------|------|---------------------------|
| **シード** | テスト用ユーザー・主人公・仲間・通貨など「ログインして触るための最小セット」。マスタ（アイテム・敵・スキル・ドロップなど）は**入れない**。 | コード（`prisma/seed.ts`）。「空の DB に最低限を入れる」だけ。 |
| **バックアップ** | 管理画面で編集したマスタや、プレイで溜まったデータを**そのまま**保存した .dump。 | **バックアップファイル**。ここが「今の状態」の正本。 |

- **シードとローカルで触った結果がずれる**のは、シードにマスタを入れてしまっているか、「編集結果をシードに反映しようとしている」から起こりやすい。
- **RemAria の考え方**: 「編集した結果」は**シードに戻さない**。**バックアップを取って、それを正本にする**。別環境や本番には「マイグレーション → バックアップ復元」で揃える。シードは「復元したあと、テスト用ユーザーだけ足したいとき」にだけ使う（または復元にテストユーザーも含めておけばシード不要）。
- 運用のイメージ: **ローカルで触る → よくなったら `npm run db:backup` → その .dump を「いまの正本」として保管・共有・本番復元**。シードは「ゼロから立ち上げたときのログイン用」と割り切ると扱いやすい。

---

## 1. いつ使うか

| 目的 | 手順 |
|------|------|
| 編集済み DB を保存したい | バックアップを取る（タイムスタンプ付きファイルで残す） |
| 別 PC・別環境で同じ DB を使いたい | バックアップをコピーしてその環境で復元する |
| 新規 DB を「今の本番に近い状態」にしたい | マイグレーション後にバックアップを復元する |
| 開発でやり直したい | 空の DB にバックアップを復元する |

---

## 2. 前提

- **PostgreSQL のクライアント**（`pg_dump`, `pg_restore`）が使えること。  
  - Docker で DB だけ動かしている場合: ホストに PostgreSQL を入れるか、`docker compose exec db pg_dump ...` でコンテナ内のコマンドを使う。
- 接続情報は `.env` の `DATABASE_URL`。バックアップ・復元スクリプトはこれを参照する。
- **ローカル（localhost）でバックアップ・復元するとき**: スクリプトは **Docker (remaria-db) の pg_dump / pg_restore を優先**する。これにより「バックアップ時はホストの pg_dump、復元時は Docker の pg_restore」のように実行元が混在し、Postgres のダンプ形式バージョン違いで `unsupported version (1.16) in file header` が出る事態を防ぐ。

### 2.1 バージョンを確実に確認したいとき

**互換ルール（確実）**: **pg_restore は「同じか新しい」pg_dump で作ったダンプしか読めない。**

- 例: **ホストの pg_dump 18 でバックアップ** → ダンプ形式は 18 用。**Docker の pg_restore 16 では復元できない**（16 は 18 の形式を読めない）。
- 逆: Docker の pg_dump 16 でバックアップ → Docker の pg_restore 16 で復元はできる。

**確認コマンド**: いまどのバージョンが使われるかは次のコマンドで確認できる。

```bash
npm run db:check-versions
```

- ホストの `pg_dump` / `pg_restore` のバージョンと、Docker (remaria-db) 内のバージョンが表示される。
- **ローカルでバックアップ・復元するとき**: 接続先が localhost ならスクリプトは **Docker を優先**するので、新規に取るバックアップは「Docker の Postgres のバージョン」で揃い、同じ Docker で復元できる。
- **すでにホストの 18 で取ったダンプがある場合**: そのダンプを復元するには **ホストの pg_restore 18** を使う必要がある。復元時に Docker を先に試すと 16 で失敗するが、スクリプトは続けてホストの pg_restore を試すので、ホストに 18 が入っていれば復元は成功する。

### 2.2 Railway（本番）の Postgres バージョンを確認する

Railway のダッシュボードには「Postgres のメジャーバージョン」がサービス名の横や設定に出る場合もあるが、**確実に知る方法**は次のとおり。

**接続して SQL で確認する**

`manage/production.env` に本番の `DATABASE_URL` が書いてある前提で、ローカルから:

```powershell
# PowerShell（production.env の DATABASE_URL を 1 行で取得して実行）
$url = (Get-Content manage\production.env | Where-Object { $_ -match '^DATABASE_URL=' }) -replace 'DATABASE_URL=','' -replace '"',''
psql $url -c "SELECT version();"
```

- 出力に `PostgreSQL 16.x` や `PostgreSQL 18.x` のようにバージョンが含まれる。
- Railway のテンプレートは **デフォルトで 16** を使うことが多いが、**17** など別バージョンになっている場合もある（上記コマンドで確認）。

**補足**:  
- ダンプを「読む」のは手元の **pg_restore** なので、本番が 17 でも「18 形式のダンプを手元の pg_restore 18 で本番 17 に復元する」はできる。  
- 本番に復元するときは、使うダンプの形式を手元の pg_restore が読めるかだけ気にすればよい（本番のサーバーバージョンが 17 だから復元できない、にはならない）。

---

## 3. バックアップ

### 手順（推奨）

```bash
npm run db:backup
```

- 出力先: `manage/backups/remaria_YYYYMMDD_HHmmss.dump`
- フォルダが無ければ自動作成する。
- 形式: PostgreSQL のカスタム形式（`-Fc`）。圧縮され、`pg_restore` で復元する想定。

### 手動で取りたい場合

```bash
# カスタム形式（推奨・圧縮）
pg_dump "$DATABASE_URL" -Fc -f manage/backups/remaria_manual.dump

# プレーンテキスト（見たり編集したりしたいとき）
pg_dump "$DATABASE_URL" > manage/backups/remaria_manual.sql
```

Windows のコマンドプロンプトでは `set DATABASE_URL=...` で環境変数を設定してから実行する。

---

## 4. 復元

**注意**: 復元先の DB は**既存データがすべて上書き**される。必要な場合は先にバックアップを取っておく。

### 手順（推奨）

```bash
# 直近のバックアップ（manage/backups/ 内で一番新しい .dump）を復元
npm run db:restore

# 特定ファイルを指定して復元
npm run db:restore -- manage/backups/remaria_20250101_120000.dump
```

- 復元前に **DB を空にする**ため、既存の全テーブルを `DROP` してから `pg_restore` する。
- マイグレーション履歴（`_prisma_migrations`）も消える。  
  - 復元後は「スキーマはバックアップ時点の状態」になる。  
  - その後 `prisma migrate deploy` や `prisma db push` は、必要に応じて運用方針に合わせて使う。

### 手動で復元したい場合（カスタム形式 .dump）

```bash
# 1. 接続して DB を空にする（例: 全テーブル DROP）
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 2. 復元
pg_restore -d "$DATABASE_URL" --no-owner --no-privileges manage/backups/remaria_YYYYMMDD_HHmmss.dump
```

### 手動で復元したい場合（プレーン .sql）

```bash
psql "$DATABASE_URL" < manage/backups/remaria_manual.sql
```

---

## 5. 別 DB に復元する（上書きしない）

今の DB はそのままにして、バックアップを**別のデータベース**に復元して試したいときに使う。

### 手順

**1. 別のデータベースを作る**

同じ PostgreSQL サーバー（例: Docker の remaria-db）に新しい DB を作成する。

```bash
# Docker の場合（コンテナ名は remaria-db）
docker exec remaria-db psql -U remaria -d postgres -c "CREATE DATABASE remaria_restore;"
```

**2. その DB を指定して復元する**

```bash
# 直近のバックアップを remaria_restore に復元
npm run db:restore -- --target "postgresql://remaria:remaria_dev@localhost:5432/remaria_restore"

# 使うバックアップファイルを指定する場合
npm run db:restore -- --target "postgresql://remaria:remaria_dev@localhost:5432/remaria_restore" manage/backups/remaria_20260308_095246.dump
```

- `--target` に渡すのは「復元先の DB の接続 URL」。
- `.env` の `DATABASE_URL`（今の DB）は変更されない。復元は `--target` で指定した DB だけに行われる。
- アプリで復元先を試すときは、一時的に `.env` の `DATABASE_URL` を `postgresql://remaria:remaria_dev@localhost:5432/remaria_restore` に変えて起動すればよい。

---

## 6. Railway（本番）にバックアップを復元する

Railway の Postgres を「バックアップの内容」で上書きしたいときの手順。**ローカルの .env は触らず、復元先だけ Railway の DB に指定する。**

### 前提

- **復元元**: `manage/backups/` にある `.dump` ファイル（例: ローカルや別環境で取ったバックアップ）。
- **復元先**: Railway の Postgres。接続 URL は Railway のダッシュボードで確認する（Postgres サービス → **Variables** → `DATABASE_URL` または `DATABASE_URI`。RemAria の Variables で参照している名前と一致する方をコピーする）。
- **ローカルに PostgreSQL クライアント**（`psql`, `pg_restore`）が入っていること。  
  - Windows で入っていない場合は [PostgreSQL の公式インストーラ](https://www.postgresql.org/download/windows/) で「Command Line Tools」を入れるか、WSL や Docker で `postgres` イメージを使って実行する。

### 手順

**1. Railway の Postgres の接続 URL をコピーする**

- Railway のプロジェクト → **Postgres** サービス → **Variables**。
- `DATABASE_URL` または `DATABASE_URI` の**値**をコピーする（`postgresql://...` で始まる文字列）。  
  - パスワードなどが含まれるので、他人に見られないようにする。

**2. 復元先の DB をいったん空にする**

Railway の DB にすでにテーブルがあると `pg_restore` で競合することがあるため、先に public スキーマを空にする。

```bash
psql "postgresql://postgres:AJxvUatplraSAXpKVUeuSwDzGrhEwvxL@gondola.proxy.rlwy.net:48580/railway" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

**3. バックアップを復元する**

```bash
# 直近のバックアップを Railway に復元
npm run db:restore -- --target "postgresql://postgres:AJxvUatplraSAXpKVUeuSwDzGrhEwvxL@gondola.proxy.rlwy.net:48580/railway"

# 使う .dump ファイルを指定する場合
npm run db:restore -- --target "postgresql://postgres:AJxvUatplraSAXpKVUeuSwDzGrhEwvxL@gondola.proxy.rlwy.net:48580/railway" manage/backups/remaria_YYYYMMDD_HHmmss.dump
```

- `--target` に渡すのは **2. で使ったのと同じ Railway の接続 URL**。
- ローカルの `.env` の `DATABASE_URL` は変更しない。復元は `--target` で指定した Railway の DB だけに行われる。

**4. 確認**

- Railway の RemAria サービスを開き、ログにエラーが出ていないか確認する。
- ブラウザでアプリの URL を開き、ログインや主要画面が動くか確認する。

### 補足

- Railway の URL には **SSL 接続**（`?sslmode=require` など）が含まれることがある。そのまま `psql` / `pg_restore` に渡してよい。
- `psql` や `pg_restore` がローカルにない場合は、Docker で実行する例:  
  `docker run --rm -v "%cd%\manage\backups:/backups" postgres:16 pg_restore -d "（URL）" --no-owner --no-privileges /backups/remaria_xxx.dump`  
  （PowerShell では `%cd%` は `$PWD` に読み替える。URL に含まれる `&` などはクォートで囲む。）

---

## 7. 本番 DB をローカルに復元する（引っこ抜き）

開発 DB を空にしてしまったときなどに、**稼働中の本番 DB の内容をダンプしてローカルに復元する**手順。

### 前提

- **本番の接続 URL** が分かること（Railway の Postgres → Variables の `DATABASE_URL`、または `manage/production.env` に記載した値）。
- ローカルに **PostgreSQL クライアント**（`pg_dump`, `pg_restore`, `psql`）が入っているか、**Docker の remaria-db（postgres:16）** が使えること。
- **バージョン**: ダンプを作る `pg_dump` と、復元に使う `pg_restore` の **PostgreSQL メジャーバージョンが同じか、復元側が同じか新しいこと**。  
  - ホストの `pg_dump` が 16 でダンプした場合、Docker の postgres:16 の `pg_restore` で復元すれば問題ない。  
  - 古い `pg_restore` で新しい形式のダンプを復元すると `unsupported version (1.16) in file header` などのエラーになる。

### 手順

**1. 本番からダンプを取得する**

現在の `.env` は触らず、**その場だけ**本番の `DATABASE_URL` を渡してバックアップを取る。

```powershell
# PowerShell の例（manage/production.env に DATABASE_URL がある場合）
Get-Content manage\production.env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim().Replace('"',''), 'Process') } }
npm run db:backup
```

- 別のやり方: `manage/production.env` を開き、`DATABASE_URL` の値をコピーしてから、  
  `$env:DATABASE_URL="（本番のURL）"` を実行してから `npm run db:backup`。
- 出力: `manage/backups/remaria_YYYYMMDD_HHmmss.dump`。これが「本番のスナップショット」。

**2. ローカル DB を起動しておく**

```bash
npm run db:start
```

**3. ローカルを空にして、上記ダンプを復元する**

`.env` の `DATABASE_URL` が **ローカル**（例: `postgresql://remaria:remaria_dev@localhost:5432/remaria`）を指していることを確認する。

```bash
npm run db:restore -- manage/backups/remaria_YYYYMMDD_HHmmss.dump
```

- 直前に取ったダンプのファイル名に合わせてパスを指定する。
- 復元先は `DATABASE_URL` の DB（ローカル）になる。既存の public スキーマは DROP されてから復元される。

**4. 確認**

- アプリを `npm run dev` で起動し、本番と同じアカウントでログインできるか、主要画面が動くか確認する。

### 注意

- 本番から取得するため、**本番のプレイデータ・マスタがそのままローカルに入る**。取り扱いに注意する。
- 本番 DB に負荷をかけるため、必要なときだけ実行する。

---

## 8. 新規環境のセットアップ例

1. DB を用意する（Docker なら `npm run db:start` など）。
2. `.env` の `DATABASE_URL` をその DB に合わせる。
3. マイグレーション: `npm run db:migrate`（空の DB にスキーマを作る）。
4. バックアップを復元: `npm run db:restore -- path/to/backup.dump`。
5. （任意）テスト用ユーザーだけ足したい場合: `npm run db:seed`（シードはテスト用のみ投入）。

---

## 9. 運用の整理

| 内容 | やり方 |
|------|--------|
| マスタ（アイテム・設備・スキル・敵・エリア・ドロップなど） | 管理画面で編集 → 必要ならバックアップ |
| テスト用ユーザー（test1/test2） | シード（`npm run db:seed`）で投入可能。復元した DB にテストユーザーが含まれていれば不要。 |
| シードの役割 | テスト用ユーザー・主人公・仲間・通貨・所持品など**テスト用データのみ**。マスタは投入しない。 |
