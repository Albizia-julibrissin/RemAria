# 070: 戦闘時有効基礎ステ実装案・実装フェーズ

戦闘で使用する「有効基礎ステ」の算出方針と実装フェーズ。正式仕様は **spec/069_battle_effective_base_stats**。

---

## 1. 方針

- **有効基礎ステ** = キャラの生の基礎ステ（STR, INT, …）に、以下を順に適用したもの。  
  1. **遺物の％補正**（RelicInstance.statBonus1 / statBonus2。例: STR+5%）  
  2. **メカのフラット加算**（フレーム以外の部位の strAdd, intAdd 等の合算）※メカのみ  
  3. **メカフレームの倍率**（slot=frame の statRates。例: STR 1.2, DEX 0.8）※メカのみ  
- 算出結果を `partyInput.base` として戦闘に渡し、`computeDerivedStats(base)` で派生ステ（HP, PATK 等）を求める。
- 装備は**派生ステへの加算**として別扱い（spec/071）。

---

## 2. 実装フェーズ（完了）

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | 純粋関数ライブラリ `effective-base-stats.ts`（parseRelicStatBonus, applyRelicStatBonuses, addMechaPartsFlat, applyFrameMultiplier, computeEffectiveBaseStats） | 完了 |
| 2 | battle.ts で遺物 statBonus1/2・メカパーツ（slot, statRates, strAdd 等）を取得し、mechPartDataByCharId を組み立て | 完了 |
| 3 | battle.ts で rawBase → computeEffectiveBaseStats → partyInput.base に有効基礎を渡す | 完了 |

---

## 3. 参照

- メカの部位とステ計算: **docs/024_mecha_design.md**
- 遺物の基礎ステ％: **docs/026_user_inventory_and_items.md**、**spec/051_relics**
- 実装: `src/lib/battle/effective-base-stats.ts`、`src/server/actions/battle.ts`
