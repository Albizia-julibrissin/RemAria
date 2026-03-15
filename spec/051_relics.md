# Spec: 遺物（4枠・効果表示・戦闘耐性）

`docs/021_equipment_cycle_design.md`・`docs/026_user_inventory_and_items.md`・`docs/09_character_implementation_notes.md` に基づき、**遺物型マスタ**・**遺物個体**・**装着（4枠）**・**鑑定**・**効果表示**・**戦闘への属性耐性受け渡し**を定義する。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **010_auth**：所持・装着 API は getSession を前提とする。
- **045_inventory_and_items**：遺物枠は「4枠・別スロット」として 045 で言及。個体テーブルは本 spec で定義。
- **049_exploration**：探索ドロップで「遺物グループトークン」（例: relic_group_a_token）を付与。鑑定で遺物個体を生成。
- **038_battle_skills_and_effects**：Phase 10 属性耐性の変数・計算基盤は実装済み。本 spec で遺物由来の耐性値を渡す。

### 0.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| getRelicInstances | ユーザー所持の遺物個体一覧。バッグ「遺物」タブ・装着画面。 | バッグ・キャラ詳細 |
| getCharacterRelics | 指定キャラの4枠装着状況（スロット番号・遺物個体）。 | キャラ詳細・戦闘入力組み立て |
| appraiseRelicToken | 遺物トークン（Item）を1個消費し、遺物個体を1個生成。 | 工房・鑑定タブ |
| decomposeRelic | 未装着の遺物個体を1個消費し、アイテム relic_shard を1個付与。 | 工房・鑑定タブ |
| getRelicTemperPending | 指定遺物の未確定調律結果（pending）があれば返す。 | 工房・鑑定タブ（調律モーダル） |
| startRelicTemper | 遺物の欠片77個を消費し、パッシブ以外をリロールして pending に保存。before/after を返す。 | 工房・鑑定タブ |
| confirmRelicTemper | pending を RelicInstance に反映し pending 削除。 | 工房・鑑定タブ |
| cancelRelicTemper | 遺物の欠片77個を返却し pending 削除。 | 工房・鑑定タブ |
| equipRelic | 指定キャラの指定スロットに遺物を装着。 | キャラ詳細 |
| unequipRelic | 指定キャラの指定スロットから遺物を外す。 | キャラ詳細 |

------------------------------------------------------------------------

## 1. 目的

- **遺物**は探索ドロップ中心のハクスラ枠。各キャラ（主人公・仲間・メカ）**4枠**を装備可能。
- **個体別ユニーク**：同一型でも個体ごとにパッシブ効果・基礎ステ補正が異なる。
- MVP では「枠と効果表示」および戦闘への**属性耐性**受け渡しまで実装する。生成・厳選ルールの詳細は Next でも可。

------------------------------------------------------------------------

## 2. 用語

- **遺物型（RelicType）**：遺物の種類マスタ。表示名・グループコード（鑑定時の抽選対象）を持つ。
- **遺物パッシブ効果（RelicPassiveEffect）**：遺物専用のパッシブ効果マスタ。表示用説明を持つ。戦闘計算での利用は Next で拡張可。
- **遺物個体（RelicInstance）**：ユーザーが所持する1個1行。型・パッシブ効果ID・基礎ステ％補正2つ・属性耐性（任意）を保持。
- **遺物トークン**：探索でドロップする Item（例: relic_group_a_token）。鑑定で1個消費し、遺物個体を1個生成する。
- **スロット**：1～4 の整数。キャラごとに4枠（relic_slot_1 ～ relic_slot_4 または slotIndex 1～4）。

------------------------------------------------------------------------

## 3. 永続化データ

### 3.1 RelicType（遺物型マスタ）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| code | String, UNIQUE | 安定参照用（例: relic_series_a） |
| name | String | 表示名 |
| groupCode | String? | 鑑定時のグループ。同一グループの型から抽選する（例: group_a）。 |
| createdAt / updatedAt | DateTime | 既存パターン |

### 3.2 RelicPassiveEffect（遺物用パッシブ効果マスタ）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| code | String, UNIQUE | 安定参照用 |
| name | String | 表示名 |
| description | String? | 効果説明（UI表示用） |
| createdAt / updatedAt | DateTime | 既存パターン |

- MVP では「効果なし」や「物理攻撃+5%」など少数を seed で投入。戦闘計算での発動は Next で拡張可。

### 3.3 RelicInstance（遺物個体）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| userId | String, FK→User | 所有者 |
| relicTypeId | String, FK→RelicType | 型 |
| relicPassiveEffectId | String?, FK→RelicPassiveEffect | パッシブ効果。NULL は効果なし。 |
| statBonus1 | Json? | 基礎ステ％補正1。例: { "stat": "STR", "percent": 5 } |
| statBonus2 | Json? | 基礎ステ％補正2。1と別 stat を想定。 |
| attributeResistances | Json? | Phase 10 用。キー=属性コード、値=受けるダメージ倍率。例: { "burn": 0.9, "freeze": 1.0 } |
| createdAt / updatedAt | DateTime | 既存パターン |

- 鑑定時に型・パッシブ・補正・耐性を抽選して決定する。MVP では抽選ルールは簡易（固定またはランダム1種）で可。

### 3.4 CharacterRelic（装着）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| characterId | String, FK→Character | 主人公・仲間・メカのいずれか |
| slot | Int | 1～4 のいずれか（遺物枠番号） |
| relicInstanceId | String?, FK→RelicInstance | 装着している個体。NULL は未装着。 |
| createdAt / updatedAt | DateTime | 既存パターン |

- @@unique([characterId, slot])。1キャラあたりスロット1～4を1つずつ持つ。初期は4行とも relicInstanceId NULL で作成するか、装着時のみ行を作るかは実装で選択可。

------------------------------------------------------------------------

## 4. 定数

- **RELIC_SLOT_COUNT** = 4
- **RELIC_SLOTS** = [1, 2, 3, 4] または slot コードの配列
- 属性コード（Phase 10 と一致）：none / crush / slash / pierce / burn / freeze / corrode / polarity

------------------------------------------------------------------------

## 5. API 仕様

### 5.1 getRelicInstances

- **入力**：なし（セッションの userId を使用）
- **出力**：RelicInstance の配列（relicType, relicPassiveEffect を含む）。未装着かどうかは、CharacterRelic に存在するかで判定可能にするため、呼び出し元で getCharacterRelics と突き合わせるか、equippedCharacterId を付与して返す。

### 5.2 getCharacterRelics

- **入力**：characterId（任意で userId で権限チェック）
- **出力**：スロット1～4について、{ slot, relicInstance } の配列。未装着スロットは relicInstance: null。

### 5.3 appraiseRelicToken

- **入力**：itemId（遺物トークンの Item.id）または itemCode（例: relic_group_a_token）。数量は1固定。
- **前提**：その Item が「遺物トークン」として登録されていること（マスタまたは code で判定）。
- **処理**：UserInventory の quantity を1減らす。減らせない場合はエラー。RelicInstance を1件作成（型・パッシブ・補正・耐性はグループに応じた抽選）。
- **出力**：success + 作成した RelicInstance、または error。

### 5.4 equipRelic

- **入力**：characterId, slot（1～4）, relicInstanceId。relicInstanceId が null の場合は「外す」扱いでも可（unequip と統合可）。
- **前提**：relicInstance の所有者がセッション userId と一致。character がそのユーザーに属する。slot は 1～4。
- **処理**：同一 characterId + slot の CharacterRelic を upsert。relicInstanceId を設定。既に他スロットに装着されていれば、そのスロットは未装着にする（1個体は1キャラ1スロットのみ）。

### 5.5 unequipRelic

- **入力**：characterId, slot（1～4）
- **処理**：該当 CharacterRelic の relicInstanceId を NULL に更新、または行削除（実装方針による）。

### 5.6 decomposeRelic

- **入力**：relicInstanceId（遺物個体の ID）
- **前提**：その遺物がセッション userId の所持であり、**未装着**であること。
- **処理**：RelicInstance を1件削除。Item code が `relic_shard` のアイテムを1個、当該ユーザーの UserInventory に加算（upsert で quantity +1、無ければ create）。
- **出力**：success、または error（RELIC_NOT_FOUND / EQUIPPED / RELIC_SHARD_ITEM_NOT_FOUND 等）と message。
- **備考**：`relic_shard` はアイテムマスタに登録が必要。docs/086_craft_relic_appraisal_and_decompose.md 参照。

### 5.7 遺物の調律（docs/087_relic_temper.md）

- **定数**：**RELIC_TEMPER_SHARD_COST** = 77。遺物の欠片の消費数。
- **RelicTemperPending**：userId + relicInstanceId で一意。newStatBonus1, newStatBonus2, newAttributeResistances を保持。調律実行時に作成、確定または取消で削除。
- **getRelicTemperPending(relicInstanceId)**：その遺物の pending があれば返す。モーダルで「前回のリロール結果」を表示する用。
- **startRelicTemper(relicInstanceId)**：未装着・自分の遺物であること。遺物の欠片を 77 個消費。遺物の groupCode に紐づく RelicGroupConfig の範囲で statBonus1/2 と attributeResistances をリロール（パッシブは変更しない）。RelicTemperPending を作成。戻り値は before（現在値）と after（リロール結果）。
- **confirmRelicTemper(relicInstanceId)**：pending を RelicInstance に反映し、pending 削除。
- **cancelRelicTemper(relicInstanceId)**：pending を削除するのみ。遺物の欠片は返却しない（調律実行時に消費済み）。

------------------------------------------------------------------------

## 6. 戦闘との接続

- **runBattle**（battle.ts）でパーティメンバーを組み立てる際、各キャラの **CharacterRelic** から装着遺物を取得し、各遺物個体の **attributeResistances** をマージする。
- マージルール：同一属性コードは乗算または加算で集約。仕様では「受けるダメージ倍率」なので、複数遺物で 0.9 と 0.9 なら 0.81 とするか、平均や加算は仕様で規定する。**MVP では「各遺物の倍率を乗算」**とする（例: 0.9 * 0.9 = 0.81）。未定義属性は 1.0 扱い。
- 集約した **AttributeResistances** を **PartyMemberInput.attributeResistances** に渡す。装備（EquipmentInstance）からも耐性が出る場合は、装備分と遺物分を同様にマージしてから渡す（装備実装済みならここで合算）。

------------------------------------------------------------------------

## 7. 鑑定トークンとアイテム

- 探索ドロップでは **Item**（例: relic_group_a_token）を付与する（既存 finishExploration のまま）。
- 「遺物トークン」であることを判定する方法：Item.code が定数 RELIC_TOKEN_ITEM_CODES に含まれる、または Item に relicTokenGroupCode のような拡張カラムを持つ。MVP では **Item.code の一致**で判定する（例: relic_group_a_token → group_a）。
- 鑑定時：トークン1個消費 → 対応する groupCode の RelicType から1種抽選 → **RelicGroupConfig** でそのグループに紐づくパッシブ（および「効果なし」）から1種抽選 → statBonus1/2 をグループ設定の min〜max で抽選 → attributeResistances をグループ設定の耐性幅で抽選 → RelicInstance 作成。
- **RelicGroupConfig**：groupCode ごとの鑑定設定（ステ補正1/2の min/max、耐性倍率の min/max、効果なしを抽選に含めるか）。管理画面で編集可能。
- **RelicGroupPassiveEffect**：グループごとに「抽選対象にするパッシブ」を多対多で管理。グループ編集画面で選択可能。

------------------------------------------------------------------------

## 8. UI 要件（MVP）

- **工房・鑑定タブ**：所持遺物トークン数と「1個鑑定する」ボタンで appraiseRelicToken を呼ぶ。所持 RelicInstance 一覧を表示し、未装着の遺物には「分解」を表示。
- **工房・調律タブ**：鑑定タブと同様の所持遺物一覧を表示。未装着の遺物には「調律準備」のみ表示。調律はモーダルでコスト（遺物の欠片77個）・リロール前後・確定/取消を行う（docs/087）。
- **物資庫（バッグ）**：種別タブに「遺物」を追加。所持 RelicInstance 一覧の確認のみ（鑑定は工房で行う）。
- **キャラ詳細**：遺物4枠を表示。各スロットに装着中なら遺物名・効果要約を表示。未装着なら「未装着」。装着・解除はドロップダウンまたはクリックで equipRelic / unequipRelic を呼ぶ。
- **効果表示**：遺物個体の relicType.name、relicPassiveEffect.name / description、statBonus1/2 の要約（例: STR+5%、INT+3%）、attributeResistances の要約（例: 炎耐性+10%）を表示する。

------------------------------------------------------------------------

## 9. 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| docs/021_equipment_cycle_design.md | 遺物の位置づけ・4枠・ユニーク前提 |
| docs/026_user_inventory_and_items.md | 遺物の所持・装着・鑑定方針 |
| docs/09_character_implementation_notes.md | 装備枠・遺物4枠 |
| docs/041_skill_effects_implementation_prep.md | Phase 10 属性耐性 |
| spec/045_inventory_and_items.md | バッグ・種別タブ |
| spec/049_exploration.md | 探索ドロップ・報酬 |
