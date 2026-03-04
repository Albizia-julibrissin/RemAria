# AI（Cursor）向けメモ

実装時に「何を読むか・どこを編集するか」を迷わないための参照。詳細は各 spec / docs を参照すること。

---

## 1. 共通ルール

- **仕様変更は spec または正本 doc を先に更新してからコードを変更する。** チャットの会話だけに残さず、必ずファイルに反映する。
- **データモデルの正本**: `prisma/schema.prisma`。説明・メモは `docs/08_database_schema.md`。
- **マスタデータの投入**: `prisma/seed.ts`（`npm run db:seed`）。スキル・効果の具体値はここで定義。
- **ドキュメント索引**: `docs/README.md` でテーマ別の一覧と参照先を確認できる。
- **アーキテクチャ・ディレクトリ構成**: `docs/03_architecture_spec.md`。依存方向は UI → server(actions) → repositories → db。`lib/` は純粋ロジック。
- **ハードコード・暫定実装**: 「後でちゃんと実装する」前提のコードは **`docs/027_hardcoded_and_deferred.md`** に一覧化する。新規に追加するときは一覧に 1 行追記し、解消したらその行を削除する。

### docs / spec / content-guides の役割

- **`docs/`**: 人間向けの仕様・設計メモ。  
  - あなたと AI で読み合わせ・合意する場所。企画・バランス方針・設計ドラフトなどを置く。
- **`spec/`**: 実装用の正式仕様。  
  - API / データ構造の正本。主に AI が参照して実装する。変更時は必ずここを更新してからコードを触る。
- **`docs/content-guides/`**: コンテンツ追加ガイド。  
  - 「スキル追加」「探索エリア追加」など、コンテンツを増やすときの**実務手順書（チェックリスト）**を置く。
  - docs/spec に書かれた意図を前提に、「どの順番でどのファイルを触るか」をここで整理する。

---

## 2. 戦闘・スキル効果（effectType）

- **定義・param の正本**: `docs/042_battle_effect_types_reference.md`。
- **新規 effectType 追加時**: (1) 042 に定義ブロックを追加 (2) `src/lib/battle/run-battle-with-party.ts` の effectType 分岐にハンドラを追加 (3) 必要なら `prisma/seed.ts` の BATTLE_SKILL_EFFECTS に追加。
- **戦闘仕様（API・Skill/SkillEffect 構造）**: `spec/038_battle_skills_and_effects.md`。effectType の一覧詳細は 042 が正本。
- **実装 Phase・データフロー**: `docs/041_skill_effects_implementation_prep.md`。残課題は同 doc の「9. 戦闘機能の残課題・未実装」。

---

## 3. Spec ↔ 実装の対応（主な編集場所）

| テーマ | Spec | 主な実装場所 |
|--------|------|----------------|
| 認証・セッション | spec/010_auth | `src/server/actions/auth.ts`, `src/lib/auth/session.ts`, `src/middleware.ts` |
| 主人公作成 | spec/015_protagonist_creation | `src/server/actions/protagonist.ts`, `src/app/character/create/`, `src/server/lib/protagonist-icons.ts` |
| 仮戦闘 | spec/020_test_battle | `src/server/actions/test-battle.ts`, `src/lib/battle/run-test-battle.ts`, `src/lib/battle/run-battle-with-party.ts`, `src/lib/battle/test-enemy.ts` |
| キャラ一覧 | spec/025_character_list | `src/app/dashboard/characters/`, `src/server/repositories/character-repository.ts` |
| 仲間雇用・解雇 | spec/030_companion_employment | `src/server/actions/recruit.ts`, `src/app/dashboard/recruit/`, `src/lib/constants/companion.ts` |
| 初期設備・生産 | spec/035, 036 | `src/server/actions/initial-area.ts`, `src/server/actions/receive-production.ts`, `src/app/dashboard/facilities/` |
| チャット | spec/037_chat | `src/server/actions/chat.ts`, `src/components/chat/` |
| 戦闘スキル・効果 | spec/038 | 上記「2. 戦闘・スキル効果」参照。`run-battle-with-party.ts`, seed BATTLE_SKILL_EFFECTS |
| 作戦編集 | spec/039_battle_tactics_and_editor | `src/app/dashboard/tactics/`, `src/server/actions/tactics.ts`, `src/app/dashboard/tactics/tactics-constants.ts` |
| 作戦スロット評価（行動決定） | spec/040_tactic_slot_evaluation | `src/lib/battle/tactic-evaluation.ts`。戦闘ループからここを呼ぶ。 |
| メカパーツ・部位・ステ計算 | spec/044_mecha_parts_and_stats | 未実装。MechaPartType・装備テーブル・computeMechaBaseStats 等。 |
| アイテム・所持・バッグ | spec/045_inventory_and_items | `src/server/actions/inventory.ts`（または bag.ts）, `src/app/dashboard/bag/`, schema: Item.category, EquipmentType, EquipmentInstance, CharacterEquipment, MechaPartInstance |
| アイテムクラフト | spec/046_item_craft | `src/server/actions/craft.ts`, `src/app/dashboard/craft/`, `src/app/dashboard/equipment/`, schema: CraftRecipe, CraftRecipeInput |
| 研究・解放・建設 | spec/047_research_unlock_construction | `src/server/actions/research.ts`, `src/server/actions/facilities.ts`（place/dismantle）, `src/app/dashboard/facilities/`, `src/app/dashboard/research/`, schema: FacilityVariant, FacilityConstructionRecipeInput, UserFacilityTypeUnlock |

- 上記以外の機能を追加するときは、まず `docs/01_features.md` と `manage/MVP_PROGRESS.md` で該当 spec を確認し、対応する spec がなければ spec を書いてから実装する。

---

## 4. 戦闘計算・定数

- **計算式・係数**: `docs/10_battle_calc_formulas.md`, `docs/10_battle_status.csv`。
- **戦闘用定数**: `src/lib/battle/battle-constants.ts`。
- **派生ステータス（HP・攻撃力・速度など）**: `src/lib/battle/derived-stats.ts`（10_battle_status 係数表準拠）。

---

## 5. コマンド・検証

- **開発サーバ**: `npm run dev`
- **DB マイグレーション**: `npm run db:migrate`（schema 変更後）
- **シード投入**: `npm run db:seed`
- **Lint**: `npm run lint`
- テストは未整備の場合は省略可。追加する場合は `docs/03_architecture_spec.md` の「8. テスト方針」に従う。
