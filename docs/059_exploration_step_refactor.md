## 探索進行フローのリファクタ計画（advanceExplorationStep）

### 1. 背景・問題意識

- 探索戦闘フローでは、これまで  
  `GET /battle/exploration?step=next` 到達 = 「次の 1 ステップ（戦闘 or 技能 or 終了）を進める＋その結果を描画する」  
  という **副作用付きページ** になっていた。
- Next.js App Router / RSC の特性上、同一 URL に対するサーバコンポーネントの実行やデータ取得が「二重に」走るケースがあり、  
  そのタイミングで `runExplorationBattle` が 2 回呼ばれることで、
  - 1 戦目が裏で実行されて HP/残り回数だけ減る
  - 画面上は 2 戦目のログから始まる  
  という不具合が発生していた。
- 暫定対処として、**探索開始直後は `?step=next` に飛ばさず** `/battle/exploration`（復帰画面）を挟み、  
  ユーザーの「次へ」クリックでのみ `?step=next` を叩くように変更した結果、  
  1 戦目が裏で消える事象は解消されている。
- ただし UX 的には「探索開始 → 復帰画面 → 次へ」という 1 ステップ余計なクリックが必要になっており、  
  将来的には **「探索開始 → いきなり 1 戦目表示」** を安全に実現したい。

### 2. 目標と制約

**目標**

- 探索フローの責務を明確に分離し、次を両立させる:
  - **安全性**: URL へのアクセス回数に依存して進行が 2 回進むことがない。
  - **UX**: ユーザーが望めば「探索開始ボタン 1 回で 1 戦目に突入」できる。

**制約・前提**

- `docs/027_hardcoded_and_deferred.md` #18 の方針：  
  探索戦闘の **詳細ログは永続化しない**。`runExplorationBattle` の戻り値を **同一リクエスト内で描画**している。
- そのため、「進行専用リクエスト」と「結果表示リクエスト」を完全に分離してリダイレクトする場合、  
  - ログをどこかに一時保存する（＝ #18 方針を見直す）  
  - もしくは「進行専用」は **Server Action** として UI から直接叩き、そのレスポンスを同一画面で描画する  
  などのいずれかの設計判断が必要になる。

### 3. 現状フローの整理（2026-03 時点）

- `src/app/dashboard/exploration-start-client.tsx`
  - `startExploration` Server Action を呼んで Expedition を新規作成。
  - 成功時に `router.push("/battle/exploration")`。
- `src/app/battle/exploration/page.tsx`
  - 共通で `getSession` / `getCurrentExpeditionSummary` を呼び、`current.state` と `searchParams.step` で分岐:
  - `state === "ready_to_finish"`: 報酬受け取り画面。副作用なし。
  - `state === "in_progress" && step なし`: `getExplorationResumeSummary` でパーティ状況カード＋「次へ」ボタン（表示のみ）。
  - `state === "in_progress" && step === "next" | "strong_enemy_battle" | "area_lord_battle"`:
    - `getNextExplorationStep` を呼び、その内部で
      - 通常戦闘なら `runExplorationBattle`
      - 技能イベントなら `resolveExplorationSkillEvent`
    - ＝ **このリクエスト内で 1 ステップ進めつつ、その結果をページとして描画**している。
- `src/app/battle/exploration/exploration-next-button.tsx`
  - クライアントコンポーネント。`router.push(href)` を 1 クリックにつき 1 回だけ実行（連打ガード付き）。

### 4. リファクタ後の理想像（案）

#### 4.1 責務の分離方針

- **進行専用の Server Action** を新設（仮名 `advanceExplorationStep`）し、  
  「次の 1 ステップ（戦闘 / 技能 / 終了判定）を進める」責務だけを担当させる。
- **表示専用ページ** `/battle/exploration` は、
  - DB（`Expedition` / `explorationState` 等）から「今の状態」を読むだけに寄せる。
  - ページ読み込み回数が増えても、**状態が 2 回進むことはない**。

#### 4.2 ログ非永続の扱い（検討ポイント）

案 A: **Server Action 方式（非リダイレクト）**

- `advanceExplorationStep` を Server Action としてエクスポートし、  
  クライアントコンポーネントから `await advanceExplorationStep()` を呼ぶ。
- `advanceExplorationStep` の戻り値に
  - 「戦闘ログ（UI 用構造体）」
  - 「技能イベント内容」
  - 「探索終了時の結果サマリ」
  などを含め、**同一画面内で setState して描画**する。
- `/battle/exploration` ページは「探索 UI 全体」のコンテナとし、  
  ページ自体は副作用を持たない（Server Action 側に閉じ込める）。
- Pros: #18 の「ログ非永続」方針と相性が良い（今と同様、ログはリクエストライフタイム内だけに留まる）。
- Cons: 現在の Server Component ベースの探索戦闘ページを、  
  **クライアント主体 + Server Action 呼び出し型**に寄せる必要があり、影響範囲がやや大きい。

案 B: **一時的なログ永続＋リダイレクト方式**

- `advanceExplorationStep` 実行時に、
  - 戦闘結果ログを `explorationState.lastBattle` 等に一時保存する（#18 の方針を更新）。
  - 進行が終わったら `/battle/exploration` にリダイレクト。
- `/battle/exploration` は「現在の `explorationState` から lastBattle を読んで表示する」だけにする。
- Pros: 現在の `page.tsx` の構造を大きく変えずに責務分離しやすい。
- Cons: ログを永続（少なくとも探索中は保持）する設計に切り替える必要があり、  
  #18 の「ログ非永続」方針を見直す必要がある。

本リファクタ doc では、**どちらの案に寄せるかを検討したうえで実装フェーズに進む**。

### 5. 実装フェーズ案

#### Phase 0: 方針確定

- 案 A（Server Action + クライアント描画）と案 B（一時ログ永続＋リダイレクト）のどちらを採用するか決める。
- 027 #18（探索ログ非永続）の扱いを再確認し、必要なら 027 / 関連 spec を更新する。

#### Phase 1: サーバー側進行ロジックの抽出

- `src/server/actions/exploration.ts` に `advanceExplorationStep`（仮）を追加。
  - 引数: （必要最小限。基本はセッションから userId を取る）
  - 戻り値: 「今回 1 ステップ進めた結果」を表す discriminated union（例）:
    - `{ kind: "battle"; result: RunBattleSuccessLike; remainingNormalBattles: number; ... }`
    - `{ kind: "skill_event"; event: ... }`
    - `{ kind: "finished"; ... }`
  - 中身は現状の `getNextExplorationStep` の「進行部分」をほぼ丸ごと移植する。
- `getNextExplorationStep` は将来削除 or ラッパーにする前提で、まずは極力薄くする。

#### Phase 2: 表示用データ取得の整理

- `/battle/exploration` ページから副作用を取り除き、  
  「今表示すべきもの」を読むための関数を整理する。
  - 案 A の場合: Server Action の戻り値をクライアント state に保持し、それを描画。
  - 案 B の場合: `explorationState.lastBattle` や `currentHpMp` から表示用データを組み立てる関数を用意。
- `getExplorationResumeSummary` も含め、「復帰」「戦闘後の状況」「技能イベント表示」などの**表示ケース**を網羅できるようにする。

#### Phase 3: 「次へ」ボタンの更新

- `ExplorationNextButton` を、URL ではなく **`advanceExplorationStep` を叩く役割**に変更する。
  - 案 A:
    - `onClick` で `await advanceExplorationStep()` → 親コンポーネントに結果を渡して描画更新。
    - URL は固定（`/battle/exploration` のまま）。
  - 案 B:
    - `await advanceExplorationStep()` 実行後に `router.replace("/battle/exploration")` または `redirect`。
- 連打ガードは現状同様に維持（`isNavigating` フラグや useTransition 等）。

#### Phase 4: 「探索開始」ボタンの UX 改善

- ダッシュボード側の「探索を開始」ボタンの挙動を整理する。
  - 最終的な理想像:
    - `startExploration` 成功後に **即座に 1 回だけ `advanceExplorationStep` を実行**し、その結果を 1 戦目ログとして表示。
    - ユーザー視点では「探索開始 → いきなり 1 戦目」に見える。
  - 実装上は、Phase 1〜3 が完了してから切り替える。

#### Phase 5: 旧コード・spec の整理

- `getNextExplorationStep` が不要になった場合は削除、または `advanceExplorationStep` の薄いラッパーにする。
- 027 (#18, #32) および関連 spec（spec/049_exploration など）を、最終的な挙動と整合するように更新する。
- テスト観点（手動動作確認メモ）:
  - 新規探索開始直後の HP/MP が常に最大から始まること。
  - 「探索開始」1 回につき、裏で戦闘が 2 回以上進まないこと。
  - 「次へ」連打やブラウザバック／リロードで、探索進行が重複しないこと。

### 6. メモ

- 現状の暫定 UX（探索開始 → 復帰画面 → 次へ）は、027 #32 に「最終手段案」として記載済み。  
  本リファクタで安全なフローが確立できたら、#32 の内容を更新または削除する。

