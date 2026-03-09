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

- **永続化方針**（`docs/04_persistence_principles.md` §2、`docs/027_hardcoded_and_deferred.md` #18 経緯）：  
  原則として戦闘ログを長期履歴として蓄積しない。一方で、**探索ライフサイクル中に限り** `lastBattle`（直近 1 戦）や `pendingSkillEvent`（未解決の技能イベント）などを一時保持する例外を許容している（探索終了時に削除）。本リファクタはこの方針を前提とする。
- 責務分離の実現方法として、  
  - **案 A**: 進行は Server Action で行い、戻り値を同一画面で描画（一時保存に頼らない）  
  - **案 B**: 進行時に `explorationState` へ一時ログを書き、表示ページは read-only で読むだけ（04・027 の例外ポリシーに沿う）  
  のいずれかを選択する。

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

案 B: **一時ログ保持＋リダイレクト方式**

- `advanceExplorationStep` 実行時に、
  - 戦闘結果ログを `explorationState.lastBattle` 等に一時保存する（04・027 で定めた「探索中のみ一時保持」の例外ポリシーに沿う）。
  - 進行が終わったら `/battle/exploration` にリダイレクト。
- `/battle/exploration` は「現在の `explorationState` から lastBattle を読んで表示する」だけにする。
- Pros: 現在の `page.tsx` の構造を大きく変えずに責務分離しやすい。04 の例外ポリシーと整合する。
- Cons: 実装で `lastBattle` 等の書き込み・探索終了時の削除を確実に行う必要がある。

本リファクタ doc では、**どちらの案に寄せるかを検討したうえで実装フェーズに進む**。

### 5. 実装フェーズ案

**方針**: 各フェーズは「1 回の実装セッション（AI がコンテキストを保持して修正するまとまり）で完了できる単位」を目安にする。長くなりそうな場合はサブフェーズに分割して進める。

#### Phase 0: 方針確定

- 04・027 で定めた「探索中のみ一時ログ保持」の例外ポリシーを前提に、案 A（Server Action + クライアント描画）と案 B（一時ログ保持＋リダイレクト）のどちらを採用するか決める。
- 必要なら spec/049 等の関連 spec を更新する。

#### Phase 1a: advanceExplorationStep の骨格と「通常戦闘」のみ実装

- `src/server/actions/exploration.ts` に `advanceExplorationStep` を新設する。
  - 戻り値型: 今回 1 ステップ進めた結果の discriminated union（`{ kind: "battle"; ... }` / `{ kind: "skill_event"; ... }` / `{ kind: "finished"; ... }` 等）を定義。
  - 中身は **通常戦闘の 1 ステップ**だけ実装（`runExplorationBattle` を呼び、DB 更新し、上記型で返す）。技能・強敵・領域主・終了はまだ触れない。
- `getNextExplorationStep` はこの段階では変更しない。page は従来どおり `?step=next` で動いたままにする（動作変更なし＝1a 完了時点で既存挙動が壊れていないことを確認しやすい）。

#### Phase 1b: advanceExplorationStep に技能・強敵・領域主・終了を統合

- `advanceExplorationStep` 内で、抽選結果に応じて技能イベント・強敵戦闘・領域主・探索終了を処理するようにする（現状の `getNextExplorationStep` の進行部分を移す）。
- 完了後、`getNextExplorationStep` を `advanceExplorationStep` の薄いラッパーにするか、呼び出し元を `advanceExplorationStep` に切り替える準備まで行う。

#### Phase 2a: 表示用データ取得の整理（戦闘結果）

- 「戦闘結果を表示する」ために必要なデータを、案 A なら Server Action 戻り値から、案 B なら `explorationState.lastBattle` / `currentHpMp` から組み立てる関数を用意する。
- この段階では page の**呼び出し関係はまだ変えず**、表示用データの形と取得方法だけを整える（次の 2b で page の分岐を差し替える）。

#### Phase 2b: 探索ページの「進行」を advanceExplorationStep に差し替え

- `/battle/exploration` の `step=next`（および強敵・領域主）分岐で、これまで `getNextExplorationStep` 等を直接呼んでいた部分をやめ、**進行は `advanceExplorationStep` に一本化**する。
  - 案 A: クライアントで `advanceExplorationStep()` を呼び、戻り値を state に持って描画する構成に変更。
  - 案 B: Server Action 実行後にリダイレクトし、表示は 2a で用意した「表示用データ取得」で `explorationState` から読むだけにする。
- 復帰・技能イベント・終了画面など、他の表示ケースもこのデータソースに揃える。

#### Phase 3: 「次へ」ボタンの更新

- `ExplorationNextButton` を、`router.push(href)` ではなく **`advanceExplorationStep` を叩く**ように変更する。
  - 案 A: `onClick` で `await advanceExplorationStep()` → 親に結果を渡して描画。URL は `/battle/exploration` 固定。
  - 案 B: `await advanceExplorationStep()` のあと `router.replace("/battle/exploration")`。
- 連打ガード（`isNavigating` や useTransition）は維持する。

#### Phase 4: 「探索開始」ボタンの UX 改善

- ダッシュボードの「探索を開始」押下後、`startExploration` 成功時に **1 回だけ `advanceExplorationStep` を実行**し、その結果を 1 戦目として表示する（ユーザーからは「探索開始 → いきなり 1 戦目」に見える）。Phase 1〜3 完了後に実施。

#### Phase 5: 旧コード・spec の整理

- `getNextExplorationStep` を削除するか、`advanceExplorationStep` のラッパーとして残すかを決めて整理する。
- 027 (#18, #32) と spec/049 等を、最終挙動に合わせて更新する。
- 手動確認メモ: 新規探索開始時 HP/MP が最大から始まること。「探索開始」1 回で裏で 2 戦進まないこと。「次へ」連打・バック・リロードで進行が重複しないこと。

### 6. メモ

- 現状の暫定 UX（探索開始 → 復帰画面 → 次へ）は、027 #32 に「最終手段案」として記載済み。  
  本リファクタで安全なフローが確立できたら、#32 の内容を更新または削除する。

