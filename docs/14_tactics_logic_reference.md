# 作戦ロジック参照（作戦スロット評価のまとめ）

作戦スロットの**評価ロジック**を一覧にし、「条件を増やしたい」「主語を増やしたい」ときの判断ができるようにする。  
**正式仕様**は **spec/040_tactic_slot_evaluation.md**。本 doc は「どこに何があるか」「拡張時にどこを触るか」の参照用。

---

## 1. このドキュメントの使い方

- **作戦の動きを把握したい** → §2 評価フロー と §3・§4 の一覧を見る。
- **新規条件を追加したい** → §5 条件を拡張するとき のチェックリストに沿って spec/040・定数・評価コード・UI を更新する。
- **主語と条件の対応を確認したい** → §4 の「主語×条件」表を参照する。

---

## 2. 評価フロー（概要）

1. 行動者の作戦スロットを **orderIndex 昇順** に並べる。
2. 先頭から順に **条件を評価** する。
3. **最初に true になったスロットの行動**（通常攻撃 or スキル）を採用する。
4. いずれも true にならなければ **通常攻撃**。
5. スキル採用後、MP 不足なら **不発**（次スロットにはフォールバックしない）。

※ 味方・敵とも同じロジック（`tactic-evaluation.ts`）。味方は TacticSlot、敵は EnemyTacticSlot を参照。

---

## 3. 主語（subject）一覧

条件は「主語で指定した対象」を見る。主語によって「ユニットのリスト」を返すか「サイクル/ターンという値」を返すかが決まる。

### 3.1 ユニットを対象とする主語

| コード | ラベル（UI） | 解決結果 |
|--------|--------------|----------|
| **self** | 自分 | 行動者 1 人のみ（party[actorPartyIndex]） |
| **any_ally** | 味方のいずれか | 生存している味方全員 |
| **any_enemy** | 相手のいずれか | 生存している敵全員 |
| **front_enemy** | 正面の相手 | 行動者と同じ row の敵のうち、col が最小の生存者 1 体 |

- 条件の解釈：「対象のうち **少なくとも 1 体** が条件を満たせば true」。

### 3.2 サイクル・ターンを対象とする主語

| コード | ラベル（UI） | 条件の対象 |
|--------|--------------|------------|
| **cycle** | サイクル | コンテキストの cycle（1 始まり）。偶数/奇数/Nの倍数など |
| **turn** | ターン | コンテキストの turnIndexInCycle（1～6）。行動順〇～〇番目 |

- **cycle** のとき使える条件：cycle_is_even / cycle_is_odd / cycle_is_multiple_of / cycle_at_least / cycle_equals のみ。
- **turn** のとき使える条件：turn_order_in_range のみ。

---

## 4. 条件種別（conditionKind）一覧

### 4.1 主語×条件の対応（どの主語でどの条件が使えるか）

| 条件種別 | 使える主語 | 備考 |
|----------|------------|------|
| **always** | 任意 | 常に true。主語は表示用。 |
| **hp_below_percent** / **hp_above_percent** | self, any_ally, any_enemy, front_enemy | 対象の HP 割合 |
| **mp_below_percent** / **mp_above_percent** | 同上 | 対象の MP 割合（敵は未定義なら false） |
| **subject_has_attr_state** | self, any_ally, any_enemy, front_enemy | 指定属性状態（crush / slash / …） |
| **self_has_debuff** | 主語は無視（常に自分） | 自分がデバフを 1 つでも持つ |
| **subject_in_column** | self, any_ally, any_enemy, front_enemy | 指定列（1=前列, 2=中列, 3=後列）にいる |
| **subject_count_equals** | **any_ally, any_enemy のみ有効**（self / front_enemy のときは常に false） | 生存数が指定数（1～3体）のとき |
| **subject_count_at_least** | **any_ally, any_enemy のみ有効** | 生存数が2体以上のとき（最大3のため「2体以上」のみ） |
| **cycle_is_even** / **cycle_is_odd** / **cycle_is_multiple_of** / **cycle_at_least** / **cycle_equals** | cycle（または主語なしで ctx.cycle で判定） | サイクル条件 |
| **turn_order_in_range** | turn（または主語なしで ctx.turnIndexInCycle で判定） | 本サイクル内の行動順範囲 |

### 4.2 条件ごとの conditionParam

| conditionKind | conditionParam | 例・備考 |
|---------------|----------------|----------|
| always | 不要（null でよい） | — |
| hp_below_percent / hp_above_percent / mp_* | `{ "percent": number }` | 10～90 の 10 刻み推奨 |
| subject_has_attr_state | `{ "attr": string }` | crush / slash / pierce / burn / freeze / corrode / polarity / none |
| self_has_debuff | 不要 | — |
| subject_in_column | `{ "column": 1 \| 2 \| 3 }` | 1=前列, 2=中列, 3=後列（BattleCol） |
| subject_count_equals | `{ "count": 1 \| 2 \| 3 }` | 生存数が〇体のとき（any_ally / any_enemy のみ） |
| subject_count_at_least | `{ "count": 2 }` | 生存数が2体以上のとき（any_ally / any_enemy のみ） |
| cycle_is_even / cycle_is_odd | 不要 | — |
| cycle_is_multiple_of / cycle_at_least / cycle_equals | `{ "n": number }` | 倍数・以上・一致 |
| turn_order_in_range | `{ "turnIndexMin": number, "turnIndexMax": number }` | 1～6（1 始まり） |

---

## 5. 戦闘コンテキスト（評価の入力）

条件評価時に参照する「今の戦闘状態」。実装では `TacticEvaluationContext`（`tactic-evaluation.ts`）。

| 項目 | 用途 |
|------|------|
| **cycle** | サイクル条件（偶数/奇数/倍数/以上/一致） |
| **turnIndexInCycle** | ターン順条件（〇～〇番目） |
| **actorPartyIndex** | 主語「自分」の解決、front_enemy の row 参照 |
| **party** | 味方の HP/MP/属性状態/デバフ（ユニット条件用） |
| **partyAlive** | 生存フラグ（主語解決・位置解決用） |
| **enemies** | 敵の HP/属性状態（ユニット条件用） |
| **enemyAlive** | 生存フラグ |
| **partyPositions** | 味方の (row, col)。front_enemy 解決・subject_in_column 用 |
| **enemyPositions** | 敵の (row, col)。front_enemy 解決・subject_in_column 用 |

- 列（col）：1=前列, 2=中列, 3=後列（`battle-position.ts` の BattleCol）。

---

## 6. 条件を拡張するとき

新規 **conditionKind** を追加するときは、以下を漏れなく行う。**主語の追加**の場合は、主語の解決ロジックと UI 選択肢の両方に手を入れる。

### 6.1 編集箇所チェックリスト

| 順 | 対象 | やること |
|----|------|----------|
| 1 | **spec/040_tactic_slot_evaluation.md** | §4 に「conditionKind / conditionParam / 評価」を 1 行以上追記。主語との対応が変わる場合は §3 も更新。 |
| 2 | **src/app/dashboard/tactics/tactics-constants.ts** | ユニット主語用なら `CONDITION_OPTIONS` に追加。パラメータの選択肢（例: 列・属性）が必要なら `*_OPTIONS` を追加して export。 |
| 3 | **src/lib/battle/tactic-evaluation.ts** | `evaluateCondition` 内に conditionKind の分岐を追加。**位置**を見る条件なら `resolveSubjectPositions` を利用 or 拡張。 |
| 4 | **src/app/dashboard/tactics/tactics-editor-client.tsx** | 条件プルダウンは CONSTANTS 参照で増える場合が多い。**条件パラメータの UI**（select 等）を追加。主語変更時・conditionKind 変更時のデフォルト param を `updateSlotRow` 内で設定（例: subject_in_column → `{ column: 1 }`）。 |
| 5 | **src/app/dashboard/admin/enemies/[id]/admin-enemy-edit-form.tsx** | 同上。条件パラメータの UI と、conditionKind 変更時のデフォルト conditionParam を追加。 |
| 6 | **src/app/dashboard/admin/enemies/new/admin-enemy-create-form.tsx** | 同上（敵マスタ新規作成フォーム）。 |
| 7 | **docs/14_tactics_logic_reference.md** | 本 doc の §4.1・§4.2 に新条件を 1 行ずつ追記。 |
| 8 | **docs/14_tactics_slot_shared.md** | 定数名を追加した場合は「共有しているもの」に追記。 |

### 6.2 判断の目安

- **「〇〇の状態を見たい」** → 既存の主語（self / any_ally / any_enemy / front_enemy）で足りるか確認。足りれば conditionKind だけ追加。
- **「誰々の位置（列）を見たい」** → 既に `subject_in_column` で「主語の列」が使える。行（row）や「自分より前の列にいる」など別の意味なら、新 conditionKind とコンテキストの位置情報の参照方法を spec/040 に定義する。
- **「サイクル/ターン以外の“値”を見たい」** → 主語を増える可能性あり（例: 主語「スキル」は未実装）。spec/040 の §3 とコンテキスト項目を先に決める。

---

## 7. 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| **spec/040_tactic_slot_evaluation.md** | 作戦スロット評価の**正式仕様**（正本） |
| spec/039_battle_tactics_and_editor.md | 作戦室（味方）の画面・API |
| spec/050_enemy_master.md | 敵マスタ・EnemyTacticSlot |
| **docs/14_tactics_slot_shared.md** | 味方・敵での共有とアップデート時の注意 |
| docs/14_battle_attributes_tactics.md | 属性・作戦の設計 |
| src/lib/battle/tactic-evaluation.ts | 評価ロジックの実装 |
| src/lib/battle/battle-position.ts | 列・行の定義（BattleCol: 1=前列, 2=中列, 3=後列） |
