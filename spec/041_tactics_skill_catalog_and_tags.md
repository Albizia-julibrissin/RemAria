# Spec: 作戦室向けスキル一覧・タグ表示

`docs/043_tactics_room_skill_info_ux_proposal.md`・`docs/14_initial_skills.csv` に基づき、作戦室（spec/039）のスキル選択を補助する **スキル一覧 UI と表示用データ** を定義する。

本 spec は **表示用の追加データ (`description` / `displayTags`) と API 形状** を定める。戦闘処理そのものは `spec/038_battle_skills_and_effects.md` に従う。

---

## 0. 位置づけ・画面イメージ

- 対象画面: **作戦室**（spec/039, tactics editor）
  - パーティプリセットで編成した **3 キャラ分** の作戦スロットを編集する画面。
- 課題: 行動列のスキル選択プルダウンだけでは、**各スキルの効果・性質が分かりにくい**。
- 解決: 作戦室から開ける **スキル一覧パネル** を用意し、以下を一望できるようにする。
  - どのスキルがどんな挙動か（説明文＋タグ）
  - どのスキルを **誰が習得しているか**（編成 3 人のアイコン）
  - チャージタイム・クールダウンなど、作戦を組むうえで必要な要素

### 0.1 スキル一覧パネル（概要）

- 作戦室の画面から「スキル一覧」ボタン（またはリンク）で開くモーダル／ドロワー。
- **対象スキル**: 「現在のプリセットで編成されている 3 キャラが習得している戦闘スキル（battle_active）」のみ。
- 表示形式: **行カード型のリスト**（1 行 = 1 スキル）。
  - 左側: スキル名、種別（物理/魔法/補助）、CT/CD。
  - 左側の下: 説明文（日本語）。
  - 説明文の下: タグ行（`#敵単体 #複数回攻撃 #切創属性 #出血` など）。
  - 右側: そのスキルを習得している編成 3 人のキャラアイコン（0〜3個）。
- ソート・フィルタ:
  - デフォルトは「種別（物理→魔法→補助）→スキル名」でソート。
  - 少なくとも **種別フィルタ（物理 / 魔法 / 補助）** があるとよい（UI 実装詳細は裁量）。

---

## 1. 依存・横断

### 1.1 依存する spec / docs

- **spec/038_battle_skills_and_effects.md**
  - 戦闘スキルのデータ構造、`getBattleSkillCatalog` の基本形。
- **spec/039_battle_tactics_and_editor.md**
  - 作戦室の画面構成とスキル選択 UX（プルダウン側）。
- **docs/043_tactics_room_skill_info_ux_proposal.md**
  - 本機能の UX 詳細（一覧レイアウト・タグ方針・MP 表示方針）。
- **docs/14_initial_skills.csv**
  - 初期スキルのマスタ CSV。今回追加した `description_ja` / `display_tags` 列がソース。

### 1.2 提供する API / 利用者

| API | 用途 | 呼び出し元 |
|-----|------|-----------|
| getBattleSkillsForCharacters (既存) | キャラごとの習得スキル一覧（プルダウン用）。`id` / `name` / `battleSkillType` のみ。 | 作戦テーブルの行動プルダウン |
| **getTacticsSkillCatalogForCharacters**（本 spec） | 編成 3 人が習得しているスキルを **重複排除して一覧化**し、説明文・タグ・習得キャラ情報を含めて返す。 | 作戦室の「スキル一覧」パネル |

---

## 2. 目的

- 作戦室で「どのスキルをどの条件で使うか」を考える際に、**スキルの性質を一覧で把握**できるようにする。
- 倍率やヒット数などの数値は開示せず、**説明文とタグ・CT/CD・対象範囲・属性**に留める。
- 初期スキル群については、`docs/14_initial_skills.csv` の `description_ja` と `display_tags` から **Seed 時に DB の表示用フィールドを埋める**。

---

## 3. 用語

- **description_ja**: 日本語のスキル説明（`docs/14_初期スキル` の「説明」列と同内容）。
- **displayTags**: ハッシュタグ風の文字列配列。例: `["#敵単体", "#複数回攻撃", "#切創属性", "#出血"]`。
- **編成 3 人**: 作戦室で現在選択中のプリセットに含まれる主人公 / 仲間 / メカの 3 キャラ。

---

## 4. データモデル拡張（表示用）

### 4.1 Skill モデルの拡張（論理仕様）

Prisma スキーマ上の `Skill` モデルに、表示用フィールドを追加する。

- **対象**: `category = "battle_active"` の戦闘スキルで使用。

追加フィールド（論理）:

- `description: string?`
  - `description_ja` に相当。スキルの効果・性質の短い文章説明。
- `displayTags: string[]?`（保存形式は実装側で決定：JSON 配列 or 区切り文字列）
  - 作戦室 UI などで表示する、ハッシュタグ風のラベル。

> 実装メモ: 具体的な Prisma 型（`Json?` や `String?` で `|` 区切り保存など）は実装フェーズで選択する。  
> 本 spec では「論理的に配列の文字列タグを持つ」ことのみを要求する。

### 4.2 初期スキル CSV からのマッピング

`docs/14_initial_skills.csv` に追加した列との対応は以下とする。

| CSV 列 | 例 | Skill フィールド |
|--------|----|------------------|
| `description_ja` | `単体に2回攻撃` | `Skill.description` |
| `display_tags` | `#敵単体\|#複数回集中攻撃\|#圧縮属性` | `Skill.displayTags = ["#敵単体", "#複数回集中攻撃", "#圧縮属性"]` |

- Seed 時には、既存の `group` / `skill_name` などとあわせて、上記 2 列から `description` / `displayTags` を埋める。
- 将来スキル追加時は、**CSV も更新し、同じ規則で Seed に反映**する。

---

## 5. API 仕様: getTacticsSkillCatalogForCharacters

### 5.1 Input

```json
{
  "characterIds": ["char_protagonist", "char_companion", "char_mech"]
}
```

- `characterIds`: 作戦室で現在編成されている 3 キャラの ID（1〜3件）。
  - フロント側では、すでに作戦テーブルで使っている `preset.slot1/2/3.characterId` を渡す想定。

### 5.2 Output

```json
{
  "skills": [
    {
      "id": "skill_cuid",
      "name": "虎挟ミ",
      "battleSkillType": "physical",
      "chargeCycles": 0,
      "cooldownCycles": 0,
      "targetScope": "enemy_single",
      "attribute": "crush",
      "description": "単体に2回攻撃",
      "displayTags": ["#敵単体", "#複数回集中攻撃", "#圧縮属性"],
      "learnedBy": [
        {
          "characterId": "char_protagonist",
          "displayName": "レム",
          "iconFilename": "protagonist_01.png" // null の場合もあり
        }
      ]
    }
  ]
}
```

#### フィールド定義

- `id`: `Skill.id`
- `name`: `Skill.name`
- `battleSkillType`: `Skill.battleSkillType`（physical / magic / support）
- `chargeCycles`: `Skill.chargeCycles`（null の場合は 0 として扱う）
- `cooldownCycles`: `Skill.cooldownCycles`（null の場合は 0 として扱う）
- `targetScope`: `Skill.targetScope`（enemy_single / enemy_all / ally_single / ally_all / self）
- `attribute`: `Skill.attribute`（none / crush / slash / pierce / burn / freeze / corrode / polarity）
- `description`: `Skill.description`（日本語）。初期スキルは CSV の `description_ja` に一致。
- `displayTags`: `Skill.displayTags`（配列）。初期スキルは CSV の `display_tags` を分解したもの。
- `learnedBy`: このスキルを習得している **編成 3 人のキャラ** のみ。
  - `characterId`: `Character.id`
  - `displayName`: `Character.displayName`
  - `iconFilename`: `Character.iconFilename`（存在しなければ null）

> 注意: 1 つのスキルを複数キャラが習得している場合、`skills` 配列は 1 要素だが、その `learnedBy` 配列に複数キャラが並ぶ。

---

## 6. ルール・挙動

### 6.1 対象スキルの絞り込み

1. `characterIds` がユーザーの所有キャラであることを検証（spec/039 と同等）。
2. `CharacterSkill` から、`characterId IN (characterIds)` かつ `skill.category = "battle_active"` のレコードを取得。
3. 取得した `skillId` をユニーク化し、`Skill` を JOIN。

### 6.2 並び順

- サーバ側でのデフォルトソート:

```text
ORDER BY
  battleSkillType (physical -> magic -> support),
  name (昇順)
```

- フロント側で追加のフィルタ・ソートを行うのは自由（種別フィルタ、テキスト検索など）。

### 6.3 MP 消費表示の扱い

- **本 API では MP 消費を返さない**（mpCapCoef / mpFlat は別途必要であれば `Skill` から取得可能だが、スキル一覧 UI では使用しない）。
- 作戦テーブル上のツールチップでは、キャラごとの CAP から計算した実 MP 消費を表示してよいが、それは **既存の行動プルダウン + ツールチップ側での責務** とし、本 spec の API には含めない。

### 6.4 セキュリティ・所有権

- `characterIds` に含まれるキャラの `userId` が、セッションの `userId` と一致すること。
- 一致しないキャラは無視またはエラーとする（MVP では「無視」が実装しやすい）。

---

## 7. フロントエンド利用イメージ（作戦室）

### 7.1 呼び出しタイミング

- 作戦室でプリセットと 3 キャラが確定したタイミングで、`getTacticsSkillCatalogForCharacters` を呼ぶ。
- もしくは「スキル一覧」ボタン押下時に初回だけ呼び、以降は同画面内でキャッシュしてよい。

### 7.2 行カードの表示（最低限）

各行カードで少なくとも以下を表示する。

- **1 行目**:
  - スキル名
  - 種別バッジ（`battleSkillType` → 物理 / 魔法 / 補助）
  - CT バッジ（`chargeCycles`）
  - CD バッジ（`cooldownCycles`）
- **2 行目**:
  - `description`
- **3 行目**:
  - `displayTags` を空白区切りで表示（例: `#敵単体 #複数回攻撃 #切創属性 #出血`）
- **右端**:
  - `learnedBy` の各要素について、キャラアイコン（またはイニシャル）を表示。

> UI の細部（色・余白・ホバー効果など）は `docs/07_ui_guidelines.md` に沿って実装側で決める。

---

## 8. 例

### 8.1 虎挟ミ（虎挟ミを主人公が習得している場合）

```json
{
  "id": "skill_torahasami",
  "name": "虎挟ミ",
  "battleSkillType": "physical",
  "chargeCycles": 0,
  "cooldownCycles": 0,
  "targetScope": "enemy_single",
  "attribute": "crush",
  "description": "単体に2回攻撃",
  "displayTags": ["#敵単体", "#複数回集中攻撃", "#圧縮属性"],
  "learnedBy": [
    {
      "characterId": "char_protagonist",
      "displayName": "レム",
      "iconFilename": "protagonist_01.png"
    }
  ]
}
```

### 8.2 血ノ嘆キ（複数キャラが習得）

```json
{
  "id": "skill_chi_no_nageki",
  "name": "血ノ嘆キ",
  "battleSkillType": "physical",
  "chargeCycles": 1,
  "cooldownCycles": 0,
  "targetScope": "enemy_single",
  "attribute": "slash",
  "description": "敵全体にランダムに複数回攻撃。命中した対象が切創だった場合、出血の状態異常を与える。",
  "displayTags": ["#敵単体", "#複数回攻撃", "#溜めスキル", "#切創属性", "#出血"],
  "learnedBy": [
    { "characterId": "char_protagonist", "displayName": "レム", "iconFilename": "protagonist_01.png" },
    { "characterId": "char_companion", "displayName": "ヴィオラ", "iconFilename": "companion_01.png" }
  ]
}
```

---

## 9. 実装メモ

- 既存の `getBattleSkillsForCharacters` は、作戦テーブルのプルダウン用にそのまま残す（軽量なままが望ましい）。
- 本 spec の `getTacticsSkillCatalogForCharacters` は、表示情報が多くなるため **別 API** とし、スキル一覧パネルを開いたときだけ呼び出す想定とする。
- `displayTags` の保存形式（JSON vs 区切り文字列）は、Prisma の制約とマイグレーションコストを踏まえて実装時に決定する。いずれにせよ「タグは CSV の `display_tags` を正として Seed される」ことが担保されればよい。

