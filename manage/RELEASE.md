# リリース手順・相談メモ

**目的**: 「いつ・何を確認して・どうやって本番に出すか」を manage 配下で整理し、リリースのたびに参照・更新できるようにする。

**本番リリースの考え方（テーブル変更・マスタ・アカウントデータ・デプロイ）**は **[PRODUCTION_RELEASE_GUIDE.md](./PRODUCTION_RELEASE_GUIDE.md)** にまとめてある。

**リリースのやり方**: 本番 DB に触れる手順（バックアップ・マイグレーション・マスタ同期など）は **基本、Cursor に各手順を依頼する**。依頼前に **manage/production.env** に本番の `DATABASE_URL` を用意しておく（`manage/production.env.example` をコピーして作成）。Cursor は [PRODUCTION_RELEASE_GUIDE.md の「Cursor に本番リリースの各手順を依頼する」](./PRODUCTION_RELEASE_GUIDE.md#9-cursor-に本番リリースの各手順を依頼する標準のやり方) を参照して production.env を読み込み、コマンドを実行する。

---

## 1. リリースの種類（要相談）

| 種類 | 想定 | メモ |
|------|------|------|
| **初回リリース（オープンβ等）** | 初めて外部に公開する | MVP 完了＋[SECURITY_READINESS.md](./SECURITY_READINESS.md) の [NOW] は押さえたい |
| **通常リリース（機能追加・修正）** | 既に動いている本番へのデプロイ | チェックリスト＋DB マイグレーション有無の確認 |
| **ホットフィックス** | 緊急の不具合修正 | 最小変更でデプロイ。必要ならロールバック手順を用意 |

※ 上記はあくまで例。運用方針に合わせて「リリースの種類」を増減・書き換えてよい。

---

## 2. リリース前チェックリスト（案）

### 2.1 機能・仕様

- [ ] [MVP_PROGRESS.md](./MVP_PROGRESS.md) で、今回のスコープが「完了」または「意図した部分のみ」になっているか確認
- [ ] 今回の変更に関係する spec / docs が更新済みか
- [ ] `docs/027_hardcoded_and_deferred.md` に新規の暫定実装を追加していないか（追加した場合は一覧に記載済みか）

### 2.2 セキュリティ・運用

- [ ] [SECURITY_READINESS.md](./SECURITY_READINESS.md) の **[NOW]** 項目が満たされているか
- [ ] 本番環境で `SESSION_SECRET` が 32 文字以上で設定されているか（本番デプロイ時）
- [ ] バックアップ取得とリストア手順を 1 回は確認済みか（[SECURITY_READINESS §4](./SECURITY_READINESS.md#4-運用インフラまわり)）

### 2.3 ビルド・検証

- [ ] `npm run lint` が通る
- [ ] `npm run build` が通る（本番ビルド）
- [ ] （任意）ステージング or ローカルで主要フローを 1 通り確認

### 2.4 データベース

- [ ] `prisma/schema.prisma` を変更した場合、本番で `npm run db:migrate:deploy` を実行する（[PRODUCTION_RELEASE_GUIDE.md](./PRODUCTION_RELEASE_GUIDE.md) 参照）
- [ ] マスタテーブルを追加・削除した場合、`prisma/sync-masters-to-target.ts` の `MASTER_DELEGATES_IN_ORDER` を更新する
- [ ] マスタデータ: 初回はバックアップ復元、本番に既存ユーザーがいる場合はマスタ同期または管理画面で編集（同上）

---

## 3. リリース実行（手順の例）

※ 実際のデプロイ先に合わせて書き換える。**Railway で出す場合は [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) に手順あり。** 候補の比較は [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md)。

1. **ブランチ・タグ**
   - リリース用ブランチを切る or `main` からタグを打つ（例: `v0.1.0`）。  
     → **要相談**: タグ運用するか、常に `main` の最新を本番にするか。

2. **本番環境の環境変数**
   - `NODE_ENV=production`
   - `SESSION_SECRET`（32 文字以上）
   - `DATABASE_URL`（本番 DB）
   - その他、アプリが参照する env をすべて設定

3. **DB マイグレーション**
   - スキーマ変更がある場合: 本番 DB に対して `npx prisma migrate deploy` を実行する。**Cursor に依頼する場合は** [PRODUCTION_RELEASE_GUIDE.md §9](./PRODUCTION_RELEASE_GUIDE.md#9-cursor-に本番リリースの各手順を依頼する標準のやり方) のとおり、manage/production.env を参照して実行してもらう。
   - シードが必要な場合: 手順を doc 化したうえで実行（例: `npm run db:seed` または管理用スクリプト）

4. **デプロイ**
   - 各プラットフォームの手順に従う（`git push` で自動デプロイする場合は、push 前に上記チェックリストを実施）

5. **リリース後**
   - トップページ・ログイン・主要画面が開けるかさっと確認
   - （LATER）エラーログ・監視の仕組みがあれば確認

---

## 4. ロールバック（要相談）

- デプロイ先が「前のビルドに戻す」をサポートしているか確認しておく。
- DB マイグレーションを「戻す」必要がある場合は、**マイグレーションのロールバック手順**を別ドキュメント or ここに追記する。

---

## 5. 相談・メモ用（自由記述）

- **初回リリースをいつにするか**: （例: MVP 100% 後 / セキュリティ [NOW] 完了後 / 〇月頃 など）
- **デプロイ先**: （候補の比較は [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md)。決まったら「3. リリース実行」を具体化）
- **ドメイン・HTTPS**: （例: サブドメインで運用する / カスタムドメインの有無）
- **マスタデータの本番更新**: 方針は [PRODUCTION_RELEASE_GUIDE.md §3](./PRODUCTION_RELEASE_GUIDE.md#3-マスタデータの正本と本番への反映) に記載（初回は復元、以降は本番の管理画面で編集）。
- その他、リリースに関して決まったこと・悩んでいることをメモする。

---

## 参照

- **本番リリースの考え方（マイグレーション・マスタ・アカウントデータ）**: [PRODUCTION_RELEASE_GUIDE.md](./PRODUCTION_RELEASE_GUIDE.md)
- **デプロイ先の検討**: [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md)
- 進捗: [MVP_PROGRESS.md](./MVP_PROGRESS.md)
- セキュリティ・運用 TODO: [SECURITY_READINESS.md](./SECURITY_READINESS.md)
- 全体像: [README.md](./README.md)
