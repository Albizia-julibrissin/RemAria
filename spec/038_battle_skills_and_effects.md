# Spec: 戦闘スキル（マスタ・効果・ログ）

`docs/14_battle_core_spec.md`・`docs/14_battle_attributes_tactics.md`・`docs/14_battle_skill_design_draft.md`・`docs/14_skill_proposals_30.csv` に基づき、戦闘スキルを「マスタ＋効果（effectType）＋戦闘ログメッセージ」として実装できる形に定義する。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：ログイン済み前提の画面・API が存在する。
- **015_protagonist_creation**：主人公（Character category=protagonist）が存在する。
- **020_test_battle**：既存の仮戦闘にスキルを段階導入する場合の土台。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| getBattleSkillCatalog | 戦闘スキルの一覧（UI 用）を返す | 作戦スロット編集画面 |
| （戦闘実行側）resolveSkillAction | スキル 1 回分の実行を解決する | 戦闘ループ（仮戦闘・本番戦闘） |

------------------------------------------------------------------------

## 1. 目的

- 戦闘スキルを「固定カラム（種別・属性・消費・溜め等）」と「拡張可能な効果（effectType＋param）」で表現し、スキル追加・調整を **DB 追記**中心で行えるようにする。
- 戦闘ログ用の **通常メッセージ＋条件達成時の追加メッセージ**をスキルに持たせ、UI 側で色分けできるようにする。

------------------------------------------------------------------------

## 2. 用語

- **battleSkillType**：physical / magic / support（物理 / 魔法 / 補助）。
- **attribute（属性）**：none / crush / slash / pierce / burn / freeze / corrode / polarity。
- **effectType**：スキル効果の種類。スキルは 0 個以上の効果を持つ。
- **溜め（chargeCycles）**：サイクルで数える。0 なら即時発動。1 以上なら「発動予約」を作る。
- **不発**：MP 不足などでスキルが発動しないこと。ダメージ・効果・属性状態付与なし。MP 消費なし。ターンは消費する。

------------------------------------------------------------------------

## 3. 入力（Input）

### 3.1 getBattleSkillCatalog

- 入力：セッション（userId）のみ。
- 出力：戦闘で使えるスキルの一覧（4.1）。

### 3.2 resolveSkillAction（戦闘実行側の概念）

- 入力：行動者（Character または敵ユニット）、選択スキルID、戦闘コンテキスト（HP/MP/位置/状態）。
- 出力：ログイベント、HP/MP 変動、状態変化（属性状態・状態異常・バフ・列移動）。

------------------------------------------------------------------------

## 4. 出力（Output）

### 4.1 getBattleSkillCatalog の出力

```json
{
  "skills": [
    {
      "id": "cuid",
      "name": "メテオ",
      "battleSkillType": "magic",
      "attribute": "burn",
      "mpCostCapCoef": 0.1,
      "mpCostFlat": 30,
      "chargeCycles": 2,
      "powerMultiplier": 2.2,
      "hitsMin": 3,
      "hitsMax": 5,
      "resampleTargetPerHit": true,
      "targetScope": "enemy_single",
      "logMessage": "…{敵名}…",
      "logMessageOnCondition": "（条件達成時追加）"
    }
  ]
}
```

------------------------------------------------------------------------

## 5. ルール

### 5.1 MP 消費と不発

- MP 消費量：`MP_cost = floor(CAP * capCoef) + flat`。
- **発動時**に現在 MP と比較し、不足なら **不発**。
  - 不発時：MP 消費なし。ダメージなし。効果適用なし。属性状態付与なし。ターンは消費。
  - 不発時は戦闘ログに「MP 不足で不発」を出す（ログイベントの tone は warning 等）。

### 5.2 溜め（chargeCycles）

- chargeCycles=0：即時実行。
- chargeCycles>=1：スキル選択時に「発動予約」を作り、そのターンは実行しない。
- 予約中の扱い（MVP 方針）：
  - 予約があるキャラは、作戦スロット評価の前に「予約カウントを減らす」。
  - 0 になったターンでそのスキルを実行する。
- 予約中に死亡した場合は予約は破棄する。

### 5.3 多ヒット

- hitsMin/hitsMax が 1 以外の場合、その範囲でヒット回数を乱数で決める。
- resampleTargetPerHit=true の場合、**各ヒットごとにターゲット抽選**する（同一体に複数回命中しうる）。

### 5.4 ターゲット範囲（targetScope）

- enemy_single / enemy_all / ally_single / ally_all / self を基本とする。
- enemy_single のターゲット抽選は列ウェイト（必要なら weight 修飾）に従う。

### 5.5 列ウェイト修飾

- スキルが「列ウェイト加算（例：後列 +2.0）」を持つ場合、そのスキルのターゲット抽選時のみ列ウェイトに加算する。

### 5.6 列移動

- `move_target_column`：ヒット時に対象の列を変更（toColumn または direction）。
- `move_self_column`：使用時に自分の列を変更（toColumn または direction）。
- 行（row）は不変。衝突や入れ替えは発生しない。

### 5.7 戦闘ログメッセージ

- スキルには `logMessage`（通常）と `logMessageOnCondition`（条件達成時追加、任意）を持つ。
- スキルが不発でない場合、実行ログに `logMessage` を出す。
- `SkillEffect` が「条件達成」した場合に `logMessageOnCondition` を追加で出す（UI で文字色を変える）。

------------------------------------------------------------------------

## 6. 処理フロー（概要）

1. 作戦スロットによりスキルが選ばれる（spec/039）。
2. 溜め予約の有無を確認し、必要なら予約作成／カウント減算。
3. MP 不足なら不発ログのみ出して終了。
4. ターゲット抽選（多ヒットならヒットごと）。
5. 命中→直撃/致命→ダメージ計算→属性耐性→効果（effectType）適用→属性状態付与。
6. ログメッセージ（通常＋条件達成時追加）を生成。

------------------------------------------------------------------------

## 7. 永続化データ / 一時データ

### 7.1 永続化するデータ（Prisma 追加/拡張の前提）

- **Skill（既存）**：戦闘用カラムを追加する。
  - battleSkillType（physical/magic/support）
  - mpCostCapCoef（Decimal）
  - mpCostFlat（Int）
  - chargeCycles（Int）
  - powerMultiplier（Decimal?）
  - hitsMin/hitsMax（Int）
  - resampleTargetPerHit（Boolean）
  - targetScope（String）
  - attribute（String）
  - logMessage（String?）
  - logMessageOnCondition（String?）
- **SkillEffect（新規）**：skillId, effectType, param(Json) を持つ（スキルは複数効果を持てる）。

#### SkillEffect の使う想定

- **戦闘ループ内で「スキル 1 回の実行」を解決するとき**に参照する。
- 流れのイメージ：行動が「スキル X」に決まる → ターゲット抽選 → 命中判定 → ダメージ計算（種別・属性耐性・直撃/致命）→ **そのスキルに紐づく SkillEffect を順に適用**（倍率上乗せ・列移動・スプラッシュ・状態付与など）→ 命中時なら攻撃の属性状態を対象に付与 → MP 消費・ログ出力。
- つまり「**resolveSkillAction（スキル 1 回分の解決）**」のなかで、Skill に紐づく SkillEffect を `effectType` で分岐し、`param` を読んで処理する。

#### effectType と param（JSON）の具体例

| effectType | 意味 | param 例（JSON） | 使うスキル例 |
|------------|------|------------------|--------------|
| **attr_state_trigger_damage** | 対象が指定の属性状態ならダメージ倍率を掛け、その属性状態を消費する | `{ "triggerAttr": "crush", "damageMultiplier": 1.5, "consumeAttr": true }` | ハイスピア（圧壊なら1.5倍＋圧壊消費） |
| **move_target_column** | ヒットした対象の列を変更する | `{ "direction": "back", "steps": 1 }` または `{ "toColumn": 3 }`（後列へ直接） | 圧縮の一撃、氷結の矢、退散の呪文 |
| **move_self_column** | 使用後に自分の列を変更する | `{ "direction": "forward", "steps": 1 }` または `{ "toColumn": 1 }`（前列へ） | 前進突撃、鉄壁の構え、転移、反転の盾 |
| **column_splash** | ターゲットが指定列（例：後列）だったとき、与えたダメージの一定割合を敵全体に追加する | `{ "whenTargetCol": 3, "pctOfDealtDamage": 0.5 }` | 強行突撃（後列ヒット時与ダメ50％を敵全体に） |
| **self_attr_state_cost** | 使用時に自分に指定の属性状態を付与する（代償） | `{ "attr": "freeze", "durationCycles": 2, "includeCurrent": true }` | 研ぎ澄まされた感覚（凍傷）、捨て身（侵食） |
| **ally_buff** | 味方（自分／単体／全体）にステータスバフを N サイクル付与する | `{ "target": "self" \| "ally_single" \| "ally_all", "stat": "PATK", "pct": 0.5, "durationCycles": 3, "includeCurrent": true }` | 研ぎ澄まされた感覚、守りの祈り、鼓舞 |
| **attr_state_trigger_splash** | 対象が指定の属性状態なら、与ダメの一定割合を敵全体に追加する | `{ "triggerAttr": "corrode", "pctOfDealtDamage": 0.2 }` | 瘴気 |
| **attr_state_chance_debuff** | 対象が指定の属性状態なら確率で状態異常を付与し、属性状態を消費する | `{ "triggerAttr": "burn", "chance": 0.5, "debuffCode": "burning", "durationCycles": 2, "includeCurrent": true, "recordDamagePct": 0.2 }` | メテオ（焼損→燃焼） |
| **heal_all** / **heal_single** | 味方全体／味方単体を回復する | `{ "scale": "MATK*0.5" }` | 癒しの光、応急手当 |
| **dispel_debuffs** / **dispel_debuff** | 指定状態異常を解除／最大 N 個解除 | `{ "list": [] }` または `{ "count": 1 }` | 癒しの光、浄化 |
| **apply_debuff** | 対象に状態異常を付与する | `{ "debuffCode": "poison", "durationCycles": 2, "tick": "turn_start", "damageKind": "current_hp_pct", "pct": 0.05 }` など | 毒霧、萎縮の呪い |

- 複数効果を持つスキルは、SkillEffect を複数行持つ（例：研ぎ澄まされた感覚＝ally_buff 2 件＋self_attr_state_cost 1 件）。
- **seed** では 30 種のうち効果が必要な 22 スキル分の SkillEffect を登録している（合計 29 行）。効果なしは列ウェイト・多ヒット・溜め・属性付与のみで Skill 側で完結するスキル。
- CSV の `effects` 列は**仕様メモ・人間向け**。実装では上記の effectType ＋ param を DB に持ち、戦闘解決時にこれだけ見れば動くようにする。

### 7.2 保存しないデータ（戦闘中のみ）

- HP/MP の現在値、属性状態、状態異常、バフ、溜め予約、列（col）の現在位置。
- 状態異常の「付与時メタ情報」（例：燃焼の元ダメージ）など。

------------------------------------------------------------------------

## 8. 例（最低3ケース）

### ケース1：不発

- 条件：MP < MP_cost
- 期待：不発ログのみ。HP/MP/状態は変化しない（MP も減らない）。ターンは消費。

### ケース2：メテオ（多ヒット）

- 期待：3～5 ヒット。各ヒットでターゲット再抽選。焼損→燃焼付与（確率）判定がヒット順で行われる。

### ケース3：列移動

- 期待：`move_target_column(direction=back,1)` で対象が前→中、中→後に移動する（列のみ変化）。

