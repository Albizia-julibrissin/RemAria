# 069: 探索戦闘での装備・遺物・メカパーツの効果反映状況

探索戦闘・練習戦闘において、装備・遺物・メカパーツの効果がどのように反映されているかを一覧する。正式仕様は **spec/069_battle_effective_base_stats**（有効基礎ステ）と **spec/071_equipment_derived_stats_in_battle**（装備の派生ステ加算）。

---

## 1. 反映状況一覧

| 対象 | 効果内容 | 反映状況 | 備考 |
|------|----------|----------|------|
| **装備** | 派生戦闘ステ（HP, MP, PATK, MATK, PDEF, MDEF, HIT, EVA, LUCK）への加算 | **反映済み** | stats の合算値をそのまま加算。spec/071。 |
| **遺物** | 基礎ステ％補正（statBonus1 / statBonus2） | **反映済み** | 有効基礎ステの算出に使用。spec/069。 |
| **遺物** | 属性耐性（attributeResistances） | **反映済み** | partyAttributeResistances として戦闘に渡す。spec/051。 |
| **遺物** | パッシブ効果（最終ダメージ倍率・毎ターンHP回復等） | **反映済み** | docs/073。effectType + param。 |
| **メカパーツ** | フレーム以外の部位のフラット加算（strAdd 等） | **反映済み** | 有効基礎ステの算出に使用。spec/069。 |
| **メカパーツ** | フレームの倍率（statRates） | **反映済み** | 有効基礎ステの最後に適用。docs/024。 |

---

## 2. 実装箇所

- **戦闘時有効基礎ステ**（遺物％・メカフラット・フレーム倍率）  
  - `src/lib/battle/effective-base-stats.ts`（純粋関数）  
  - `src/server/actions/battle.ts`（データ取得・relicStatBonuses / mechPartDataByCharId の組み立て・computeEffectiveBaseStats 呼び出し）
- **装備の派生ステ加算**  
  - `src/server/actions/battle.ts`（characterEquipments → equipmentInstance.stats を合算、derivedBonus で partyInput に渡す）  
  - `src/lib/battle/run-battle-with-party.ts`（PartyMemberInput.derivedBonus を computeDerivedStats(base) の結果に加算）
- **遺物パッシブ・属性耐性**  
  - `src/server/actions/battle.ts`（relicPassiveEffects / attributeResistances の取得と partyInput への受け渡し）  
  - `src/lib/battle/run-battle-with-party.ts`（遺物パッシブの倍率適用・HP回復・検証ログ）

---

## 3. 補足（装備の派生ステ加算）

- 装備個体の `EquipmentInstance.stats` に格納されている値（HP, MP, PATK 等）を、そのキャラの装着装備分だけ合算し、合算値をそのまま派生戦闘ステに加算する（spec/071）。
