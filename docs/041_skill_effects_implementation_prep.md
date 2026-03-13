# スキル効果（SkillEffect）実装の準備

**effectType の一覧・各 param の定義は `docs/042_battle_effect_types_reference.md` が正本。** 本 doc は実装 Phase・データフローの整理用。

戦闘スキルの「効果まわり」（effectType + param）を実装するにあたり、**現状・不足・データ構造・実装順**を整理する。  
参照: `spec/038_battle_skills_and_effects.md`, `docs/042_battle_effect_types_reference.md`, `prisma/seed.ts` の BATTLE_SKILL_EFFECTS。

---

## 1. 現状（いま動いていること）

| 項目 | 実装場所 | 備考 |
|------|----------|------|
| 攻撃種別（物理/魔法）→ PDEF/MDEF | `run-battle-with-party.ts` resolveDamage | 既存 |
| スキル倍率（powerMultiplier） | 同上 | 既存 |
| MP 消費・不足時不発（ターン消費のみ） | 味方ターン分岐 | 既存 |
| 作戦スロット評価（条件→行動決定） | `tactic-evaluation.ts` | spec/040 済み |
| 敵単体ターゲット抽選（列ウェイト＋スキル別 weight 加算） | pickEnemyTarget | Phase 1 で実装済み |
| 味方の列位置（partyPositions）・列移動 | move_self_column / move_target_column | Phase 2 で実装済み。作戦室で初期列設定可 |
| 多ヒット・ヒットごとターゲット再抽選 | hitsMin/Max, resampleTargetPerHit | Phase 1 で実装済み |
| 属性状態付与・保持・起爆系・column_splash・回復・解除・バフ・デバフ・DoT・チャージタイム・属性耐性計算基盤 | Phase 3～10 | 041 の Phase 表のとおり実装済み（Phase 10 は変数＋計算のみ） |

**戦闘に渡しているスキルデータ（SkillDataForBattle）**

- `name`, `battleSkillType`, `powerMultiplier`, `mpCostCapCoef`, `mpCostFlat`, `hitsMin/Max`, `resampleTargetPerHit`, `targetScope`, `attribute`, `chargeCycles`, `weightAdd*`, `effects`, `logMessage`, `logMessageOnCondition` を test-battle で取得し run-battle に渡している。

---

## 2. 未実装の効果・仕様（effectType とその前提）

以下は spec/038 および seed の BATTLE_SKILL_EFFECTS に登場する効果。実装には**戦闘状態の拡張**と**実行フロー（resolveSkillAction）の挿入**が共通で必要。

### 2.1 多ヒット・ターゲット

| 効果 | 仕様 | 前提・依存 |
|------|------|------------|
| 多ヒット | hitsMin/hitsMax でヒット回数決定、resampleTargetPerHit でヒットごとターゲット再抽選 | スキルデータに hitsMin/Max, resampleTargetPerHit を追加して戦闘に渡す |
| 列ウェイト修飾 | スキル使用時のみ weightAddFront/Mid/Back を列ウェイトに加算 | pickEnemyTarget に「今回のスキル」を渡す |

### 2.2 チャージタイム（chargeCycles）と発動予約

| 効果 | 仕様 | 前提・依存 |
|------|------|------------|
| チャージタイム | chargeCycles≥1 のとき「発動予約」を作り、指定サイクル後に発動。予約中は通常攻撃にも行かない | パーティメンバーごとに `{ skillId, remainingCycles }` を保持。ターン開始時にカウント減算、0 で実行。死亡で予約破棄 |

### 2.3 列移動

| effectType | 意味 | param 例 | 前提・依存 |
|------------|------|----------|------------|
| move_target_column | ヒットした対象の列を変更 | direction+steps / toColumn | 敵の位置を**ミュータブル**に保持（enemyPositions をループ内で更新） |
| move_self_column | 使用後に自分の列を変更 | direction+steps / toColumn | 味方の位置を**ミュータブル**に保持（partyPositions を更新） |

### 2.4 属性状態（attrStates）と起爆

| effectType | 意味 | param 例 | 前提・依存 |
|------------|------|----------|------------|
| （通常ヒット時） | 攻撃の attribute で対象に属性状態を付与 | Skill.attribute | 敵・味方に `attrStates: string[]` を保持し、サイクル/ターンで減算する仕様を決める |
| attr_state_trigger_damage | 対象が指定属性状態ならダメージ倍率を掛け、属性状態を消費 | triggerAttr, damageMultiplier, consumeAttr | 対象の attrStates を参照・更新 |
| attr_state_trigger_splash | 対象が指定属性状態なら与ダメの一定割合を敵全体に | triggerAttr, pctOfDealtDamage | 同上＋敵全体への追加ダメージ |
| attr_state_chance_debuff | 対象が指定属性状態なら確率でデバフ付与（属性消費） | triggerAttr, chance, debuffCode, durationCycles, recordDamagePct 等 | attrStates + デバフ付与＋DoT 用「記録ダメ」 |
| self_attr_state_cost | 使用時に自分に属性状態を付与（代償） | attr, durationCycles, includeCurrent | 行動者の attrStates に追加 |

### 2.5 スプラッシュ・回復・解除・バフ／デバフ

| effectType | 意味 | param 例 | 前提・依存 |
|------------|------|----------|------------|
| column_splash | ターゲットが指定列のとき、与ダメの一定割合を敵全体に | whenTargetCol, pctOfDealtDamage | 単体与ダメ算出後、敵全員に追加ダメージ |
| **damage_target_columns** | **指定列にいる敵にダメージ**。targetScope と組み合わせで挙動が変わる | targetColumns: number[]（1=前列, 2=中列, 3=後列） | **enemy_all + 列指定**: 指定範囲全体攻撃。攻撃回数（hits）の回数だけ全体に判定（2回なら全員に2ヒット）。**enemy_single + 列指定**: 指定列内の敵のみをウェイト抽選の対象にし、攻撃回数分だけ抽選→判定。 |
| heal_single / heal_all | 味方単体／全体を回復 | scale: "MATK*0.3" 等 | 対象の currentHp を上限まで加算。targetScope と連動 |
| dispel_debuff / dispel_debuffs | デバフ 1 個解除／指定リスト解除 | count: 1 / list: [] | 対象の debuffs から削除 |
| ally_buff | 味方にステータスバフを N サイクル付与 | target, stat, pct, durationCycles, includeCurrent | バフ状態を「誰が・何を・あと何サイクル」で保持。ダメージ/命中計算時に参照 |
| apply_debuff | 対象に状態異常を付与 | debuffCode, durationCycles, tick, damageKind, pct 等 | デバフ定義（DoT 発動タイミング・ダメージ種別）と戦闘中の debuffs 保持 |

### 2.6 その他

- **属性耐性（Phase 10）**: 変数と計算基盤を実装済み。`AttributeResistances`（属性コード→受けるダメージ倍率）、`PartyMemberInput.attributeResistances`、`runBattleWithParty` の `enemyAttributeResistances` を保持。`resolveDamage` / `resolveSplashDamage` で最終ダメージに耐性倍率を乗算。**耐性値の算出（装備・遺物から入れる）は装備・遺物実装後に実装**する想定。
- **戦闘ログの条件付きメッセージ**: logMessageOnCondition は「条件達成時」の定義（どの effectType を「条件達成」とみなすか）と UI 表示が必要。

---

## 3. 戦闘状態の拡張（必要な一時データ）

現在のループでは `party[].currentHp/currentMp`, `enemies[].currentHp/currentMp`, `partyAlive`, `enemyAlive`, `partyPositions`, `enemyPositions` がある。効果実装には以下を追加する。

| データ | 単位 | 用途 |
|--------|------|------|
| **attrStates** | ユニットごと `{ attr: string, remainingCycles: number }[]` または `string[]`＋サイクル共通減算 | 属性状態付与・消費・起爆条件 |
| **debuffs** | ユニットごと `{ code: string, remainingCycles, meta?: object }[]` | デバフ付与・解除・DoT（記録ダメ等） |
| **buffs** | ユニットごと `{ stat: string, pct: number, remainingCycles }[]` | ally_buff の付与とダメージ/命中計算への反映 |
| **partyPositions / enemyPositions** | ループ内で**更新可能**な配列 | 列移動の反映 |
| **chargeReservation** | パーティメンバーごと `{ skillId: string, remainingCycles: number } \| null` | チャージタイム発動予約 |

※ attrStates / debuffs は tactic-evaluation 用に「空配列」でコンテキストを既に渡している。ここに実データを載せるには、ループ内で配列を保持・更新する必要がある。

---

## 4. データフローと挿入点

### 4.1 スキルマスタを戦闘に渡す形の拡張

- **SkillDataForBattle**（または同等の型）に追加したい項目:
  - `hitsMin`, `hitsMax`, `resampleTargetPerHit`
  - `targetScope`（enemy_single / enemy_all / ally_single / ally_all / self）
  - `attribute`（none / crush / slash / pierce / burn / freeze / corrode / polarity）
  - `chargeCycles`
  - `weightAddFront`, `weightAddMid`, `weightAddBack`
  - `effects: { effectType: string; param: Record<string, unknown> }[]`（SkillEffect の配列）

- **test-battle（または runBattleWithParty の呼び出し元）**で、スキル取得時に `skillEffects` を include し、上記の形で `PartyMemberInput.skills` に渡す。

### 4.2 実行フローの挿入点（resolveSkillAction のイメージ）

現在の流れ:

1. 味方ターン → 作戦評価で actionType + skillId 取得
2. ターゲット 1 体を pickEnemyTarget で決定
3. `resolveDamage` で 1 回分のダメージ計算 → 敵 1 体の HP 減算・MP 消費・ログ

これを次のように拡張する:

1. **チャージタイム**: 行動者に予約があればカウント減算。0 ならそのスキルを実行；予約のみならターン消費して終了。
2. スキル決定後 **MP 不足なら不発**（現状どおり）。
3. **ターゲット決定**: targetScope に応じて「敵単体／敵全体／味方単体／味方全体／自分」を決める。敵単体のときは列ウェイトにスキルの weightAdd を加算して抽選。
4. **多ヒット**: hitsMin～hitsMax でヒット回数を決め、resampleTargetPerHit に応じてヒットごとにターゲットを決める。
5. **ヒットごと**: 命中判定 → ダメージ計算（属性耐性があればここで軽減）→ **そのスキルの effects を順に適用**（倍率上乗せ・列移動・スプラッシュ・属性付与・起爆・バフ／デバフ等）→ 通常の属性状態付与（攻撃 attribute）→ ログ用の「条件達成」フラグ。
6. **回復／解除／バフ／デバフ**は targetScope に応じて対象に適用（ヒットループの外で 1 回だけの効果もあれば、ヒットごとの効果もあるので effectType ごとに定義）。
7. MP 消費・ログ出力（logMessage ＋ 条件達成時は logMessageOnCondition）。

実装単位としては、「**1 スキル 1 回分を解決する関数**」（resolveSkillAction）を新設し、その中で「ターゲット列挙 → ヒットループ → 効果適用」を行い、run-battle-with-party の味方ターンは「行動決定 → resolveSkillAction → ログ追加」に寄せる形が扱いやすい。

---

## 5. 実装順序の提案（依存関係を考慮）

| 段階 | 内容 | 得られるもの |
|------|------|----------------|
| **Phase 0** | データ拡張のみ: SkillDataForBattle に hitsMin/Max, resampleTargetPerHit, targetScope, attribute, chargeCycles, weightAdd*, effects を追加。test-battle で skillEffects を取得して渡す。run-battle ではまだ使わない。 | 戦闘に「効果の種別とパラメータ」を渡せるようになる |
| **Phase 1** | 多ヒット＋列ウェイト修飾: ヒット回数決定、resampleTargetPerHit でのターゲット再抽選、pickEnemyTarget にスキル渡して weight 加算。 | メテオ・連斬・乱れ討ちなどが「回数とターゲット」の面で正しく動く |
| **Phase 2** | 列移動: partyPositions / enemyPositions をミュータブルにし、move_target_column / move_self_column を適用。 | 前進突撃・圧縮の一撃・転移・反転の盾など | **実装済み** |
| **Phase 3** | 属性状態の付与と保持: 攻撃の attribute で対象に付与。戦闘状態に attrStates を追加し、サイクル終了時などに remainingCycles 減算。 | 起爆系の「対象が〇〇状態」を判定できる土台 | **実装済み** |
| **Phase 4** | 起爆系: attr_state_trigger_damage, attr_state_trigger_splash, attr_state_chance_debuff。self_attr_state_cost（代償）。 | ハイスピア・瘴気・浸食霧・研ぎ澄まされた感覚・捨て身など | **実装済み** |
| **Phase 5** | column_splash: ターゲット列が一致したとき敵全体に追加ダメージ。 | 強行突撃 | **実装済み** |
| **Phase 6** | 回復・解除: heal_single / heal_all, dispel_debuff / dispel_debuffs。targetScope に ally_single / ally_all 対応。 | 癒しの光・応急手当・浄化 | **実装済み** |
| **Phase 7** | バフ: ally_buff。buffs 状態の保持と、ダメージ/命中計算での参照。 | 鉄壁の構え・守りの祈り・鼓舞・加速・研ぎ澄まされた感覚・反転の盾 | **実装済み** |
| **Phase 8** | デバフ: apply_debuff。debuffs の保持、DoT（tick: turn_start 等）の処理。attr_state_chance_debuff の「記録ダメ」と燃焼 DoT。 | 毒霧・萎縮の呪い・メテオ（燃焼） | **実装済み** |
| **Phase 9** | チャージタイム: chargeReservation の作成・カウント減算・0 で発動・死亡で破棄。作戦評価で「予約中はスキップ」または「予約スキルを返す」。 | 極意・貫・メテオ・稲光・極大光・鼓舞 | **実装済み** |
| **Phase 10** | 属性耐性の変数・計算基盤。耐性値の算出（装備・遺物→耐性）は装備・遺物実装後に実装。 | 変数保持・resolveDamage で乗算 | **計算基盤のみ実装済み** |

**属性状態・バフ・デバフの持続（サイクル数）の確定仕様**（Phase 3 実装時に採用済み）:
- **数え方**: **付与したサイクルを含めて N サイクル**有効。`remainingCycles = N` で初期化し、**サイクル終了時**に `tickAttrStates` / `tickBuffs` / `tickDebuffs` で 1 減算。0 以下で削除。
- **例**: サイクル 1 の途中で属性状態を付与（remainingCycles=2）→ サイクル 1 中は有効、サイクル 1 終了で 1 に、サイクル 2 終了で 0 になり解除。同じサイクル内の後続ターンで起爆可能。
- **includeCurrent**: 現状は **true 扱いのみ実装**（param の includeCurrent は参照していない）。`durationCycles` をそのまま `remainingCycles` にしている。false 時「付与サイクルを含めない」とする場合は、初期値を N+1 にする等の別扱いが必要で未実装。

---

## 6. 型・インターフェース案（Phase 0 用）

```ts
// 戦闘に渡すスキル 1 件（SkillDataForBattle の拡張案）
interface SkillDataForBattle {
  name: string;
  battleSkillType: string | null;
  powerMultiplier: number | null;
  mpCostCapCoef: number;
  mpCostFlat: number;
  // 以下 Phase 0 で追加
  hitsMin: number;
  hitsMax: number;
  resampleTargetPerHit: boolean;
  targetScope: string;  // enemy_single | enemy_all | ally_single | ally_all | self
  attribute: string;   // none | crush | slash | pierce | burn | freeze | corrode | polarity
  chargeCycles: number;
  weightAddFront: number;
  weightAddMid: number;
  weightAddBack: number;
  effects: { effectType: string; param: Record<string, unknown> }[];
  logMessage?: string | null;
  logMessageOnCondition?: string | null;
}
```

effectType ごとの param 型は、実装する Phase で narrow していく（先に `Record<string, unknown>` のまま渡し、適用時にパースでも可）。

---

## 7. 参照ドキュメント一覧

| ドキュメント | 内容 |
|--------------|------|
| **docs/042_battle_effect_types_reference.md** | **effectType 定義一覧（param・適用タイミング・使用例）。新規効果追加時の参照用** |
| spec/038_battle_skills_and_effects.md | 戦闘スキル・SkillEffect・MP/チャージタイム/多ヒット/列移動/ログの仕様 |
| docs/14_battle_skill_design_draft.md | スキル草案と必要な項目・システム（チャージタイム・デバフ・DoT・バフ・列移動等） |
| docs/14_battle_core_spec.md | 戦闘コア仕様 |
| docs/14_battle_attributes_tactics.md | 属性・作戦まわり |
| prisma/seed.ts | BATTLE_SKILLS, BATTLE_SKILL_EFFECTS の具体値 |
| prisma/schema.prisma | Skill, SkillEffect モデル定義 |

---

## 8. 次のアクション（実装に必要なことを「そろえる」）

1. ~~**Phase 0**: 上記の型拡張と、test-battle での skillEffects 取得・渡却。run-battle の SkillDataForBattle 型と PartyMemberInput を拡張。~~ **実装済み**
2. ~~**Phase 1**: 多ヒット（hitsMin/hitsMax, resampleTargetPerHit）と列ウェイト修飾（weightAdd）を run-battle で適用。~~ **実装済み**
3. ~~**Phase 2**: 列移動（move_self_column / move_target_column）。enemyPositions をループ内コピーでミュータブル化、applyMoveColumn で効果適用。~~ **実装済み**
4. ~~**Phase 3**: 属性状態の付与と保持。partyAttrStates / enemyAttrStates（AttrStateEntry[]）を追加。ヒット時に対象に skill.attribute を付与（2 サイクル）。サイクル終了時に tickAttrStates で減算。作戦評価に実 attrStates を渡す。~~ **実装済み**
5. **resolveSkillAction のスケルトン**（任意）: 入力（行動者・スキルID・戦闘状態）・出力（HP/MP/位置/状態の変化＋ログエントリ）を決め、run-battle の味方スキル実行部分を「resolveSkillAction を 1 回呼ぶ」形に差し替える。Phase 2 以降の効果適用をここに集約する想定。
6. **戦闘状態の保持**: debuffs / buffs / chargeReservation の配列・フィールド追加を、Phase 4～9 に合わせて順次導入（attrStates は Phase 3、debuffs は Phase 4 で導入済み）。
7. **effectType 別ハンドラ**: 各 Phase で必要な effectType を 1 つずつ「適用関数」として実装し、resolveSkillAction 内の effects ループから呼び出す。

このドキュメントを更新しながら Phase 0 から順に進めると、効果まわりの実装が抜け漏れにくくなる。

---

## 9. 戦闘機能の残課題・未実装（再確認）

| 項目 | 状態 | 備考 |
|------|------|------|
| **targetScope: enemy_all** | 未実装 | spec/038 では定義あり。現状は enemy_single のみ対応。敵全体への一斉攻撃はヒットループの対象拡張が必要。seed に enemy_all スキルはなし。 |
| **logMessageOnCondition の表示** | 要検討 | 条件達成時はログで「〇〇決壊！」をインライン表示済み。spec 上の「条件達成時追加メッセージ」を別行で出すか、決壊表記で足りるかは仕様次第。 |
| **属性耐性の値** | 装備・遺物実装後 | Phase 10 で変数・計算基盤のみ実装。耐性値の算出（装備・遺物→耐性）は装備・遺物未実装のため未実装。 |
| **includeCurrent: false** | 未実装 | 持続「付与サイクルを含めない」は param を参照しておらず、常に true 扱い。必要なら remainingCycles の初期値等を変更する実装が必要。 |
| **resolveSkillAction のスケルトン** | 任意 | 味方スキル実行を 1 関数にまとめるリファクタ。動作上の必須ではない。 |
| **敵のスキル・AI** | 未実装 | 現行は敵は通常攻撃のみ。敵スキルや行動選択の spec は別途。 |
| **本番戦闘・探索連続戦闘** | 未実装 | 020 仮戦闘のみ。探索出撃・報酬・帰還は MVP 別項目。 |
