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

## 5. 管理画面との関係

- マスタの**編集済み一覧・編集手順**は [admin_master_edit_overview.md](./admin_master_edit_overview.md) を参照。
- 各マスタの画面パス・API・データ構造は `admin_*_edit.md` に記載。
- 認可は現状**テストユーザー1**のみ。本番運用時は [SECURITY_READINESS.md](./SECURITY_READINESS.md) を参照。

---

## 6. 参照リンク

| 内容 | 参照先 |
|------|--------|
| スキーマ・テーブル説明 | `prisma/schema.prisma`, `docs/08_database_schema.md` |
| バックアップ・復元の詳細 | [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) |
| マスタ編集の全体像 | [admin_master_edit_overview.md](./admin_master_edit_overview.md) |
| リリース・本番デプロイ | [RELEASE.md](./RELEASE.md), [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md) |
