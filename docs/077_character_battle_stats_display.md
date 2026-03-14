# キャラ単位の戦闘ステ・戦闘力表示（装備・遺物反映）

キャラ詳細などで「1キャラごとに」戦闘時と同じ解釈の戦闘ステ（HP/MP）と戦闘力を表示するための設計。**戦闘処理（battle.ts）には一切手を入れない**。

---

## 1. 目的

- **表示内容**: そのキャラの「解釈後の戦闘ステ」の **HP** と **MP**、およびその合計を **戦闘力** として表示する。
- **反映するもの**:
  - 主人公・仲間: 基礎ステ ＋ 遺物（％補正）＋ 装備（派生ステ加算）
  - メカ: 基礎ステ ＋ 遺物（％補正）＋ パーツ（フラット加算・フレーム倍率）
- **解釈**: 戦闘で使っている計算と同一（`effective-base-stats` → `derived-stats` → 装備/パーツ加算）。表示だけが増える。

---

## 2. 戦闘力の定義（本機能）

- **表示用戦闘力** = 解釈後（装備・遺物反映済み）の**派生ステータス 9 種の合計**とする。  
  HP + MP + PATK + MATK + PDEF + MDEF + HIT + EVA + LUCK
- 運営目安の「CAP×21」（`manage/COMBAT_POWER_SCALE_DESIGN.md`）は別の文脈のため、画面表示の「戦闘力」は上記合計で統一する。

---

## 3. 実装方針

### 3.1 戦闘への影響なし

- `src/server/actions/battle.ts` は**変更しない**。
- 既存の `computeEffectiveBaseStats` / `computeDerivedStats`（`lib/battle`）を**そのまま**利用し、**新規のデータ取得＋表示用 API のみ**追加する。

### 3.2 レイヤー構成

| レイヤー | 役割 |
|----------|------|
| **lib/battle** | 既存の `effective-base-stats.ts` と `derived-stats.ts` で「有効基礎 → 派生ステ」を計算。変更なし。 |
| **server** | 1キャラ分の「戦闘ステ算出用データ」を取得し、上記 lib を組み合わせて「装備込みの戦闘ステ」と「戦闘力（派生ステ 9 種合計）」を返す。 |
| **UI** | キャラ詳細でその戻り値を表示（HP / MP / 戦闘力）。 |

### 3.3 データ取得（1キャラ）

戦闘と同様に以下を揃える。

- **キャラ**: STR, INT, VIT, WIS, DEX, AGI, LUK, CAP
- **遺物**: `characterRelics` → 各 `relicInstance.statBonus1` / `statBonus2` を `parseRelicStatBonus` でパースし `relicStatBonuses` を構築
- **装備**: `characterEquipments` → 各 `equipmentInstance.stats` の HP, MP, PATK, … を合算して `derivedBonus` を構築
- **メカ**: そのキャラの `MechaEquipment` を取得し、部位ごとに `mechaPartType` の `slot` / `statRates` / `strAdd` 等から `mechaFlat` と `frameMultiplier` を構築（battle の `mechPartDataByCharId` と同一ロジック）

計算の流れ（battle と同一）:

1. `rawBase` = キャラの 7 種 + CAP
2. `computeEffectiveBaseStats(rawBase, { relicStatBonuses, mechaFlat?, frameMultiplier? })` → 有効基礎
3. `computeDerivedStats(有効基礎)` → 装備前の派生ステ
4. 装備の `derivedBonus` を加算 → 装備込みの戦闘ステ（HP, MP 含む）
5. 戦闘力 = HP + MP + PATK + MATK + PDEF + MDEF + HIT + EVA + LUCK（装備込みの値）

---

## 4. ファイル構成

| ファイル | 役割 |
|----------|------|
| `docs/077_character_battle_stats_display.md` | 本設計（このドキュメント） |
| `src/server/lib/character-battle-stats.ts` | 1キャラ用のデータ取得＋有効基礎・派生・装備加算・戦闘力算出。battle と同じ式を再利用。 |
| `src/app/dashboard/characters/[id]/page.tsx` | 上記を呼び出し、戦闘ステ（HP/MP）と戦闘力を表示するブロックを追加 |

`character-battle-stats.ts` は「1キャラ分」に限定した Prisma 取得と、既存の `effective-base-stats` / `derived-stats` の呼び出しのみ行う。battle の「編成・作戦・スキル」には触れない。

---

## 5. API 形状（案）

```ts
// 戻り値
type CharacterBattleStatsResult = {
  derived: DerivedStats;  // 装備・遺物反映後の戦闘ステ（HP, MP, PATK, ...）
  combatPower: number;     // HP+MP+PATK+MATK+PDEF+MDEF+HIT+EVA+LUCK
} | null;  // キャラが存在しない or 権限なしのとき null

getCharacterBattleStats(characterId: string, userId: string): Promise<CharacterBattleStatsResult | null>
```

- キャラ詳細では `getCharacterBattleStats(character.id, session.userId)` を呼び、`derived.HP` / `derived.MP` / `combatPower` を表示する。

---

## 6. 表示例（キャラ詳細）

- 見出し例: 「戦闘ステ（装備・遺物反映）」
- 表示項目: HP, MP, 戦闘力（派生ステ 9 種合計）
- メカも同じ API で取得可能（パーツ・遺物反映済み）。

---

## 7. 参照

- 戦闘時有効基礎ステ: `spec/069_battle_effective_base_stats.md`, `src/lib/battle/effective-base-stats.ts`
- 派生ステ計算: `docs/10_battle_calc_formulas.md`, `src/lib/battle/derived-stats.ts`
- 戦闘での組み立て: `src/server/actions/battle.ts`（参照のみ。変更しない）
- 運営用戦闘力目安: `manage/COMBAT_POWER_SCALE_DESIGN.md`
