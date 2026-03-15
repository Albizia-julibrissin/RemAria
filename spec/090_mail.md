# Spec: 郵便（運営→プレイヤー）

`docs/085_mail_system_design.md` に基づく。**運営からプレイヤーへお知らせと付与物を届ける郵便機能**を定義する。プレイヤー同士のメールは対象外。

------------------------------------------------------------------------

## 0. 依存

- **010_auth**: セッション有効。管理画面は管理者のみ。
- **045_inventory_and_items**: アイテム付与（UserInventory）。任務報酬と同様の付与ロジックを利用するが、**郵便受取時は上限を超えて付与**する。
- **055_titles**: 称号解放（UserTitleUnlock）。郵便報酬で称号を付与可能。
- 通貨: User.premiumCurrencyFreeBalance / premiumCurrencyPaidBalance、CurrencyTransaction（reason コード追加）。

------------------------------------------------------------------------

## 1. 目的

- 運営が管理画面から「郵便」を送信し、プレイヤーが受信箱で閲覧・受取できるようにする。
- 付与物: **無償 GRA・有償 GRA・アイテム（複数）・研究記録書・称号**。お知らせのみ（付与 0）も可。
- **有効期限**（expiresAt）を設け、null のときは無期限。期限過ぎは受取不可。**有効期限切れの郵便は一覧に表示しない**（非表示）。
- **アイテム付与は所持数上限（Item.maxOwnedPerUser）を超えて付与する**。郵便経由では上限チェックを行わない。

------------------------------------------------------------------------

## 2. データ

### 2.1 Mail（郵便 1 通の定義）

| 項目 | 型 | 説明 |
|------|-----|------|
| id | String (cuid) | 主キー |
| title | String | タイトル |
| body | String? | 本文（任意） |
| rewardGraFree | Int | 無償 GRA 付与数（0 以上） |
| rewardGraPaid | Int | 有償 GRA 付与数（0 以上） |
| rewardResearchPoint | Int | 研究記録書付与数（0 以上） |
| rewardItems | Json? | アイテム付与。`[{ itemId: string, amount: number }]`。空配列または null でなし。 |
| rewardTitleIds | Json? | 称号付与。`[titleId: string]`。複数可。空配列または null でなし。 |
| expiresAt | DateTime? | 有効期限。null で無期限。この日時を過ぎたら受取不可。 |
| createdAt | DateTime | 作成日時（送信日時） |

- 送信対象は「送信時」に決める（全員 or 指定ユーザー）。Mail 自体には「誰に届けたか」は持たず、UserMail で紐づける。

### 2.2 UserMail（ユーザーごとの受信レコード）

| 項目 | 型 | 説明 |
|------|-----|------|
| id | String (cuid) | 主キー |
| userId | String | User 参照 |
| mailId | String | Mail 参照 |
| readAt | DateTime? | 開封（既読）日時。null は未読。 |
| receivedAt | DateTime? | 受取日時。null は未受取。1 通 1 回のみ受取可。 |
| createdAt | DateTime | 届いた日時（UserMail 作成日時） |

- ユニーク: (userId, mailId)。同一ユーザーに同じ Mail は 1 通だけ。
- 受取: receivedAt を設定したタイミングで GRA・研究記録書・アイテム・称号を一括付与。

### 2.3 User（既存）

- Mail 経由の通貨付与時は CurrencyTransaction に記録。reason は `mail_reward`（定数追加）。referenceType: "user_mail", referenceId: UserMail.id など。

------------------------------------------------------------------------

## 3. API（プレイヤー側）

| API | 用途 |
|-----|------|
| getMailList() | 自分の郵便一覧。未読優先・届いた日時順など。有効期限切れは含めるが「受取不可」であることを示す。 |
| getMailDetail(userMailId) | 1 通の詳細（タイトル・本文・付与内容・有効期限・受取済みか）。 |
| markMailRead(userMailId) | 開封＝既読。readAt を設定。 |
| receiveMail(userMailId) | 受取。receivedAt が null かつ expiresAt 未経過の場合のみ、付与実行して receivedAt を設定。付与は無償/有償 GRA・研究記録書・アイテム（上限超え付与）・称号。 |

------------------------------------------------------------------------

## 4. API（管理画面）

| API | 用途 |
|-----|------|
| getAdminMailList() | 送信済み Mail 一覧（タイトル・送信日・有効期限・対象件数・受取済み数など）。 |
| sendMail(input) | 郵便送信。input: title, body, rewardGraFree, rewardGraPaid, rewardResearchPoint, rewardItems, rewardTitleIds, expiresAt, targetType: "all" \| "users", userIds?: string[]。Mail 1 件作成 ＋ 対象ユーザー分の UserMail を作成 ＋ 各ユーザーに Notification（type: mail_arrived, title: 「郵便が届きました。」, linkUrl: /dashboard/mail）を作成。 |

- 送信先が「全員」のときは現存する全 User（accountStatus は考慮するかは運用で決定）に UserMail を作成する。

------------------------------------------------------------------------

## 5. ルール

- **受取可能条件**: receivedAt が null かつ (expiresAt が null または expiresAt > now)。
- **付与の順序**: 1 トランザクション内で、通貨（無償→有償）→ 研究記録書 → アイテム → 称号。通貨は CurrencyTransaction に各 1 件ずつ記録（無償・有償で 2 件になりうる）。
- **アイテム付与**: 既存の `grantStackableItem` は Item.maxOwnedPerUser を尊重するため、**郵便用には上限を無視する付与関数**（例: grantStackableItemForMail または grantStackableItem にオプション `ignoreLimit: true`）を用意し、郵便受取時のみそれを使う。
- **称号**: rewardTitleIds の各 titleId について UserTitleUnlock を upsert（既に解放済みならスキップでよい）。
- **重複受取**: receivedAt が非 null の場合は受取処理を行わずエラーまたは no-op。

------------------------------------------------------------------------

## 6. 画面

### 6.1 プレイヤー側（ユーザー UI）

- **入口**
  - 画面ヘッダーで、**通知（ringing-bell）の隣**に郵便アイコンを配置。
  - アイコン: **Game Icons の `mailbox`**（`<GameIcon name="mailbox" />`）。
  - クリックで**郵便画面へ遷移**（ドロップダウンではなく専用画面）。URL: `/dashboard/mail`。
  - 未読または未受取がある場合、バッジで件数表示してもよい（任意）。

- **郵便画面（メール風 2 カラム）**
  - **左: 郵便選択リスト**
    - 自分宛ての郵便一覧。1 行 = 1 通。タイトル・届いた日時・未読/既読・付与の有無・有効期限（または期限切れ）が分かる表示。
    - 一覧の 1 件をクリックすると、その郵便を選択し右側に内容を表示。
    - 並び: 未読優先、届いた日時降順など。
  - **右: 選択した郵便の内容**
    - 未選択時: 「郵便を選択してください」等のプレースホルダー。
    - 選択時: **タイトル・本文**を表示。その下に**添付（付与物）**を一覧（無償 GRA・有償 GRA・研究記録書・アイテム名＋数量・称号名。付与があるもののみ表示）。
    - 付与ありかつ未受取かつ有効期限内: **「受け取る」ボタン**を表示。押下で receiveMail を呼び、成功後は受取済み表示に更新。
    - 付与なし（お知らせのみ）: 「受け取る」は出さない。開封（選択）で既読（markMailRead）する。
    - 有効期限切れ: 「受取期限を過ぎています」等と表示し、「受け取る」は出さない。
  - 狭い画面ではリストと詳細を縦積みやタブ切り替えで対応してもよい。

- **受取後の更新**: 受取成功後、右側を「受取済み」に更新し、一覧の該当行も付与済みであることが分かるようにする。

### 6.2 管理画面

- 郵便送信フォーム（タイトル・本文・各付与・有効期限・送信先）と送信履歴一覧。

------------------------------------------------------------------------

## 7. 監査・定数

- **通貨理由コード**: `src/lib/constants/currency-transaction-reasons.ts` に `CURRENCY_REASON_MAIL_REWARD`（例: "mail_reward"）を追加。ラベル「郵便報酬」。
- 無償・有償それぞれ付与時は CurrencyTransaction に beforeBalance / afterBalance を記録する（既存の任務報酬と同様）。

------------------------------------------------------------------------

## 8. 参照

- 設計: docs/085_mail_system_design.md
- 任務報酬付与: src/server/actions/quest.ts（grantQuestRewards）、src/server/lib/inventory.ts（grantStackableItem）
- 称号解放: spec/055_titles.md、UserTitleUnlock の upsert
