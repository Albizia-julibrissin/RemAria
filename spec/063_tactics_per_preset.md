# Spec: 作戦スロットのプリセット別保持

**spec/039 の拡張**。味方の作戦スロットを **プリセット（PartyPreset）ごとに保持**し、同一キャラでもプリセットが違えば別の作戦を持てるようにする。設計案は **docs/062_tactics_per_preset_extension.md**。

------------------------------------------------------------------------

## 0. 前提・目的

### 0.1 前提（テスト公開中）

- ユーザのプリセット・作戦データは一度消えてもよい（作り直してもらう想定）。
- 既存 TacticSlot の移行は行わず、**PresetTacticSlot のみ**で運用する（案B）。

### 0.2 目的

- プリセット1とプリセット2で、同じキャラの作戦スロットを別々に持てるようにする。
- 編成ごとに戦術を切り替えやすくする。

### 0.3 現状（039）との関係

- **039**: 作戦は TacticSlot（characterId + orderIndex）でキャラ単位のみ。同一キャラは全プリセットで作戦が共通。
- **063 採用後**: 作戦は PresetTacticSlot（partyPresetId + characterId + orderIndex）でプリセット単位。TacticSlot は参照せず、廃止または削除する。

------------------------------------------------------------------------

## 1. 依存・横断

### 1.1 依存する spec

- **039_battle_tactics_and_editor**：作戦室の画面フロー・主語・条件・行動の仕様はそのまま。永続先だけ PresetTacticSlot に変える。
- **040_tactic_slot_evaluation**：評価ロジックは不変。入力のスロット並びの取得元が PresetTacticSlot になるだけ。
- **010_auth**：ログイン・所有権検証は既存どおり。

### 1.2 影響する API・呼び出し元

| 対象 | 現状 | 063 採用後 |
|------|------|------------|
| 作戦室・取得 | getTacticsForCharacters(characterIds) | getTacticsForPreset(presetId) または getTacticsForCharacters(characterIds, presetId) |
| 作戦室・保存 | savePresetWithTactics → upsertTacticsForCharacter ×3 | savePresetWithTactics → PresetTacticSlot の一括置換のみ |
| 戦闘実行 | Character.tacticSlots（TacticSlot）を include | presetId に紐づく PresetTacticSlot を取得してキャラごとに割り当て |

------------------------------------------------------------------------

## 2. データモデル

### 2.1 新規: PresetTacticSlot

プリセット × キャラ × orderIndex で一意。1 行が 1 スロット。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | String (cuid) | PK |
| partyPresetId | String | FK → PartyPreset.id, onDelete: Cascade |
| characterId | String | FK → Character.id（編成 3 枠のいずれか） |
| orderIndex | Int | 1～10。評価順 |
| subject | String | 主語（039・040 と同一） |
| conditionKind | String | 条件種別 |
| conditionParam | Json? | 条件パラメータ |
| actionType | String | normal_attack / skill |
| skillId | String? | actionType=skill のとき FK → Skill.id |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**制約**

- `@@unique([partyPresetId, characterId, orderIndex])`
- `@@index([partyPresetId])`
- 権限: partyPreset.userId の所有物であり、characterId は同一 user のキャラに限定（既存と同様）。

### 2.2 既存 TacticSlot の扱い

- **参照**: しない（取得・戦闘ともに PresetTacticSlot のみ使用）。
- **テーブル**: マイグレーションで削除するか、残すなら未使用とする。テスト公開前提のため削除してよい。

------------------------------------------------------------------------

## 3. API（入出力・ルール）

### 3.1 取得: プリセットに紐づく作戦

**API 名**: `getTacticsForPreset(presetId: string)` とする（既存 getTacticsForCharacters のプリセット版）。

- **入力**: presetId（PartyPreset.id）。
- **処理**:
  1. セッションで userId 取得。presetId が当該 user の PartyPreset か検証。
  2. そのプリセットの編成 3 人の characterIds を取得（slot1, slot2, slot3）。
  3. PresetTacticSlot を partyPresetId + characterId in characterIds で orderIndex 昇順に取得。
  4. characterIds の順で、各 characterId ごとに slots 配列を組み立て。0 件のキャラは slots: []。
- **出力**: 039 の getTacticsForCharacters と同じ形。

```json
{
  "tactics": [
    { "characterId": "cuidA", "slots": [ /* orderIndex 昇順 最大10件 */ ] },
    { "characterId": "cuidB", "slots": [] },
    { "characterId": "cuidC", "slots": [] }
  ]
}
```

- **エラー**: UNAUTHORIZED, NOT_FOUND（プリセットが無い／他人のもの）。

### 3.2 保存: プリセットに紐づく作戦の一括置換

**API 名**: 既存の `savePresetWithTactics(presetId, presetData, tacticsByCharacter)` の内部を変更。

- **入力**: 変更なし（presetId, 編成・名前・列, tacticsByCharacter）。
- **処理**:
  1. 既存どおり preset の編成・名前・列を更新（updatePartyPreset）。
  2. **PresetTacticSlot** について、当該 presetId に紐づく行を deleteMany したうえで、tacticsByCharacter の内容で createMany。**TacticSlot は触らない**。
- **出力**: 既存どおり success / error。

### 3.3 デフォルト・バリデーション

- あるキャラについて PresetTacticSlot が 0 件 → 戦闘時は通常攻撃（039 6.2 と同様）。
- orderIndex 1～10、subject / conditionKind / actionType / skillId の整合は 039 と同様にバリデーションする。

------------------------------------------------------------------------

## 4. 戦闘時の参照

- **runBattle(presetId, ...)** 内で、味方の作戦スロットは **presetId に紐づく PresetTacticSlot** から取得する。
- **手順**:
  1. プリセットと編成 3 人の characterIds は既存どおり取得。
  2. PresetTacticSlot を partyPresetId = presetId, characterId in characterIds で orderIndex 昇順に取得。
  3. キャラごとに slots を組み立て、既存の PartyMemberInput.tacticSlots に渡す。Character.tacticSlots（TacticSlot）の include はやめる。

------------------------------------------------------------------------

## 5. 実装フェーズ

### Phase 1: スキーマ・マイグレーション

- PresetTacticSlot を prisma/schema.prisma に追加。PartyPreset に relation を追加。
- マイグレーション作成・実行。
- （テスト公開前提）既存 TacticSlot を DROP するマイグレーションを同じか別ファイルで実行。または Phase 5 で実施。

**成果物**: PresetTacticSlot が存在し、作成・参照できる状態。

---

### Phase 2: 作戦取得 API のプリセット対応

- `getTacticsForPreset(presetId)` を新設。PresetTacticSlot から取得し、039 の getTacticsForCharacters と同じ出力形で返す。
- 既存 `getTacticsForCharacters(characterIds)` の呼び出し元を、**presetId がある場合は getTacticsForPreset(presetId)** に切り替える（作戦室 page / tactics-editor-client の編成変更時追加取得）。

**成果物**: 作戦室で「選択中プリセットの作戦」が PresetTacticSlot から読まれる。

---

### Phase 3: 作戦保存の PresetTacticSlot 書き込み

- `savePresetWithTactics` の内部を変更: tacticsByCharacter の保存先を **PresetTacticSlot** にし、`upsertTacticsForCharacter` を呼ばない。
- 当該 presetId の PresetTacticSlot を deleteMany してから、tacticsByCharacter の内容で createMany。
- （任意）`upsertTacticsForCharacter` は削除するか、未使用のまま残す。

**成果物**: 作戦室の「保存」で PresetTacticSlot のみ更新される。

---

### Phase 4: 戦闘実行で PresetTacticSlot を参照

- `runBattle`（battle.ts）で、Character の include から `tacticSlots` を外す。
- presetId と編成 characterIds で PresetTacticSlot を取得し、キャラごとの slots を組み立てて partyInput に渡す。

**成果物**: 練習戦闘・探索戦闘で、選択プリセットに紐づく作戦が使われる。

---

### Phase 5: TacticSlot 廃止・クリーンアップ

- TacticSlot を参照しているコードが残っていないか確認し、あれば削除。
- マイグレーションで TacticSlot テーブルを DROP（テスト公開前提）。
- spec/039 の「永続化」を PresetTacticSlot に更新。docs/08_database_schema.md に PresetTacticSlot を追記。

**成果物**: 作戦は PresetTacticSlot のみ。TacticSlot は存在しない。

---

### Phase 6: アカウントデータ保護の確認・リリース手順

- **目的**: プリセット・作戦データは仕様上リセットされるが、**アカウントデータには一切影響を与えない**ことを保証する。
- **触ってよいもの（リセット対象）**: PartyPreset の「作戦」に相当するデータ（TacticSlot 削除により既存作戦は消える）。必要に応じて「プリセット一覧」も作り直しと案内している場合は、運用で PartyPreset の TRUNCATE 等を検討可能（その場合はマイグレーションではなく一度きりスクリプトで明示的に行う）。
- **触ってはいけないもの**: User、Character（主人公・仲間・メカ）、所持品・通貨・クエスト進捗・施設配置・探索状態など、**アカウントに紐づくすべてのデータ**。マイグレーションでは **PresetTacticSlot の追加と TacticSlot の DROP のみ**とし、User / Character 等のテーブルには手を付けない。
- **リリース手順**: manage/PRODUCTION_RELEASE_GUIDE.md の「8. spec/063 作戦スロット・プリセット別保持のリリース時」に従い、事前に「プリセットデータは飛ぶがアカウントには影響しない」ことを確認してから実行する。

**成果物**: リリース後もユーザのログイン・キャラ・所持品等はそのまま。作戦・（案内している場合はプリセット一覧）のみリセット。

------------------------------------------------------------------------

## 6. 移行（テスト公開前提）

- 既存の TacticSlot データは移行しない。ユーザは作戦室でプリセットを開き、必要に応じて作戦を設定し直す。
- 既存 PartyPreset はそのまま利用可能（マイグレーションで PartyPreset は削除しない）。作戦が空のプリセットは「0 件」として扱い、戦闘時は通常攻撃。
- **アカウントデータ（User, Character, 所持品・通貨・クエスト等）は一切消さない**。Phase 6 およびリリース手順でこれを確認する。

------------------------------------------------------------------------

## 7. 関連

- **docs/062_tactics_per_preset_extension.md** … 設計案・前提・案A/B の比較。
- **spec/039_battle_tactics_and_editor.md** … 作戦室・主語・条件・行動の正本。063 は永続先の拡張のみ。
- **spec/040_tactic_slot_evaluation.md** … 評価ロジック（変更なし）。
