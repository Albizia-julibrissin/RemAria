# spec/071: 装備の派生戦闘ステ加算（戦闘反映）

装備個体が持つ戦闘用ステ補正を、戦闘計算の**派生ステ**（HP, MP, PATK, MATK, PDEF, MDEF, HIT, EVA, LUCK）に加算する仕様。

---

## 1. 概要

- 装備は**基礎ステ**を上げず、**派生戦闘ステ**（二層解釈後の値）に直接加算する（docs/021, docs/026）。
- キャラが装着している装備の `EquipmentInstance.stats`（JSON）を合算し、その結果を戦闘の派生ステに加える。HP を含めすべてのキーで合算値を**そのまま**加算する。
- 装備の属性耐性は**持たせない**（遺物のみ。docs/027）。

---

## 2. データ構造

- **EquipmentInstance.stats**: キーは派生戦闘ステ名（HP, MP, PATK, MATK, PDEF, MDEF, HIT, EVA, LUCK）。値は数値（加算値）。
- **PartyMemberInput.derivedBonus**: `Partial<DerivedStats>`。装備の合算結果（stats の値をそのまま渡す）。

---

## 3. 戦闘での扱い

1. **battle.ts**: キャラごとに characterEquipments → equipmentInstance.stats を走査し、キーごとに合算。合算結果を `derivedBonus` として PartyMemberInput に渡す。
2. **run-battle-with-party**: `computeDerivedStats(p.base)` の結果に、`p.derivedBonus` の各キーを加算したものを `derived` とする。これで HP, MP, PATK 等が装備分だけ増える。

---

## 4. 実装

- `src/server/actions/battle.ts`: characterEquipments と equipmentInstance.stats の取得、合算、derivedBonus の組み立て。  
- `src/lib/battle/run-battle-with-party.ts`: PartyMemberInput.derivedBonus の型定義、derived 算出時の加算。

---

## 5. 参照

- docs/072_equipment_hp_mp_implementation_plan.md（実装フェーズ・HP/MP 拡張）  
- docs/053_equipment_craft_stat_gen_master.md（装備のステ生成・マスタ）  
- docs/069_equipment_relic_mecha_battle_reflection.md（反映状況一覧）
