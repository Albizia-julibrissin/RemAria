# 開拓者証（プロフィール画面）超超草案

**表記**: 画面・メニュー上の名称は「**開拓者証**」で統一する（URL・コードは `/dashboard/profile` のまま）。

**ステータス**: 称号の表示・脱着は実装済み。表示名編集などは今後の Phase。

---

## 1. 目的

- **01_features.md** の MVP アカウント項目「プロフィール（表示名・称号程度）」に対応する画面を用意する。**UI 上の表記は「開拓者証」**。
- 現時点では「どのような内容を将来表示するか」を検討し、**ルートとページだけ**を作成する。
- **他プレイヤーも見られる**: 開拓者証は自分以外のプレイヤーも閲覧可能とする。URL で `accountId`（spec/010 の英数字ID）を指定して開く。

---

## 2. 表示する内容の検討（候補）

将来開拓者証画面に載せうる項目。実装順・要不要は未確定。

| 項目 | 説明 | データ源・備考 |
|------|------|----------------|
| **表示名** | プレイヤー名（主人公の表示名としても使用） | `User.name`。既に他画面で利用済み。 |
| **称号** | 装備中の称号 1 つ＋所持一覧 | spec/055_titles。`Title` マスタ・`UserTitleUnlock`。装備中は User に持つ想定（要確認）。 |
| **登録日時** | アカウント作成日 | `User.createdAt`（必要なら公開するか検討）。 |
| **最終アクティブ** | 最後に操作した日時 | `User.lastActiveAt`。運営・自分用。 |
| **通貨** | 所持 GRA・有償/無償 GRA 等 | 開拓拠点の CharacterSummaryCard と重複。開拓者証で見せるかは要検討。 |
| **解放済み称号一覧** | 取得した称号の一覧・選択（装備切り替え） | `getMyUnlockedTitleIds` 等。装備変更 UI は別タスク。 |

**MVP で最低限**: 表示名・称号（装備中＋将来の一覧）程度を想定（01_features に合わせる）。

---

## 3. ルートとアクセス（他プレイヤー閲覧対応）

- **自分の開拓者証**: `/dashboard/profile` にアクセスすると、ログイン中のユーザーの `accountId` へリダイレクトされ、`/dashboard/profile/[accountId]` が開く。
- **他プレイヤーの開拓者証**: `/dashboard/profile/[accountId]` を直接開く。例: ` /dashboard/profile/my_id_123`。ログイン済みであれば誰でも閲覧可能。存在しない `accountId` の場合は 404。
- **公開する情報**: 他プレイヤーに表示してよい項目のみを返す（`userRepository.findPublicProfileByAccountId`）。表示名・accountId など。メール・通貨・最終アクティブなどは返さない。

## 4. Phase 0 でやったこと

- **ルート**: `/dashboard/profile`（→ 自分用リダイレクト）、`/dashboard/profile/[accountId]`（本人・他者共通表示）。
- **ページ**: ダッシュボードレイアウト内で「開拓者証」タイトル＋「開拓拠点に戻る」「移動先」＋ 最小表示（@accountId / 表示名）。
- **ナビ**: 開拓拠点トップのメニューおよび「移動先」に開拓者証へのリンクを追加。

---

## 5. 称号の表示・脱着（実装済み）

- **表示**: 開拓者証画面で @accountId / 表示名に加え、**装備中の称号**を表示。他プレイヤーから見たときも装備中称号は表示のみ（読み取りのみ）。
- **脱着**: **本人の開拓者証を開いているときのみ**、解放済み称号一覧と「装備する」「装備を外す」で脱着可能。`User.selectedTitleId` と `setEquippedTitle`（spec/055）を使用。
- 公開プロフィール（`userRepository.findPublicProfileByAccountId`）で `selectedTitle`（id, name）を返す。

---

## 6. 今後の Phase（参考）

- 表示名の編集（現状は User.name のまま）。
- ヘッダー・チャットなど他画面での装備中称号の表示（任意）。

データモデル・API の詳細は **spec/055_titles** および **docs/055_titles_design.md** を参照。

---

## 7. 参照

- 機能一覧: `docs/01_features.md`（MVP アカウント）
- 称号仕様: `spec/055_titles.md`, `docs/055_titles_design.md`
- MVP 進捗: `manage/MVP_PROGRESS.md`（開拓者証・プロフィールの項目）
