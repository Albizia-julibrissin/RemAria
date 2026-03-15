# Spec: 称号（Title）

`docs/055_titles_design.md` に基づく。**称号マスタ**と**ユーザの称号解放**を定義する。

------------------------------------------------------------------------

## 0. 依存

- **010_auth**：セッション有効。
- 解放の付与契機はクエスト（054）・探索など別 spec に依存。

------------------------------------------------------------------------

## 1. 目的

- 称号はマスタで定義し、ユーザごとに「解放済み」を記録する。
- 称号の簡単な説明・解放条件はマスタのメモ項目で保持する（自動判定は将来拡張）。

------------------------------------------------------------------------

## 2. データ

### 2.1 Title（称号マスタ）

| 項目 | 型 | 説明 |
|------|-----|------|
| id | String (cuid) | 主キー |
| code | String (unique) | 識別用コード |
| name | String | 表示名 |
| description | String? | 称号の簡単な説明 |
| unlockConditionMemo | String? | 解放条件のメモ（運用・実装参照用） |
| displayOrder | Int | 表示順（昇順） |
| createdAt / updatedAt | DateTime | 作成・更新日時 |

### 2.2 UserTitleUnlock（ユーザの称号解放）

| 項目 | 型 | 説明 |
|------|-----|------|
| id | String (cuid) | 主キー |
| userId | String | User 参照 |
| titleId | String | Title 参照 |
| createdAt | DateTime | 解放日時 |

- ユニーク: (userId, titleId)。

### 2.3 User（拡張）

- `userTitleUnlocks UserTitleUnlock[]` を追加。
- **装備中の称号**: `selectedTitleId` (String?, Title 参照)。null は未装備。開拓者証で脱着。

------------------------------------------------------------------------

## 3. API（想定）

| API | 用途 |
|-----|------|
| getTitleList() | 称号マスタ一覧（表示順）＋ログイン中なら解放済み・装備中IDを付与。 |
| getMyUnlockedTitleIds(userId) | ユーザが解放済みの titleId 一覧。 |
| unlockTitleForUser(userId, titleId) | 内部用。解放付与（クエスト報酬等から呼ぶ）。 |
| setEquippedTitle(titleId \| null) | 装備中の称号を変更。解放済みの称号のみ装備可能。null で装備解除。本人のみ。 |

- **称号表示・脱着**: 開拓者証画面（`/dashboard/profile/[accountId]`）で表示。本人のときのみ脱着 UI。他プレイヤー閲覧時は装備中称号の表示のみ。

------------------------------------------------------------------------

## 4. 解放条件

- 初期は **unlockConditionMemo は運用メモのみ**。解放はアプリ側で `unlockTitleForUser` を呼ぶタイミング（クエストクリア、エリア初クリアなど）で行う。
- 将来、Quest と同様の achievementType + achievementParam で自動解放する場合は Title に項目を追加する。

------------------------------------------------------------------------

## 5. 実装メモ

- **スキーマ**: `Title`, `UserTitleUnlock` を追加済み。User に `userTitleUnlocks` および `selectedTitleId`（装備中）を追加済み。
- **マイグレーション**: `add_titles`, `add_user_selected_title_id` 適用済み。
- **シード**: 称号「開拓者」（code: kaitakusha）を 1 件投入。説明文「惑星荒廃を生き延び、この星を再び開拓する者。」。
- **API**: `src/server/actions/titles.ts` に `getTitleList`, `getMyUnlockedTitleIds`, `unlockTitleForUser`, `setEquippedTitle` を実装済み。
- **UI**: 開拓者証（`src/app/dashboard/profile/[accountId]/`）で称号表示。本人は脱着可能、他プレイヤーは表示のみ。公開プロフィール取得（`userRepository.findPublicProfileByAccountId`）で装備中称号を返す。
