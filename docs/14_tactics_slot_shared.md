# 作戦スロットの味方・敵での共有

**作戦スロット**（主語・条件・行動を最大10件並べ、戦闘中に評価して行動を決定する仕組み）は、**味方**と**敵**の両方で使われる。仕様・選択肢・実装の定数を共有している。

---

## 1. どこで使うか

| 対象 | Spec | データ | 編集画面 |
|------|------|--------|----------|
| **味方** | spec/039 | TacticSlot（Character に紐づく） | 作戦室（`/dashboard/tactics`） |
| **敵** | spec/050 | EnemyTacticSlot（Enemy に紐づく） | 敵マスタ編集（`/dashboard/admin/enemies`） |

- 味方：パーティプリセットで選んだ 3 キャラそれぞれに 10 スロットを設定。作戦室で編集。
- 敵：敵種（Enemy）ごとに最大 10 スロットを設定。管理画面「敵マスタ編集」で編集。

---

## 2. 共有しているもの

- **主語・条件・行動の選択肢**  
  `src/app/dashboard/tactics/tactics-constants.ts` の  
  `SUBJECT_OPTIONS`, `CONDITION_OPTIONS`, `CYCLE_CONDITION_OPTIONS`, `TURN_CONDITION_OPTIONS`, `ACTION_TYPES` を、作戦室と敵マスタ編集の両方で参照している。
- **評価ロジック**  
  戦闘ループ内で味方・敵ともに `tactic-evaluation.ts`（spec/040）に基づき「主語・条件・行動」を評価し、行動を決定する。
- **データ構造**  
  subject / conditionKind / conditionParam / actionType / skillId の形は TacticSlot と EnemyTacticSlot で同一。

---

## 3. アップデート時の注意

**作戦スロットまわりの仕様変更・選択肢の追加・条件種別の追加**を行うときは、以下を両方確認すること。

1. **spec/039**（作戦室・味方の TacticSlot）  
   - 作戦室 UI・保存 API・表示。
2. **spec/050**（敵マスタ・EnemyTacticSlot）  
   - 敵マスタ編集 UI・管理 API・探索/戦闘への渡し方。

`tactics-constants.ts` を変更した場合は、作戦室と敵マスタ編集の**両方の画面**で表示・保存が正しく動くか確認する。

---

## 4. 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| spec/039_battle_tactics_and_editor.md | 作戦室（味方の作戦スロット）の正式仕様 |
| spec/040_tactic_slot_evaluation.md | 作戦スロットの評価ロジック |
| spec/050_enemy_master.md | 敵マスタ・EnemyTacticSlot |
| docs/14_battle_attributes_tactics.md | 属性・作戦スロットの設計 |
| docs/14_battle_tactics_impl_draft.md | 作戦のテーブル・処理のたたき台 |
