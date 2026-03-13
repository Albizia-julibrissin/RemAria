# spec/069: 戦闘時有効基礎ステ

戦闘で使用する「有効基礎ステ」の算出仕様。遺物の％補正・メカパーツのフラット加算・フレーム倍率を反映する。

---

## 1. 概要

- **有効基礎ステ** = キャラの生の基礎ステ（STR, INT, VIT, WIS, DEX, AGI, LUK, CAP）に、以下を**順に**適用した値。  
  - 遺物の基礎ステ％補正（RelicInstance.statBonus1 / statBonus2）  
  - メカのみ: フレーム以外の部位のフラット加算（MechaPartType の strAdd, intAdd 等の合算）  
  - メカのみ: フレームの倍率（MechaPartType.statRates。キーが無い基礎ステは 1.0 扱い）  
- 算出した有効基礎ステを `PartyMemberInput.base` として戦闘に渡す。派生ステ（HP, PATK 等）は `computeDerivedStats(base)` で算出する（docs/10_battle_status.csv 準拠）。

---

## 2. 入力データ

| 項目 | 出典 | 形式 |
|------|------|------|
| 生の基礎ステ | Character（STR, INT, …） | BaseStats |
| 遺物％補正 | RelicInstance.statBonus1, statBonus2 | 各 { stat: string, percent: number }。有効 stat は STR, INT, VIT, WIS, DEX, AGI, LUK, CAP。 |
| メカフラット | MechaPartType（slot ≠ frame）の strAdd, intAdd, … | 部位ごとの加算を合算した Partial<BaseStats> |
| フレーム倍率 | MechaPartType（slot = frame）の statRates | Record<string, number>（例: { STR: 1.2, DEX: 0.8 }） |

---

## 3. 算出順序

1. **遺物％適用**: 各基礎ステについて、そのステに対する遺物の percent を合算し、`base[stat] * (1 + sumPercent/100)` を切り捨てで適用。  
2. **メカフラット加算**: メカの場合のみ、フレーム以外の部位の strAdd, intAdd 等を加算。  
3. **フレーム倍率**: メカの場合のみ、statRates のキーに対応する基礎ステに倍率を掛け、切り捨て。

---

## 4. 実装

- **純粋関数**: `src/lib/battle/effective-base-stats.ts`  
  - `parseRelicStatBonus(json)`, `applyRelicStatBonuses(base, relicBonuses)`, `addMechaPartsFlat(base, flat)`, `applyFrameMultiplier(base, statRates)`, `computeEffectiveBaseStats(base, options)`  
- **データ取得・組み立て**: `src/server/actions/battle.ts`  
  - characterRelics.relicInstance.statBonus1, statBonus2 を取得し relicStatBonuses を組み立て。  
  - メカは mechaEquipment から mechaPartType の slot, statRates, strAdd 等を取得し、mechPartDataByCharId を組み立て。  
  - `computeEffectiveBaseStats(rawBase, { relicStatBonuses, mechaFlat, frameMultiplier })` の結果を partyInput.base に渡す。

---

## 5. 参照

- docs/070_battle_effective_stats_implementation_plan.md（実装フェーズ）  
- docs/024_mecha_design.md（メカの部位・ステ計算）  
- docs/026_user_inventory_and_items.md（遺物の基礎ステ％）
