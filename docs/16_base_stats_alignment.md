# 基礎ステータス定義のずれと整理

**結論**：**A 案を採用済み**。DB・コード・docs を計算式・CSV に合わせ、基礎ステータスは **STR, INT, VIT, WIS, DEX, AGI, LUK** の 7 種類＋**CAP（合計上限）**に統一した。

---

## 1. 定義の対照

### 1.1 計算式・CSV（10 の正）

| 資料 | 基礎ステータス | 備考 |
|------|----------------|------|
| **docs/10_battle_calc_formulas.md** 1.1 | STR / INT / VIT / **WIS** / DEX / **AGI** / LUK | 7 種類。合計＝CAP。 |
| **docs/10_battle_status.csv** 列見出し | STR, INT, VIT, WIS, DEX, AGI, LUK | 係数表の入力側。 |

→ **7 種類は STR, INT, VIT, WIS, DEX, AGI, LUK**。**CAP は「合計上限」**で別概念。

### 1.2 実装メモ（09 の決定）

| 資料 | Character に持つカラム |
|------|------------------------|
| **docs/09_character_implementation_notes.md** 1.1 | STR / INT / **DEX** / VIT / **SPD** / CAP / LUK |

→ **WIS がない**。**AGI の代わりに SPD**。  
→ ここで「DB は WIS/AGI をやめ、SPD で速度（回避）を表す」とされた。

### 1.3 現状の DB・コード

| 対象 | カラム／プロパティ |
|------|---------------------|
| **prisma/schema.prisma** Character | STR, INT, DEX, VIT, **SPD**, LUK, CAP |
| **spec/015, 025, 030** | 同上（STR〜LUK=10, CAP=60 等） |
| **10_battle_status.csv** | STR, INT, VIT, **WIS**, DEX, **AGI**, LUK |

→ DB・spec は **09 の決定（SPD 採用）** に合わせている。  
→ CSV・計算式 doc は **WIS, AGI** の 7 種のまま。

---

## 2. ずれの内容

| 項目 | 計算式・CSV（10） | 現状 DB・09 |
|------|-------------------|-------------|
| 知力系 | **INT** ＋ **WIS**（別枠） | **INT** のみ（WIS なし） |
| 速度・回避 | **AGI** | **SPD**（AGI の代用） |
| 並び | STR, INT, VIT, WIS, DEX, AGI, LUK | STR, INT, DEX, VIT, SPD, LUK ＋ CAP |

- **11_test_battle_plan.md** では「DB は WIS/AGI なし。WIS→INT 流用、AGI→SPD でマッピング」と**ずれを許容**したうえで戦闘計算に使っている。
- **spec/020_test_battle.md** 143 行目も「CSV は WIS, AGI。キャラは WIS なし→INT 流用、AGI→SPD 流用」と記載。

---

## 3. どれを正とするか（選択肢）

### A) 計算式・CSVに合わせる（7 種＝STR, INT, VIT, WIS, DEX, AGI, LUK ＋ CAP）

- **DB**：Character を **STR, INT, VIT, WIS, DEX, AGI, LUK, CAP** に変更（SPD をやめて AGI を追加、WIS 追加）。
- **定数・Seed・戦闘**：上記 7 種＋CAP に合わせて修正。
- **メリット**：10_battle_status.csv と 10_battle_calc_formulas.md と完全一致。  
- **デメリット**：マイグレーションと、SPD 参照箇所の AGI への変更が必要。

### B) 現状の DB を正とする（SPD のまま）

- **docs/10, 11** と **spec** を「基礎ステータスは STR, INT, DEX, VIT, SPD, LUK。CAP は合計上限。CSV の WIS は INT で、AGI は SPD でマッピングする」と明記。
- **メリット**：既存 DB・コードをそのまま使える。  
- **デメリット**：CSV の「WIS, AGI」と名前が一致しない。

### C) その他

- 例：DB は 7 種＋CAP のまま、**表示名だけ**「SPD→速度(AGI)」「WIS は別枠で INT と併存」などと説明する折衷。

---

## 4. 採用した方針

- **A 案を採用**。DB を STR, INT, VIT, WIS, DEX, AGI, LUK, CAP に変更し、マイグレーション `20260222130000_base_stats_wis_agi` で SPD を AGI に移行・WIS を追加した。定数・derived-stats・repository・戦闘・UI・docs をすべて CSV 準拠に修正済み。

---

## 5. 参照箇所一覧（修正時に触れる想定）

- **prisma/schema.prisma**：Character の STR, INT, DEX, VIT, SPD, LUK, CAP。
- **src/lib/constants/protagonist.ts**：INITIAL_* と CAP。
- **src/lib/battle/derived-stats.ts**：係数計算の入力（現状 SPD 等）。
- **src/lib/battle/**：戦闘計算で参照しているステータス名。
- **prisma/seed.ts**：PHYSICAL_TYPE_A_STATS 等（現状 SPD）。
- **docs/08_database_schema.md**：Character のカラム説明。
- **docs/09_character_implementation_notes.md**：1.1 の「永続化する項目」。
- **docs/10_battle_calc_formulas.md**：1.1 の基礎ステータス表。
- **docs/11_test_battle_plan.md**：マッピング表（WIS/AGI と SPD/INT）。
- **spec/015, 025, 020**：基礎ステータス一覧の記載。
