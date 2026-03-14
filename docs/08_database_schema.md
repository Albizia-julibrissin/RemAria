# データベーススキーマ

この文書は、テーブル・カラム・リレーションの一覧と説明をまとめたものである。
**正は `prisma/schema.prisma`**。実装時は Prisma を更新し、本 doc は説明・メモ用として同期する。

---

## 1. 現在のスキーマ（作成済み）

### 1.1 User（ユーザーアカウント）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー（内部用） |
| email | String | NOT NULL, UNIQUE | メールアドレス。ログイン用。一意 |
| accountId | String | NOT NULL, UNIQUE | ID（英数字）。ユーザーが登録時に指定。**重複不可**。 |
| passwordHash | String | NOT NULL | ハッシュ化済みパスワード |
| name | String | NOT NULL | 表示名。**重複可**。**主人公の表示名もこの値のみを使用**（二重管理しない）。 |
| createdAt | DateTime | NOT NULL, default now() | 作成日時 |
| updatedAt | DateTime | NOT NULL, updatedAt | 更新日時 |
| premiumCurrencyFreeBalance | Int | NOT NULL, default 0 | GRA（無償分）。市場・仲間雇用等で消費時はこちらから優先。 |
| premiumCurrencyPaidBalance | Int | NOT NULL, default 0 | 課金通貨（有償分） |
| birthdate | DateTime | NULL可 | 生年月日 |
| country | String | NULL可 | 国コード |
| region | String | NULL可 | 地域 |
| accountStatus | String | NOT NULL, default "active" | active / suspended / banned |
| lastLoginAt | DateTime | NULL可 | 最終ログイン日時（※下記） |
| firstLoginAt | DateTime | NULL可 | 初回ログイン日時（※下記） |
| lastActiveAt | DateTime | NULL可 | 最終アクティブ日時（※下記）。直近5分のプレイ中人数・管理画面で参照。 |
| locale | String | NULL可 | 表示言語 |
| protagonistCharacterId | String | NULL可, UNIQUE, FK→Character.id | 主人公1体（category=protagonist）。登録時または初回キャラ作成時に設定。 |
| partyPresetLimit | Int | NOT NULL, default 5 | パーティプリセットの最大所持数（作戦室）。将来は課金等でユーザごとに増やせる想定。spec/039。 |
| companionLimit | Int | NOT NULL, default 5 | 仲間の上限（ユーザーごと）。docs/082。管理・課金で増枠可。 |
| researchPoint | Int | NOT NULL, default 0 | 研究記録書の所持数。クエスト報酬等で加算、研究解放で消費。表示名は「研究記録書」。docs/054。 |

**アカウント登録時の入力項目**
- **メールアドレス**（必須・一意）：ログイン識別子。
- **ID**（accountId）（必須・一意）：英数字。**重複不可**（他ユーザーと被ると登録エラー）。
- **名前**（name）（必須）：表示名。**重複可**。この値が**主人公キャラの表示名**としても使われる（名前は User にのみ保持し、二重管理しない）。長さは **おおよそ全角 12 文字・半角 24 文字（UTF-8 約 24 バイト）以内** を想定し、バリデーションもこれに従う。

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
- **lastActiveAt** ＝ **最終アクティブ日時**（保護パスへのアクセスなど「操作」があった日時）。
  - spec/010_auth §11.6 に従い、ルート layout で認証済みユーザーの lastActiveAt を更新する。同一ユーザーは **1 分に 1 回まで** 更新（スロットリング）して DB 負荷を抑える。
  - 「いま〇人がプレイ中」は `lastActiveAt >= NOW() - 5分` のユーザー数で表示。管理画面のユーザ一覧でも表示する。

---

### 1.2 Character（主人公・仲間・メカ統一）

主人公・仲間・メカを1テーブルで管理。category で判別。**PlayerCharacter は廃止し Character に統一済み。**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| userId | String | NOT NULL, FK→User.id | 所有者 |
| category | String | NOT NULL | protagonist / companion / mech |
| displayName | String | NOT NULL, default "冒険者" | 表示名。**主人公では参照しない**（主人公の表示名は User.name を使用）。仲間・メカではこのカラムを使用。 |
| iconFilename | String | NULL可 | アイコン画像ファイル名 |
| description | String | NULL可 | 説明文 |
| protagonistTalentId | String | NULL可 | 主人公専用（仲間・メカでは未使用） |
| createdAt | DateTime | NOT NULL, default now() | 作成日時 |
| updatedAt | DateTime | NOT NULL, updatedAt | 更新日時 |
| STR, INT, VIT, WIS, DEX, AGI, LUK, CAP | Int | NOT NULL, default 各10（CAP=60） | 基礎ステータス（10_battle_status.csv 準拠） |

**ステータスの二層解釈**（08・09・10 共通の前提）

- **永続するのは基礎ステータスだけ**（上記 7 種＋CAP）。戦闘用・工業用の「最終値」は保存しない。
- **戦闘時**：基礎ステータスを **`docs/10_battle_status.csv` の係数表で二次解釈**し、戦闘用ステータス（HP・物理攻撃力・速度（回避）・命中力など）を算出して使う。**AGI は「速度」そのものではない**。AGI は係数計算の**入力**の一つであり、計算結果として**派生値「速度（回避）」**（EVA）が得られる。
- **工業配備時**：基礎ステータスが**そのまま影響**する（二次解釈しない）。戦闘時のみ係数表で戦闘用ステータスに換算する。

**主人公の表示名について（二重管理の回避）**
- 主人公キャラの「名前」は **User.name にのみ保持**する。Character.displayName は主人公では使わない（表示時は常に User.name を参照する）。
- 仲間・メカの表示名は Character.displayName を使用する。これにより名前の管理を一箇所に統一し、二重管理を避ける。

**リレーション**
- `User` … N対1（userId）。主人公は User.protagonistCharacterId で 1対1参照。
- `CharacterSkill` … 1対多（習得スキル）。spec/030。

---

### 1.3 Skill（スキルマスタ）

仲間雇用時の工業スキル付与などで参照。**spec/030、docs/13、15**。工業スキルは**対象タグ（targetTagId）の設備に配備時のみ**効果発動。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| name | String | NOT NULL | 表示名 |
| category | String | NOT NULL | industrial / battle_active / battle_passive 等 |
| description | String | NULL可 | 説明文（画面表示用） |
| effectType | String | NULL可 | 工業スキル用。`time_reduction`（時間短縮） / `production_bonus`（生産量アップ） |
| effectValue | Int | NULL可 | 百分率（例: 5 → 5%） |
| targetTagId | String | NULL可, FK→Tag.id | 工業スキル用。このタグを持つ設備に配備時のみ効果。 |
| createdAt | DateTime | NOT NULL, default now() | 作成日時 |
| updatedAt | DateTime | NOT NULL, updatedAt | 更新日時 |

- **リレーション**：CharacterSkill から N対1。Tag と N対1（targetTag）。
- **工業スキル**：category = `industrial`。effectType / effectValue / targetTagId で「〇〇タグの設備で時間短縮〇%／生産量〇%アップ」を定義。MVP で 5 種を seed 登録。

---

### 1.4 CharacterSkill（習得スキル）

キャラが持つスキルを管理。**spec/030**。Character 削除時は連動削除（Cascade）。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| characterId | String | NOT NULL, FK→Character.id | キャラ |
| skillId | String | NOT NULL, FK→Skill.id | スキル |
| createdAt | DateTime | NOT NULL, default now() | 習得日時（雇用時など） |

- **リレーション**：Character N対1、Skill N対1。
- **一意**：同一キャラに同一スキルを二重登録しない場合は @@unique([characterId, skillId]) を検討。
- 仲間は雇用時に工業スキルを 1 つランダムで習得。主人公・メカは別 spec で習得処理を定義。

---

### 1.5 Tag（設備・スキル用タグ）

**docs/15**。設備に複数タグを付け、工業スキルは「対象タグ」に一致する設備に配備されたときだけ効果を発揮する。タグの増減は将来調整可。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| code | String | NOT NULL, UNIQUE | 安定参照用（例: water, ore）。コードで参照。 |
| name | String | NOT NULL | 表示名（例: 水） |
| description | String | NULL可 | 説明 |
| createdAt | DateTime | NOT NULL, default now() | 作成日時 |
| updatedAt | DateTime | NOT NULL, updatedAt | 更新日時 |

- **リレーション**：FacilityTypeTag で設備と多対多。Skill の targetTagId で工業スキルの対象タグを参照。

---

### 1.6 FacilityType（設備マスタ）

**docs/02、15、017**。設備（川探索拠点・精錬機などの施設の種類）のマスタ。設置可能な設備の種類を定義する。**kind** で資源探索／工業／訓練を区別（入出力の意味が異なる）。1設備＝1レシピは将来 Recipe で紐づけ。タグは FacilityTypeTag で多対多。型（基本型／派生型）は docs/017 参照。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| name | String | NOT NULL | 設備名（例: 浄水施設、川探索拠点） |
| kind | String | NOT NULL | `resource_exploration`（資源探索・input なし output 資源） / `industrial`（工業・input あり output 加工品） / `training`（訓練・output なし、ステータス変動のみ） |
| description | String | NULL可 | 説明 |
| createdAt | DateTime | NOT NULL, default now() | 作成日時 |
| updatedAt | DateTime | NOT NULL, updatedAt | 更新日時 |

- **リレーション**：FacilityTypeTag で Tag と多対多。
- **流れ例**：川探索拠点（資源）→ 水。浄水施設（工業）に水を input → 飲料水。訓練所（訓練）→ ステータス変動のみ。

---

### 1.7 FacilityTypeTag（設備 ↔ タグ）

設備にタグを付与する多対多の中間テーブル。**docs/15**。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| facilityTypeId | String | NOT NULL, FK→FacilityType.id | 設備（FacilityType） |
| tagId | String | NOT NULL, FK→Tag.id | タグ |
| createdAt | DateTime | NOT NULL, default now() | 作成日時 |

- **一意**：@@unique([facilityTypeId, tagId])。同一設備に同一タグは1回のみ。
- 配備時、設備のタグとキャラの工業スキル targetTag を照合して効果を適用する。

---

### 1.8 CurrencyTransaction（通貨履歴）

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

### 1.8.1 ItemUsageLog（特別アイテム使用履歴・docs/081）

特別アイテム（Item.category = special）を消費したときに 1 件ずつ記録する。理由コードは `src/lib/constants/item-usage-reasons.ts` で管理。取り扱い方針は **docs/081_special_items_policy.md** を参照。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| userId | String | NOT NULL, FK→User.id | 対象ユーザー |
| itemId | String | NOT NULL, FK→Item.id | 消費したアイテム |
| quantity | Int | NOT NULL | 消費数（正の値） |
| reason | String | NOT NULL | 理由コード（ITEM_USAGE_REASON_*） |
| referenceType | String | NULL可 | 参照種別（例: character, facility_instance） |
| referenceId | String | NULL可 | 参照ID |
| createdAt | DateTime | NOT NULL, default now() | 発生日時 |

**リレーション**: User N対1、Item N対1。インデックス: userId, (userId, createdAt), itemId。

### 1.9 Order（購入・決済）

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

### 1.10 ChatMessage（全体チャット・spec/037）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| userId | String | NOT NULL, FK→User.id | 送信者 |
| body | String | NOT NULL | 本文（spec で最大 500 文字） |
| createdAt | DateTime | NOT NULL, default now() | 送信日時 |

- **リレーション**: User N対1（User.chatMessages）。
- **用途**: docs/00・022 の全体チャット。直近ログのみ保持（永続は最小限）。インデックス: createdAt 降順取得用。

### 1.11 リレーション（現状）

```
User (1) -- protagonistCharacterId --> (1) Character [category=protagonist]
  (1) ----< (N) Character（characters: 全キャラ）
  (1) ----< (N) CurrencyTransaction
  (1) ----< (N) Order
  (1) ----< (N) ChatMessage

Character (1) ----< (N) CharacterSkill >---- (N) Skill（マスタ）
Skill (N) -- targetTagId --> (1) Tag

FacilityType (N) ----< FacilityTypeTag >---- (N) Tag
```

- **仲間追加**：推薦紹介状（Item.code=letter_of_recommendation）を1消費して仲間を1体作成。spec/030、docs/081。使用履歴は ItemUsageLog。
- **ChatMessage**：全体チャット（spec/037, docs/022）。直近ログのみ保持。
- **Tag・FacilityType・FacilityTypeTag**：設備タグと工業スキル効果の対象。docs/15。設備の型（基本型／派生型）は docs/017。初期データは seed で投入。

### 1.12 spec/068: 任務による機能解放（探索テーマ・研究グループ）

開拓任務のクリア報告時に、紐づく探索テーマ・研究グループをユーザに「解放済み」として記録する（フラグ方式）。**正は schema.prisma**。

| モデル | 説明 | 主なカラム・制約 |
|--------|------|-------------------|
| **QuestUnlockExplorationTheme** | 任務→テーマの紐づけ（この任務クリアでこのテーマ解放） | questId, themeId。@@id([questId, themeId])。FK onDelete: Cascade。@@index([themeId])。 |
| **UserExplorationThemeUnlock** | ユーザが解放済みの探索テーマ | userId, themeId。@@id([userId, themeId])。@@index([userId])。 |
| **QuestUnlockResearchGroup** | 任務→研究グループの紐づけ（この任務クリアでこのグループ解禁） | questId, researchGroupId。@@id([questId, researchGroupId])。@@index([researchGroupId])。 |
| **UserResearchGroupUnlock** | ユーザが解禁済みの研究グループ | userId, researchGroupId。@@id([userId, researchGroupId])。@@index([userId])。 |

- **User** に `explorationThemeUnlocks`, `researchGroupUnlocks` のリレーション追加。
- **Quest** に `unlockExplorationThemes`, `unlockResearchGroups` のリレーション追加。
- **ExplorationTheme** に `questUnlocks`, `userUnlocks` 追加。**ResearchGroup** に `questUnlocks`, `userUnlocks` 追加。
- 詳細は **docs/068_quest_unlock_themes_and_research.md** と **spec/068_quest_unlock_themes_and_research.md**。

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

---

## 5. 探索テーブル（Expedition / ExpeditionHistory）

### 5.1 Expedition（現在の探索 1 本）

**spec/049_exploration**, **spec/061_expedition_single_row_per_user** 準拠。  
「1 回の探索出撃」の進行・結果を保持するテーブルだが、**1 ユーザーにつき常に 1 行だけを持つ**（行を再利用する）モデルに変更する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| userId | String | NOT NULL, UNIQUE, FK→User.id | 所有ユーザー。**1ユーザー1行**に制限。 |
| areaId | String | NOT NULL, FK→ExplorationArea.id | 探索エリア |
| partyPresetId | String | NOT NULL, FK→PartyPreset.id | 出撃時のパーティプリセット |
| state | String | NOT NULL, default "in_progress" | in_progress / ready_to_finish / finished / aborted |
| startedAt | DateTime | NULL可 | 今回の探索 run の開始日時。行再利用のため、開始ごとに UPDATE で上書き。 |
| remainingNormalBattles | Int | NOT NULL, default 0 | 残り通常戦回数 |
| strongEnemyCleared | Boolean | NOT NULL, default false | 強敵撃破済みか |
| areaLordCleared | Boolean | NOT NULL, default false | 領域主撃破済みか |
| battleWinCount | Int | NOT NULL, default 0 | 勝利した戦闘数 |
| skillSuccessCount | Int | NOT NULL, default 0 | 成功した技能判定の回数 |
| currentHpMp | Json | NULL可 | 探索中の HP/MP 状態。{ characterId: { hp, mp } } などを想定。 |
| explorationState | Json | NULL可 | 探索用消耗品・一時バフなど、探索レイヤーの状態。 |
| totalExpGained | Int | NOT NULL, default 0 | この探索で獲得した経験値合計（主人公・仲間に同量付与するためのメモ） |
| createdAt | DateTime | NOT NULL, default now() | 行が初めて作られた日時 |
| updatedAt | DateTime | NOT NULL, updatedAt | 更新日時 |

- **行粒度**: `1ユーザー = 1 行`。探索開始のたびに新規 INSERT はせず、既存行を UPDATE で再利用する（spec/061）。
- **進行中探索の有無判定**: userId から 1 行取得し、`state in ('in_progress','ready_to_finish')` かどうかで判断。
- **履歴**: 完了/中断済み run のサマリが必要な場合は ExpeditionHistory を使用する。

### 5.2 ExpeditionHistory（探索履歴サマリ）

**spec/061_expedition_single_row_per_user** で導入される任意テーブル。  
完了/中断した探索 run ごとに 1 行を持ち、**軽量なサマリ情報のみ**を保持する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| userId | String | NOT NULL, FK→User.id | 探索したユーザー |
| areaId | String | NOT NULL | 探索エリア ID（FK制約は実装に合わせて付与） |
| partyPresetId | String | NOT NULL | 使用したパーティプリセット ID |
| state | String | NOT NULL | finished / aborted |
| startedAt | DateTime | NOT NULL | run の開始日時（Expedition.startedAt のコピー。既存移行時は createdAt でも可） |
| finishedAt | DateTime | NOT NULL | run の終了日時 |
| battleWinCount | Int | NOT NULL, default 0 | 勝利した戦闘数 |
| skillSuccessCount | Int | NOT NULL, default 0 | 技能成功回数 |
| totalExpGained | Int | NOT NULL, default 0 | 獲得経験値合計 |
| createdAt | DateTime | NOT NULL, default now() | この履歴行の作成日時 |

- **行粒度**: `1 run = 1 行`。件数は増え続けてよいが、1 行あたりは軽量。
- **用途**:
  - CSV エクスポート（過去の探索一覧）
  - 分析（ユーザーごとのプレイ履歴）
  - 将来の「探索履歴画面」のデータソース
- **インデックス**:
  - `userId`（ユーザーごとの履歴一覧）
  - `finishedAt`（時系列ソート）

### 5.3 探索イベント（技能イベント本実装・spec/073）

**spec/073_skill_events_exploration** 準拠。探索中の技能イベントをマスタ化し、エリアごとに発生しうるイベントを重み付きで紐づける。

| テーブル | 役割 |
|----------|------|
| **ExplorationEvent** | 探索イベントの共通マスタ。eventType（skill_check 等）で種別分岐。 |
| **SkillEventDetail** | 技能イベント専用。発生時メッセージ（ExplorationEvent と 1 対 1）。 |
| **SkillEventStatOption** | 技能イベントのステータスごとの係数・成功/失敗メッセージ。 |
| **AreaExplorationEvent** | エリア × イベントの紐づけ（weight で重み付き抽選）。 |

**ExplorationEvent**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (cuid) | PK | 主キー |
| code | String | NOT NULL, UNIQUE | 安定参照用コード |
| eventType | String | NOT NULL | skill_check 等。将来 story_choice 等を拡張 |
| name | String | NOT NULL | 管理用表示名 |
| description | String | NULL可 | 説明（任意） |
| createdAt / updatedAt | DateTime | NOT NULL | 作成・更新日時 |

**SkillEventDetail**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| explorationEventId | String | PK, FK→ExplorationEvent.id | 対応する探索イベント（1 対 1） |
| occurrenceMessage | String | NOT NULL | 発生時共通メッセージ。選択前の画面で 1 回表示 |

**SkillEventStatOption**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| skillEventDetailId | String | PK の一部, FK→SkillEventDetail | 技能イベント詳細 |
| statKey | String | PK の一部 | STR \| INT \| VIT \| WIS \| DEX \| AGI \| LUK |
| sortOrder | Int | NOT NULL, default 0 | 表示順 |
| difficultyCoefficient | Float | NOT NULL, default 1 | 閾値 = エリア skillCheckRequiredValue × 係数（端数四捨五入） |
| successMessage | String | NOT NULL | そのステで成功したときの解決メッセージ |
| failMessage | String | NOT NULL | そのステで失敗したときの解決メッセージ |

@@id([skillEventDetailId, statKey])。

**AreaExplorationEvent**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| areaId | String | PK の一部, FK→ExplorationArea.id | 探索エリア |
| explorationEventId | String | PK の一部, FK→ExplorationEvent.id | 探索イベント |
| weight | Int | NOT NULL | 出現重み。抽選で使用。0 で無効扱い可 |

@@id([areaId, explorationEventId])。同一エリアに同一イベントは 1 行。

- **ExplorationArea** にリレーション `areaExplorationEvents AreaExplorationEvent[]` を追加済み。
- 抽選: 技能に振れたとき、そのエリアの AreaExplorationEvent（weight > 0）から重み付きで 1 件選択。0 件のときは従来の固定文言・エリア skillCheckRequiredValue でフォールバック（後方互換）。
