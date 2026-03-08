# 称号機能の設計メモ

**称号マスタ**と**ユーザごとの解放**を中心にした最小構成。解放条件・説明はマスタのメモ項目として持つ。

---

## 1. 構成案

| 要素 | 内容 |
|------|------|
| **称号マスタ** | 1件 = 1称号。code（ユニーク）, name（表示名）, 簡単な説明, 解放条件のメモ, 表示順。 |
| **ユーザの解放** | どのユーザがどの称号を解放済みか。UserTitleUnlock（userId + titleId）。解放は「条件達成時」や「クエスト報酬」などでアプリ側がレコードを挿入する想定。 |
| **メモ項目** | マスタに「説明」「解放条件」をテキストで持つ。条件の**自動判定**は将来実装する場合に別カラム（achievementType + achievementParam など）を足せばよい。 |

---

## 2. データイメージ

- **Title（称号マスタ）**
  - `id`, `code`（ユニーク）, `name`（表示名）
  - `description`（任意）… 称号の簡単な説明（プレイヤー向け or 運用メモ）
  - `unlockConditionMemo`（任意）… 解放条件のメモ（運用・実装時の参照用。自動判定しないならテキストで十分）
  - `displayOrder`（表示順。一覧並び用）

- **UserTitleUnlock（ユーザの称号解放）**
  - `userId`, `titleId`, `createdAt`
  - ユニーク: (userId, titleId)

- **将来の拡張**
  - 「装備中の称号」を持たせる場合は `User.selectedTitleId` のような 1 本を足す想定。
  - 解放条件をコードで判定する場合は、Title に `achievementType` + `achievementParam`（Quest と同様）を追加する案。

---

## 3. 実装の置き場所（想定）

- **スキーマ**: `prisma/schema.prisma` に Title, UserTitleUnlock を追加。User に `userTitleUnlocks UserTitleUnlock[]` を追加。
- **正本**: `spec/055_titles.md` でデータ構造・API を定義。
- **解放の付与**: クエスト報酬やイベントで `UserTitleUnlock` を create する処理を、該当アクション（例: クエスト完了、探索クリア）から呼ぶ。
- **一覧表示**: 称号一覧画面で「全称号マスタ」と「自分の解放済み titleId 一覧」を組み合わせて表示。

---

## 4. まとめ

- 称号マスタ（名前・説明・解放条件メモ・表示順）と、ユーザごとの解放テーブルで足りる。
- 解放条件の**説明**はマスタのメモで持ち、**自動解放**は必要になったら Quest と同様の achievementType/Param を後から足す形にするとよい。
