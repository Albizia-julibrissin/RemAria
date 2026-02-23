# Spec: 主人公作成

`docs/01_features.md` MVP「キャラ管理」のうち、**主人公（アカウントキャラ）の作成のみ**を扱う。  
仲間・メカの作成は別 spec とする。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：セッションが有効であること（ログイン済み）。主人公作成画面・API は保護画面として getSession を前提とする。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| createProtagonist | 主人公を1体作成 | 主人公作成画面 |
| getProtagonist | 主人公の有無・詳細取得 | ミドルウェア／layout（リダイレクト判定）、ダッシュボード等 |

**横断前提**：ログイン後の保護画面では「主人公未作成なら作成画面へ強制遷移」する場合、本 spec の getProtagonist（または同等の判定）を用いる。

------------------------------------------------------------------------

## 1. 目的

- 登録後、ログインしたユーザーが主人公を**1体だけ**作成できること。
- 主人公未作成の場合は**作成画面に強制遷移**し、名前とアイコンを選択して作成すること。
- 作成後は通常の保護画面（ダッシュボード等）に進めること。

------------------------------------------------------------------------

## 2. 用語

- **主人公**：アカウントキャラ。Character の 1 行で `category = "protagonist"`。1 ユーザーあたり必ず 1 体（作成済みなら追加作成しない）。
- **User.protagonistCharacterId**：そのユーザーの主人公の Character.id を指す。NULL のとき「主人公未作成」。
- **作成画面**：名前（表示名）とアイコンを入力・選択し、createProtagonist を呼ぶ画面。

------------------------------------------------------------------------

## 3. 入力（Input）

### 3.1 主人公作成（createProtagonist）

```json
{
  "displayName": "冒険者",
  "iconFilename": "1.gif"
}
```

- `displayName`：必須。表示名。長さは実装で上限を設ける（例：50 文字）。空不可。
- `iconFilename`：必須。選択したアイコンのファイル名（例：`1.gif`）。**選択肢は定数で保持**（例：`public/icons` 内の許可リスト）。不正な値はバリデーションエラー。

------------------------------------------------------------------------

## 4. 出力（Output）

### 4.1 作成成功時

```json
{
  "success": true,
  "characterId": "clx..."
}
```

- Character を 1 件作成し、User.protagonistCharacterId に設定したうえで返す。以降は主人公作成画面には強制遷移しない。

### 4.2 エラー時

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "ユーザー向けメッセージ"
}
```

- 例：`ALREADY_CREATED`（既に主人公がいる）、`VALIDATION_ERROR`（displayName や iconFilename の不正）。

------------------------------------------------------------------------

## 5. ルール

### 5.1 作成トリガー・遷移

- **ログイン後**、いずれかの保護画面（ダッシュボード等）にアクセスしたとき、**主人公が未作成**（User.protagonistCharacterId が NULL）なら、**主人公作成画面に強制遷移**する。
- 作成画面以外の保護画面は「主人公が作成済みであること」を前提としてよい（未作成なら作成画面へリダイレクト）。

### 5.2 作成内容

- **1 ユーザーにつき主人公は 1 体のみ**。既に protagonistCharacterId が設定されている場合は createProtagonist を呼んでも新規作成せず、`ALREADY_CREATED` を返すか、作成画面を表示しないようにする。
- 作成する Character の内容：
  - `userId`：セッションの userId
  - `category`：`"protagonist"`
  - `displayName`：入力値（トリム済み）
  - `iconFilename`：入力値（許可リストに含まれるもの）
  - **ステータス初期値**：**定数で保持**。全基礎ステータスを **10** とする。
    - `STR = 10`, `INT = 10`, `DEX = 10`, `VIT = 10`, `SPD = 10`, `LUK = 10`
    - `CAP`：定数で保持（値は実装で定義。例：60 や 70 など）
  - `description`：NULL でよい
  - `protagonistTalentId`：NULL でよい

### 5.3 定数

- **初期ステータス**：上記の 10 および CAP の値は、コード内の定数（または設定）で保持する。マスタは使わない。
- **アイコン選択肢**：作成画面で選べる iconFilename の一覧を定数で保持する（例：`["1.gif", "2.gif", "3.gif", "4.gif", "5.gif"]`）。送信された iconFilename がこの一覧に含まれるか検証する。

------------------------------------------------------------------------

## 6. 処理フロー（概要）

### 6.1 ログイン後のリダイレクト判定

1. 保護画面にアクセス
2. getSession で userId 取得
3. getProtagonist(userId) または User に protagonistCharacterId が存在するか確認
4. 存在しなければ主人公作成画面へリダイレクト

### 6.2 主人公作成（createProtagonist）

1. セッション検証（未ログインならエラー）
2. 既に protagonistCharacterId が設定されていれば `ALREADY_CREATED` で終了
3. 入力検証（displayName 長・空でない、iconFilename が許可リストに含まれる）
4. Character を 1 件作成（category=protagonist, displayName, iconFilename, 初期ステータスは定数）
5. User の protagonistCharacterId を更新
6. 成功レスポンスを返す

------------------------------------------------------------------------

## 7. 永続化データ / 一時データ

### 7.1 永続化するデータ

- **Character** 1 行：userId, category="protagonist", displayName, iconFilename, STR/INT/DEX/VIT/SPD/LUK/CAP の初期値（定数）、createdAt, updatedAt
- **User.protagonistCharacterId**：作成した Character.id を設定

### 7.2 保存しないデータ

- 定数（初期ステータス値・CAP・アイコン一覧）はコード内に持つ。DB には保存しない。

------------------------------------------------------------------------

## 8. 例（最低3ケース）

### ケース1：正常系（初回作成）

- 前提：ユーザーはログイン済み、主人公未作成
- 入力：displayName="主人公", iconFilename="2.gif"
- 期待：Character が 1 件作成され、User.protagonistCharacterId が設定される。success: true, characterId が返る。

### ケース2：既に主人公がいる

- 前提：そのユーザーは既に protagonistCharacterId が設定されている
- 入力：createProtagonist を呼ぶ
- 期待：新規作成しない。ALREADY_CREATED を返すか、または API が呼ばれない（画面側で作成済みなら作成画面を出さない）。

### ケース3：バリデーションエラー

- 入力：displayName が空、または iconFilename が許可リストにない
- 期待：success: false, error: "VALIDATION_ERROR", message に理由。

------------------------------------------------------------------------

## 9. エラー条件 / NG

| 条件 | 挙動 |
|------|------|
| 未ログインで createProtagonist 呼び出し | 認証エラーまたはログイン画面へリダイレクト |
| 既に主人公がいる | ALREADY_CREATED または新規作成しない |
| displayName が空または長さ超過 | VALIDATION_ERROR |
| iconFilename が許可リストにない | VALIDATION_ERROR |

------------------------------------------------------------------------

## 10. 画面仕様

### 10.1 主人公作成画面

| 項目 | 内容 |
|------|------|
| **URL** | `/character/create` または `/create-protagonist` 等（実装で決定） |
| **前提** | ログイン済み。主人公未作成の場合に表示（未作成でないとアクセスできない、または未作成時のみリダイレクト先になる） |
| **見出し** | 「主人公を作成」等 |
| **要素** | 表示名入力（必須）、アイコン選択（必須）、作成ボタン |
| **アイコン選択** | 定数で持つ一覧から 1 つ選択（ラジオまたは一覧クリック）。画像は `/icons/{iconFilename}` で表示 |
| **呼び出す API** | createProtagonist |
| **成功時** | ダッシュボード（または `/`）へリダイレクト |
| **エラー時** | フォーム上にメッセージ表示。フォームは維持 |

### 10.2 強制遷移

- ログイン後の保護画面（ダッシュボード等）で、主人公未作成なら **主人公作成画面へリダイレクト**する。
- 作成画面へのリダイレクトは、layout のサーバー側またはミドルウェアで「protagonistCharacterId が NULL なら作成画面へ」と判定して行う。

------------------------------------------------------------------------

## 11. スコープ（本 spec で扱わないもの）

- 仲間・メカの作成・入手
- 主人公の名前・アイコン変更（別 spec または後拡張）
- 訓練・装備・スキル習得（別 spec）

---

## 12. 実装メモ（現行 Prisma との対応）

- **現状の DB**：`Character` は未導入。**PlayerCharacter**（User と 1:1）で主人公を表現する。
- **主人公未作成の判定**：その User に紐づく **PlayerCharacter が存在しない**こととする（`User.protagonistCharacterId` は使わない）。
- **PlayerCharacter に追加するカラム**：`iconFilename`（String, NULL可またはデフォルト）、基礎ステータス `STR`, `INT`, `DEX`, `VIT`, `SPD`, `LUK`, `CAP`（Int, 初期値は定数で 10 / CAP は別定数）。追加後、createProtagonist で 1 件作成し、既存の User 1:1 リレーションで紐づける。
- **将来**：`docs/08_database_schema.md` の Character 案に統合する場合は、別マイグレーション・別 spec で行う。
- **アイコン一覧**：選べるアイコンは **`public/icons` 内の `.gif` を起動時に読み込み**しており、**ファイルを追加するだけでアイコンが増える**。定数での許可リストは使わない。バリデーションも同一の一覧で行う。
