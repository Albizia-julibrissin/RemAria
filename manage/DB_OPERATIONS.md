# DB 運営（開発・運用向け）

データベースの起動・マイグレーション・シード・バックアップ復元など、運営で使う手順をまとめる。  
データモデルの正本は `prisma/schema.prisma`、説明は `docs/08_database_schema.md` を参照。

---

## 1. 起動・停止

| 目的 | コマンド |
|------|----------|
| DB 起動（Docker） | `npm run db:start` |
| DB 停止 | `npm run db:stop` |

接続情報は `.env` の `DATABASE_URL`。スキーマ変更後は `npm run db:generate` で Prisma クライアントを更新する。

### 1.1 Docker の Postgres バージョンを変える

**変えてよい。** 使っているのは「PostgreSQL が入ったコンテナ」の**イメージの種類**だけ。

- **どこを変えるか**: プロジェクト直下の `docker-compose.yml` の `image:` の行。
  - いま: `image: postgres:16-alpine`
  - 例: 16 のまま別タグにしたい → `postgres:16`（Alpine じゃないフルイメージ）など。
  - 例: バージョンを変えたい → `postgres:15-alpine` や `postgres:17-alpine` など。
- **変えたあと**:
  1. `npm run db:stop` でコンテナを止める。
  2. 必要なら既存のデータをバックアップ（`npm run db:backup`。接続先は `.env` のローカル DB のまま）。
  3. `docker compose up -d db` または `npm run db:start` でコンテナを起動する。
- **注意**: すでに **同じメジャーバージョン**（16 → 16 の別タグなど）なら、そのまま起動し直すだけでよい。**メジャーが変わる**（14 → 16 など）場合は、Postgres は「古いデータディレクトリを新しいメジャーでそのまま読めない」ことがある。そのときは「いったんダンプ → 新しいイメージで空の DB で起動 → 復元」が必要（[BACKUP_RESTORE.md](./BACKUP_RESTORE.md) の復元手順を使う）。

**このプロジェクトでの役割**: Docker は「ローカル用の PostgreSQL サーバー」を動かすためだけに使っている。アプリやバックアップ／復元のスクリプトは、このコンテナの 5432 番に `DATABASE_URL` で接続する。コンテナの中の Postgres のバージョンが、`pg_dump` / `pg_restore` のバージョンになる（localhost でバックアップ・復元するときは、スクリプトがこのコンテナ内のコマンドを優先して使う）。

---

## 2. マイグレーション

| 目的 | コマンド |
|------|----------|
| マイグレーション実行（開発） | `npm run db:migrate` |
| スキーマを DB に反映（マイグレーション履歴を使わない場合） | `npm run db:push` |

- **本番**では `prisma migrate deploy` を利用する想定。手順は `manage/RELEASE.md` 等で具体化する。

---

## 3. シード（テスト用データのみ）

| コマンド | 用途 |
|----------|------|
| `npm run db:seed` | **テスト用データのみ**投入（test1/test2 ユーザー・主人公・仲間・通貨・所持品など）。 |
| `npm run db:seed:test` | 同上（SEED_TEST=1）。 |

**シードの役割**: テスト用ユーザーとその周辺データだけ。**マスタ（タグ・設備・アイテム・スキル・敵・エリア・ドロップなど）はシードでは投入しない。**

- マスタは**管理画面で編集**し、**バックアップ・復元**で環境間を揃える。
- 新規 DB や「今の本番に近い状態」にしたい場合は、マイグレーション後に **バックアップを復元**する（下記 4. 参照）。
- 初期設備の配置・強制配置は**アプリ側**で行うため、シードでは行わない。

---

## 4. バックアップ・復元（マスタ・プレイデータの運用）

マスタやプレイデータは「画面で編集 → バックアップで保存 → 必要時に復元」する運用にする。

| コマンド | 用途 |
|----------|------|
| `npm run db:backup` | 現在の DB を `manage/backups/remaria_YYYYMMDD_HHmmss.dump` に出力。 |
| `npm run db:restore` | 直近のバックアップ、または指定した .dump を復元する。 |

**手順・注意点**は **[BACKUP_RESTORE.md](./BACKUP_RESTORE.md)** を参照。

---

## 4.1 マスタのみ同期（本番にユーザーがいる場合）

本番にすでにユーザーがいる状態で、ローカルで編集したマスタだけを反映したいときに使う。**ユーザー・キャラ・所持品などは一切触らない。**

| コマンド | 用途 |
|----------|------|
| `npm run db:sync-masters` | ソース DB のマスタをターゲット DB に upsert で同期する。 |

**前提**: 環境変数で `SOURCE_DATABASE_URL`（編集済みマスタの DB。未設定時は `DATABASE_URL`）と `TARGET_DATABASE_URL`（本番など反映先）を指定する。ソースとターゲットで同じマイグレーションが適用済みであること。**Cursor に依頼する場合**は、TARGET に **manage/production.env** の `DATABASE_URL` を渡す（[PRODUCTION_RELEASE_GUIDE.md §9](./PRODUCTION_RELEASE_GUIDE.md#9-cursor-に本番リリースの各手順を依頼する標準のやり方)）。

**詳細**は **[PRODUCTION_RELEASE_GUIDE.md §3](./PRODUCTION_RELEASE_GUIDE.md#3-マスタデータの正本と本番への反映)** を参照。  
**マイグレーションでマスタテーブルを追加・削除したとき**は、`prisma/sync-masters-to-target.ts` の `MASTER_DELEGATES_IN_ORDER` を更新すること。

---

## 5. 管理画面との関係

- マスタの**編集済み一覧・編集手順**は [admin_master_edit_overview.md](./admin_master_edit_overview.md) を参照。
- 各マスタの画面パス・API・データ構造は `admin_*_edit.md` に記載。
- 認可は現状**テストユーザー1**のみ。本番運用時は [SECURITY_READINESS.md](./SECURITY_READINESS.md) を参照。

---

## 6. 一度きりのデータ移行（本番など）

全ユーザーに「工業コスト上限 +200」「設備設置数 +4」を一括で反映するスクリプト。

| コマンド | 用途 |
|----------|------|
| `npm run db:migrate:bump-industrial` | 全ユーザーの `industrialMaxCost` を +200、`industrialMaxSlots` を +4 する。 |

- **実行前に**: `.env` の `DATABASE_URL` が対象環境（本番など）を指していることを確認する。
- 本番で実行する場合: ローカルで本番の DATABASE_URL を一時的に設定してから実行するか、デプロイ先で実行する。**Cursor に依頼する場合**は、manage/production.env を読み込んだうえで実行する（[PRODUCTION_RELEASE_GUIDE.md §9](./PRODUCTION_RELEASE_GUIDE.md#9-cursor-に本番リリースの各手順を依頼する標準のやり方)）。
- **注意**: 複数回実行するとその都度 +200 / +4 が加算される。一度だけ実行すること。
- スクリプト本体: `prisma/migrate-bump-user-industrial.ts`

---

## 7. テストユーザ以外のアカウント削除

シードで作成するテストユーザ（管理人・test2@example.com）以外の User を削除する。開発環境で不要なアカウントを一括削除するときなどに使う。

| コマンド | 用途 |
|----------|------|
| `npm run db:delete-non-seed-users` | 削除を実行（accountId が `admin` / `test_user_2` 以外のユーザを削除） |
| `npm run db:delete-non-seed-users:dry-run` | 削除対象を表示するだけ（**確実に削除しない**。本番前の確認に推奨） |

- **残すユーザ**: accountId が `admin`（管理人）または `test_user_2`（test2@example.com）のユーザのみ。関連データは Prisma の onDelete: Cascade で削除される。
- **本番で実行する場合**: 必ず `npm run db:delete-non-seed-users:dry-run` で対象を確認してから、削除用コマンドを実行すること。（`npm run ... -- --dry-run` は環境によっては引数がスクリプトに渡らず削除が実行されてしまうため、dry-run 専用スクリプトを推奨）

---

## 8. 参照リンク

| 内容 | 参照先 |
|------|--------|
| スキーマ・テーブル説明 | `prisma/schema.prisma`, `docs/08_database_schema.md` |
| バックアップ・復元の詳細 | [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) |
| マスタ編集の全体像 | [admin_master_edit_overview.md](./admin_master_edit_overview.md) |
| 本番リリースの考え方（マイグレーション・マスタ・アカウント） | [PRODUCTION_RELEASE_GUIDE.md](./PRODUCTION_RELEASE_GUIDE.md) |
| リリース・本番デプロイ | [RELEASE.md](./RELEASE.md), [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md) |
| Railway デプロイ | [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) |
