# 管理用アカウント（管理人）

管理画面（`/dashboard/admin/*`）に入室できるアカウントの仕様とセットアップ手順。

---

## 1. 突入条件

- **入室できるのは「管理用アカウント」1 つのみ。**
- 管理用アカウントは **メールアドレス** で識別する。
  - そのメールは **環境変数 `ADMIN_EMAIL`** で指定する。
  - 未設定時は **`test1@example.com`**（開発用デフォルト）。
- 実装上の判定: `src/server/lib/admin.ts` の `getAdminEmail()` が返すメールと、ログイン中ユーザーの `User.email` が一致する場合のみ入室可。
- **二重チェック**:
  - `src/app/dashboard/admin/layout.tsx` で全 `/dashboard/admin/*` に対して一括チェックし、非管理ユーザーは `/dashboard` へリダイレクト。
  - 各管理画面ページおよび Server Actions（`src/server/actions/admin.ts`）でも `isAdminUser()` / `isTestUser1()` を参照。

---

## 2. シードでの作成

- `prisma/seed.ts` 実行時に **管理人** アカウントを 1 件作成・更新する。
- **メール**: `process.env.ADMIN_EMAIL ?? "test1@example.com"`
- **表示名**: `管理人`
- **accountId**: `admin`
- **パスワード**:
  - `ADMIN_PASSWORD` が設定されていればそれを使用。
  - 未設定なら **ランダム生成**（24 バイト base64url）。生成したパスワードは **コンソールに表示** する（初回ログイン用）。

本番で管理用アカウントを使う場合は、**.env に `ADMIN_EMAIL` と `ADMIN_PASSWORD` を設定してから** `npm run db:seed` を実行すること。

---

## 3. 本番での運用

1. 本番環境の `.env`（またはホスティングの環境変数）に次を設定:
   - `ADMIN_EMAIL`: 管理用に使うメールアドレス（例: `admin@yourgame.com`）
   - `ADMIN_PASSWORD`: 強固なパスワード（ランダム生成推奨、8 文字以上）
2. 本番 DB に対して **一度だけ** シードを実行するか、または既存 DB に該当 User がいる場合は手動で `ADMIN_EMAIL` のユーザーを「管理人」として運用可能。
3. シードで作成した管理用アカウントでログインすると、ダッシュボードに「コンテンツ管理」等のリンクが表示され、`/dashboard/admin/content` から各管理画面に入れる。

---

## 4. 参照

- 定数・判定: `src/lib/constants/admin.ts`（`DEFAULT_ADMIN_EMAIL`）、`src/server/lib/admin.ts`（`getAdminEmail`, `isAdminUser`, `isTestUser1`）
- シード: `prisma/seed.ts`（`getAdminSeedConfig`, 管理人ユーザーの upsert）
