# Railway でデプロイする手順（RemAria）

**デプロイ先を Railway に決めたときの「あなたがやること」をまとめた手順書。**  
初回セットアップと、2 回目以降のリリースの両方に対応。

---

## GitHub は必須か？

**いいえ。必須ではありません。**

| 方法 | 説明 |
|------|------|
| **A. GitHub 連携** | Railway に GitHub リポジトリを接続し、`git push` するたびに自動でビルド・デプロイされる。 |
| **B. Railway CLI（ローカルから）** | GitHub に上げなくても、**Railway CLI** でローカルのフォルダをそのままアップロードしてデプロイできる。`railway up` で「今のローカルの状態」をデプロイする。 |

- **GitHub の使い方（push のやり方）が分からない** → まず [GITHUB_BASICS.md](./GITHUB_BASICS.md) で「リポジトリを作る → ローカルから push する」までやってから、ここに戻って **A（GitHub 連携）** で進める。
- **GitHub にリポジトリを置きたくない／まだ push していない** → **B（CLI）** でよい。手順は「[GitHub なしでデプロイ（CLI）](#github-なしでデプロイするcliで上げる)」を参照。
- **GitHub にコードを置いていて、push のたびに自動デプロイしたい** → **A（GitHub 連携）**。以下「あなたがやること」の流れのまま進める。

---

## あなたがやること（初回デプロイ）

### 1. Railway のアカウントとプロジェクトを作る

**GitHub 連携で進める場合（方法 A）**

1. [railway.com](https://railway.com) にアクセスし、**Sign in**（GitHub でログインが簡単）。
2. **New Project** で「**Deploy from GitHub repo**」を選ぶ。
3. リポジトリ **RemAria** を選び、接続する（Railway がリポジトリを参照できるようにする）。

**GitHub なしで進める場合（方法 B）**

1. [railway.com](https://railway.com) にアクセスし、**Sign in**（GitHub アカウントでログインしても、リポジトリ連携はしなくてよい）。
2. **New Project** で「**Empty Project**」を選ぶ（空のプロジェクトを作る）。
3. このあと **PostgreSQL** を追加し、**Empty Service** で Web サービスを 1 つ追加する。デプロイは **Railway CLI** の `railway up` で行う（後述）。

いずれにしても、このあと **PostgreSQL** と **Web サービス** の 2 つを用意する。

---

### 2. PostgreSQL を追加する

1. プロジェクトの画面で **+ New** をクリック。
2. **Database** → **PostgreSQL** を選ぶ。
3. しばらくすると PostgreSQL が 1 つ追加される。
4. 追加された **PostgreSQL** をクリック → **Variables** タブを開く。  
   - ここに **`DATABASE_URL`** が表示されている（本番用の接続文字列）。  
   - あとで Web サービスからこの値を参照するので、**コピーしておく**か、次のステップで「変数参照」で渡す。

---

### 3. Web サービス（Next.js アプリ）を追加する

**方法 A（GitHub 連携）**

1. 同じプロジェクトで **+ New** → **GitHub Repo** を選ぶ。
2. リポジトリを **RemAria** にし、**デプロイするブランチ**（例: `main`）を選ぶ。
3. 追加された **Web サービス** をクリックして設定する。

**方法 B（GitHub なし・CLI でデプロイ）**

1. 同じプロジェクトで **+ New** → **Empty Service** を選ぶ（中身のない Web サービスが 1 つできる）。
2. その **Web サービス** をクリックして、環境変数やビルド設定だけ先に用意する（次の 3.1 以降）。実際のデプロイはローカルで `railway up` を行う（「[GitHub なしでデプロイ（CLI）](#github-なしでデプロイするcliで上げる)」参照）。

#### 3.1 環境変数を設定する

**Settings** または **Variables** で、次の変数を追加する。

| 変数名 | 値 | メモ |
|--------|-----|------|
| `NODE_ENV` | `production` | 本番用 |
| `DATABASE_URL` | （PostgreSQL の接続文字列） | **PostgreSQL の Variables に表示されている値**をコピーして貼る。または Railway の「変数参照」で `${{Postgres.DATABASE_URL}}` のように参照（Postgres がサービス名の場合） |
| `SESSION_SECRET` | **32 文字以上のランダム文字列** | ローカルで `openssl rand -base64 32` を実行して出した値を 1 回だけ使い、**誰にも教えない・Git に commit しない** |

- **SESSION_SECRET の作り方（例）**  
  - プロジェクトで Node が使える場合:  
    `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`  
  - または [1Password のパスワード生成](https://1password.com/password-generator/) などで 32 文字以上のランダム文字列を生成して使う。

#### 3.2 ビルド・起動コマンドを確認する

Railway は多くの場合、**Nixpacks** で `package.json` の `build` / `start` を自動検出する。

- **Build Command**: `npm run build` のままでよい（Prisma は `postinstall` やビルド時に `prisma generate` が走る設定になっていれば OK。未設定なら **Build Command** に `npx prisma generate && npm run build` を指定）。
- **Start Command**: `npm run start`（= `next start`）のままでよい。

**Root Directory** は空のままでよい（リポジトリルートがプロジェクトルートの場合）。

- ビルドが失敗する場合は、Railway の **Settings** → **Build** で **Build Command** を `npx prisma generate && npm run build` に設定する。

#### 3.3 ポート

Railway は **PORT** 環境変数でポートを渡す。Next.js の `next start` は `PORT` を読むので、多くの場合**追加設定は不要**。動かない場合は **Settings** で **Port** を `3000` にしておくか、`PORT` を渡しているか確認する。

---

### 4. 初回だけ：DB マイグレーションとシードを実行する

PostgreSQL は空のままなので、**スキーマを作成**し、必要なら**マスタデータを投入**する。

**方法 A: Railway のシェルから実行（おすすめ）**

1. **Web サービス**の画面で **…** メニュー → **Shell** を開く（または **Deployments** の実行中デプロイから **View Logs** の近くに **Shell** がある場合あり）。
2. 次のコマンドを実行する（Prisma がインストールされている前提）。  
   - マイグレーション:  
     `npx prisma migrate deploy`  
   - シード（マスタ投入）:  
     `npx prisma db seed`  
   - 注意: Shell が**ビルド後のコンテナ**ではなく**ビルド用環境**の場合は、`prisma` が入っていないことがある。その場合は **方法 B** を使う。

**方法 B: ローカルから本番 DB に対して実行**

1. **PostgreSQL** の **Variables** にある **`DATABASE_URL`** をコピーする。
2. ローカルで **一時的に** その値を `.env` に設定する（例: `DATABASE_URL="（コピーした本番のURL）"`）。  
   - **注意**: 本番データを壊さないよう、マイグレーションとシードだけ実行し、終わったら `.env` を元の開発用に戻す。
3. ターミナルで実行:  
   - `npx prisma migrate deploy`  
   - `npx prisma db seed`  
4. `.env` を開発用の `DATABASE_URL` に戻す。

---

### 5. デプロイを待って動作確認する

1. **Deployments** でビルドが成功し、**Running** になるのを待つ。
2. **Settings** → **Networking** の **Generate Domain** で URL を発行する（例: `xxx.up.railway.app`）。
3. その URL を開き、**トップページ・ログイン・主要画面**が開けるか確認する。

---

## GitHub なしでデプロイする（CLI で上げる）

GitHub にリポジトリを連携せず、**ローカルのコードをそのまま Railway にデプロイ**する方法。

1. **Railway CLI を入れる**  
   - 例（npm）: `npm i -g @railway/cli`  
   - その他: [Railway CLI 公式](https://docs.railway.app/guides/cli) のインストール方法を参照。
2. **ログイン**: `railway login`（ブラウザで認証）。
3. **プロジェクト・サービスと紐づける**: プロジェクトルートで `railway link` を実行し、画面上で **Empty Project で作ったプロジェクト** と **Empty Service で作った Web サービス** を選ぶ。
4. **デプロイ**: `railway up` を実行する。  
   - ローカルフォルダがアップロードされ、Railway 側でビルド・デプロイが走る。  
   - 2 回目以降も、更新したいときに同じく `railway up` を実行すればよい。

環境変数（`DATABASE_URL` など）は、**Railway の Web サービス画面の Variables** で設定しておく。CLI は「どのサービスにデプロイするか」を `railway link` で紐づけるだけなので、Git のリモートは不要。

---

## 2 回目以降のリリース（通常デプロイ）

**GitHub 連携している場合**

1. **リリース前**: [RELEASE.md](./RELEASE.md) の「2. リリース前チェックリスト」を確認する。
2. **コードを push する**（例: `main` に push）。  
   - Railway は **Git と連携している場合、push で自動ビルド・デプロイ**される。
3. **DB のスキーマを変えた場合だけ**、マイグレーションを実行する（Railway の Shell またはローカルから本番 `DATABASE_URL` で `npx prisma migrate deploy`）。
4. **マスタの追加・変更**がある場合だけ、`npx prisma db seed` を実行するか、管理画面から投入する。
5. デプロイ完了後、画面が問題なく動くかさっと確認する。

**CLI でデプロイしている場合**

1. リリース前チェックリストを確認したあと、**プロジェクトルートで `railway up`** を実行する。ローカルの現在の状態がデプロイされる。
2. **DB のスキーマを変えた場合だけ**、マイグレーションを実行する（Railway の Shell またはローカルから本番 `DATABASE_URL` で `npx prisma migrate deploy`）。
3. **マスタの追加・変更**がある場合だけ、`npx prisma db seed` を実行するか、管理画面から投入する。
4. デプロイ完了後、画面が問題なく動くかさっと確認する。

---

## ロールバック

- Railway の **Deployments** で、**前のデプロイ**を選んで **Redeploy** するなど、過去のビルドに戻す操作ができる。  
- DB マイグレーションを「戻す」必要がある場合は、事前にロールバック用のマイグレーションを用意するか、バックアップからリストアする（[SECURITY_READINESS.md](./SECURITY_READINESS.md) のバックアップ手順を参照）。

---

## バックアップ（本番 DB）

- [SECURITY_READINESS.md](./SECURITY_READINESS.md) の「バックアップとリストア手順の確認」に従い、**1 回は手順をやっておく**。
- Railway の PostgreSQL の場合、**Variables** の `DATABASE_URL` を使ってローカルから `pg_dump` するか、プロジェクトに `db:backup` がある場合は本番用 URL を一時的に指定して実行する方法を doc にメモしておくとよい。

---

## まとめ：初回でやること一覧

**GitHub 連携する場合**

| # | やること |
|---|----------|
| 1 | Railway にログインし、**New Project** → **Deploy from GitHub repo** で RemAria を紐づける |
| 2 | プロジェクトに **PostgreSQL** を 1 つ追加する |
| 3 | 同じプロジェクトに **GitHub Repo** で **Web サービス**を追加する（RemAria の `main` など） |
| 4 | Web サービスの **Variables** に `NODE_ENV=production`・`DATABASE_URL`（PostgreSQL の URL）・`SESSION_SECRET`（32 文字以上）を設定する |
| 5 | ビルドが通るか確認する（失敗したら Build Command に `npx prisma generate && npm run build` を指定） |
| 6 | 初回だけ **マイグレーション**（`npx prisma migrate deploy`）と **シード**（`npx prisma db seed`）を Railway の Shell かローカルから実行する |
| 7 | **Generate Domain** で URL を出し、ブラウザで動作確認する |

**GitHub なし（CLI で上げる）場合**

| # | やること |
|---|----------|
| 1 | Railway にログインし、**New Project** → **Empty Project** で空プロジェクトを作る |
| 2 | プロジェクトに **PostgreSQL** を 1 つ追加する |
| 3 | **+ New** → **Empty Service** で Web サービスを 1 つ追加する |
| 4 | その Web サービスの **Variables** に `NODE_ENV=production`・`DATABASE_URL`・`SESSION_SECRET` を設定する |
| 5 | ローカルに **Railway CLI** を入れ（`npm i -g @railway/cli`）、`railway login` → `railway link` で上記プロジェクト・サービスを選ぶ |
| 6 | 初回だけ **マイグレーション**と **シード**をローカルから本番 `DATABASE_URL` で実行する |
| 7 | `railway up` でデプロイし、**Generate Domain** で URL を出して動作確認する |

---

## 参照

- リリース全体の流れ・チェックリスト: [RELEASE.md](./RELEASE.md)
- セキュリティ・バックアップ: [SECURITY_READINESS.md](./SECURITY_READINESS.md)
- デプロイ先を決める前の比較: [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md)
