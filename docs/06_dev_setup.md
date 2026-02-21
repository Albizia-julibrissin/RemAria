# 開発環境構築手順

この文書は、プロジェクトをゼロから動かすまでの手順を定義する。
`docs/03_architecture_spec.md` の技術スタック・ディレクトリ構成に従う。

---

## 1. 前提条件

- Node.js LTS（推奨: v20 以上）
- パッケージマネージャ: npm または pnpm

---

## 2. 構築手順（推奨順序）

### 2.1 Next.js プロジェクト作成

※ プロジェクト名に大文字・全角が含まれる場合、`create-next-app` が npm 制約で失敗することがある。
その場合は `package.json` 等を手動で作成する（`name` は `remaria` などの URL 準拠名にすること）。

### 2.2 Prisma 導入

```bash
npm install prisma @prisma/client
npx prisma init
```

- `prisma/schema.prisma` にドメインモデル（`docs/02_domain_model.md`）を反映
- 最初は最小スキーマでも可

### 2.3 データベース接続

**オプションA**: Docker Compose（推奨・アーキテクチャ準拠）

```bash
docker compose up -d
```

- PostgreSQL 16 が `localhost:5432` で起動
- `.env` に `DATABASE_URL="postgresql://remaria:remaria_dev@localhost:5432/remaria"` を設定（`.env.example` 参照）

**オプションB**: Neon / Supabase 無料枠

- アカウント作成 → プロジェクト作成 → 接続文字列を取得
- `.env` に `DATABASE_URL="postgresql://..."` を設定

**オプションC**: ローカル PostgreSQL

- PostgreSQL をインストール
- データベースを作成し、`DATABASE_URL` を設定

### 2.4 iron-session 導入

```bash
npm install iron-session
```

- セッション暗号化キーを `.env` に設定（32文字以上）
- `lib/auth/` にセッション取得・検証を実装

### 2.5 ディレクトリ構成の整備

`docs/03_architecture_spec.md` のセクション3に従い、以下を作成：

```
src/lib/domain
src/lib/battle
src/lib/training
src/lib/crafting
src/lib/jobs
src/lib/db
src/lib/auth
src/server/actions
src/server/services
src/server/repositories
src/types
src/utils
tests
```

空ディレクトリは `.gitkeep` で保持するか、最初のファイル作成時に作る。

### 2.6 shadcn/ui（任意）

必要に応じて導入：

```bash
npx shadcn@latest init
```

---

## 3. 環境変数（.env.example）

```
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
SESSION_SECRET="32文字以上のランダム文字列"
```

`.env` は git に含めない。`.env.example` をコミットし、手動で `.env` を複製する。

---

## 4. Docker について

- **DB 用**：`docker-compose.yml` で PostgreSQL を起動可能（`docker compose up -d`）
- 本番デプロイ・チーム開発時も同様の Docker Compose 構成を想定

---

## 5. 動作確認

1. `npx prisma migrate dev` でマイグレーション
2. `npm run dev` で開発サーバ起動
3. `http://localhost:3000` にアクセスして表示を確認
