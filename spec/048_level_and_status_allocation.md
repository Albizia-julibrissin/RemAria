# Spec: レベルとステータス割り振り

`docs/05_project_constitution.md`・`docs/09_character_implementation_notes.md` で決めた「レベル＋CAP＋割合制御」の方針を、実装用に API レベルまで落とし込む。
本 spec では **レベルと CAP の関係** と **ステータス割り振り（再配分）API** を定義する。

---

## 0. 依存・横断

### 0.1 依存する docs / spec

- `docs/05_project_constitution.md` … 育成哲学（レベル＋CAP採用）
- `docs/09_character_implementation_notes.md` … ステータスと CAP、レベルアップ時の CAP 増分（Lv1 CAP=560、1レベルごとに +60）、各ステの割合下限/上限（5〜30%）
- `spec/015_protagonist_creation.md` … 主人公作成（初期レベル=1 を前提とする）
- `spec/025_character_list.md` … キャラ詳細画面（基礎ステータス表示）

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| `allocateCharacterStats` | キャラ1体の基礎ステータスを再配分（ステ割り振り） | キャラ詳細画面 `/dashboard/characters/[id]` |

ステ割り振りは **ログインユーザーが所有するキャラに対してのみ**実行可能とする。

---

## 1. 目的

- 各キャラ（主人公 / 仲間 / メカ）の基礎ステータス（STR/INT/VIT/WIS/DEX/AGI/LUK）を、
  - **キャラの CAP を総量とするポイント制**
  - **各ステごとに CAP に対する割合下限/上限（5〜30%）**
  に従って **任意に再配分できるようにする**。
- MVP では「経験値→レベルアップ→CAP増加」の導線はまだ実装しないが、
  - テストユーザーなどで **レベルと CAP がすでに設定されているキャラ**に対して、
  - 画面からステ割り振りを行い、**戦闘挙動を確認できる状態**にする。

---

## 2. レベルと CAP の関係

（`docs/09` に準拠。ここでは実装に必要な部分だけ定義する。）

- キャラは整数レベル `level`（1 以上）を持つ。
- **CAP（総合ポイント）** はレベルから次の式で決まる。
  - Lv1 の CAP 初期値：**560**
  - LvN の CAP：**`CAP(N) = 560 + 60 × (N - 1)`**
- DB では `Character.level` と `Character.CAP` は **両方を保存**する。
  - CAP は Seed や将来のレベルアップ処理により更新される。
  - ステ割り振り処理では **DB に保存されている CAP 値を信頼する**（level から再計算はしない）。

> レベルアップ処理（経験値など）は本 spec のスコープ外とし、別 spec で定義する。

---

## 3. ステータス割り振りのルール

### 3.1 制約

対象キャラの基礎ステータスを `STR, INT, VIT, WIS, DEX, AGI, LUK`、CAP を `CAP` とする。

再配分後のステータス値は次の制約を満たさなければならない。

1. **合計が CAP を超えない**
   - `STR + INT + VIT + WIS + DEX + AGI + LUK <= CAP`
2. **割合下限（5%）**
   - 各ステについて `value >= floor(CAP * 0.05)`
3. **割合上限（30%）**
   - 各ステについて `value <= floor(CAP * 0.30)`
4. **整数**
   - すべての基礎ステータスは整数（Int）。

> 「未使用ポイント」は別カラムを持たず、常に `CAP − (7ステ合計)` から導出される想定。

### 3.2 所有権・カテゴリ

- ステ割り振り可能なのは **セッションの userId と Character.userId が一致するキャラのみ**。
- 対象カテゴリは **主人公（protagonist）／仲間（companion）のみ**とし、メカ（mech）は**基礎ステ固定＋パーツ補正**の前提のため、割り振り対象外とする。

---

## 4. API: allocateCharacterStats

### 4.1 入力

Server Action `allocateCharacterStats` の引数（想定）:

```ts
type AllocateCharacterStatsInput = {
  characterId: string;
  STR: number;
  INT: number;
  VIT: number;
  WIS: number;
  DEX: number;
  AGI: number;
  LUK: number;
};
```

- `characterId`：対象キャラの ID。セッションの `userId` と `Character.userId` が一致する必要がある。
- 各ステ値：画面から送られてくる整数値。

### 4.2 出力

```ts
type AllocateCharacterStatsResult =
  | { success: true }
  | { success: false; error: string; message: string };
```

代表的な `error` 値と message の例：

- `UNAUTHORIZED` … 「ログインし直してください」
- `NOT_FOUND` … 「キャラが見つかりません」
- `FORBIDDEN` … 「このキャラに対する操作権限がありません」
- `VALIDATION` … 「合計が CAP と一致していません」「各ステータスは CAP の 5〜30% の範囲で入力してください」など

### 4.3 処理フロー

1. セッション取得（未ログインなら `UNAUTHORIZED`）。
2. `characterId` で Character を取得し、`userId === session.userId` を確認。
   - 一致しなければ `FORBIDDEN` or `NOT_FOUND`。
3. DB から `CAP` を取得。
4. 入力された 7 ステの合計が CAP と一致するか確認。
5. 各ステの値が
   - `>= floor(CAP * 0.05)`
   - `<= floor(CAP * 0.30)`
   を満たすか確認。
6. すべて通れば、`Character` の 7 ステカラムを更新する（トランザクション内で 1 行 update）。
7. 成功したら `{ success: true }` を返し、`revalidatePath("/dashboard/characters/[id]")` 相当で詳細画面を再描画する。

バリデーションに失敗した場合は **DB を更新せず** `{ success: false, error: "VALIDATION", message: "..." }` を返す。

---

## 5. 画面仕様（簡易版）

### 5.1 配置場所

- 既存のキャラ詳細画面 `/dashboard/characters/[id]` に、
  - 「基礎ステータス」表示ブロックの下に
  - **「ステータス再配分」フォーム** を追加する。

### 5.2 フォーム

- 各ステごとに **数値入力欄**（初期値は現在値）を表示。
- 送信ボタン：`「この配分で確定」`（ラベルは実装で調整可）。
- 提交先：Server Action `allocateCharacterStats`。

UI のバリデーションは最低限でよく、**サーバ側バリデーションを正とする**。  
エラー時はフォーム上部にメッセージを表示する程度でよい。

---

## 6. 永続化データ / 一時データ

### 6.1 永続化するデータ

- `Character` の基礎ステータス 7 種（STR/INT/VIT/WIS/DEX/AGI/LUK）。
- `CAP`・`level` は既存のカラムを使用（本 API では更新しない）。

### 6.2 保存しないデータ

- 「前の配分」や「未使用ポイント」は別途保存しない。
  - 必要であればクライアント側の state（フォームの値）としてのみ扱う。

---

## 7. 実装メモ

- Server Action は `src/server/actions/character-stats.ts` のような新規ファイルでよい。
- キャラの取得は既存の `characterRepository`（`getCharacterWithSkillsForUser` など）を参考に、
  - `id` と `userId` の両方で絞り込む関数を追加してもよい。
- 画面側は `CharacterDetailPage` に Server Action を渡し、`useFormStatus` 等を使った Next.js 標準の Form で十分。

