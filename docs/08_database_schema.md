# データベーススキーマ

この文書は、テーブル・カラム・リレーションの一覧と説明をまとめたものである。
**正は `prisma/schema.prisma`**。実装時は Prisma を更新し、本 doc は説明・メモ用として同期する。

---

## 1. 現在のスキーマ（作成済み）

### 1.1 User（ユーザーアカウント）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| email | String | NOT NULL, UNIQUE | ログイン用。一意 |
| passwordHash | String | NOT NULL | ハッシュ化済みパスワード |
| name | String | NULL可 | 表示名（任意） |
| createdAt | DateTime | NOT NULL, default now() | 作成日時 |
| updatedAt | DateTime | NOT NULL, updatedAt | 更新日時 |
| gameCurrencyBalance | Int | NOT NULL, default 0 | ゲーム通貨残高 |
| premiumCurrencyFreeBalance | Int | NOT NULL, default 0 | 課金通貨（無償分） |
| premiumCurrencyPaidBalance | Int | NOT NULL, default 0 | 課金通貨（有償分） |
| birthdate | DateTime | NULL可 | 生年月日 |
| country | String | NULL可 | 国コード |
| region | String | NULL可 | 地域 |
| accountStatus | String | NOT NULL, default "active" | active / suspended / banned |
| lastLoginAt | DateTime | NULL可 | 最終ログイン日時（※下記） |
| firstLoginAt | DateTime | NULL可 | 初回ログイン日時（※下記） |
| locale | String | NULL可 | 表示言語 |
| protagonistCharacterId | String | NULL可, UNIQUE, FK→Character.id | 主人公1体（category=protagonist）。登録時または初回キャラ作成時に設定。 |

**リレーション**
- `Character`（主人公） … protagonistCharacterId で 1対1
- `Character`（所有キャラ全体） … characters で 1対多
- `CurrencyTransaction` … 1対多
- `Order` … 1対多

#### lastLoginAt / firstLoginAt の扱い

- **lastLoginAt** ＝ **最終認証日時**（パスワードでログインしてセッションを確立した日時）。
  - **更新するのはログイン成功時のみ**。セッション有効中にゲーム操作しても更新しない。
  - 例: 2/1 にログイン → 2/7 にセッション切れ → lastLoginAt は 2/1 のまま。2/7 に再ログインしたらその時点で 2/7 に更新。
  - 負荷を抑えるため、リクエストごとの更新は行わない。
- **firstLoginAt** ＝ 初回ログイン日時。初回ログイン（または登録時の自動ログイン）時に 1 回だけ設定し、以降は更新しない。
- 「最後にプレイした日時」など活動ベースで見たい場合は、別途 lastActivityAt 等を用意し、更新は日単位など間引いて行う設計を検討する。

---

### 1.2 Character（主人公・仲間・メカ統一）

主人公・仲間・メカを1テーブルで管理。category で判別。**PlayerCharacter は廃止し Character に統一済み。**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| userId | String | NOT NULL, FK→User.id | 所有者 |
| category | String | NOT NULL | protagonist / companion / mech |
| displayName | String | NOT NULL, default "冒険者" | 表示名 |
| iconFilename | String | NULL可 | アイコン画像ファイル名 |
| description | String | NULL可 | 説明文 |
| protagonistTalentId | String | NULL可 | 主人公専用（仲間・メカでは未使用） |
| createdAt | DateTime | NOT NULL, default now() | 作成日時 |
| updatedAt | DateTime | NOT NULL, updatedAt | 更新日時 |
| STR, INT, DEX, VIT, SPD, LUK, CAP | Int | NOT NULL, default 各10（CAP=60） | 基礎ステータス |

**リレーション**
- `User` … N対1（userId）。主人公は User.protagonistCharacterId で 1対1参照。

---

### 1.3 CurrencyTransaction（通貨履歴）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| userId | String | NOT NULL, FK→User.id | 対象ユーザー |
| currencyType | String | NOT NULL | game / premium_free / premium_paid |
| amount | Int | NOT NULL | 増減量（正: 増加, 負: 消費） |
| reason | String | NULL可 | 理由 |
| referenceType | String | NULL可 | 関連種別 |
| referenceId | String | NULL可 | 関連ID |
| createdAt | DateTime | NOT NULL, default now() | 発生日時 |

**リレーション**: User N対1

### 1.4 Order（購入・決済）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| userId | String | NOT NULL, FK→User.id | 購入者 |
| externalPaymentId | String | NULL可, UNIQUE | 決済プロバイダのトランザクションID |
| amountPaid | Int | NOT NULL | 支払い金額（最小単位） |
| premiumCurrencyGranted | Int | NOT NULL | 付与した課金通貨（有償分） |
| status | String | NOT NULL | pending / completed / refunded / failed |
| createdAt | DateTime | NOT NULL, default now() | 購入日時 |
| completedAt | DateTime | NULL可 | 完了日時 |

**リレーション**: User N対1

### 1.5 リレーション（現状）

```
User (1) -- protagonistCharacterId --> (1) Character [category=protagonist]
  (1) ----< (N) Character（characters: 全キャラ）
  (1) ----< (N) CurrencyTransaction
  (1) ----< (N) Order
```

---

## 2. 将来の拡張メモ

- 通貨消費順は「無償 → 有償」で実装する想定。
- 通貨残高は User にキャッシュし、増減時に CurrencyTransaction も記録する二重管理とする。
- 有償課金付与時は Order.id を CurrencyTransaction の referenceId に保存する。
- 月額課金上限（未成年向け）などは User にカラム追加で対応可能。

---

## 3. 用語・備考

- **ゲーム通貨**: 課金なしでゲーム内で獲得・消費する通貨。
- **課金通貨（無償分）**: ログボ・イベント・補填などで付与。消費時は無償→有償の順を想定。
- **課金通貨（有償分）**: 実マネー購入で増える部分。返金・規約対応のため履歴と分離して管理。
- **正のスキーマ**: マイグレーションは必ず `prisma/schema.prisma` を編集し、`prisma migrate` で行う。本 doc の表は説明用である。

---

## 4. キャラ周り設計（Character 統一・実施済み）

**主人公・仲間・メカを1テーブル（Character）で扱い、判別用に category を用意する**。  
スキーマ・マイグレーション・リポジトリは Character に統一済み。PlayerCharacter は削除済み。

### 4.1 方針

| 項目 | 内容 |
|------|------|
| テーブル | **Character** 1本。PlayerCharacter を置き換え、仲間・メカも同じテーブルに行として持つ。 |
| 判別 | **category**（protagonist / companion / mech）で主人公・仲間・メカを区別。 |
| アカウントキャラ | category = protagonist。1ユーザーあたり**必ず1体**。User.protagonistCharacterId（FK, UNIQUE）で参照。 |
| 仲間 | category = companion。同一 User に 0〜N 体。 |
| メカ | category = mech。同一 User に 0〜N 体。パーツ構成は MechPart 等で別管理する想定（将来）。 |
| 主人公専用効果 | Character にカラム追加（例: protagonistTalentId）。仲間・メカの行では NULL。 |
| 戦闘・スキル | パーティメンバーはすべて Character の id で参照。ステータス・スキルは category によらず同じ扱い。種別が必要なときだけ category を見る。 |

### 4.2 Character テーブル（案）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| userId | String | NOT NULL, FK→User.id | 所有者 |
| category | String | NOT NULL | protagonist / companion / mech |
| displayName | String | NOT NULL, default "冒険者" | 表示名（キャラごとに1つ、変更方法は別途検討） |
| iconFilename | String | NULL可 | アイコン画像のファイル名（数値.gif 等）。参照は /icons/{iconFilename} |
| description | String | NULL可 | 説明文（仲間キャラ詳細画面等で表示、画面仕様は未定） |
| protagonistTalentId | String | NULL可 | 主人公専用効果（companion / mech では未使用） |
| createdAt | DateTime | NOT NULL, default now() | 作成日時 |
| updatedAt | DateTime | NOT NULL, updatedAt | 更新日時 |

- 将来、主人公専用を増やす場合は同様に **Character に nullable カラム**を足し、仲間・メカでは使わない。
- メカのパーツ構成は MechPart 等を別テーブルで持ち、Character.id（category=mech）に紐づける想定。

### 4.3 User 側の変更（案）

| カラム | 説明 |
|--------|------|
| protagonistCharacterId | String, NULL可, UNIQUE, FK→Character.id | アカウントキャラ1体（category=protagonist）を指す。登録時または初回キャラ作成時に1度設定し、以降は固定。 |

- User は characters Character[] と protagonistCharacter Character?（protagonistCharacterId）を持つ。PlayerCharacter は廃止済み。

### 4.4 リレーション（イメージ）

```
User (1) ----< (N) Character（category: protagonist / companion / mech）
  |                ↑
  |   protagonistCharacterId (1対1: category=protagonist の1行)
  └────────────────┘
```

- アカウントキャラ: `user.protagonistCharacterId === character.id` かつ `character.category === 'protagonist'` の1行。
- 仲間: `character.userId === user.id` かつ `character.category === 'companion'`。
- メカ: `character.userId === user.id` かつ `character.category === 'mech'`。
