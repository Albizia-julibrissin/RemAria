# 本番 DB を開発 DB で上書きする手順

**いつ使うか**: DB 構造が大きく変わり、MVP プレイヤーに通達済みのうえで、本番を開発 DB の内容で差し替えたいとき。

**注意**: 本番の既存データは**すべて消えます**。必ず通達・バックアップのうえで実行する。

---

## 前提

- ローカルに **PostgreSQL クライアント**（`psql`, `pg_restore`）が入っていること。  
  Windows でない場合は [PostgreSQL 公式](https://www.postgresql.org/download/windows/) の「Command Line Tools」や、Docker の `postgres` イメージで代用可能。
- **開発 DB**（`.env` の `DATABASE_URL`）が、反映したいスキーマ・マスタ・テストユーザーなど「正」の状態になっていること。
- **本番の接続 URL** を用意する（Railway の Postgres → Variables の `DATABASE_URL`、または `manage/production.env` の `DATABASE_URL`）。

---

## 手順

### 1. （推奨）本番のバックアップを残す

万一ロールバックするときに使う。

- **Railway の手動バックアップ**: Postgres サービス → **Backups** → **Create backup**
- **または** ローカルに .dump を残す:  
  `manage/production.env` の `DATABASE_URL` を読み込んだうえで  
  `npm run db:backup`  
  → 出力は `manage/backups/remaria_YYYYMMDD_HHmmss.dump`（本番のスナップショット）

### 2. 開発 DB のバックアップを取る

`.env` の `DATABASE_URL` が**ローカル開発 DB**を指していることを確認してから:

```bash
npm run db:backup
```

→ `manage/backups/remaria_YYYYMMDD_HHmmss.dump` ができる。**このファイルを本番に復元する。**

### 3. 本番（Railway）の接続 URL をコピーする

- Railway のプロジェクト → **Postgres** サービス → **Variables**
- `DATABASE_URL` の値をコピー（`postgresql://...`）。  
  または `manage/production.env` に書いてある本番の `DATABASE_URL` を使う。

### 4. 本番の public スキーマを空にする

`db:restore -- --target` は**復元先の DROP を実行しない**ため、手動で空にする。

**PowerShell の例**（URL は実際の値に置き換え。パスワードに `&` などが含まれる場合はクォートで囲む）:

```powershell
psql "postgresql://user:password@host:port/railway" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

- Railway の URL に `?sslmode=require` が付いていてもそのまま渡してよい。

### 5. 開発の .dump を本番に復元する

**直近のバックアップ**を本番に復元する場合:

```powershell
npm run db:restore -- --target "postgresql://user:password@host:port/railway"
```

**使う .dump を指定する**場合（2. で作ったファイル名に合わせる）:

```powershell
npm run db:restore -- --target "postgresql://user:password@host:port/railway" manage/backups/remaria_YYYYMMDD_HHmmss.dump
```

- ローカルの `.env` の `DATABASE_URL` は**変更しない**。復元は `--target` で指定した本番 DB だけに行われる。

### 6. デプロイ・確認

- コードがまだ本番に反映されていなければ、**push して Railway にデプロイ**する。
- Railway のアプリ URL を開き、ログイン・主要画面が動くか確認する。

---

## 参照

- バックアップ・復元の詳細: [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)（とくに §6 Railway への復元）
- 本番リリースの考え方: [PRODUCTION_RELEASE_GUIDE.md](./PRODUCTION_RELEASE_GUIDE.md)
