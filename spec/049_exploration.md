# 049_exploration: 探索（本番フロー）

`docs/020_exploration_design.md` に基づき、**MVP 用の探索フロー（テーマ→エリア→出撃→戦闘/技能→報酬→帰還）**を定義する。
まずは **錆びれた森林地区の 1 テーマ＋1 エリア（遊覧舗装路跡）** に絞った縦 1 本を対象とし、後続のエリア・テーマは拡張で追加する。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- `010_auth`：ログイン済みセッション（userId）が前提。
- `015_protagonist_creation`：主人公キャラ（protagonist）が存在すること。
- `025_character_list`：ユーザーが所持する `Character` 一覧を取得できること。
- `038_battle_skills_and_effects`：戦闘ロジック・スキル・効果。
- `039_battle_tactics_and_editor`：作戦スロット・パーティプリセット。
- `040_tactic_slot_evaluation`：作戦スロット評価ロジック。
- `045_inventory_and_items`：UserInventory からアイテム（探索用消耗品・ドロップ）を扱う。
- `046_item_craft`：探索用消耗品の製造（MVP では最低限セットのみ利用）。
- `048_level_and_status_allocation`：レベル・経験値・ステータス割り振り。

### 0.2 提供する API / 利用者

| API 名 | 用途 | 呼び出し元 |
|--------|------|------------|
| `getExplorationMenu` | テーマ・エリア一覧と、ユーザーごとの解放状況・推奨情報を取得 | ダッシュボードの「探索」トップ画面 |
| `startExploration` | エリア・パーティプリセット・持ち込み消耗品を指定して探索を開始し、Expedition を作成 | 探索開始画面（エリア詳細＋編成・消耗品選択） |
| `continueExploration` | 進行中の Expedition を 1 ステップ進め、次のイベント（技能 or 戦闘 or 結果）を返す | 探索中画面（ログ表示＋「次へ」） |
| `finishExploration` | 探索を終了し、確定したドロップ・経験値を UserInventory・キャラに反映 | 探索結果画面（報酬受け取りボタン） |

※ API 名・引数は 3. 入力 / 4. 出力で詳細を定義する。

------------------------------------------------------------------------

## 1. 目的

- パーティプリセット・既存戦闘システム（020/038/039/040）を用いて、**PvE 探索の 1 サイクル（出撃〜報酬〜帰還）**を実装する。
- **HP/MP・バフ状態を探索中に持ち回る連続戦闘**と、**技能判定イベント・ドロップ枠・経験値**を組み合わせた周回コンテンツの土台を作る。
- MVP では、**錆びれた森林地区の「遊覧舗装路跡」1 エリアのみ**を実装対象とし、他エリア・テーマはマスタとテーブルだけ先に拡張しやすい形にする。

------------------------------------------------------------------------

## 2. 用語

- **テーマ（ExplorationTheme）**：世界観・ストーリー上の地域の大枠。例：錆びれた森林地区。
- **エリア（ExplorationArea）**：テーマに属する探索場所（＝ゲーム的なマップ）。例：遊覧舗装路跡。
- **Expedition**：1 回の探索出撃単位。開始〜終了までの進行状態・途中ログ・最終結果をまとめたもの。
- **イベント**：探索中に発生する 1 ステップ。技能判定イベント / 戦闘イベント / 結果確定。
- **ドロップ枠（スロット）**：探索結果としてロールされるアイテムの枠。標準枠＋行動に応じた加算枠があり、由来種別（origin）を持つ。
- **探索用消耗品**：探索中にのみ消費できるアイテム（HP 回復・MP 回復・次イベント時 STR アップなど）。

------------------------------------------------------------------------

## 3. 入力（Input）

### 3.1 `getExplorationMenu`

```json
{}
```

### 3.2 `startExploration`

```json
{
  "areaId": "cuidAreaYuranPavedRoad",
  "partyPresetId": "cuidPreset001",
  "consumables": [
    { "itemId": "cuidItemHpPotionSmall", "quantity": 3 },
    { "itemId": "cuidItemMpPotionSmall", "quantity": 3 },
    { "itemId": "cuidItemNextStrBuff", "quantity": 1 }
  ]
}
```

### 3.3 `continueExploration`

```json
{
  "expeditionId": "cuidExpedition001"
}
```

### 3.4 `finishExploration`

```json
{
  "expeditionId": "cuidExpedition001"
}
```

------------------------------------------------------------------------

## 4. 出力（Output）

### 4.1 `getExplorationMenu`

```json
{
  "themes": [
    {
      "themeId": "cuidThemeRustForest",
      "name": "錆びれた森林地区",
      "isUnlocked": true,
      "areas": [
        {
          "areaId": "cuidAreaYuranPavedRoad",
          "name": "遊覧舗装路跡",
          "difficultyRank": 1,
          "recommendedLevel": 1,
          "status": "available" // locked / available / cleared 等
        }
      ]
    }
  ]
}
```

### 4.2 `startExploration`

```json
{
  "expeditionId": "cuidExpedition001",
  "firstEvent": {
    "kind": "log_only", // すぐに戦闘/技能が始まる場合は "battle" / "skill_check"
    "message": "遊覧舗装路跡に足を踏み入れた……"
  }
}
```

### 4.3 `continueExploration`

```json
{
  "expeditionId": "cuidExpedition001",
  "state": "in_progress", // in_progress / ready_to_finish
  "nextEvent": {
    "kind": "battle", // "skill_check" / "result"
    "battle": {
      "enemyGroupId": "cuidEnemyGroupRustSlimes",
      "log": [/* 020_test_battle と同等フォーマットのログ */],
      "result": "win", // win / lose / wipe
      "hpMpAfterBattle": {
        "characters": [
          { "characterId": "cuidCharProtagonist", "hp": 80, "mp": 30 },
          { "characterId": "cuidCharCompanion", "hp": 60, "mp": 40 }
        ]
      }
    }
  }
}
```

### 4.4 `finishExploration`

```json
{
  "expeditionId": "cuidExpedition001",
  "summary": {
    "areaId": "cuidAreaYuranPavedRoad",
    "result": "cleared", // cleared / wiped
    "battleWins": 5,
    "midBossCleared": true,
    "lastBossCleared": false,
    "skillSuccessCount": 2,
    "expGained": 9
  },
  "dropSlots": [
    { "origin": "base", "itemId": "wood_basic", "quantity": 3 },
    { "origin": "battle", "itemId": "stone_basic", "quantity": 2 },
    { "origin": "skill", "itemId": "skillbook_firebolt", "quantity": 1 },
    { "origin": "mid_boss", "itemId": "relic_series_A", "quantity": 1 }
    // last_boss_special origin の虹枠は lastBossCleared 時のみ
  ]
}
```

------------------------------------------------------------------------

## 5. ルール（概要）

※ 詳細な数値・テーブルは `docs/020_exploration_design.md` を正本とし、本 spec では **入出力と状態遷移**を中心に定義する。

- **1 回の探索（Expedition）は 1 テーマ内の 1 エリアに対してのみ行う**。
- 出撃可能メンバーは主人公＋仲間＋メカの 1〜3 体。作戦スロットは `039` のパーティプリセットをそのまま利用する。
- 探索開始時に、持ち込む探索用消耗品の種類・数量を指定し、**Expedition 内の専用ストック**として扱う（バッグからはあらかじめ消費）。
- `continueExploration` の呼び出しごとに、「技能判定イベント」または「戦闘イベント」または「結果イベント」を 1 回進める。
- **探索イベントの発生判定**：**各イベント（戦闘・技能など）が終了するたびに**、次に発生させるイベント種別を抽選する（事前にキューを積まない方式）。技能イベントの発生確率はエリアの `baseSkillEventRate` で制御する。
- **イベント種別の拡張**：技能イベントに限らず、将来的に他の探索イベント（例：技能強制成功、ハイアンドローで連勝すると報酬枠が増え続ける等、射幸・ラッキー要素）を追加できるよう、イベント種別を汎用的に扱う設計とする。MVP では「戦闘」と「技能」のみ実装。
- 戦闘は `run-battle-with-party`（仮称）で実行し、**戦闘結果の HP/MP を Expedition に書き戻す**。  
  - 次の戦闘は、この HP/MP を初期値として開始する。  
  - **戦闘中の一時的なバフ/デバフ状態は探索間で持ち越さない**（戦闘終了でリセット）。  
  - ただし、**探索用消耗品によるバフ/強化は探索レイヤーの状態として扱い、次の戦闘・技能イベントに反映できるようにする**（例：次のイベント時 STR アップ）。
- 経験値は、`020` のルールに従い、「雑魚勝利×1 / 中ボス+2 / 大ボス+5」を合計し、  
  **参加したキャラクター（`Character.category` が protagonist / companion のみ）それぞれに同量を付与する**（`category=mech` には経験値を付与しない）。
- ドロップは、エリアごとの標準枠数＋行動由来の加算枠＋大ボス専用枠からロールする。枠ごとに origin 種別を保持する。

------------------------------------------------------------------------

## 6. 処理フロー（概要）

### 6.1 `startExploration`

1. セッションから userId を取得。
2. `areaId` が解放済みであることを検証。
3. `partyPresetId` が user の所有物であり、メンバーが 1〜3 体であることを検証。
4. `consumables` について、UserInventory に十分な数量があるか検証し、あれば予約または即時減算。
5. Expedition レコードを作成し、初期状態（残り雑魚戦回数、フラグ、HP/MP=最大、バフなし、ドロップ枠カウンタなど）を保存。
6. 初回イベント（ログのみ or すぐ戦闘）を決定し、`expeditionId` とともに返す。

### 6.2 `continueExploration`

1. Expedition を userId と expeditionId で取得し、`state` が in_progress であることを検証。
2. 終了条件（残り戦闘回数 0 & 中ボス済 & 大ボス抽選済）を満たしていれば、`state=ready_to_finish` として result イベントを返す。
3. 終了していない場合：
   - **次イベントの抽選**：各イベント終了ごとに抽選する方式のため、ここで「次は技能イベントか戦闘イベントか」をエリアの `baseSkillEventRate` 等に基づき判定。
   - 技能イベントにした場合：技能判定イベントを生成し、成功/失敗に応じてドロップ枠カウンタを更新。
   - 戦闘イベントにした場合：雑魚 or 中ボス or 大ボスを生成。
4. 戦闘イベントの場合：`run-battle-with-party` を呼び出し、ログと結果を取得。
5. Expedition の進行状態（残り戦闘回数、ボスフラグ、HP/MP、ドロップ枠カウンタ）を更新。
6. 次イベントの内容を `nextEvent` として返す。

### 6.3 `finishExploration`

1. Expedition が userId の所有物かつ `state` が `in_progress` または `ready_to_finish` であることを検証。
2. Expedition 内のカウンタ（雑魚勝利数・中ボス/大ボスクリア・技能成功数）から、経験値とドロップ枠数を計算。
3. 枠ごとにエリアドロップテーブル／大ボステーブルをロールし、具体的な `itemId / quantity` を決定。
4. UserInventory にアイテムを加算し、参加キャラに経験値を付与（`048` のレベリングルールに従う）。
5. Expedition の state を `finished` に更新し、summary ＋ dropSlots を返す。

------------------------------------------------------------------------

## 7. 永続化データ / 一時データ（ダミー・詳細は別途）

※ ここは後で `prisma/schema.prisma` と同期しつつ詳細定義する。現時点では概要のみ。

### 7.1 永続化するデータ（例）

- `ExplorationTheme`：id, name, displayOrder, unlockRequirements など。
- `ExplorationArea`：id, themeId, name, difficultyRank, baseDropMin, baseDropMax, baseSkillEventRate, enemyGroupIds, bossIds など。
- `Expedition`：id, userId, areaId, partySnapshot, state, remainingNormalBattles, midBossDone, lastBossDone, battleWinCount, skillSuccessCount, expGained, createdAt, finishedAt など。

### 7.2 保存しないデータ

- 戦闘中の詳細コンテキスト（行動ログ・ターン単位の中間状態）は `020/038/040` の方針通り、一時データとして扱い、Expedition にはまとめたログと結果だけを保存する。

------------------------------------------------------------------------

## 8. 画面仕様（MVP 想定）

### 8.1 ダッシュボード内「探索」セクション

- 場所: `/dashboard` 下部の探索カード。
- 表示内容（MVP 実装イメージ）:
  - **進行中の探索サマリ**（あれば）：
    - テーマ名 / エリア名
    - 状態（in_progress=進行中 / ready_to_finish=結果確定待ち）
    - 経過ラウンド数（= battleWinCount + skillSuccessCount）
  - **ログウィンドウ（簡易）**：
    - `explorationState.logs` に保持した短いテキストログ（「R1: …」形式）を上から順に表示。
    - 戦闘ログの詳細やターンごとの HP/MP はここでは表示しない。
  - **探索開始フォーム**：
    - テーマ選択プルダウン → 選択テーマ内のエリア選択プルダウン。
    - パーティプリセット選択プルダウン（作戦室のプリセット一覧）。
    - 将来的に「持ち込み消耗品選択」を追加（MVP ではパラメータのみ受け取り、実使用は後続）。
    - 「探索を開始」ボタン → `startExploration` を呼び出し、Expedition 作成。

### 8.2 探索戦闘画面 `/battle/exploration`（案）

- URL 例: `/battle/exploration?expeditionId=...` または内部で進行中 Expedition を自動解決。
- レイアウト方針：
  - 既存の仮戦闘 UI（`battle-full-view` 相当）と同様に、
    - 上部に **1 サイクル 1 ターン単位の HP/MP バー＋配置情報＋ログブロック** を表示。
    - 敵 / 味方の配置と HP/MP は戦闘中のスナップショットをそのまま見せる。
  - 画面下部に、
    - パーティ 3 体ぶんの **現在 HP/MP のサマリ**（Expedition に書き戻した値）
    - 「次へ」ボタン（次の探索イベントへ進む）
    を配置する。
- 戦闘イベント時の挙動：
  1. 画面表示時に `Expedition` と `PartyPreset` からパーティ編成を構築。
  2. `run-battle-with-party` を 1 回実行し、**その戦闘だけのログと結果**を取得。
  3. 上記の 1 ブロック（HP/MP バー＋配置＋ログ）に、その戦闘ログを表示。
  4. 戦闘後の HP/MP を Expedition.currentHpMp に書き戻し、進行カウンタ（battleWinCount 等）を更新。
  5. 「次へ」ボタン押下時は、探索フロー（`continueExploration`）に戻り、次のイベント（戦闘 or 技能 or 結果）を決定する。
- ログの永続化：
  - 戦闘ログの詳細（ターン単位のログ）は **永続化しない**。
  - Expedition には「R3: 戦闘に勝利した」程度の短い行（`explorationState.logs`）のみを残す。
  - 途中でページを離れ、あとから探索を再開する場合：
    - `/battle/exploration` では直近バトルの詳細ログは再現せず、
    - 下部の現在 HP/MP と「次へ」ボタンだけを表示する。
- **復帰の実装**：`/battle/exploration` に `?step=next` なしでアクセスすると「復帰」画面（サマリ＋次へのみ）を表示。`?step=next` のときのみ次ステップを抽選・実行。ダッシュボードの「探索を続ける」は復帰用（step なし）。探索開始後のリダイレクトと、戦闘/技能後の「次へ」は `?step=next` で次を実行。

### 8.3 技能イベント表示（戦闘画面流用）

- 技能イベントも `/battle/exploration` 上で **同じレイアウトブロック** を使って表示する方針とする。
- 表示方針：
  - 敵側のユニット表示を空にし、味方側の配置・HP/MP バーだけを表示。
  - 上部ログブロックには、
    - 「〇〇が起きた…。どう対処する？」のようなイベントテキストを表示。
  - 画面下部の操作エリアに、
    - 基礎ステータス選択ボタン（STR / VIT / …）や、探索用消耗品の選択 UI、
    - 「次へ」ボタン
    を配置し、プレイヤーがどのステ・どの消耗品で対処するかを選べるようにする。
- ログ：
  - 技能イベントの結果（成功/失敗・ドロップ枠加算など）は、短いテキストとして `explorationState.logs` に 1 行追加する。
  - 戦闘と同様、詳細な内部状態は Expedition には保存しない。

### 8.4 テスト観点（抜粋）

- 進行中の Expedition が無い場合、ダッシュボードの「進行中の探索」カード・ログウィンドウが表示されないこと。
- 進行中 Expedition がある状態で `/dashboard` を開くと、テーマ名・エリア名・状態・ラウンド数が正しく表示されること。
- `/battle/exploration` で戦闘イベントが発生した場合、1 戦闘ぶんのログ・HP/MP 表示が行われ、終了後に Expedition.currentHpMp が更新されること（後続実装）。
- 技能イベント時に敵側の表示が空であり、ログブロックとステータス選択 UI が表示されること（後続実装）。

------------------------------------------------------------------------

## 9. 実装フェーズ・進捗管理（一時）

※ 探索は段階的に実装しているため、「何が済んで何が残りか」をここで管理する。  
実装が一通り揃ったらこのセクションは縮約するか `manage/` 側に移す想定。  
**仕様の正本は 1〜8 章。ここは進捗メモ。**

### 9.1 フェーズ一覧

| Phase | 内容 | 状態 |
|-------|------|------|
| **0** | 基盤（DB・メニュー・開始） | ✅ 済 |
| **1** | 戦闘ループ（1戦闘実行・HP/MP 持ち回り・勝敗で状態遷移） | ✅ 済 |
| **2** | 結果確定 UI（報酬受け取りボタン・サマリ表示・敗北時ログ表示） | ✅ 済 |
| **3** | 技能イベント（発生判定・画面・判定ロジック） | ✅ 済 |
| **4** | 消耗品（持ち込み選択・戦闘後使用・効果適用） | ✅ 済 |
| **5** | 報酬実装（Exp 付与・ドロップ抽選・インベントリ付与） | ❌ 未 |
| **6** | 中ボス・大ボス（イベント種別・専用枠・敵編成） | ❌ 未 |

### 9.2 Phase 0：基盤

| 項目 | 状態 | 備考 |
|------|------|------|
| ExplorationTheme / ExplorationArea / Expedition スキーマ | ✅ | prisma/schema.prisma |
| テーマ・エリアの seed（錆びれた森林・遊覧舗装路跡） | ✅ | prisma/seed.ts |
| getExplorationMenu | ✅ | テーマ・エリア一覧取得 |
| startExploration | ✅ | エリア・プリセット・消耗品パラメータで Expedition 作成 |
| ダッシュボード：探索セクション・テーマ/エリア/プリセット選択・探索開始ボタン | ✅ | ExplorationStartClient |
| 進行中探索サマリ表示（テーマ名・エリア名・state・ラウンド数） | ✅ | getCurrentExpeditionSummary |
| 探索開始後 /battle/exploration へ遷移 | ✅ | router.push |

### 9.3 Phase 1：戦闘ループ

| 項目 | 状態 | 備考 |
|------|------|------|
| runExplorationBattle（1戦闘実行・Expedition 更新） | ✅ | runTestBattle をプリセットで呼び、currentHpMp / remainingNormalBattles / state 更新 |
| 初期 HP/MP：未指定時は最大値、Expedition から渡すときはその値（0 含む） | ✅ | test-battle で -1 を「未指定」、exploration で currentHpMp を渡す |
| 勝敗で state 遷移（敗北 or 残り0 → ready_to_finish） | ✅ | shouldReadyToFinish → nextState |
| /battle/exploration：戦闘ログ表示（BattleFullView）・残り戦闘数・「次の戦闘へ」 | ✅ | in_progress 時 |
| 最後の戦闘ログの保存（ready_to_finish 時に explorationState.lastBattle） | ✅ | 敗北時・結果画面で再表示用 |

### 9.4 Phase 2：結果確定 UI

| 項目 | 状態 | 備考 |
|------|------|------|
| ready_to_finish 時に結果画面（報酬受け取りボタン）を表示 | ✅ | getCurrentExpeditionSummary で分岐、ExplorationFinishClient |
| 全勝で最後の戦闘後も同じ画面で報酬ボタンを表示 | ✅ | isNowReadyToFinish で戦闘直後から ExplorationFinishClient を表示 |
| 敗北時：敗北した戦闘のログを結果画面で表示 | ✅ | getLastExplorationBattle で lastBattle を取得し BattleFullView |
| finishExploration（state → finished、サマリ返却） | ✅ | 枠の由来一覧・totalExpGained 計算。Exp/アイテム付与は未実装 |
| 報酬受け取り後のサマリ表示（結果・勝利数・枠内訳） | ✅ | ExplorationFinishClient 内で仮サマリ表示 |
| 強制破棄（テスト用） | ✅ | abortCurrentExpedition・ExplorationAbortClient |

### 9.5 Phase 3：技能イベント

| 項目 | 状態 | 備考 |
|------|------|------|
| 戦闘の前に技能イベント発生判定（エリア baseSkillEventRate） | ✅ | getNextExplorationStep で各表示時に抽選 |
| 技能イベント画面（STR/VIT 等選択・判定） | ✅ | ExplorationSkillEventBlock（戦闘ログ同様1ブロック＋ログにメッセージ・選択UI） |
| 成功時ドロップ枠加算・explorationState.logs 追記 | ✅ | resolveExplorationSkillEvent で skillSuccessCount と logs 更新 |

**Phase 3 実装の前提（決めごと）**  
- **次ステップの抽選**：`/battle/exploration` で in_progress のとき、表示前に「今回のステップは戦闘か技能か」を `baseSkillEventRate` で抽選。戦闘なら現行どおり `runExplorationBattle`、技能なら技能イベント用 UI を表示し、ユーザーがステータス選択後に `resolveExplorationSkillEvent(stat)` で判定・更新してから同一ページへリダイレクト（次の抽選へ）。  
- **判定ロジック（MVP）**：docs/020 の「エリア基準値×イベント補正」は MVP では簡略化し、**エリアごと1つの必要値（全ステ共通）** で判定する。パーティ内で選択したステが最高のキャラのその基礎ステを使い、必要値以上なら確定成功、未満なら成功率＝そのステ／必要値でランダム判定。必要値は `ExplorationArea.skillCheckRequiredValue`（default 80）で持つ（後でエリア別・ステ別に拡張可能）。  
- **ログ**：技能イベントの結果（どのステで挑んだか・成功/失敗）を `explorationState.logs` に 1 行追記。

### 9.6 Phase 4：消耗品

| 項目 | 状態 | 備考 |
|------|------|------|
| 開始時の持ち込み選択 UI・在庫チェック | ✅ | ダッシュボードで一種類・個数選択。startExploration で在庫・持ち込み上限チェック＋開始時減算 |
| 戦闘/技能後の消耗品使用 UI・効果適用（HP/MP 回復・次イベント STR 等） | ✅ | 戦闘後の使用UI・HP/MP回復は実装済み。技能イベント後の使用は未実装（要検討）。次イベントSTR等は 027#21 |

### 9.7 Phase 5：報酬実装

| 項目 | 状態 | 備考 |
|------|------|------|
| 参加キャラ（protagonist/companion）への経験値付与 | ✅ | finishExploration 内で grantCharacterExp を呼び出し。048・docs/048_experience_and_levelup に従う |
| 枠ごとのドロップテーブルロール・UserInventory 加算 | ✅ | finishExploration で DropTable 重みロール→在庫加算。枠由来ごとにテーブル紐づけ |
| 報酬内容の画面表示（取得アイテム名・数量・枠色分け） | ✅ | 基本=グレー、戦闘=銅、技能=銀、中ボス=金、大ボス=虹で枠ごとに色分け表示 |

### 9.8 Phase 6：中ボス・大ボス

| 項目 | 状態 | 備考 |
|------|------|------|
| 通常戦闘 N 回後の「中ボス」イベント・専用敵編成 | ❌ | 敵マスタ未実装のため test-enemy 流用 |
| 中ボス撃破後の大ボス出現判定・専用枠 | ❌ | |
| エリア別敵編成（normalEnemyGroupCode 等）とマスタ連携 | ❌ | docs/027 #14 |

### 9.9 更新ルール（このセクション）

- 実装したら該当 Phase の表で 状態 を ✅ にし、必要なら 備考 を追記。
- 新しいフェーズができたら 9.1 と対応する 9.x を追加。
- 探索が一通り揃ったら 9 章を「完了サマリ」に縮約するか、`manage/MVP_PROGRESS.md` の探索行に集約し、ここでは「進捗は manage 参照」に変更してよい。

