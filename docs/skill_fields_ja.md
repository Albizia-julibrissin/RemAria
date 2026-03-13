# 戦闘スキル項目（スプレッドシート用・日本語）

スキルをスプレッドシートで作る際の列名（日本語）と説明です。

**effectType の正式な定義・param 一覧・適用タイミング**は `docs/042_battle_effect_types_reference.md` を参照。

**属性コード→日本語名の正本**: 本ドキュメントの attribute 行と `src/lib/constants/relic.ts` の `ATTRIBUTE_RESISTANCE_LABELS` を正本とする。他で表示名を参照する場合はここに合わせる。

---

## 1. スキル本体（Skill / BATTLE_SKILLS）

| 英語（DB・コード） | 日本語項目名 | 説明・入力例 |
|-------------------|--------------|--------------|
| name | スキル名 | 例: メテオ, 連斬 |
| battleSkillType | スキル種別 | physical=物理 / magic=魔法 / support=補助 |
| mpCostCapCoef | MP消費（CAP係数） | CAPに対する係数。例: 0.1 → CAP×0.1 |
| mpCostFlat | MP消費（固定値） | 固定加算。例: 30 |
| chargeCycles | チャージタイム（サイクル数） | 0=即時発動。1以上でそのサイクル数チャージしてから発動 |
| cooldownCycles | クールダウン（サイクル数） | 0=クールダウンなし。1以上で使用後Nサイクル再使用不可。クールダウン中は作戦で次のスロットを評価 |
| powerMultiplier | 威力倍率 | ダメージ/回復の倍率。補助のみのスキルは null または 0 |
| hitsMin | 攻撃回数（最小） | 例: 1, 3 |
| hitsMax | 攻撃回数（最大） | 例: 1, 5 |
| resampleTargetPerHit | ヒットごとにターゲット再抽選 | true / false |
| targetScope | 対象範囲 | enemy_single=敵単体 / enemy_all=敵全体 / ally_single=味方単体 / ally_all=味方全体 / self=自分 |
| attribute | 属性 | none / crush=圧縮 / slash=切創 / pierce=穿孔 / burn=焼損 / freeze=凍傷 / corrode=侵食 / polarity=極星 |
| weightAddFront | 列ウェイト加算（前列） | ターゲット抽選で前列に加算。例: 0, 1.0 |
| weightAddMid | 列ウェイト加算（中列） | 同上・中列 |
| weightAddBack | 列ウェイト加算（後列） | 同上・後列。例: 2.0 |
| description | 説明文 | 任意。スキル説明 |
| logMessage | 戦闘ログ（通常） | 発動時に出す文。{敵名} 等プレースホルダー可 |
| logMessageOnCondition | 戦闘ログ（条件達成時） | 条件達成時の追加文。UIで色分け表示 |

---

## 2. スキル効果（SkillEffect）effectType 一覧

1スキルに0個以上の効果を紐づけます。効果ごとに「効果タイプ」と「パラメータ」を指定。

| 英語（effectType） | 日本語（効果名） | 主な param（日本語） |
|--------------------|------------------|----------------------|
| attr_state_trigger_damage | 属性状態でダメージ倍率＋消費 | 発動属性(triggerAttr), 倍率(damageMultiplier), 消費(consumeAttr) |
| move_target_column | 対象の列を移動 | 方向(direction): forward/back, 段数(steps)。または toColumn: 1〜3 |
| move_self_column | 自分の列を移動 | 同上 |
| column_splash | 列条件で敵全体にスプラッシュ | 対象列(whenTargetCol): 1〜3, 与ダメ割合(pctOfDealtDamage): 0〜1 |
| damage_target_columns | 指定列の敵にダメージ | 対象列(targetColumns): [1],[2],[3],[1,2],[2,3],[1,3],[1,2,3] 等。targetScope と併用 |
| self_attr_state_cost | 使用時に自分に属性状態付与（代償） | 属性(attr), 持続サイクル(durationCycles), 現在含む(includeCurrent) |
| ally_buff | 味方にステータスバフ | 対象(target): self/ally_single/ally_all, ステータス(stat), 割合(pct), 持続(durationCycles), 現在含む(includeCurrent) |
| attr_state_trigger_splash | 属性状態で与ダメ割合を敵全体に | 発動属性(triggerAttr), 与ダメ割合(pctOfDealtDamage) |
| attr_state_chance_debuff | 属性状態で確率で状態異常付与 | 発動属性(triggerAttr), 確率(chance), 状態異常(debuffCode), 持続(durationCycles), 現在含む(includeCurrent), ダメ記録割合(recordDamagePct) |
| heal_all | 味方全体回復 | 倍率(scale): 例 "MATK*0.5" |
| heal_single | 味方単体回復 | 同上 |
| dispel_debuffs | 状態異常一括解除 | リスト(list): 空なら全て。指定なら debuffCode の配列 |
| dispel_debuff | 状態異常をN個解除 | 個数(count) |
| apply_debuff | 状態異常を付与 | 状態異常(debuffCode), 持続(durationCycles), 現在含む(includeCurrent)。DoTなら tick, damageKind, pct。萎縮なら statMult |

---

## 3. 効果の param キー（日本語↔英語）

| 日本語 | 英語（param内） | 例・備考 |
|--------|-----------------|----------|
| 発動属性 | triggerAttr | crush, burn, corrode 等 |
| 倍率 | damageMultiplier | 1.5 |
| 消費 | consumeAttr | true |
| 方向 | direction | forward, back |
| 段数 | steps | 1 |
| 列（直接） | toColumn | 1=前列, 2=中列, 3=後列 |
| 対象列（条件） | whenTargetCol | 1〜3 |
| 与ダメ割合 | pctOfDealtDamage | 0.5 |
| 対象列（複数） | targetColumns | [1], [2], [3], [1,2], [2,3], [1,3], [1,2,3] |
| 属性 | attr | freeze, corrode 等 |
| 持続サイクル | durationCycles | 2 |
| 現在含む | includeCurrent | true |
| 対象 | target | self, ally_single, ally_all |
| ステータス | stat | PATK, MATK, PDEF, MDEF, HIT, EVA |
| 割合 | pct | 0.3 (=30%) |
| 確率 | chance | 0.5 |
| 状態異常コード | debuffCode | burning, poison, wither 等 |
| ダメ記録割合 | recordDamagePct | 0.2（燃焼のDoT用） |
| 倍率（回復） | scale | "MATK*0.5" |
| リスト | list | [] または ["poison"] 等 |
| 個数 | count | 1 |
| 発動タイミング | tick | turn_start 等 |
| ダメージ種別 | damageKind | current_hp_pct, record_damage_pct 等 |
| 割合（DoT） | pct | 0.05 等 |
| ステータス倍率 | statMult | { PATK: 0.75, MATK: 0.75 }（萎縮） |

---

## 4. スプレッドシート用ヘッダー例（1行目）

スキル本体だけなら次の列が使えます。

```
スキル名, スキル種別, MP消費CAP係数, MP消費固定, チャージタイム(サイクル), クールダウン(サイクル), 威力倍率, 攻撃回数最小, 攻撃回数最大, ヒットごと再抽選, 対象範囲, 属性, 列ウェイト前列, 列ウェイト中列, 列ウェイト後列, 説明, ログ通常, ログ条件達成時
```

効果は「スキル名」に紐づく別シートまたは別表（効果タイプ・paramをJSONまたは列で）で管理する想定です。
