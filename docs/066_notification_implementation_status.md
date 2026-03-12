# 通知機能の実装状況

**目的**: 通知 → 任務の順で実装する前提で、通知まわりの現状を整理する。完了後に「新規任務受注」を通知に載せる（`docs/065` §4）。

---

## 1. 実装順序の確認

- **通知を先に実装する**形で問題ない。任務受注時に通知を出すため、通知の土台（DB・API・一覧・既読）ができてから、任務受注処理のなかで「通知を 1 件追加」する実装にするとよい。

---

## 2. 現在の実装状況

| 項目 | 状態 | 備考 |
|------|------|------|
| **ヘッダーの通知ボタン** | ✅ 実装済 | `src/components/header.tsx`。アイコンは `ringing-bell`。ログイン時のみ表示。クリックでドロップダウン開閉。未読バッジ表示。 |
| **Notification テーブル** | ✅ 実装済 | Prisma `Notification` モデル（id, userId, type, title, body, linkUrl, readAt, createdAt）。 |
| **未読件数 API** | ✅ 実装済 | `getUnreadNotificationCount()`。Layout で取得し Header に渡す。 |
| **通知一覧 API** | ✅ 実装済 | `getNotificationList()`。最新 30 件。 |
| **既読 API** | ✅ 実装済 | `markNotificationAsRead(id)`。通知クリック時に呼ぶ。 |
| **通知一覧 UI** | ✅ 実装済 | `NotificationDropdown`。開いたときに一覧取得、クリックで既読＋linkUrl があれば遷移。 |
| **通知の作成** | ✅ 実装済 | `createNotification(params)`。任務受注時などから呼ぶ（任務連動は別タスク）。 |

**参照**: `docs/027_hardcoded_and_deferred.md` の #31（通知機能本体は未実装）→ 本実装で解消。

---

## 3. 実装するときに必要なもの（メモ）

- **Prisma**: `Notification` モデル（例: id, userId, type, title, body?, linkUrl?, readAt?, createdAt）。
- **種別（type）**: `quest_accepted`（初回誘導）、`quest_report_ready`（報告可能時）。後から `system` など増やせる。
- **API**: (1) 未読件数取得 (2) 通知一覧取得（最新 N 件、既読含む）(3) 既読にする (4) 通知作成（Server Action や内部関数）。
- **既読タイミング**: **通知をクリックしたときに既読にする**。リンクありの通知はクリックで遷移＋既読、リンクなしの通知もクリックで既読。一覧を開いただけでは既読にしない（「見た」はクリックで判定）。
- **任務連動（現状）**:
  - **初回誘導**: アカウント作成時（register）に 1 回だけ「あなたに依頼がきています。」で `/dashboard/quests` へ誘導（`auth.ts`）。任務ページを開くと前提を満たした最初の開拓任務が自動作成される。
  - **報告可能時**: 条件を満たしたタイミング（探索終了・戦闘勝利で progress ≥ 目標になったとき）に「報告可能な任務があります。」で `/dashboard/quests` へ誘導（`quest.ts` の addQuestProgressAreaClear / addQuestProgressEnemyDefeat）。そのときユーザーは別ページにいるので、通知から開拓任務ページへ飛んで報告できる。

---

## 4. 参照

- `docs/065_special_items_and_facility_speed.md` §4（通知と任務・HowTo の連携）
- `docs/027_hardcoded_and_deferred.md` #31
- `manage/ROADMAP_1_3_MONTHS.md`（通知機能の完成と任務連動）
