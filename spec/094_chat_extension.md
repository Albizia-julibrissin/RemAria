# Spec: チャット拡張（システムメッセージ・任務達成通知・表示設定）

`spec/037_chat.md` を拡張する。**システムメッセージ**（kind/systemKind）の導入、**任務クリア時のチャット通知**（quest_clear）、**開拓者証へのリンク**、**ユーザーごとのチャット表示設定**（パネルサイズ S/M/L・カスタム割合、文字サイズ等）を定義する。設計の詳細は `docs/093_chat_extension_design.md` を参照。

------------------------------------------------------------------------

## 0. 依存・スコープ

### 0.1 依存する spec

- **037_chat**：全体チャット・sendChatMessage・getRecentChatMessages・ChatMessage の基本。
- **054_quests**：任務クリア報告（acknowledgeQuestReport）。quest_clear の挿入契機。
- **010_auth**：セッション・User。

### 0.2 本 spec のスコープ（今回実装）

| 機能 | スコープ |
|------|----------|
| メッセージ種別（kind: user / system）と systemKind・payload | 本実装 |
| 任務クリア時のチャット通知（quest_clear） | 本実装 |
| システムメッセージの色分け・アイコン表示 | 本実装 |
| 開拓者証（プロフィール）へのリンク（quest_clear から） | 本実装 |
| チャットでの主人公アイコン表示（そのアカウントの主人公アイコンをメッセージ横に表示） | 本実装 |
| チャット表示設定（パネルサイズ S/M/L・カスタム割合、文字サイズ等） | 本実装 |
| 設定の入口（ヘッダー「設定」→ 設定ページ） | 本実装 |

### 0.3 将来拡張（本 spec では実装しない）

- 作戦プリセットシェア（preset_share）。
- 探索クリア通知（exploration_clear）。
- その他 systemKind（title_unlock, level_up, system_announce 等）は必要に応じて別途追加。

------------------------------------------------------------------------

## 1. メッセージ種別（kind）

| kind | 説明 | 送信者 | 表示 |
|------|------|--------|------|
| **user** | プレイヤーが送信した通常メッセージ | User（senderName） | 従来どおり。時刻・名前・本文。 |
| **system** | システムが自動投稿するメッセージ | なし（userId は null） | 背景・アイコンで区別。送信者名は出さない。 |

- 既存の ChatMessage はすべて **user** として扱う（マイグレーションで `kind = 'user'` を付与）。
- **system** はサーバー側から挿入する。`userId` は **null 許容**（kind=system のとき null）。

------------------------------------------------------------------------

## 2. システムメッセージのサブタイプ（systemKind）と payload

`kind = 'system'` のとき、**systemKind** で種別を分け、**payload**（JSON）でリンク用 id 等を渡す。

### 2.1 本実装で使う systemKind

| systemKind | トリガー | body の例 | payload の例 |
|------------|----------|-----------|--------------|
| **quest_clear** | 誰かが任務のクリア報告をした | 「{senderName}が任務「{questName}」を達成しました。」 | `{ "userId": "cuid", "questId": "cuid", "questName": "任務名" }` |

- **body**: 人間が読める文言をサーバーで組み立てて保存する。
- **payload**: フロントでプロフィールリンク等を描画するために用いる。quest_clear では少なくとも `userId`, `questName` を含む。`questId` は任意。

### 2.2 表示仕様（色分け・リンク）

- **プレイヤー名はすべて開拓者証リンク**: チャット内の**すべてのプレイヤー名**（ユーザー投稿の送信者名・システムメッセージの主体名）を `/dashboard/profile/[userId]` へのリンクとする。任務クリア報告に限らない。
- **user**: 送信者名を上記リンクで表示。本文は `text-text-primary`。時刻・名前は `text-text-muted`。
- **system（quest_clear）**:
  - 行全体を薄い背景で区別（例: `bg-brass/10`）。
  - 先頭に旗アイコン（`GameIcon` の `flag`）。文言は `text-text-muted` 程度で目立たせすぎない。
  - 表示文中のプレイヤー名を payload.userId で `/dashboard/profile/[userId]` へのリンクにする。

------------------------------------------------------------------------

## 3. データモデル（ChatMessage 拡張）

037 の ChatMessage に以下を追加する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| kind | String | NOT NULL, default "user" | `user` \| `system` |
| systemKind | String? | | kind=system のときのみ。本実装では `quest_clear`。 |
| payload | Json? | | リンク用 id 等。例: `{ "userId": "...", "questName": "..." }`。 |
| userId | String? | FK→User.id | **nullable に変更**。kind=system のとき null。既存はすべて値あり。 |

- **マイグレーション**: 既存レコードに `kind = 'user'` を付与。userId を nullable に変更。
- **リレーション**: User との 1 対多は維持。userId が null の行は user に紐づかない。

------------------------------------------------------------------------

## 4. API・処理の変更

### 4.1 getRecentChatMessages の出力拡張

返却する各メッセージに以下を追加する。

| フィールド | 型 | 説明 |
|------------|-----|------|
| kind | "user" \| "system" | 種別。既存は "user"。 |
| systemKind | string \| null | kind=system のときのみ。 |
| payload | object \| null | kind=system のときリンク用。 |
| protagonistIconFilename | string \| null | **表示対象ユーザー**の主人公アイコン（Character.iconFilename）。user のときは送信者、quest_clear のときは payload.userId のユーザー。主人公未設定・未取得時は null。 |

- kind=user のときは userId から senderName を取得して返す（従来どおり）。そのユーザーの主人公（User.protagonistCharacter）の iconFilename を protagonistIconFilename に含める。
- kind=system（quest_clear）のときは senderName は返さない（または空文字）。payload をそのまま返す。payload.userId のユーザーの主人公の iconFilename を protagonistIconFilename に含める。
- **表示**: チャット UI では、各メッセージの送信者名（user）または quest_clear のプレイヤー名の**横に**そのアカウントの主人公アイコンを表示する。画像は `public/icons` の .gif を用い、パスは `/icons/{protagonistIconFilename}`。null のときはアイコンを出さない（またはデフォルト画像）。

### 4.2 sendChatMessage

変更なし。作成時は `kind: 'user'`（デフォルト）、userId はセッションのユーザー。

### 4.3 システムメッセージ挿入（quest_clear）

- **契機**: `acknowledgeQuestReport(questId)` 内で、報告完了・報酬付与・reportAcknowledgedAt 更新の**後**に 1 回だけ実行する。
- **任務側の設定**: Quest に **notifyChatOnClear**（Boolean, default false）を持たせる。true の任務のみチャットに投稿する。管理画面の開拓任務編集で ON/OFF 可能。
- **処理**: 上記が true のときのみ、ChatMessage を 1 件 create。  
  - `userId: null`, `kind: 'system'`, `systemKind: 'quest_clear'`  
  - `body`: 「{User.name}が任務「{Quest.name}」を達成しました。」（名前は **User.name**。未設定時はフォールバック例: 「冒険者」）  
  - `payload`: `{ "userId": session.userId, "questId": questId, "questName": quest.name }` など。
- 同一ユーザー・同一任務で複数回報告されても、reportAcknowledgedAt 更新は 1 回のみなので、チャット投稿も 1 回でよい。

------------------------------------------------------------------------

## 5. チャット表示設定（ユーザーごと）

チャットパネルの**サイズ**・**デフォルト開閉**・**文字サイズ**・**システムメッセージ表示の ON/OFF** をユーザーが変更でき、**ヘッダー「設定」**から設定ページに遷移して編集する。

### 5.1 設定の入口

- ヘッダー「設定」ドロップダウンに **「チャット設定」** リンクを追加する。
- リンク先: **`/dashboard/settings`**。設定ページは 1 本とし、その中に「チャット」セクションを設ける（将来、通知 ON/OFF 等を同じページに並べられるようにする）。

### 5.2 変更できる項目

| 項目 | 説明 | 保存キー例（localStorage） | 備考 |
|------|------|----------------------------|------|
| **パネルサイズ** | S / M / L または カスタム（幅・高さを割合で指定） | chatSizeMode, chatSizePreset, chatWidthPercent, chatHeightPercent | §5.3 参照。 |
| **起動時にチャットを開く** | 画面読み込み時にパネルを開いた状態にするか | 既存 `remaeria-chat-open` と統合可。または chatOpenByDefault | 現状の開閉保持と整合させる。 |
| **メッセージの文字サイズ** | 小 / 標準 / 大 | chatFontSize | text-xs / text-sm / text-base。 |
| **システムメッセージを表示する** | quest_clear 等を表示するか | chatShowSystemMessages | true/false。OFF のときは kind=system をフィルタして表示しない。 |

### 5.3 パネルサイズ：S/M/L ＋ カスタム（割合）

- **プリセット**: S / M / L のいずれかを選択。幅・高さは下表の固定値とする。

| プリセット | 幅 | 高さ |
|------------|-----|------|
| S | 280px | 30vh |
| M | 360px | 45vh |
| L | 440px | 55vh |

- **カスタム**: 「カスタム」選択時は、**幅**と**高さを割合**で指定する。
  - **幅**: ビューポート幅に対する割合。**25〜85** の整数（単位は vw として適用）。CSS では `min(90vw, max(260px, {n}vw))` のように clamp で安全圏を設ける。
  - **高さ**: ビューポート高さに対する割合。**25〜70** の整数（単位は vh）。CSS では `min(70vh, max(200px, {n}vh))` とする。
  - 保存例: `chatSizeMode: "custom"`, `chatWidthPercent: 35`, `chatHeightPercent: 45`。

### 5.4 保存方針

- **初回実装**: 上記を **localStorage** に保存する。DB スキーマ変更は不要。同一ブラウザ内でのみ有効。
- **将来**: User に JSON カラム（例: `preferences`）を追加し、設定をサーバーに保存すれば端末間で同期可能。

### 5.5 設定ページの UI

- **パネルサイズ**: ラジオ「小(S) / 中(M) / 大(L) / カスタム」。カスタム選択時のみ「幅（%）」「高さ（%）」のスライダーまたは数値入力（幅 25〜85、高さ 25〜70）を表示。
- **起動時にチャットを開く**: チェックボックス。
- **メッセージの文字サイズ**: ラジオ「小 / 標準 / 大」。
- **システムメッセージを表示する**: チェックボックス。
- **保存**: ボタン押下で localStorage に書き込み、必要ならチャットパネルに設定を反映する（開いていれば即時反映）。

### 5.6 チャットパネルでの反映

- パネル描画時に localStorage から設定を読む。未設定の場合はデフォルト（例: サイズ M、起動時は閉じる、文字サイズ標準、システムメッセージ表示 ON）。
- サイズ: sizeMode が preset なら S/M/L の px/vh、custom なら widthPercent/heightPercent を vw/vh で適用（clamp 付き）。

------------------------------------------------------------------------

## 6. 画面仕様（037 からの変更点）

- **開いた状態のパネル**: 幅・高さは §5.3 の設定に従う（従来の 320〜400px、40〜50vh はデフォルト M 相当とする）。
- **メッセージリスト**: 各メッセージは kind に応じて表示を分ける。**各メッセージで、表示対象ユーザー（送信者または quest_clear の主体）の主人公アイコン**を名前の横に表示する（getRecentChatMessages の protagonistIconFilename を用い、`/icons/{filename}` で表示。null なら非表示）。user は従来どおり名前・本文。system は背景・旗アイコン・プレイヤー名をリンクで §2.2 に従う。設定で「システムメッセージを表示する」が OFF のときは kind=system を一覧から除外して表示する。
- **開閉の保持**: 従来どおり localStorage（例: `remaeria-chat-open`）。設定で「起動時にチャットを開く」を ON にした場合は、初回読み込み時に開いた状態にする。

------------------------------------------------------------------------

## 7. エラー条件

- 037 のエラー条件に変更なし。
- システムメッセージ挿入失敗時は、acknowledgeQuestReport の本処理（報酬付与・reportAcknowledgedAt 更新）は成功済みとする。チャット投稿に失敗しても報告完了はロールバックしない（ログを残して続行）。

------------------------------------------------------------------------

## 8. 参照

- `spec/037_chat.md`：チャット基本
- `docs/093_chat_extension_design.md`：設計詳細
- `docs/022_chat_ui_design.md`：UI 配置・スタイル

------------------------------------------------------------------------

## 9. 実装フェーズ

### Phase 1: データ・API・任務通知

1. **スキーマ**: ChatMessage に `kind`（default "user"）, `systemKind`, `payload` を追加。`userId` を nullable に変更。マイグレーションで既存行に `kind = 'user'` を付与。
2. **chat.ts**: getRecentChatMessages の返却に kind, systemKind, payload, **protagonistIconFilename** を追加。kind=user のときは送信者 User の protagonistCharacter.iconFilename を取得。kind=system（quest_clear）のときは payload.userId の User の protagonistCharacter.iconFilename を取得。kind=system の行は senderName は空または省略。
3. **quest.ts**: acknowledgeQuestReport 内で、報告完了処理の後に quest_clear 用の ChatMessage を 1 件 create（body に「{User.name}が任務「{quest.name}」を達成しました。」、payload に userId, questId, questName）。
4. **docs/08_database_schema.md**: ChatMessage の変更を追記。

### Phase 2: チャット UI（システムメッセージ表示・リンク）

5. **ChatFloating**: メッセージ一覧で kind を判定。各メッセージで **protagonistIconFilename** を名前の横に表示（`/icons/{protagonistIconFilename}`）。user は従来表示。system は背景・旗アイコン・**表示文中のプレイヤー名を** `/dashboard/profile/[userId]` の Link にする。設定未実装の間は「システムメッセージを表示する」は常に ON として扱う。

### Phase 3: チャット表示設定

7. **設定ページ**: `/dashboard/settings` を新設。チャットセクションにパネルサイズ（S/M/L/カスタム）、起動時開く、文字サイズ、システムメッセージ表示の各項目を配置。保存は localStorage。
8. **ヘッダー**: 「設定」ドロップダウンに「チャット設定」リンクを追加。クリックで `/dashboard/settings` へ遷移（アンカー `#chat` 等でも可）。
9. **ChatFloating**: 表示時に localStorage から設定を読み、パネル幅・高さ・文字サイズ・システムメッセージ表示の有無を反映。設定変更後は「設定に戻る」またはパネルを開き直すと反映される（必要なら context や storage イベントで即時反映）。

### Phase 4: 結合・確認

10. 任務クリア報告 → チャットに quest_clear が 1 件出ることを確認。
11. 設定でサイズを S/L/カスタムに変更し、パネルが変わることを確認。システムメッセージ OFF で quest_clear が非表示になることを確認。

**手動確認チェックリスト**: **`manage/094_chat_extension_verification.md`** に記載。上記 10・11 および表示内容（旗アイコン・主人公アイコン・開拓者証リンク）の確認手順を一覧にしている。

------------------------------------------------------------------------

## 10. テスト観点

- 既存 037 のテスト観点に加え:
- getRecentChatMessages: kind, systemKind, payload, protagonistIconFilename が返ること。表示対象ユーザーが主人公を持つ場合に protagonistIconFilename が設定されること。kind=system の行で senderName が空または不要であること。
- acknowledgeQuestReport 成功後、ChatMessage が 1 件増え、kind=system, systemKind=quest_clear, body に任務名が含まれること。
- 設定でカスタム幅・高さを変更すると、パネルに反映されること。「システムメッセージを表示する」OFF で system が表示されないこと。

------------------------------------------------------------------------

## 11. 決定事項（ヒアリング結果）

- **チャット設定の保存先**: 初回実装は **localStorage** とする。サーバー保存は将来拡張。
- **任務達成メッセージの名前**: body の「〇〇が任務「△△」を達成しました。」の **〇〇** は **User.name** とする。
- **開拓者証リンク**: チャット内の**すべてのプレイヤー名**（ユーザー投稿の送信者・システムメッセージの主体）を `/dashboard/profile/[userId]` へのリンクにする。任務クリア報告に限らない。
- **主人公アイコン**: そのアカウントの主人公アイコンをチャットに表示する。getRecentChatMessages の返却に protagonistIconFilename（表示対象ユーザーの主人公の iconFilename）を含め、UI では送信者名／quest_clear のプレイヤー名の横に `/icons/{protagonistIconFilename}` で表示する。
