# 戦闘スキル効果（effectType）定義一覧

戦闘で使う **effectType** と **param** の仕様を一覧にした**正本**ドキュメント。  
**新規 effectType 追加時**: (1) このファイルに定義ブロックを追加 (2) `src/lib/battle/run-battle-with-party.ts` の effectType 分岐にハンドラを追加 (3) 必要なら `prisma/seed.ts` の BATTLE_SKILL_EFFECTS に追加。

- 仕様の土台: `spec/038_battle_skills_and_effects.md`
- 実装準備・Phase: `docs/041_skill_effects_implementation_prep.md`
- 初期スキルとの対応: `docs/14_初期スキル_評価と新規効果.md`
- スプレッドシート用日本語: `docs/skill_fields_ja.md`

---

## 1. 適用タイミングの整理

効果はおおまかに次の順で適用される（詳細は戦闘ループを参照）。

| タイミング | 効果 | 備考 |
|------------|------|------|
| **ターゲット抽選前** | target_select_equal_weight | 列ウェイトを使わず均等抽選にする |
| **命中・直撃／致命の前** | attr_state_force_direct | 条件で直撃を100%にする |
| **ダメージ計算中** | attr_state_trigger_damage | 倍率乗算・属性消費 |
| **与ダメ確定後（ヒットごと）** | attr_state_trigger_splash, attr_state_chance_debuff, attr_state_trigger_debuff, column_splash, apply_debuff, move_target_column | スプラッシュ・デバフ・列移動など |
| **スキル実行時（1回だけ）** | move_self_column, self_attr_state_cost | 自分の列移動・代償の属性状態 |
| **回復・解除・バフ系** | heal_all, heal_single, dispel_attr_states, dispel_debuff, dispel_debuffs, ally_buff | targetScope に応じて対象決定後に適用 |

damage_target_columns はターゲット列の決定に使う（抽選前に参照）。

---

## 2. effectType 一覧（アルファベット順）

### apply_debuff

対象に状態異常（デバフ）を付与する。DoT・ステータス低下などはデバフマスタで定義。

| param | 型 | 説明 |
|-------|-----|------|
| debuffCode | string | デバフコード（bleeding, paralysis, poison, burning, wither 等） |
| durationCycles | number | 持続サイクル数（付与サイクルを含む） |
| includeCurrent | boolean | 付与サイクルを含めて数える（現状 true のみ実装） |
| targetScope | string | 省略時はスキルの targetScope。enemy_all で敵全体に付与 |
| tick | string | DoT の発動タイミング（例: turn_start） |
| damageKind | string | DoT の種別（current_hp_pct, record_damage_pct 等） |
| pct | number | DoT の割合 |
| statMult | object | ステータス倍率（例: { PATK: 0.4 } で萎縮、{ HIT: 0.8 } で命中力20%ダウン）。攻撃者に付与されているときは**命中判定**で HIT に乗算、防御者に付与されているときは EVA / PDEF / MDEF 等に乗算。 |

**使用例**: 萎縮の呪い（wither, enemy_all）, 排熱スチーム（accuracy_down, statMult: { HIT: 0.8 }）, ポイズンホール（poison は attr_state_trigger_debuff で付与）

---

### ally_buff

味方にステータスバフを N サイクル付与。戦闘中の buffs に追加し、ダメージ・命中計算で参照する。

| param | 型 | 説明 |
|-------|-----|------|
| target | string | "self" \| "ally_single" \| "ally_all" |
| stat | string | PATK, MATK, PDEF, MDEF, HIT, EVA 等 |
| pct | number | 上昇率（0.5 = 50%） |
| durationCycles | number | 持続サイクル数 |
| includeCurrent | boolean | 付与サイクルを含める（現状 true 扱い） |

**使用例**: 感覚深化（self, HIT+20%, PATK+15%）, 砦の構え（ally_all, PDEF+50%, MDEF+25%）

---

### attr_state_chance_debuff

対象が指定の属性状態のとき、**確率で**指定デバフを付与し、属性状態を消費する。

| param | 型 | 説明 |
|-------|-----|------|
| triggerAttr | string | 発動に必要な属性状態（burn, crush 等） |
| chance | number | 付与確率（0～1） |
| debuffCode | string | 付与するデバフ |
| durationCycles | number | 持続サイクル数 |
| includeCurrent | boolean | 付与サイクルを含める |
| recordDamagePct | number | 燃焼等の DoT 用「記録ダメージ」の割合 |

**使用例**: メテオスォーム（焼損→燃焼 50%）

---

### attr_state_force_direct

対象が指定の属性状態のとき、直撃を 100% にする。致命は通常確率のままにするかは param で指定。

| param | 型 | 説明 |
|-------|-----|------|
| triggerAttr | string | 条件となる属性状態（例: burn） |
| fatalAsNormal | boolean | true なら致命は通常確率のまま |

**使用例**: 宵闇ノ奈落（焼損時直撃100%）

---

### attr_state_trigger_damage

対象が指定の属性状態のとき、ダメージ倍率を掛け、その属性状態を消費する。

| param | 型 | 説明 |
|-------|-----|------|
| triggerAttr | string | 発動に必要な属性状態（crush, freeze 等） |
| damageMultiplier | number | 乗算する倍率 |
| consumeAttr | boolean | 発動時に属性状態を消費（true 想定） |

**使用例**: 閃槍（圧縮で1.7倍＋消費）, 連装射弓（凍傷で1.1倍＋消費）

---

### attr_state_trigger_debuff

対象が指定の属性状態のとき、**必ず**指定デバフを付与し、属性状態を消費する（確率なし）。

| param | 型 | 説明 |
|-------|-----|------|
| triggerAttr | string | 発動に必要な属性状態 |
| debuffCode | string | 付与するデバフ |
| durationCycles | number | 持続サイクル数 |
| includeCurrent | boolean | 付与サイクルを含める |

**使用例**: 血ノ嘆キ（切創→出血）, ライトニングストーム（焼損→麻痺）, ポイズンホール（侵食→毒）

---

### attr_state_trigger_splash

対象が指定の属性状態のとき、与ダメの一定割合を敵全体に追加する。属性状態は消費しない（仕様要確認）。

| param | 型 | 説明 |
|-------|-----|------|
| triggerAttr | string | 発動に必要な属性状態 |
| pctOfDealtDamage | number | 与ダメの何割を敵全体に（0～1） |

**使用例**: 瘴気（侵食時 20% スプラッシュ）

---

### column_splash

ターゲットが指定列にいたとき、与えたダメージの一定割合を敵全体に追加する。

| param | 型 | 説明 |
|-------|-----|------|
| whenTargetCol | number | 1=前列, 2=中列, 3=後列 |
| pctOfDealtDamage | number | 与ダメの割合（0.5 = 50%） |

**使用例**: 強行突破（後列ヒット時50%敵全体）, クエイクバースト（中列ヒット時50%敵全体）

---

### damage_target_columns

指定列にいる敵にダメージを飛ばす。targetScope と組み合わせる。

- **enemy_all + targetColumns**: 指定列の敵全員に、攻撃回数分のヒットを適用。
- **enemy_single + targetColumns**: 指定列内のみを抽選対象にし、攻撃回数分ターゲットを選ぶ。

| param | 型 | 説明 |
|-------|-----|------|
| targetColumns | number[] | [1]=前列, [2]=中列, [3]=後列, [1,2],[2,3],[1,3],[1,2,3] 等 |

**使用例**: 旋回斬（[1,2]）, アイススパイク（[1]）, ウィンドブラスト（[2,3]）, エンドオブモーゼ（[1,3]）

---

### dispel_attr_states

対象の**属性状態**を全て解除する。状態異常（デバフ）は触れない。

| param | 型 | 説明 |
|-------|-----|------|
| chance | number | 解除が発動する確率（省略時は 1） |

**使用例**: 浄化の祈り（50%で属性状態全解除）

---

### dispel_debuff / dispel_debuffs

状態異常を解除する。

| effectType | param | 説明 |
|------------|-------|------|
| dispel_debuff | count: number | 最大 N 個解除 |
| dispel_debuffs | list: string[] | 指定 debuffCode のみ解除。空なら全て |

**使用例**: 浄化系スキル

---

### heal_all

味方全体を回復する。

| param | 型 | 説明 |
|-------|-----|------|
| scale | string | 回復量式（例: "MATK*1.0"） |
| randMin | number | 乱数範囲の下限（0.8 で 80%～） |
| randMax | number | 乱数範囲の上限（1.0 で～100%） |

**使用例**: 癒しの光（MATK*1.0, 0.8～1.0 乱数）

---

### heal_single

味方単体を回復する。対象は targetScope または targetSelection で決める。

| param | 型 | 説明 |
|-------|-----|------|
| scale | string | 回復量式（例: "MATK*1.5"） |
| targetSelection | string | "lowest_hp_percent" で HP 割合が最低の味方 1 体 |

**使用例**: 浄化の祈り（MATK*1.5, lowest_hp_percent）

---

### move_self_column

スキル使用後に自分の列を変更する。

| param | 型 | 説明 |
|-------|-----|------|
| direction | string | "forward" \| "back" |
| steps | number | 移動する段数 |
| toColumn | number | 1～3 で直接列指定（direction の代わり） |

**使用例**: 前進突撃（forward, 1）

---

### move_target_column

ヒットした対象の列を変更する。命中時のみ。

| param | 型 | 説明 |
|-------|-----|------|
| direction | string | "forward" \| "back" |
| steps | number | 移動する段数 |
| toColumn | number | 1～3 で直接列指定 |
| chance | number | 発動確率（省略または 1 で必発） |

**使用例**: 掌底撃（back, 1, chance: 0.2）, エンドオブモーゼ（toColumn: 2, chance: 0.5）

---

### self_attr_state_cost

使用時に自分に属性状態を付与する（代償）。

| param | 型 | 説明 |
|-------|-----|------|
| attr | string | 付与する属性（freeze, corrode 等） |
| durationCycles | number | 持続サイクル数 |
| includeCurrent | boolean | 付与サイクルを含める |

**使用例**: 研ぎ澄まされた感覚（凍傷）, 捨て身（侵食）

---

### target_select_equal_weight

敵単体抽選で、列ウェイトを使わず均等確率で 1 体選ぶ。この効果があるスキルのときだけ有効。

| param | 型 | 説明 |
|-------|-----|------|
| （なし） | - | param は {} でよい |

**使用例**: ポイズンホール

---

## 3. デバフコード（debuffCode）の扱い

apply_debuff / attr_state_trigger_debuff / attr_state_chance_debuff で指定する debuffCode は、デバフマスタ（またはコード内の定義）で次のように決まる。

| コード | 概要 | 特記事項 |
|--------|------|----------|
| burning | 燃焼 | DoT（記録ダメの割合）。attr_state_chance_debuff の recordDamagePct と連動 |
| bleeding | 出血 | 物理スキル与ダメの 20% を自分が受ける。適用後に解除 |
| paralysis | 麻痺 | EVA 半減 |
| poison | 毒 | ターン開始時 DoT。**この効果では HP が 0 にならない** |
| wither | 萎縮 | ステータス低下（例: PATK 60% 減）。apply_debuff の statMult で指定 |
| accuracy_down | 命中低下 | ステータス低下（例: HIT 80% = 20%ダウン）。apply_debuff の statMult で指定。排熱スチームなど |

新規デバフを増やすときは、ここに 1 行追記し、戦闘ループ内の「デバフ tick／特殊ルール」に処理を足す。

---

## 4. 新規 effectType を追加するとき

1. このドキュメントの **2. effectType 一覧** に、上記と同じ形式で 1 ブロック追加する。
2. **1. 適用タイミング** の表に、どこで効かせるかを 1 行追加する。
3. `run-battle-with-party.ts` の resolveSkillAction 系で、`e.effectType === "新しいタイプ"` の分岐を追加する。
4. 必要なら `spec/038_battle_skills_and_effects.md` の effectType 表も更新する。
5. seed の BATTLE_SKILL_EFFECTS に使うスキルを追加する。

これで「例外」が 1 か所（この一覧＋同じ分岐）にまとまり、整合性を追いやすくする。
