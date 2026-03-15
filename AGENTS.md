# AI（Cursor）向けメモ

実装時に「何を読むか・どこを編集するか」を迷わないための参照。詳細は各 spec / docs を参照すること。

---

## 1. 共通ルール

- **仕様変更は spec または正本 doc を先に更新してからコードを変更する。** チャットの会話だけに残さず、必ずファイルに反映する。
- **データモデルの正本**: `prisma/schema.prisma`。説明・メモは `docs/08_database_schema.md`。
- **マスタテーブルの正本**: このゲームで「マスタ」とみなすテーブル一覧の正本は **`src/server/lib/sync-masters.ts`** の **MASTER_DELEGATES_IN_ORDER**。トランザクション／アカウント系テーブルと差別化する際の基準。**スキーマにマスタ系テーブルを追加・削除した場合は、ここも必ず編集する**（新規は依存順で一覧に追加、削除したテーブルは一覧から除去）。CLI（`prisma/sync-masters-to-target.ts`）と管理画面の本番マスタ更新（spec/095）の両方がこの一覧を参照する。
- **マスタデータ**: シードでは投入しない。管理画面で編集し、**バックアップ・復元**で環境を揃える（`npm run db:backup` / `db:restore`）。**DB 運営・バックアップ手順**は **`manage/DB_OPERATIONS.md`** と **`manage/BACKUP_RESTORE.md`** を参照。
- **本番リリース**: 本番 DB に触れる手順（バックアップ・マイグレーション・マスタ同期など）は **基本、依頼されたら Cursor が実行する**。本番の接続先は **`manage/production.env`** の `DATABASE_URL` を参照する（.gitignore 済み）。手順は **`manage/PRODUCTION_RELEASE_GUIDE.md`** の「**9. Cursor に本番リリースの各手順を依頼する**」に従い、production.env を読み込んだうえでコマンドを実行する。
- **本番環境の前提**: 現在の本番環境は「MVP 公開テスト」中のもの。**本番 DB はプレイヤーの実データを含む**ため、リセットや破壊的操作（`migrate reset` など）は絶対に行わないこと。必要な変更は必ずバックアップ取得 → メンテナンスモード → マイグレーション／データ移行 → 検証 → メンテナンス解除、の手順で行う。
- **シード**: `prisma/seed.ts` は**テスト用データのみ**（管理用アカウント「管理人」＋ test2 ユーザー・主人公・仲間・通貨・所持品）。管理用アカウントは環境変数 `ADMIN_EMAIL`（未設定時は `test1@example.com`）で作成され、パスワードは `ADMIN_PASSWORD` またはランダム生成。`npm run db:seed`。詳細は **`manage/ADMIN_ACCOUNT.md`**。
- **ドキュメント索引**: `docs/README.md` でテーマ別の一覧と参照先を確認できる。
- **アーキテクチャ・ディレクトリ構成**: `docs/03_architecture_spec.md`。依存方向は UI → server(actions) → repositories → db。`lib/` は純粋ロジック。
- **ハードコード・暫定実装**: 「後でちゃんと実装する」前提のコードは **`docs/027_hardcoded_and_deferred.md`** に一覧化する。新規に追加するときは一覧に 1 行追記し、解消したらその行を削除する。
- **MVP 以降の方針**: MVP 版を公開したあとは、「とりあえず動けばよい」その場しのぎの実装は避け、将来の拡張を見据えた素直で読みやすい設計を優先する。バグ対応や暫定策を入れる場合も、必ず docs/spec（例: `docs/059_exploration_step_refactor.md`）に方針を残し、後で必ずリファクタや設計の整理につなげる。
- **Server Action の責務分離**: `src/server/actions/*` では、1 関数の中に「状態遷移ロジック」「DB 更新」「ビュー用データ組み立て」を過度に詰め込まない。可能な限り、状態遷移ロジックは `lib/` などの純粋関数として切り出し、Server Action は「入力の検証 → リポジトリ呼び出し → 状態遷移ロジック呼び出し → 更新結果をレスポンス型に整形する」薄いオーケストレーターとして実装する。探索進行は `advanceExplorationStep` に集約し、表示は `getExplorationLastBattleDisplay` / `getExplorationPendingSkillDisplay` で read-only にしている。`runExplorationBattle` / `finishExploration` なども同方針で整理済み・継続する。
- **検証ログ**: 戦闘ログに「検証用の表示」（遺物適用前ダメージ・倍率メモなど）を出したい場合は **検証ログ** に集約する。表示の有無は環境変数 `NEXT_PUBLIC_SHOW_VERIFICATION_LOG="true"` で切り替え（本番では未設定で非表示）。ログ型は `BattleLogEntryWithParty` / `hitDetails` に検証用のオプション項目を追加し、表示は `src/app/battle/practice/battle-log-view.tsx` で `SHOW_VERIFICATION_LOG` が true のときのみ描画する。詳細は **`manage/VERIFICATION_LOG.md`** 参照。

### docs / spec / content-guides の役割

- **`docs/`**: 人間向けの仕様・設計メモ。  
  - あなたと AI で読み合わせ・合意する場所。企画・バランス方針・設計ドラフトなどを置く。
- **`spec/`**: 実装用の正式仕様。  
  - API / データ構造の正本。主に AI が参照して実装する。変更時は必ずここを更新してからコードを触る。
- **`docs/content-guides/`**: コンテンツ追加ガイド。  
  - 「スキル追加」「探索エリア追加」など、コンテンツを増やすときの**実務手順書（チェックリスト）**を置く。
  - docs/spec に書かれた意図を前提に、「どの順番でどのファイルを触るか」をここで整理する。
- **`docs/ideas/`**: アイデア・思いつきのメモ置き場。**実装には関係しない**。仕様判断・コード変更の根拠に使わない。

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
| 認証・セッション | spec/010_auth | `src/server/actions/auth.ts`, `src/lib/auth/session.ts`, `src/middleware.ts`, `src/server/lib/active-user.ts`（lastActiveAt・プレイ中人数）, `src/components/header.tsx` |
| 主人公作成 | spec/015_protagonist_creation | `src/server/actions/protagonist.ts`, `src/app/character/create/`, `src/server/lib/protagonist-icons.ts` |
| 練習戦闘・戦闘実行 | spec/020_test_battle | `src/server/actions/battle.ts`, `src/lib/battle/run-simple-battle.ts`, `src/lib/battle/run-battle-with-party.ts`, `src/lib/battle/default-enemy.ts` |
| キャラ一覧 | spec/025_character_list | `src/app/dashboard/characters/`, `src/server/repositories/character-repository.ts` |
| 仲間雇用・解雇 | spec/030_companion_employment | 居住区で推薦紹介状を消費して仲間追加（人材局廃止）。`src/server/actions/recruit.ts`（getCompanionRecruitState, createCompanion, dismissCompanionAction）, `src/app/dashboard/characters/`（一覧＋「推薦紹介状を使う」）, `src/app/dashboard/characters/create/`, `src/lib/constants/companion.ts`（LETTER_OF_RECOMMENDATION_ITEM_CODE）。解雇はキャラ詳細から。 |
| 初期設備・生産 | spec/035, 036 | `src/server/actions/initial-area.ts`, `src/server/actions/receive-production.ts`, `src/app/dashboard/facilities/` |
| チャット | spec/037_chat | `src/server/actions/chat.ts`, `src/components/chat/` |
| 戦闘スキル・効果 | spec/038 | 上記「2. 戦闘・スキル効果」参照。`run-battle-with-party.ts`, seed BATTLE_SKILL_EFFECTS |
| 作戦編集 | spec/039_battle_tactics_and_editor | `src/app/dashboard/tactics/`, `src/server/actions/tactics.ts`, `src/app/dashboard/tactics/tactics-constants.ts` |
| 作戦スロット・プリセット別保持 | spec/063_tactics_per_preset | 039 の拡張。PresetTacticSlot 追加・取得・保存・戦闘参照。実装フェーズは 063 §5。 |
| 作戦スロット評価（行動決定） | spec/040_tactic_slot_evaluation | `src/lib/battle/tactic-evaluation.ts`。戦闘ループからここを呼ぶ。 |
| レベル・ステータス割り振り | spec/048_level_and_status_allocation | `src/server/actions/character-exp.ts`, `src/lib/level.ts`, キャラ詳細のステ割り振り UI。**レベルキャップ・キャップ到達後の経験値→アイテム付与**は **spec/074_level_cap_and_cap_reward_item.md**（設計は docs/074）。 |
| メカパーツ・部位・ステ計算 | spec/044_mecha_parts_and_stats | 未実装。MechaPartType・装備テーブル・computeMechaBaseStats 等。 |
| アイテム・所持・バッグ | spec/045_inventory_and_items | `src/server/actions/inventory.ts`（または bag.ts）, `src/app/dashboard/bag/`, schema: Item.category, EquipmentType, EquipmentInstance, CharacterEquipment, MechaPartInstance |
| アイテムクラフト | spec/046_item_craft | `src/server/actions/craft.ts`, `src/app/dashboard/craft/`, `src/app/dashboard/equipment/`, schema: CraftRecipe, CraftRecipeInput |
| 装備解体（工房） | spec/093_equipment_dismantle | `src/server/actions/craft.ts`（getDismantlableEquipment, dismantleEquipment, dismantleEquipmentBulk）, `src/app/dashboard/craft/`（解体タブ） |
| 研究・解放・建設 | spec/047, **docs/054_quest_and_research_design.md** §4.3.1 | `src/server/actions/facilities-placement.ts`（place/dismantle）, `src/server/actions/research.ts`（研究グループ・解放）, `src/app/dashboard/facilities/`, `src/app/dashboard/research/`, schema: FacilityTypeConstructionInput, UserFacilityTypeUnlock, ResearchGroup, ResearchGroupItem, ResearchUnlockCost, UserCraftRecipeUnlock |
| 遺物（4枠・鑑定・分解・効果・戦闘耐性） | spec/051_relics, docs/086 | `src/server/actions/relic.ts`, `src/lib/constants/relic.ts`, `src/app/dashboard/craft/`（鑑定タブ）, `src/app/dashboard/bag/`（遺物タブは一覧のみ）, `src/app/dashboard/characters/[id]/character-relic-section.tsx`, schema: RelicType, RelicPassiveEffect, RelicInstance, CharacterRelic。戦闘は `src/server/actions/battle.ts` で遺物耐性を partyInput に渡す。分解で relic_shard 付与。 |
| 戦闘時有効基礎ステ（遺物補正・メカパーツ加算・フレーム倍率） | spec/069_battle_effective_base_stats | `src/lib/battle/effective-base-stats.ts`（純粋関数）, `src/server/actions/battle.ts`（データ取得・有効基礎の組み立て）。実装フェーズは docs/070。 |
| 称号（マスタ・ユーザ解放） | spec/055_titles | `src/server/actions/titles.ts`（getTitleList, getMyUnlockedTitleIds, unlockTitleForUser）, schema: Title, UserTitleUnlock。シードで「開拓者」1件投入。 |
| スキル分析書・スキルレベル | spec/052_skill_books_and_level | `src/server/actions/inventory.ts`（consumeSkillBook, getCharactersForSkillBook）, `src/app/dashboard/bag/`（スキル分析書タブで使用・キャラ選択）, schema: Item.skillId, CharacterSkill.level。習得/レベルアップ必要冊数は Lv N→N+1 に (N+1) 冊。 |
| 探索・エリアドロップ（管理） | spec/049（7.2 ドロップテーブル）, **manage/admin_area_drop_edit.md** | `src/server/actions/admin.ts`（getAreaDropEditData, saveDropTableEntries 等）, `src/app/dashboard/admin/drops/`。編集手順・強敵枠追加は manage 参照。 |
| 探索・技能イベント（本実装） | spec/073_skill_events_exploration, **docs/060_exploration_events_design.md** | エリア×イベント紐づけ・係数閾値・発生/クリアメッセージ。`getNextExplorationStep` / `resolveExplorationSkillEvent` / pendingSkillEvent。管理画面は Phase 6 で追加。 |
| アイテムマスタ（管理） | spec/045, **manage/admin_item_master_edit.md** | `src/server/actions/admin.ts`（getAdminItemList, getAdminItem, updateAdminItem）, `src/app/dashboard/admin/items/`, `src/lib/constants/item-categories.ts`。 |
| クエスト（ストーリー・研究） | spec/054_quests, **docs/054_quest_and_research_design.md** | `src/server/actions/quest.ts`, `src/app/dashboard/quests/`。探索 finish で area_clear、戦闘勝利で enemy_defeat 進捗。研究ポイント報酬・解放は A1 以降で拡張。 |
| 任務による機能解放（テーマ・研究グループ） | spec/068_quest_unlock_themes_and_research, **docs/068_quest_unlock_themes_and_research.md** | 報告時に UserExplorationThemeUnlock / UserResearchGroupUnlock に挿入。`getExplorationMenu` でテーマ限定、`getResearchMenu` で isAvailable を任務解放のみに。管理画面で開拓任務に解放テーマ・研究グループを紐づけ。 |
| 装備の派生戦闘ステ加算（HP/MP 含む） | spec/071_equipment_derived_stats_in_battle | `src/lib/battle/run-battle-with-party.ts`（derivedBonus 加算）、`src/server/actions/battle.ts`（装備取得・合算）。実装プランは **docs/072_equipment_hp_mp_implementation_plan.md**。 |
| 市場（出品・購入・最安消化・手数料） | spec/075_market, **docs/065_market_design.md** | **Phase 1・2・3 実装済み**。User.marketUnlocked、Item.marketListable / marketMin、MarketListing / MarketTransaction / MarketListingEvent。購入・出品・取下げ・履歴の 4 画面、有効期限・期限切れ自動取下げ、価格履歴、同時出品数上限。**通貨履歴強化**（Phase 3）：CurrencyTransaction に beforeBalance/afterBalance、reason コード化、運営ビューは管理画面「通貨履歴（ユーザー別）」で確認。`src/server/actions/market.ts`、`src/lib/constants/market.ts`、`src/lib/constants/currency-transaction-reasons.ts`、`src/app/dashboard/market/`、`src/app/dashboard/admin/currency-history/`。 |
| **特別アイテム（闇市・黒市・使用履歴）** | **docs/079**, **docs/081_special_items_policy.md** | 闇市・黒市は `src/server/actions/underground-market.ts`、`src/app/dashboard/underground-market/`。**特別アイテムを消費する機能**を実装するときは **docs/081** を参照し、所持減算に加えて **ItemUsageLog** に 1 件記録する。理由コードは `src/lib/constants/item-usage-reasons.ts` で管理（新規理由はここに追加してからログを書く）。 |
| **緊急製造指示書（全設備2時間加速）** | **spec/083_emergency_production_order**, docs/065 §7 | 1 枚消費で全設備の lastProducedAt を 2 時間前に更新。`useEmergencyProductionOrder`（新規 Action）、getIndustrial 拡張（所持数）、設備画面にボタン・モーダル。`src/lib/constants/production.ts`（EMERGENCY_PRODUCTION_ACCELERATION_MINUTES）、ItemUsageLog reason=facility_speed。 |
| **郵便（運営→プレイヤー）** | **spec/090_mail**, docs/085_mail_system_design | 運営が管理画面からお知らせ＋付与（無償/有償GRA・研究記録書・アイテム・称号）を送信。届いたユーザーに「郵便が届きました。」通知（郵便画面リンク付き）。`src/server/actions/mail.ts`、`src/app/dashboard/mail/`（2カラム：左一覧・右詳細・受取）、ヘッダー mailbox アイコン→/dashboard/mail。有効期限切れは非表示。管理: `src/app/dashboard/admin/mail/`（送信フォーム・履歴）。schema: Mail, UserMail。通貨理由: CURRENCY_REASON_MAIL_REWARD。 |

- 上記以外の機能を追加するときは、まず `docs/01_features.md` と `manage/MVP_PROGRESS.md` で該当 spec を確認し、対応する spec がなければ spec を書いてから実装する。

### タスク別・読むファイル最小セット（コンテキスト節約用）

実装タスクごとに**この組み合わせだけ開けば十分**。必要以上に docs/README や設計メモを開かなくてよい。

| タスク | 読むファイル（この順で十分） |
|--------|------------------------------|
| **effectType 追加** | `docs/042_battle_effect_types_reference.md`（正本）, `spec/038`, `src/lib/battle/run-battle-with-party.ts`, 必要なら `prisma/seed.ts` の BATTLE_SKILL_EFFECTS |
| 戦闘計算・式の確認 | `docs/10_battle_calc_formulas.md`, `docs/10_battle_status.csv`, `src/lib/battle/derived-stats.ts` |
| 作戦・ターゲット評価 | `spec/039`, `spec/040`, `docs/14_tactics_slot_shared.md`, **`docs/14_tactics_logic_reference.md`**（ロジックまとめ・条件拡張時の編集箇所）, `src/lib/battle/tactic-evaluation.ts` |
| 探索・技能イベント | `spec/073_skill_events_exploration.md`, `docs/060_exploration_events_design.md` |
| クエスト・報告・報酬 | `spec/054_quests.md`, `docs/067_quest_report_completion_flow.md`, `src/server/actions/quest.ts` |
| 遺物・装備の戦闘反映 | `spec/051`, `spec/069`, `spec/071`, `src/server/actions/battle.ts`, `src/lib/battle/effective-base-stats.ts` |
| データモデル・スキーマ変更 | `prisma/schema.prisma`, `docs/08_database_schema.md`, 該当 spec。**マスタ系テーブルの追加・削除時は** `src/server/lib/sync-masters.ts` の **MASTER_DELEGATES_IN_ORDER** も更新する。 |
| **スキル追加（新規スキル・効果の登録）** | `docs/content-guides/skill_addition_guide.md`, `spec/038`, `docs/042_battle_effect_types_reference.md`, 必要なら `prisma/seed.ts` の BATTLE_SKILL_EFFECTS |
| **緊急製造指示書（設備2時間加速）** | `spec/083_emergency_production_order.md`, `docs/065_special_items_and_facility_speed.md` §7, `src/server/actions/initial-area.ts`（getIndustrial）, `src/app/dashboard/characters/use-letter-button.tsx`（UI 参照） |

※ `docs/ideas/` は実装判断に使わない。`docs/14_*_draft` は設計メモであり実装の正本ではない（正本は spec/038 と 042）。

---

## 4. 戦闘計算・定数

- **計算式・係数**: `docs/10_battle_calc_formulas.md`, `docs/10_battle_status.csv`。
- **戦闘用定数**: `src/lib/battle/battle-constants.ts`。
- **派生ステータス（HP・攻撃力・速度など）**: `src/lib/battle/derived-stats.ts`（10_battle_status 係数表準拠）。

---

## 5. ファンタジーアイコン（UI）

- **アイコンセット**: Iconify の **Game Icons**（CC BY 3.0、4,000+ アイコン）。Tailwind プラグイン `@iconify/tailwind` で利用。
- **呼び出し**: `src/components/icons/game-icon.tsx` の `<GameIcon name="ancient-sword" className="w-5 h-5 text-brass" />` のように各所で使用する。
- **名前**: ケバブケース（例: `ancient-sword`, `health-potion`, `dragon-head`）。一覧は [icon-sets.iconify.design/game-icons](https://icon-sets.iconify.design/game-icons/) で検索可能。
- **GameIcon を使うとき**: 使用するアイコン名（ケバブケース）に対応するクラス **`game-icons--<name>`** が **`tailwind.config.ts` の safelist** に含まれているか毎回確認する。未登録だとビルドで purge され表示されない。新規使用時は safelist に 1 行追加すること。
- **キャラ用アイコン画像**: 従来どおり `public/icons` の .gif と `getProtagonistIconFilenames()`。上記 GameIcon はボタン・ラベル・装備種別など UI 用。

---

## 6. コマンド・検証

- **開発サーバ**: `npm run dev`
- **DB 起動/停止**: `npm run db:start` / `npm run db:stop`
- **DB マイグレーション**: `npm run db:migrate`（schema 変更後）
- **シード投入**: `npm run db:seed`（テスト用データのみ）。マスタはバックアップ復元で用意。詳細は **`manage/DB_OPERATIONS.md`** と **`manage/BACKUP_RESTORE.md`** 参照。
- **Lint**: `npm run lint`
- テストは未整備の場合は省略可。追加する場合は `docs/03_architecture_spec.md` の「8. テスト方針」に従う。
