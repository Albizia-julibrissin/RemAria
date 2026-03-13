# 072: 装備の HP/MP 仕様拡張・戦闘反映の実装フェーズ

装備が**派生戦闘ステ**（HP, MP, PATK, MATK, PDEF, MDEF, HIT, EVA, LUCK）に加算する仕様。正式仕様は **spec/071_equipment_derived_stats_in_battle**。

---

## 1. 仕様概要

- 装備個体（EquipmentInstance）の **stats**（JSON）に、戦闘用ステ名をキーとした加算値を保持する。
- 採用可能キー: **HP, MP, PATK, MATK, PDEF, MDEF, HIT, EVA, LUCK**（docs/053 の statGenConfig で設定可能）。
- 戦闘時: そのキャラの装着装備の stats を**合算**し、合算値をそのまま派生ステに加算する。
- 装備の属性耐性は**行わない**（遺物のみ。docs/027）。

---

## 2. 実装フェーズ（完了）

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | 装備マスタ・クラフトで HP/MP を採用可能にする（EQUIPMENT_STAT_KEYS 等） | 完了（管理画面・equipment-stat-gen で対応） |
| 2 | battle.ts で characterEquipments → equipmentInstance.stats を取得・合算し derivedBonus を組み立て | 完了 |
| 3 | run-battle-with-party で PartyMemberInput.derivedBonus を derived に加算 | 完了 |
| 4 | ドキュメント・表示の整合（装備モーダルの HP 表示） | 完了 |

---

## 3. 探索の HP/MP 挙動（開始・抜けて装備変更して再開）

**希望する挙動（確認済み・問題なし）**

- **探索開始時**: 装備計算後の数値で「現在値 = 最大値」になる。
- **探索開始 → 抜ける → 装備変更 → 再開**したとき:
  - **最大値が増えた場合**: 現在値はそのまま、最大値のみ増える。
  - **最大値が減った場合**: 最大値が現在値を下回るなら、現在値も最大値まで減る（クランプ）。

**実装の現状**

- **戦闘経路**: 問題なし。`runBattle` が装備・遺物・メカ込みの derived を使い、`initialHpMpByCharacterId` を `Math.min(derived.HP, override.hp)` でクランプしている（`run-battle-with-party.ts`）。再開後の初戦開始時に「最大増→現在そのまま」「最大減→現在を最大でクランプ」が満たされる。
- **探索開始時**: `startExploration` では `currentHpMp` を保存していない（`Prisma.JsonNull`）。最初の戦闘で `initialHpMpByCharacterId` が未設定のため「最大値スタート」となり、戦闘後に `currentHpMp` が記録される。実質「開始時は現在=最大」だが、開始直後に抜けた場合の表示は下記の通り。
- **表示（再開サマリ・技能イベント step）**: `getExplorationResumeSummary` と技能イベントの `partyHp`/`partyMp` 構築では、最大値に **装備・遺物・メカを含まない** `computeDerivedStats(キャラ基礎のみ)` を使っている。このため「装備変更後の最大値の増減」が再開画面の最大値表示に反映されない。クランプ式 `Math.min(derived.HP, override.hp)` は同じなので、最大が減った場合は表示上の現在値はクランプされるが、そのときの `derived.HP` が装備なしなので値がずれる。

**推奨対応（未実装）**

1. **探索開始時**: 開始処理で装備込みの最大 HP/MP を算出し、`Expedition.currentHpMp` に「現在=最大」で保存する。これで「探索開始時は現在=最大」が DB と表示の両方で一貫する。
2. **再開・表示**: `getExplorationResumeSummary` および技能イベントで `partyHp`/`partyMp`/`partyMaxHp`/`partyMaxMp` を組み立てる箇所で、戦闘と同様に装備・遺物・メカ込みの derived（`computeEffectiveBaseStats` + 装備合算の derivedBonus）を使う。これで装備変更後の「最大が増えた/減った」が正しく表示され、クランプも装備込みの最大値で行われる。
3. **任意**: 再開時（表示時または `advanceExplorationStep` 開始時）に、装備込みの最大値でクランプした結果を `currentHpMp` に書き戻すと、DB 上の現在値が常に「現在の装備での最大値以下」に保たれる。

---

## 4. 参照

- 装備・クラフトのステ生成: **docs/053_equipment_craft_stat_gen_master.md**
- 戦闘反映状況一覧: **docs/069_equipment_relic_mecha_battle_reflection.md**
