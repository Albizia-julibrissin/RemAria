# 仲間上限のユーザー別管理

**目的**: 仲間の上限をユーザーごとに変更できるようにする。デフォルトは 10 体。課金・任務報酬・運営付与などで増枠可能にする。

---

## 1. 管理方法

| 項目 | 内容 |
|------|------|
| **保存場所** | `User.companionLimit`（Int, NOT NULL, default 5）。1 ユーザーあたりの仲間（Character.category=companion）の最大数。 |
| **デフォルト** | 5。新規ユーザー・既存ユーザー（マイグレーションで未設定時）は 5。 |
| **増やし方** | (1) **管理画面**で対象ユーザーの `companionLimit` を編集する。(2) 将来：任務クリアやアイテム使用で +N する処理を追加する。(3) 運営が DB や管理画面で直接変更する。 |
| **参照箇所** | `getCompanionRecruitState()` でユーザーの `companionLimit` を返す（居住区・モーダルの N/N 表示）。仲間作成時は `createCompanionWithLetter` 内で `companionCount < user.companionLimit` をチェック。 |

---

## 2. 実装のポイント

- **定数**：`COMPANION_MAX_COUNT = 5` は「デフォルト値」としてスキーマの default や新規ユーザー作成時にのみ使う。表示・判定は常に `User.companionLimit` を参照する。
- **管理画面**：ユーザー編集や「ユーザー一覧」で `companionLimit` を表示・変更できるようにすると、運営が個別に増枠できる。
- **増枠の付与**：課金パックや任務報酬で「仲間枠+2」などを実装する場合は、該当処理で `User.companionLimit` を `increment` する。

---

## 3. 参照

- **仲間雇用**：spec/030_companion_employment.md
- **スキーマ**：prisma/schema.prisma（User.companionLimit）、docs/08_database_schema.md
