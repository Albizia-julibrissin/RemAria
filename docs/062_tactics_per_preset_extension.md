# 作戦スロットのプリセット別保持（拡張案）

プリセットを複数持ったときに「プリセット1とプリセット2で、同じキャラの作戦スロットを別々に持てるようにする」ための設計案。現状は **キャラ単位のみ**（TacticSlot.characterId）のため、同一キャラは全プリセットで作戦が共通になっている。

---

## 0. 前提（テスト公開中）

- **現在はテスト公開のため、ユーザのプリセットデータは一度消えてもよい**（作り直してもらう想定）。
- この前提により、移行では「既存プリセット・作戦データを保持する」必要がなく、**案B（PresetTacticSlot のみ・TacticSlot 廃止）を最初から採用**したり、必要ならプリセット／作戦を一括クリアしてから新スキーマに切り替えたりする選択がしやすい。

---

## 1. 目的・背景

### 1.1 現状の制約

- **TacticSlot** は `characterId` + `orderIndex` で一意。プリセット（PartyPreset）とは紐づいていない。
- そのため、同じキャラを複数プリセットで使う場合、**そのキャラの作戦は全プリセットで 1 セット共有**される。
- 例：プリセット1（物理特化編成）とプリセット2（魔法特化編成）の両方に仲間Aを入れると、仲間Aの作戦をどちらかで保存するともう一方も上書きされる。

### 1.2 拡張で叶えたいこと

- プリセットごとに「そのプリセットで使うときの作戦」を別々に持てるようにする。
- プリセット数を増やしても、編成ごとの戦術の切り替えがしやすくなる。

---

## 2. 要件（拡張後）

- あるプリセットを開いたとき、編集・保存・戦闘参照する作戦は **そのプリセットに紐づく作戦** とする。
- 同一キャラでも、プリセットが違えば **別の作戦スロット** を保持できる。
- 既存の「キャラ単位」作戦（TacticSlot）をどう扱うかは **3. データモデル** と **5. 移行方針** で案を述べる。

---

## 3. データモデル案

### 3.1 新規テーブル: PresetTacticSlot

プリセット × キャラ × orderIndex で一意に作戦 1 行を保持する。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| partyPresetId | String | FK → PartyPreset.id |
| characterId | String | FK → Character.id（編成の 3 枠のいずれか） |
| orderIndex | Int | 1～10。評価順 |
| subject | String | 主語（既存 TacticSlot と同様） |
| conditionKind | String | 条件種別 |
| conditionParam | Json? | 条件パラメータ |
| actionType | String | normal_attack / skill |
| skillId | String? | actionType=skill のとき FK → Skill.id |
| createdAt / updatedAt | DateTime | 任意 |

**制約**

- `@@unique([partyPresetId, characterId, orderIndex])`
- `@@index([partyPresetId])`
- partyPreset は userId の所有物。characterId も同一 user のキャラに限定（既存と同様の権限チェック）。

### 3.2 既存 TacticSlot の扱い（2 案）

| 案 | 内容 | メリット | デメリット |
|----|------|----------|------------|
| **A. フォールバック** | プリセット用は PresetTacticSlot を優先して参照。**無い場合は従来どおり TacticSlot（キャラ単位）を参照**。 | 既存データをそのまま活かせる。移行が不要。 | 参照順（プリセット → キャラ）の説明と実装が必要。 |
| **B. 全面移行** | 作戦は PresetTacticSlot のみにし、TacticSlot は廃止（または読み取り専用で移行後に削除）。 | モデルが 1 本化して分かりやすい。 | 既存 TacticSlot をプリセット単位へ移行する手順が必要。 |

**推奨（テスト公開中）**: 前提 0 のとおりデータリセット許容なら **案B（全面移行）** でよい。PresetTacticSlot のみ参照・保存し、TacticSlot は使わない（削除または残しても参照しない）。本番で既存データを残す必要が出た場合は案A（フォールバック）を検討する。

---

## 4. 取得・保存・戦闘時の参照

### 4.1 取得（作戦室・戦闘準備）

- **入力**: `partyPresetId` と、そのプリセットの編成 3 人の `characterIds`。
- **処理**:
  1. `PresetTacticSlot` を `partyPresetId` と `characterId in characterIds` で取得。
  2. （案A の場合のみ）ある characterId について PresetTacticSlot が 0 件なら、そのキャラの **TacticSlot** を取得して返す（フォールバック）。**案B の場合は PresetTacticSlot のみ参照**（0 件なら空スロット）。
- **出力**: 従来どおり `{ tactics: [ { characterId, slots: [...] } ] }`。呼び出し側の型はそのままでよい。

### 4.2 保存（作戦室）

- **入力**: `partyPresetId`、編成 3 人の characterIds、および各キャラの slots。
- **処理**:
  1. partyPresetId が userId の所有物か検証。
  2. 各 characterId が user のキャラか検証。
  3. そのプリセットの 3 キャラ分について、**PresetTacticSlot を一括置換**（deleteMany + createMany）。TacticSlot は更新しない（案A の場合、プリセットで 1 回でも保存すれば以後は PresetTacticSlot が優先される）。

### 4.3 戦闘時の参照

- 戦闘開始時に「どのプリセットで出撃するか」が決まっている想定（探索・練習戦闘などでプリセット選択している）。
- 味方の行動決定時は、**そのプリセットに紐づく作戦** を参照する（4.1 と同じ取得ロジック。案B なら PresetTacticSlot のみ）。

---

## 5. API 変更・新規

- **getTacticsForCharacters(characterIds)**  
  - 変更: 呼び出し元で「どのプリセットの作戦か」を渡す必要がある。  
  - 例: `getTacticsForPreset(partyPresetId)` に変更するか、`getTacticsForCharacters(characterIds, partyPresetId?)` のようにプリセット ID をオプションで渡し、指定時は PresetTacticSlot を優先する。
- **upsertTacticsForCharacter**  
  - 変更: プリセット単位の一括保存にする。  
  - 例: `upsertTacticsForPreset(partyPresetId, tacticsByCharacter)` を新設し、PresetTacticSlot のみ更新。既存の `upsertTacticsForCharacter` は案A では残し、プリセット未指定の編集がもしあれば TacticSlot を更新する用途に回すか、非推奨にする。
- **戦闘フロー**  
  - 出撃プリセットが決まっている箇所で、その `partyPresetId` を渡して作戦取得する API を用意する。

※ 既存の作戦室は「プリセットを開いて編集」しているので、`presetId` は常にある。getTactics 系に presetId を渡す形にすれば、既存画面からも自然にプリセット別作戦になる。

---

## 6. 移行方針

### 6.1 テスト公開中（データリセット許容）の場合

- **PresetTacticSlot** を新規追加。作戦の参照・保存はすべて PresetTacticSlot のみにする（案B）。
- **TacticSlot**: テーブルは削除するか、残すなら参照しない。削除する場合はマイグレーションで `DROP` または別途マイグレーションで対応。
- **PartyPreset / 既存プリセット**: 必要なら「一度全ユーザのプリセットを削除」するマイグレーションや運用を挟んでもよい（前提 0）。ユーザは作戦室からプリセットを再作成する。
- **データ移行スクリプトは不要**: 既存 TacticSlot を PresetTacticSlot にコピーする必要はない。

### 6.2 本番で既存データを残す場合（案A）

- PresetTacticSlot を追加し、取得時は「PresetTacticSlot が無ければ TacticSlot を参照」するフォールバックにする。
- 既存ユーザーは、各プリセットで一度作戦を保存するまで TacticSlot が参照され、保存後はそのプリセットは PresetTacticSlot が使われる。

---

## 7. 関連・実装

- **spec/063_tactics_per_preset.md** … 本拡張の **正式仕様**。データモデル・API・**実装フェーズ（Phase 1～5）** を定義。実装は 063 に従う。
- **spec/039_battle_tactics_and_editor.md** … 作戦室の画面・主語・条件・行動の正本。063 は永続先の拡張のみ。039 に 063 参照を追記済み。
- **prisma/schema.prisma** … PresetTacticSlot 追加・TacticSlot 削除は 063 Phase 1 / 5。
- **docs/08_database_schema.md** … 拡張後に PresetTacticSlot を追記する（063 Phase 5）。
