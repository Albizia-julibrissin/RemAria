# 装備 HP「4.25 倍やめる」仕様変更の影響箇所一覧

装備の HP を「出た数値のまま」使う仕様に変更する。**4.25 倍をやめる**場合の修正対象。

**→ 上記修正は反映済み（spec/071, docs, battle.ts, equip-equipment-modal, equipment-stat-gen, run-battle-with-party）。**

---

## 1. Spec（正本の修正）

| ファイル | 内容 | 修正方針 |
|----------|------|----------|
| **spec/071_equipment_derived_stats_in_battle.md** | §1「HP のみ 4.25 倍してから加算」、§2「HP は 4.25 倍済み」、§3「HP キーは合算後に 4.25 倍」、§4「HP 4.25 倍」 | 4.25 倍の記述をすべて削除。「装備 stats の HP は合算値をそのまま派生 HP に加算」に統一。 |

---

## 2. Docs（4.25 倍・端数注意の削除・修正）

| ファイル | 内容 | 修正方針 |
|----------|------|----------|
| **docs/072_equipment_hp_mp_implementation_plan.md** | 冒頭「HP の 4.25 倍ルール」、§1 戦闘時の 4.25 倍、Phase 2 の「HP は 4.25 倍」、§3 注意（端数・表示と戦闘のずれ）、§4 探索まわり | 4.25 倍に関する記述を削除。§3 の「端数により表示と戦闘時の加算が一致しない」注意は不要になるので削除。 |
| **docs/069_equipment_relic_mecha_battle_reflection.md** | 表「HP は戦闘時に 4.25 倍して加算」、§2 battle.ts の「HP は 4.25 倍」、§3「装備の派生ステ・HP 4.25 倍」全体、端数注意 | 4.25 倍と端数注意を削除。「装備の HP は合算値をそのまま加算」に変更。 |
| **docs/026_user_inventory_and_items.md** | 「HP のみ、戦闘反映時に補正値を 4.25 倍してから加算する（基礎→派生の係数表で…）」 | 該当文を「装備の HP は合算値をそのまま派生 HP に加算する」に変更。係数表の言及を削除。 |
| **docs/README.md** | 「装備の派生戦闘ステ加算（HP/MP 含む・HP は 4.25 倍）」 | 「装備の派生戦闘ステ加算（HP/MP 含む）」に変更（4.25 倍の記述削除）。 |

---

## 3. 実装（コード）

| ファイル | 内容 | 修正方針 |
|----------|------|----------|
| **src/server/actions/battle.ts** | `EQUIPMENT_HP_MULTIPLIER = 4.25`、`key === "HP" ? Math.floor(v * EQUIPMENT_HP_MULTIPLIER) : v` が 2 箇所（runBattle 内と別の処理） | HP の場合も他ステと同様に `v` をそのまま加算。定数と分岐を削除。 |
| **src/app/dashboard/characters/[id]/equip-equipment-modal.tsx** | コメント「HP は 4.25 倍」、`HP_MULTIPLIER = 4.25`、`key === "HP" && typeof raw === "number" ? Math.floor(raw * HP_MULTIPLIER) : raw`、脚注「※HPは端数処理により…」 | HP も `raw` をそのまま表示。HP_MULTIPLIER と端数注意の文言を削除。 |
| **src/lib/craft/equipment-stat-gen.ts** | コメント「HP は戦闘時に 4.25 倍して加算（docs/072）」 | 「装備の HP は戦闘時に合算値をそのまま派生 HP に加算」に変更。 |
| **src/lib/battle/run-battle-with-party.ts** | コメント「装備の派生戦闘ステ加算（HP は戦闘側で 4.25 倍済み）」 | 「装備の派生戦闘ステ加算」のみに変更（4.25 倍の記述削除）。 |

---

## 4. 参照のみ・修正不要

- **AGENTS.md**  
  「装備の派生戦闘ステ加算（HP/MP 含む）」のみで 4.25 倍に言及していないため、そのままで可。
- **docs/027_hardcoded_and_deferred.md**  
  技能イベントの HP/MP 処理の記述は 4.25 倍に依存していないため、そのままで可。
- **spec/049_exploration.md**  
  装備変更と最大 HP/MP の関係の記述のみで 4.25 倍に言及していないため、そのままで可。
- **src/app/dashboard/exploration-start-client.tsx** の `pl-[4.25rem]`  
  CSS の余白指定であり、装備 HP 仕様とは無関係。変更不要。

---

## 5. 作業順序の目安

1. **spec/071** を修正（正本を先に変更）。
2. **docs** の 072 / 069 / 026 / README を修正。
3. **battle.ts** の 2 箇所で HP を「そのまま加算」に変更。
4. **equip-equipment-modal.tsx** で HP をそのまま表示・端数注意削除。
5. **equipment-stat-gen.ts** と **run-battle-with-party.ts** のコメントを修正。

---

## 6. 仕様変更後の要点

- 装備の `EquipmentInstance.stats` に格納される **HP の数値**を、戦闘時の派生 HP に**そのまま加算**する（他ステと同様）。
- 管理画面・クラフトで設定する装備の HP は「戦闘時にその値がそのまま加算される」と解釈する。
- 表示と戦闘計算のずれ（端数注意）は発生しないため、その説明は不要になる。
