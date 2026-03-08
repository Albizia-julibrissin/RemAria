# デプロイ先の検討（RemAria 向け）

**目的**: Next.js + Prisma + PostgreSQL の RemAria を「どこにどう載せるか」を候補ごとに整理し、決めたあと [RELEASE.md](./RELEASE.md) の手順を具体化するための材料にする。

---

## 1. このプロジェクトの構成（デプロイ時に必要なもの）

| 要素 | 内容 |
|------|------|
| **アプリ** | Next.js 15（App Router）、React 19、Server Actions 使用 |
| **DB** | PostgreSQL（Prisma 経由） |
| **認証** | iron-session（サーバー側セッション・Cookie） |
| **環境変数** | `DATABASE_URL`（必須）、`SESSION_SECRET`（本番必須 32 文字以上） |

デプロイ先は「Next.js を動かすランタイム」と「PostgreSQL を置く場所」の両方を用意する必要がある。  
**同一サービスで両方扱える**か、**アプリと DB を別サービスで組む**かの 2 パターンが主になる。

---

## 2. 候補の整理

### 2.1 パターン A: Railway で一式（アプリ + DB 同じプロジェクト）

**概要**: Railway 上に「PostgreSQL プラグイン」と「Next.js を動かす Web サービス」の 2 つを置く。Git 連携で push すると自動ビルド・デプロイ。

| 項目 | 内容 |
|------|------|
| **アプリの置き方** | コンテナとして Node で `next start`（または `output: 'standalone'` ビルドを実行） |
| **DB** | Railway が提供する PostgreSQL をプロジェクト内に 1 クリックで追加。`DATABASE_URL` は自動で注入される |
| **料金の目安** | 無料トライアル $5 分のクレジット（約 30 日）。その後は Hobby $5/月〜（使用量に応じた従量）。Free プランは月 $1 クレジットで小規模検証向け |
| **公式** | [railway.com](https://railway.com) / [Prisma × Railway 公式](https://www.prisma.io/docs/orm/prisma-client/deployment/traditional/deploy-to-railway) |

**メリット**

- アプリと DB を同じダッシュボードで管理でき、**最初にやることが少ない**
- Prisma の「1 本の `DATABASE_URL`」のまま使える（コネクションプールの設定を気にしなくてよい）
- マイグレーションは Railway の「シェル」やローカルから本番 `DATABASE_URL` を指定して `prisma migrate deploy` を実行すればよい

**デメリット**

- Vercel ほど「Next 特化」ではない（ビルドキャッシュなどは Vercel のほうが有利な場合あり）
- 無料でずっと使うには厳しく、月 $5 程度は見ておいた方が安心

**RemAria との相性**

- Server Actions・iron-session をそのまま使える
- 趣味〜少人数向けの「とにかく 1 台で本番を立ち上げたい」という段階に**とても向いている**

---

### 2.2 パターン B: Vercel（アプリ）+ Neon または Supabase（DB）

**概要**: アプリは Vercel にデプロイし、PostgreSQL は Neon または Supabase のマネージド DB を別契約で使う。

| 項目 | 内容 |
|------|------|
| **アプリの置き方** | Vercel が Next.js をビルドし、サーバーレス関数 / Edge で実行 |
| **DB** | Neon または Supabase の PostgreSQL。接続は「プール用 URL」と「マイグレーション用の Direct URL」の 2 本が必要（後述） |
| **Vercel 料金** | Hobby は無料だが**非商用利用のみ**。商用は Pro 以上（有料） |
| **Neon** | 無料枠あり（クレジットカード不要）。0.5GB ストレージ・制限内のコンピュート。有料は Launch プラン〜 |
| **Supabase** | 無料枠あり。PostgreSQL + 認証・ストレージ等がセット。有料でリソース拡張 |

**Prisma で必要な設定（Vercel + 外部 Postgres の場合）**

- サーバーレスでは DB 接続数が増えやすいため、**コネクションプール**を使う必要がある。
- `schema.prisma` の `datasource` で次の 2 つを設定する想定（Neon / Supabase どちらも同じ考え方）:
  - `url` … プール用（アプリの通常の接続）。Neon ならポート 6543 の URL など。
  - `directUrl` … マイグレーション専用（`prisma migrate deploy` 用）。通常の 5432 の URL。
- 環境変数は `DATABASE_URL`（プール用）と `DIRECT_URL`（直接用）を Vercel と Neon/Supabase の両方で整合させる。

**メリット**

- Vercel は Next.js の開発元で、デプロイ体験・プレビュー・エッジが強い
- Neon / Supabase の無料枠で「まず動かす」までコストを抑えられる（非商用なら Vercel Hobby も無料）

**デメリット**

- アプリと DB が別サービスなので、**設定する場所が 2 つ**になる
- Prisma の `directUrl` とプール URL の両方を理解・設定する必要がある
- Vercel Hobby は**商用利用不可**。お金を取るサービスにしたいなら Vercel Pro + DB 有料プランの検討が必要

**RemAria との相性**

- 「Vercel でやりたい」「既に Vercel を使っている」ならこの組み合わせが自然
- 商用リリースを早くから想定するなら、最初から Railway で一式の方がシンプルな場合もある

---

### 2.3 その他の候補（参考）

| サービス | メモ |
|----------|------|
| **Render** | Web サービス + PostgreSQL を提供。無料枠はスリープするため、常時起動なら有料。Railway と似た「一式」の選び方になる。 |
| **Fly.io** | コンテナベース。PostgreSQL は Fly Postgres や外部 DB と組み合わせ。やや設定は多め。 |
| **Vercel + Vercel Postgres** | Vercel が提供する Postgres（Neon ベース）。Vercel に寄せるなら選択肢になる。料金・制限は要確認。 |

---

## 3. 比較のまとめ（RemAria 用）

| 観点 | Railway 一式 | Vercel + Neon/Supabase |
|------|----------------|------------------------|
| **初期の手軽さ** | ◎ 1 プロジェクトでアプリ＋DB | ○ 2 サービス分の設定 |
| **Prisma の設定** | 通常の 1 本の `DATABASE_URL` でよい | プール URL と Direct URL の 2 本が必要 |
| **無料で試す** | 約 $5 クレジットのトライアル | Vercel Hobby（非商用）+ Neon/Supabase 無料枠 |
| **商用利用** | 有料プランで可能 | Vercel は Hobby では不可 → Pro 以上 |
| **バックアップ・DB 操作** | Railway ダッシュボード＋シェルから | Neon/Supabase のコンソール＋CLI |
| **向いている人** | 「とにかく 1 か所で本番を立てたい」 | 「Vercel で統一したい」「フロント寄りの運用」 |

---

## 4. おすすめの進め方（相談用）

- **「まず形にしたい・趣味〜少人数で使う」**  
  → **Railway 一式**から始めるのがおすすめ。  
  - アプリ＋DB を同じプロジェクトで扱える  
  - Prisma は現状の `DATABASE_URL` のまま使える  
  - 決まったら [RELEASE.md](./RELEASE.md) の「3. リリース実行」を Railway 用に書き換え、バックアップ手順は [SECURITY_READINESS.md](./SECURITY_READINESS.md) とあわせて 1 回やっておく  

- **「Vercel でデプロイしたい」**  
  → **Vercel + Neon**（または Supabase）を選択。  
  - `schema.prisma` に `directUrl` を追加し、Neon の「プール用」と「直接用」の 2 種類の URL を取得して設定する  
  - 商用利用する場合は Vercel Pro の利用を前提にする  

- **「まだ決めない」**  
  → Railway の無料トライアルで 1 回デプロイしてみて、体感してから「このまま Railway」か「Vercel に寄せるか」を決めてもよい。

---

## 5. 決まったあとにやること（RELEASE.md との関係）

1. **デプロイ先を 1 つに決める**（例: Railway とする）
2. **[RELEASE.md](./RELEASE.md) の「3. リリース実行」**を、そのサービス用の手順に書き換える  
   - 例: 「Git を Railway に連携 → 環境変数を Railway の画面で設定 → 初回だけ `prisma migrate deploy` を Railway のシェル or ローカルで実行」
3. **バックアップ**  
   - Railway ならダッシュボードや CLI からダンプ取得手順を 1 回やり、[SECURITY_READINESS.md](./SECURITY_READINESS.md) の「バックアップとリストア手順の確認」にメモ or リンクを書く
4. **このファイル（DEPLOY_OPTIONS.md）**の「4. おすすめ」や「5. 決まったあと」に、**実際に選んだ案**と日付をメモしておくと、あとで見返しやすい。

---

## 参照

- リリース手順・チェックリスト: [RELEASE.md](./RELEASE.md)
- セキュリティ・運用（バックアップ含む）: [SECURITY_READINESS.md](./SECURITY_READINESS.md)
- manage フォルダ全体: [README.md](./README.md)
