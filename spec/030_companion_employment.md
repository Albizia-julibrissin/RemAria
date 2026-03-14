# Spec: 仲間雇用・解雇

`docs/13_companion_employment_design.md` に基づき、**人材局**で仲間を購入・作成し、**キャラ詳細から解雇**できるようにする。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：セッションが有効であること。人材局・解雇 API は保護画面として getSession を前提とする。
- **015_protagonist_creation**：主人公の有無判定。主人公未作成時は作成画面へ強制遷移（dashboard layout で実施）。
- **025_character_list**：キャラ一覧・詳細画面。仲間作成後は詳細画面へリダイレクト。解雇は詳細画面から実行する。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| purchaseCompanionHire | 雇用可能回数を 1 購入（ゲーム通貨 or 課金通貨） | 人材局画面 |
| createCompanion | 雇用可能回数を 1 消費して仲間を 1 体作成（名前・アイコン・工業スキルランダム1） | 人材局の「仲間を雇う」画面 |
| dismissCompanion | 仲間を解雇（表示名一致で確認） | キャラ詳細画面 |
| getCompanionHireState | 雇用可能回数・仲間数・上限・残高（表示用） | 雇用斡旋所画面 |

------------------------------------------------------------------------

## 1. 目的

- プレイヤーが**人材局**でゲーム通貨 1000 または 課金通貨 100 を支払い、**仲間雇用可能回数**を 1 増やせること。
- 雇用可能回数が 1 以上あるとき、**名前・アイコンを決めて仲間を 1 体作成**し、**工業スキルを 1 つランダムで付与**すること。作成後は**キャラ詳細画面へリダイレクト**し、そこで工業スキルを表示すること。
- 仲間は**最大 10 体**まで。上限時は新規作成不可（回数購入は可能）。
- **解雇**はキャラ詳細から、**キャラ名入力で確認**したうえで削除できること。

------------------------------------------------------------------------

## 2. 用語

- **人材局**：仲間雇用可能回数の購入と、仲間作成（名前・アイコン決定）を行う画面。ダッシュボードのカードから遷移。
- **雇用可能回数**：User.companionHireCount。購入で +1、仲間作成で -1。0 以上。
- **仲間**：Character の category = "companion"。1 ユーザーあたり最大 10 体。
- **工業スキル**：スキルマスタで種別「工業」のスキル。仲間は雇用時に 1 つをランダムで習得する。雇用時点ではプレイヤーに表示しない。
- **解雇**：仲間（Character）を削除すること。習得スキル（CharacterSkill）も連動削除。

------------------------------------------------------------------------

## 3. 入力（Input）

### 3.1 雇用可能回数の購入（purchaseCompanionHire）

- **支払い**：**GRA のみ**（User.premiumCurrencyFreeBalance + premiumCurrencyPaidBalance）。gameCurrencyBalance は廃止（docs/076）。
- GRA が 100 以上であること。消費は**無償→有償の順**。

### 3.2 仲間の作成（createCompanion）

- **displayName**：必須。表示名。長さ上限は主人公と同様（**おおよそ全角 12 文字・半角 24 文字（UTF-8 約 24 バイト）以内**）。空不可。
- **iconFilename**：必須。主人公作成と同じアイコン許可リストに含まれること。
- 前提：User.companionHireCount >= 1、かつ仲間（category=companion）の所持数 < 10。

### 3.3 解雇（dismissCompanion）

- **characterId**：解雇対象の Character.id。
- **confirmDisplayName**：確認用に入力した表示名。対象キャラの displayName と完全一致した場合のみ削除する。
- 前提：対象 Character の userId がセッションの userId と一致すること。category は companion であること（主人公は解雇不可）。

------------------------------------------------------------------------

## 4. 出力（Output）

### 4.1 購入成功時

```json
{
  "success": true,
  "companionHireCount": 1
}
```

- User.companionHireCount を +1。CurrencyTransaction に記録（reason: `companion_hire_purchase`、referenceType: `user` / referenceId: userId 等）。

### 4.2 購入エラー時

```json
{
  "success": false,
  "error": "INSUFFICIENT_GAME" | "INSUFFICIENT_PREMIUM",
  "message": "ゲーム通貨が足りません（あと 500 必要）",
  "shortfall": 500
}
```

- shortfall：あといくつ必要か。表示用。

### 4.3 仲間作成成功時

```json
{
  "success": true,
  "characterId": "clx..."
}
```

- 作成した仲間のキャラ詳細画面（/dashboard/characters/[characterId]）へリダイレクトする。

### 4.4 仲間作成エラー時

```json
{
  "success": false,
  "error": "NO_HIRE_COUNT" | "COMPANION_LIMIT" | "VALIDATION_ERROR",
  "message": "ユーザー向けメッセージ"
}
```

### 4.5 解雇成功時

- 削除完了。キャラ一覧（/dashboard/characters）へリダイレクトする。

### 4.6 解雇エラー時

- 表示名が一致しない場合：`CONFIRM_NAME_MISMATCH`。削除しない。
- 対象が存在しない or 他ユーザー：404 または `NOT_FOUND`。

------------------------------------------------------------------------

## 5. ルール

### 5.1 価格（暫定）

- ゲーム通貨：**1000** で雇用可能回数 1。
- 課金通貨：**100** で雇用可能回数 1。無償残高から先に消費し、足りなければ有償から消費する。

### 5.2 購入処理

- 残高不足の場合は INSUFFICIENT_GAME / INSUFFICIENT_PREMIUM を返し、**shortfall** を返す（「あと X 必要」表示用）。
- 購入時は**仲間数上限（10）をチェックしない**。回数だけ増やす。作成時に上限チェックする。

### 5.3 仲間作成処理

- 雇用可能回数が 0 の場合は `NO_HIRE_COUNT`。
- 仲間が既に 10 体の場合は `COMPANION_LIMIT`。
- Character 作成：category = "companion"、displayName / iconFilename、初期ステータスは主人公と同じ定数（STR, INT, VIT, WIS, DEX, AGI, LUK=10, CAP=60）。
- 工業スキル：スキルマスタのうち種別「工業」のスキルから **1 つをランダムに選び**、CharacterSkill に 1 行登録する。MVP は工業スキル 5 種。
- 同一トランザクションで：companionHireCount -1、Character 作成、CharacterSkill 登録。失敗時はロールバック。

### 5.4 解雇処理

- 対象が仲間（category=companion）かつ userId が一致する場合のみ解雇可能。主人公（category=protagonist）は解雇不可。
- 入力された confirmDisplayName が、対象 Character の displayName と**完全一致**した場合のみ削除実行。
- Character 削除時は CharacterSkill も連動削除（FK onDelete: Cascade または明示削除）。

### 5.5 アイコン

- 仲間のアイコン選択肢は**主人公作成と同じ**（public/icons の許可リスト）。

------------------------------------------------------------------------

## 6. 処理フロー（概要）

### 6.1 雇用可能回数の購入

1. セッション検証。paymentType に応じて残高チェック。
2. 不足なら shortfall を計算し、INSUFFICIENT_* と message を返す。
3. トランザクション：残高減算（課金の場合は無償→有償）、User.companionHireCount += 1、CurrencyTransaction に 1 件追加（amount: -1000 or -100、reason: companion_hire_purchase）。
4. success: true と新しい companionHireCount を返す。

### 6.2 仲間の作成

1. セッション検証。companionHireCount >= 1、仲間数 < 10 をチェック。
2. displayName / iconFilename のバリデーション。
3. トランザクション：companionHireCount -= 1、Character 作成（companion、初期ステータス）、工業スキルをランダム 1 つ選んで CharacterSkill に登録、CurrencyTransaction は記録しない（購入時に済み）。
4. success: true、characterId を返す。画面側で /dashboard/characters/[characterId] へリダイレクト。

### 6.3 解雇

1. セッション検証。characterId で Character 取得、userId 一致かつ category=companion であることを確認。
2. confirmDisplayName と character.displayName を比較（トリム済みで完全一致）。
3. 一致すれば Character 削除（CharacterSkill は Cascade で削除）。キャラ一覧へリダイレクト。
4. 一致しなければ CONFIRM_NAME_MISMATCH。削除しない。

------------------------------------------------------------------------

## 7. 永続化データ / 一時データ

### 7.1 永続化するデータ

- **User.companionHireCount**：購入で +1、仲間作成で -1。
- **CurrencyTransaction**：購入時に 1 件（amount 負、reason: companion_hire_purchase）。
- **Character**：仲間 1 件。category=companion、初期ステータス、displayName、iconFilename。
- **CharacterSkill**：仲間につき 1 行（雇用時ランダムで選んだ工業スキル）。

### 7.2 保存しないデータ

- 価格（1000 / 100）は定数で保持。仲間上限 10 も定数。

------------------------------------------------------------------------

## 8. 例（最低3ケース）

### ケース1：購入成功（GRA）

- 前提：GRA（無償＋有償合計）>= 100。
- 操作：purchaseCompanionHire（GRA で支払い。無償から優先消費）。
- 期待：premiumCurrencyFreeBalance / premiumCurrencyPaidBalance が合計 100 減り、companionHireCount が 1 増える。CurrencyTransaction に reason=companion_hire_purchase で記録。

### ケース2：仲間作成 → 詳細へ

- 前提：companionHireCount >= 1、仲間 9 体以下。displayName / iconFilename 妥当。
- 操作：createCompanion 実行。
- 期待：companionHireCount が 1 減り、仲間が 1 体作成され、工業スキルが 1 つランダムで付与される。レスポンスで characterId が返り、/dashboard/characters/[id] へリダイレクト。詳細画面で工業スキルが表示される。

### ケース3：解雇（名前一致で削除）

- 前提：対象が仲間で、userId 一致。confirmDisplayName が "テスト仲間"、character.displayName が "テスト仲間"。
- 操作：dismissCompanion(characterId, "テスト仲間")。
- 期待：その Character と紐づく CharacterSkill が削除される。キャラ一覧へリダイレクト。

### ケース4：解雇（名前不一致）

- 前提：対象仲間の displayName が "テスト仲間"。
- 操作：confirmDisplayName = "ちがう名前" で dismissCompanion。
- 期待：削除されない。CONFIRM_NAME_MISMATCH を返す。

------------------------------------------------------------------------

## 9. エラー条件 / NG

| 条件 | 挙動 |
|------|------|
| 未ログイン | 認証エラーまたはログイン画面へ |
| 購入時ゲーム通貨不足 | INSUFFICIENT_GAME、shortfall 付き |
| 購入時課金通貨不足 | INSUFFICIENT_PREMIUM、shortfall 付き |
| 作成時雇用可能回数 0 | NO_HIRE_COUNT |
| 作成時仲間が既に 10 体 | COMPANION_LIMIT |
| 作成時 displayName / iconFilename 不正 | VALIDATION_ERROR |
| 解雇時表示名不一致 | CONFIRM_NAME_MISMATCH、削除しない |
| 解雇対象が他ユーザー or 主人公 or 存在しない | 404 / NOT_FOUND |

------------------------------------------------------------------------

## 10. 画面仕様

### 10.1 ダッシュボード（変更）

- **「雇用斡旋所」カード**を追加。クリックで `/dashboard/recruit`（または `/dashboard/employment`）へ遷移。ラベルは「雇用斡旋所」。

### 10.2 雇用斡旋所画面

| 項目 | 内容 |
|------|------|
| **URL** | `/dashboard/recruit`（英語で recruit 等、実装で決定） |
| **前提** | ログイン済み・主人公作成済み。 |
| **表示** | 現在の雇用可能回数、仲間数 / 10、ゲーム通貨残高、課金通貨残高（無償+有償または内訳）。価格：ゲーム 1000 / 課金 100。 |
| **操作** | 「ゲーム通貨で購入」「課金通貨で購入」ボタン。残高不足時は「〇〇が足りません（あと X 必要）」を表示。 |
| **仲間を雇う** | 雇用可能回数 >= 1 かつ 仲間 < 10 のとき「仲間を雇う」等のリンク・ボタンを表示。クリックで名前・アイコン入力画面へ。 |
| **呼び出す API** | getCompanionHireState（表示用）、purchaseCompanionHire（購入）、createCompanion（作成は別画面）。 |

### 10.3 仲間作成画面（名前・アイコン）

| 項目 | 内容 |
|------|------|
| **URL** | `/dashboard/recruit/create` 等 |
| **前提** | 雇用可能回数 >= 1、仲間 < 10。 |
| **要素** | 表示名入力、アイコン選択（主人公と同じリスト）。「雇う」ボタン。 |
| **成功時** | createCompanion 成功 → /dashboard/characters/[characterId] へリダイレクト。詳細で工業スキル表示。 |
| **エラー時** | NO_HIRE_COUNT / COMPANION_LIMIT / VALIDATION_ERROR を画面に表示。 |

### 10.4 キャラ詳細画面（変更・025 拡張）

| 項目 | 内容 |
|------|------|
| **対象** | 仲間（category=companion）の場合のみ「解雇する」ボタンを表示。主人公には出さない。 |
| **解雇フロー** | 「解雇する」クリック → 確認モーダルまたはインラインで「このキャラの表示名を入力してください」と入力欄。入力値が displayName と一致した場合のみ「削除」実行。不一致なら「表示名が一致しません」等。 |
| **工業スキル** | 仲間の場合は習得工業スキルを表示する（025 で詳細に基礎ステータスを表示しているので、その下に工業スキル 1 つを表示）。 |

------------------------------------------------------------------------

## 11. スコープ（本 spec で扱わないもの）

- 雇用可能回数の有効期限。
- 仲間の名前・アイコン変更（別 spec）。
- 工業スキル以外のスキル（戦闘スキル等）。
- 仲間上限の課金による拡張。

------------------------------------------------------------------------

## 12. 実装メモ

- **定数**：COMPANION_HIRE_PRICE_GAME = 1000、COMPANION_HIRE_PRICE_PREMIUM = 100、COMPANION_MAX_COUNT = 10。
- **課金消費**：無償残高から先に減らし、不足分を有償から減らす。1 回の購入で 100 なので、無償 30 なら無償 30 + 有償 70 のように按分せず、無償を 0 にして有償から 70 消費する等のルールでよい（実装で明確化）。
- **工業スキル 5 種**：Skill マスタに種別「工業」で 5 件登録。createCompanion 時に findMany で工業スキルを取得し、ランダムに 1 つ選んで CharacterSkill に挿入する。
- **URL**：雇用斡旋所は `/dashboard/recruit`、作成は `/dashboard/recruit/create` を推奨。英語で統一。
