# スキル・装備システム拡張の進め方（メモ）

主人公のみのままスキルや装備を足すか、先にキャラ統一（Character）に寄せるかを整理する。

---

## 1. 現状の前提

- **実装**: **Character** テーブルに統一済み。主人公は `category=protagonist` の 1 行で、User は `protagonistCharacterId` で参照。仲間・メカは未実装。
- **設計（02/08/09）**: スキルは「習得スキルテーブル（CharacterSkill: characterId, skillId）」、装備は「キャラ×スロットの中間テーブル（characterId, slotType, equipmentInstanceId）」を想定。

---

## 2. 選択肢

### A) 主人公のまま拡張（Character にスキル・装備を紐づける・旧 PlayerCharacter 想定）

- **やること**: 主人公はすでに Character の 1 行なので、習得スキルテーブルは `characterId`、装備も `characterId` で紐づける。
- **メリット**: 変更範囲が小さい。今の戦闘・仮戦闘の延長でスキル/装備だけ追加すればよい。
- **デメリット**: 仲間・メカを出すときに、「Character に統一し、スキル/装備を characterId に付け直す」マイグレーションが一度必要になる。

### B) 先に Character に統一してからスキル・装備を足す（実施済み）

- **実施済み**: Character テーブル導入、User.protagonistCharacterId、PlayerCharacter → Character データ移行・参照差し替えまで完了。
- **このうえで**: スキルは CharacterSkill(characterId)、装備は CharacterEquipment(characterId, slotType, ...) として実装する。

---

## 3. おすすめの切り分け

- **仲間・メカを「すぐにはやらない」なら**  
  → **A) 主人公のまま拡張**でよい。  
  スキル/装備は Character に紐づく形（CharacterSkill, characterId）で設計する。すでに Character 統一済みのため、そのまま characterId で紐づければよい。

- **仲間・メカを「半年〜1 年以内にやりたい」なら**  
  → **B) 先に Character に統一**した方が、スキル・装備を 1 回の設計で済ませられる。  
  仮戦闘は「主人公 1 体 = Character 1 行」のまま動かし、戦闘ロジックは「Character を N 体渡す」形にしておくと、仲間/メカ追加時に戦闘側の変更を抑えられる。

---

## 4. どちらでも共通でやること

- **スキル**: マスタ（Skill）＋習得テーブル（どのキャラにどのスキルか）。戦闘では「そのキャラの習得スキル」を参照して行動選択・消費 MP を計算（09 方針）。
- **装備**: スロット種別ごとに「何を装着しているか」を 1 行で持つ。戦闘計算時に「基礎ステータス＋装備補正」を都度計算し、永続化しない（09 方針）。
- **仮戦闘**: 今の 1v3 のまま、主人公にだけスキル/装備を効かせる形で拡張すれば、本番戦闘へのフィードバックもそのまま使える。

---

## 5. 結論（一言）

- **Character 統一は完了済み**。スキル・装備は **Character** 基準（characterId）で実装する。
