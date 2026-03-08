# 敵グループ編集（管理者用）

EnemyGroup（通常戦の雑魚用グループ）の作成・code 変更・メンバー（敵・重み）の編集。spec/050。

- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/enemy-groups/`（一覧・新規・編集）。

---

## 1. 目的・前提

- **目的**: 探索の通常戦で「どの敵がどの重みで抽選されるか」を敵グループで管理する。グループをここで作成・編集し、探索エリアの「通常戦 雑魚グループ」で code を選ぶ。
- **前提**: テストユーザー1のみ。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **一覧** | `/dashboard/admin/enemy-groups`。code・メンバー数・編集リンク。「新規作成」ボタン。 |
| **新規** | `/dashboard/admin/enemy-groups/new`。code のみ入力。作成後は編集画面へ。 |
| **編集** | `/dashboard/admin/enemy-groups/[id]`。code の変更と、メンバー（敵・重み）の追加・削除・保存。 |
| **入口** | コンテンツ管理の「敵グループ編集」リンク。探索テーマ・エリア編集で「通常戦 雑魚グループ」を選ぶとき、ここで作った code を選べる。 |

---

## 3. API（Server Actions）

| 関数名 | 役割 |
|--------|------|
| `getAdminEnemyGroupList()` | 一覧（id, code, entryCount）。 |
| `getAdminEnemyGroupEditData(groupId)` | 編集用（group, entries, enemies）。 |
| `createAdminEnemyGroup({ code })` | 新規。成功時 `{ success: true, enemyGroupId }`。 |
| `updateAdminEnemyGroup(groupId, { code })` | code 更新。 |
| `saveEnemyGroupEntries(groupId, entries)` | メンバー一括更新。entries は `{ enemyId, weight }[]`。 |

---

## 4. 運用メモ

- code はユニーク。探索エリアの「通常戦 雑魚グループ」で参照するので、既存エリアで使っている code の変更は注意。
- メンバーは「敵を追加」で行を増やし、「メンバーを保存」で一括反映。同一敵は重複登録できず（保存時にユニークでまとまる）。
