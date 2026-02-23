# RemAria

スチームパンク × ハイファンタジーのブラウザゲーム

## 開発環境

### 前提

- Node.js LTS（v20 以上推奨）
- Docker（DB 用。Neon / Supabase でも可）

### セットアップ

```bash
# 依存関係インストール
npm install

# DB 起動（Docker Compose）
docker compose up -d

# 環境変数（.env.example をコピーして .env を作成）
cp .env.example .env
# SESSION_SECRET を任意で変更（DATABASE_URL は .env.example のまま可）

# Prisma クライアント生成
npm run db:generate

# マイグレーション
npm run db:migrate

# テストユーザーを投入（任意）
npm run db:seed
```

### 起動

```bash
npm run dev
```

http://localhost:3000 で確認

### ドキュメント

- 全体設計: `docs/`
- 機能仕様: `spec/`
- 開発環境構築: `docs/06_dev_setup.md`
