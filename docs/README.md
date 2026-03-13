# docs — ドキュメント索引

設計・仕様メモ・参照用。**正式な API/データ仕様**は `spec/` を参照。

**Cursor での実装時**は、プロジェクト直下の **`AGENTS.md`** を優先すること。  
AGENTS に「Spec↔実装の対応」「タスク別・読むファイル最小セット」があるので、**実装タスクではそこに書かれたファイルだけを開けば十分**（コンテキスト節約）。本索引は全体像の確認や「どの doc があるか」を調べるときに使う。

- **`docs/ideas/`** は**実装には関係しない**。思いつき・メモ用の置き場。仕様判断・コード変更の根拠には使わないこと。

---

## 見方

- **太字** = そのテーマの入口・代表
- 併記の「→ spec/xxx」= 実装の正本は spec

---

## 全体・プロジェクト

| ファイル | 内容 |
|----------|------|
| **00_overview.md** | ゲーム概要・コンセプト・MVP の基本ループ |
| 01_features.md | 機能一覧（MVP 項目） |
| 02_domain_model.md | ドメインモデル |
| 03_architecture_spec.md | アーキテクチャ方針 |
| 04_persistence_principles.md | 永続化方針 |
| 05_project_constitution.md | プロジェクト憲法 |
| 06_dev_setup.md | 開発環境構築 |
| 07_ui_guidelines.md | UI ガイドライン |
| 08_database_schema.md | DB スキーマ概要 |
| **027_hardcoded_and_deferred.md** | **ハードコード・暫定実装のルールと一覧**（追加・解消時に更新） |
| 999_レムアリア_世界観確定稿.md | 世界観 |
| **archive/** | 解消済み・履歴用（028 型エラー一覧など）。**実装時は参照しない。** |

---

## 戦闘・スキル（まとめて参照しやすいようにまとめ）

戦闘まわりは **docs/14_*** と **spec/038, 039, 040** に分散している。入口は下記の順でよい。

| ファイル | 内容 |
|----------|------|
| **14_battle_core_spec.md** | **戦闘コア仕様**（編成・列・ターゲット・流れ・概要はここに集約。旧 00_battle_system_overview は統合済み） |
| 14_battle_attributes_tactics.md | 属性・耐性・属性状態・作戦 |
| 14_battle_skill_design_draft.md | スキル設計の草案・必要項目（設計メモ） |
| 14_battle_tactics_impl_draft.md | 作戦実装のたたき台 |
| **14_tactics_slot_shared.md** | **作戦スロットは味方(039)・敵(050)で共有**。主語・条件・行動の定数・評価は共通。アップデート時は作戦室と敵マスタ編集の両方に影響しうる。 |
| **042_battle_effect_types_reference.md** | **effectType 定義一覧（param・適用タイミング）** ← 効果追加時はここ |
| 041_skill_effects_implementation_prep.md | 効果実装の Phase とデータフロー |
| **043_tactics_room_skill_info_ux_proposal.md** | **作戦室でのスキル情報表示 UX 提案**（一覧項目・非開示方針） |
| 061_tactics_room_companion_switch.md | 作戦室：仲間・メカ切り替え時に作戦が編集できない問題の原因と対策（案B 実装済み） |
| 062_tactics_per_preset_extension.md | 作戦スロットのプリセット別保持（拡張案）。PresetTacticSlot とフォールバック案。 |
| 023_skill_cooldown_ct_design.md | クールダウン・CT 設計 |
| 14_初期スキル_評価と新規効果.md | 初期スキルと既存/新規効果の対応表 |
| 14_initial_skills.csv / 14_skill_proposals_30.csv | スキル一覧（CSV） |
| skill_fields_ja.md | スキル項目の日本語説明（スプレッドシート用） |
| 10_battle_calc_formulas.md | 戦闘計算式 |
| 10_battle_status.csv | ステータス例 |
| 11_test_battle_plan.md | テスト戦闘の流れ |
| **069_equipment_relic_mecha_battle_reflection.md** | 探索戦闘での装備・遺物・メカパーツの効果反映状況 |
| **070_battle_effective_stats_implementation_plan.md** | 戦闘時有効基礎ステ実装案・実装フェーズ分け（→ spec/069） |
| **072_equipment_hp_mp_implementation_plan.md** | 装備の HP/MP 仕様拡張・戦闘反映の実装フェーズ分け（→ spec/071） |

→ 正式仕様: **spec/038_battle_skills_and_effects.md**, spec/039, spec/040。**戦闘時有効基礎ステ**（遺物補正・メカパーツ・フレーム倍率）は **spec/069_battle_effective_base_stats**。**装備の派生戦闘ステ加算**（HP/MP 含む）は **spec/071_equipment_derived_stats_in_battle**。**作戦スロット**は spec/039（味方・作戦室）と spec/050（敵・敵マスタ編集）の両方で同一仕様。**プリセットごとに別作戦**の拡張は **spec/063_tactics_per_preset**（設計案は 062）。詳細は 14_tactics_slot_shared.md。

---

## キャラ・装備・仲間

| ファイル | 内容 |
|----------|------|
| 09_character_implementation_notes.md | キャラ実装メモ |
| 12_skill_equipment_extension_notes.md | スキル・装備拡張メモ |
| 13_companion_employment_design.md | 仲間雇用設計 |
| 16_base_stats_alignment.md | 基礎ステータス整合 |
| **024_mecha_design.md** | **メカ設計（パーツ部位・スキル方針・ステ計算）** |
| **026_user_inventory_and_items.md** | **ユーザーアイテム所持（資源・装備・メカパーツ・遺物・スキル分析書・課金）** |
| **053_equipment_craft_stat_gen_master.md** | **装備・クラフトのステ生成（CAP/ウェイト）をマスタに持つ設計**（021 のマスタ化） |
| **073_equipment_hp_no_multiplier_impact.md** | 装備 HP が倍率に与えない設計メモ。 |
| **074_level_cap_and_cap_break_item.md** | **レベルキャップとキャップ到達後の報酬**。ゲーム全体の最大レベル（例:100）。キャップ到達後はレベルは上がらず、レベル1分の経験値が貯まるごとに振り直しアイテムを1個付与。→ **spec/074_level_cap_and_cap_reward_item.md**（実装正本）。 |

→ spec/015, 025, 030, 045, 046, 051（遺物）。**遺物パッシブ効果の effectType** は spec/051 および `src/lib/constants/relic-passive-effect-admin.ts` を参照。

---

## 設備・工業・生産

| ファイル | 内容 |
|----------|------|
| 15_facility_tags_and_industrial_skills.md | 設備タグ・工業スキル |
| 017_facility_variant_and_rare_parts.md | 設備バリアント・レアパーツ |
| 017_spec_checklist.md | 関連 spec チェックリスト |
| 018_facility_placement_areas.md | 配置エリア |
| 019_production_receive.md | 生産・受け取り |
| 021_equipment_cycle_design.md | 装備サイクル設計 |

→ spec/035, 036

---

## 探索・チャット・その他

| ファイル | 内容 |
|----------|------|
| **064_game_cycle_design.md** | **ゲームサイクル設計**（生産→資源→探索消費）。1日あたりのプレイ量・消費量の判断用。探索時の資源消費は未実装。 |
| **065_market_design.md** | **市場設計**（出品/購入・手数料・価格履歴）。Item 出品可否・最安から購入（トレード防止）・運営の取捨選択。→ spec は未作成。 |
| 020_exploration_design.md | 探索設計 |
| 022_chat_ui_design.md | チャット UI 設計 |
| **054_quest_and_research_design.md** | **クエストと研究の設計**（定義・前提・作業分解。ストーリー/研究/一般クエスト・研究ポイント・解放コスト・称号。設計メモ。正式仕様は spec/054_quests で定義済み。） |
| **068_quest_unlock_themes_and_research.md** | **開拓任務による機能解放**（任務クリアで探索テーマ・研究グループを解放する仕様。データ・処理・管理画面。） |
| **055_titles_design.md** | **称号の設計メモ**（称号マスタ・ユーザ解放・説明・解放条件メモ）。→ spec/055_titles。 |
| **056_how_to_play_guide.md** | **遊び方ガイド（プレイヤー向け）**。文面・構成の正本。実装は `src/app/guide/page.tsx`。 |

→ spec/037。クエストは spec/054_quests。称号は spec/055_titles。

---

## コンテンツ追加ガイド（docs/content-guides/）

| ファイル | 内容 |
|----------|------|
| **content-guides/README.md** | コンテンツ追加ガイド全体の説明・索引 |
| content-guides/skill_addition_guide.md | スキル追加時の手順（ドラフト） |

---

## 管理・運用（manage/）

管理者用画面・手順・チェックリストは **`manage/`** に置く。

| 場所 | 内容 |
|------|------|
| **manage/README.md** | manage 配下のファイル一覧 |
| manage/admin_area_drop_edit.md | エリア別ドロップ編集（手順・API・強敵枠の追加） |
| manage/admin_item_master_edit.md | アイテムマスタ編集（手順・API） |
| manage/MVP_PROGRESS.md | MVP 進捗 |
| manage/SECURITY_READINESS.md | セキュリティ・運用チェックリスト |

→ 探索のドロップテーブル仕様は spec/049 の 7.2 を参照。

---

## 統廃合の検討

- **方針・戦略**: **docs/00_doc_consolidation_proposal.md** — 「どこを 1 本にまとめるか」「どれを参照用に残すか」の判断。
- **実行計画（00 から順）**: **manage/DOC_CONSOLIDATION_PLAN.md** — 番号順の削除・統合・アーカイブのチェックリスト。
