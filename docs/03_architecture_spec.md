# アーキテクチャ仕様書（開発前提 / Cursor向け）

この文書は「コード規約」「ディレクトリ構成」「開発運用」「仕様ファイルの扱い」を固定し、
Cursorエージェントが迷わず実装できるようにするための前提定義である。

------------------------------------------------------------------------

## 1. 技術スタック（確定）

-   Runtime: Node.js（LTS）
-   Framework: Next.js（App Router）
-   Language: TypeScript（strict）
-   ORM: Prisma
-   DB:
    -   開発: PostgreSQL（推奨）
    -   本番: PostgreSQL
-   Session: iron-session（Cookie暗号化）
-   Styling: Tailwind CSS
-   UI: shadcn/ui（必要に応じて）
-   State:
    -   基本はServer Components / Server Actions中心
    -   クライアント状態は最小限（必要時のみZustand）
-   Realtime:
    -   MVPでは不要（HTTPで成立）
    -   将来WebSocket/Socket.ioを段階導入
-   Cache/Queue:
    -   MVPでは導入しない
    -   将来Redisを「一時状態」「ロック最適化」「PubSub」に限定導入

------------------------------------------------------------------------

## 2. 設計原則（最重要）

### 2.1 Single Source of Truth

設計の正は repo 内のファイルのみ：

-   `/docs` = 全体地図
-   `/spec` = 実装契約
-   `/docs/05_project_constitution.md` = 最上位判断基準

チャットは参照にしない。 必ずファイルへ反映してから実装する。

------------------------------------------------------------------------

### 2.2 ドメインロジック分離

-   UI/API層からゲームロジックを分離する
-   戦闘・訓練・工業計算は純粋関数中心で実装する
-   「入力 → 出力」が保存できる形を優先する

------------------------------------------------------------------------

### 2.3 永続化原則

`docs/04_persistence_principles.md` に従う。

-   再現できる中間状態は保存しない
-   結果（成果・消耗・報酬）は保存する
-   非同期処理は Job として扱う（startAt/finishAt）

------------------------------------------------------------------------

## 3. 推奨ディレクトリ構成

    /public              # 静的アセット（ルートURLから配信）
      favicon.ico        # サイト共通ファビコン
      /icons             # ゲーム用アイコン（UI・装備・キャラ等）
      /images            # 画像（立ち絵・背景・バナー等）

    /docs
      00_overview.md
      01_features.md
      02_domain_model.md
      03_architecture_spec.md
      04_persistence_principles.md
      05_project_constitution.md

    /spec
      00_spec_template.md
      010_training.md
      020_expedition.md
      030_battle.md
      040_crafting.md

    /prisma
      schema.prisma
      migrations/

    /src
      /app
        layout.tsx
        (auth)/login/
        (dashboard)/
        page.tsx
      /components
      /lib
        /domain      # 共有型・エンティティ定義
        /battle      # 戦闘純粋ロジック
        /training    # 訓練純粋ロジック
        /crafting    # 工業・製造純粋ロジック
        /jobs        # Job進行・完了判定ロジック
        /db          # Prismaクライアント等
        /auth        # セッション・認証ユーティリティ
      /server
        /actions     # Server Actions
        /services    # ビジネスオーケストレーション
        /repositories  # データアクセス層
      /types
      /utils

    /tests

### 3.1 lib/ 各ディレクトリの役割

| ディレクトリ | 役割 | 依存禁止 |
|-------------|------|---------|
| domain | 共有型・値オブジェクト（`docs/02_domain_model.md` 準拠） | UI / server / db |
| battle, training, crafting | 各ドメインの純粋関数（入力→出力のみ） | UI / server / db |
| jobs | Jobの進行計算・完了判定（純粋部分） | UI / server / db |
| db | Prismaクライアントの取得・接続 | - |
| auth | セッション取得・検証ヘルパー | - |

### 3.2 静的アセット（public/）

Next.js では `public/` 内のファイルがルートパスからそのまま配信される。

| ディレクトリ | 用途 | 参照例 |
|-------------|------|--------|
| public/ | ファビコンなどルート直下 | `/favicon.ico` |
| public/icons/ | ゲーム用アイコン（小〜中サイズ） | `/icons/logo.png` |
| public/images/ | 画像（立ち絵・背景・バナー等） | `/images/character.png` |

-   画面やコンポーネントからは `/icons/...` のようにルート相対パスで参照する。
-   `next/image` を使う場合は `src="/icons/xxx.png"` で指定する。

------------------------------------------------------------------------

## 4. 依存方向ルール

-   UI → server(actions/services) → repositories → db
-   UI → lib（純粋関数）は可
-   lib → UI/server/db は禁止

------------------------------------------------------------------------

## 5. 命名規約

-   ファイル名: kebab-case
-   関数: camelCase
-   型/クラス: PascalCase
-   Prisma Model: PascalCase（Domain Model準拠）

------------------------------------------------------------------------

## 6. Specと実装の結び方

### 6.1 Spec必須項目

-   目的
-   用語
-   入力/出力（JSON例）
-   ルール
-   例（最低3ケース）
-   例外/NG
-   永続化/一時データの区別

------------------------------------------------------------------------

### 6.2 実装ルール

-   すべての機能実装は対応するspecを持つ
-   PR/コミットには対象specを明記
-   仕様変更は必ずspec更新→実装更新の順

------------------------------------------------------------------------

## 7. DB設計ルール

-   派生値は原則保存しない
-   Jobは startAt / finishAt を持つ
-   戦闘は BattleInput / BattleResult を保存可能にする
-   トランザクション必須領域：
    -   戦闘結果適用
    -   製造完了
    -   素材消費＋生成

------------------------------------------------------------------------

## 8. テスト方針

優先順位：

1.  battle/training/crafting の純粋関数
2.  Job適用ロジック
3.  UIは最小限

------------------------------------------------------------------------

## 9. デプロイ前提（100人規模）

-   単一サーバで可
-   Docker Compose想定（app + postgres）
-   日次バックアップ

------------------------------------------------------------------------

### 9.1 ローカル開発環境（Dockerは必須ではない）

個人開発では、PostgreSQLの立て方に以下の選択肢がある：

| 方式 | 難易度 | 概要 |
|------|--------|------|
| **クラウドDB（推奨）** | 低 | Neon / Supabase の無料枠。接続文字列のみで即開始。DBサーバ不要。 |
| **ローカルPostgreSQL** | 中 | Windows/Macに直接インストール。すべてローカルで完結。 |
| **Docker Compose** | 中〜高 | 本番に近い環境。デプロイ時・チーム開発時に有用。 |

-   まず動かすなら **Neon または Supabase** が最も手早い。
-   Docker は「本番環境を再現したい」「後から追加したい」段階で導入すればよい。
-   本番は PostgreSQL を前提とするため、SQLite は MVP の超簡易検証時のみ可（後で移行が必要）。

------------------------------------------------------------------------

## 10. Cursorエージェント運用ルール

-   `/docs` と `/spec` を参照して実装すること
-   憲法に反する提案は禁止
-   変更が必要なら docs/spec を更新してからコードを変更する
-   1タスク＝1spec単位で進める
