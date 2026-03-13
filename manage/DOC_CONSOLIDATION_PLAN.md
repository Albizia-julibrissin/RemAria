# ドキュメント整理計画（00 から順）

ドキュメント肥大化に伴う**削除・統合・アーカイブ**の実行計画。  
方針の詳細は **`docs/00_doc_consolidation_proposal.md`** を参照。  
ここでは **番号順（00 → 01 → …）** に「何をするか」を一覧化する。

---

## 前提・方針

- **全部 1 本にまとめない**。テーマごとに「入口 1 本 + 必要ならサブ」。
- **spec は契約として残す**。設計メモ・経緯は docs に寄せる。
- **索引は `docs/README.md` に集約**。リンク切れ・誤参照の修正を含める。
- **番号の全面振り直しはしない**（他 doc・spec からの参照が壊れるため）。番号が重複しているものだけ整理する。

---

## 凡例

| アクション | 意味 |
|------------|------|
| **保持** | 現状のまま残す。必要なら冒頭に「正本は ○○」などの注釈を追加。 |
| **統合** | 他 doc に取り込み、元ファイルは「○○ に統合済み」の短いリダイレクトにするか削除。 |
| **アーカイブ** | `docs/archive/` に移動。README からは「アーカイブ済み」と記載。 |
| **削除** | 実体が空・重複・参照されていない場合に削除。 |
| **番号変更** | 番号が被っているため、サブ番号や別番号に変更。 |
| **参照修正** | 他ファイルでの参照（リンク・表記）を修正する。 |

---

## 00 番台

| 番号 | ファイル | アクション | メモ |
|------|----------|------------|------|
| 00 | **00_overview.md** | **保持** | ゲーム概要・MVP の入口。索引の代表。 |
| 00 | ~~00_battle_system_overview.md~~ | **削除済み** | 14 に包括されているため削除。戦闘概要は 14_battle_core_spec のみ参照。 |
| 00 | **00_doc_consolidation_proposal.md** | **保持** | 統廃合の**方針・戦略**の正本。本計画（実行チェックリスト）の参照元。 |
| 01 | 01_features.md | 保持 | 機能一覧・MVP 項目。 |
| 02 | 02_domain_model.md | 保持 | ドメインモデル。 |
| 03 | 03_architecture_spec.md | 保持 | アーキテクチャ・AGENTS から参照。 |
| 04 | 04_persistence_principles.md | 保持 | 永続化方針。 |
| 05 | 05_project_constitution.md | 保持 | プロジェクト憲法。 |
| 06 | 06_dev_setup.md | 保持 | 開発環境構築。 |
| 07 | 07_ui_guidelines.md | 保持 | UI ガイドライン。 |
| 08 | 08_database_schema.md | 保持 | DB スキーマ概要・正本の一つ。 |

---

## 09 ～ 16

| 番号 | ファイル | アクション | メモ |
|------|----------|------------|------|
| 09 | 09_character_implementation_notes.md | 保持 | キャラ実装メモ。必要なら冒頭に「設計メモ。正本は spec/015 等」を追記。 |
| 10 | 10_battle_calc_formulas.md | 保持 | 戦闘計算式。 |
| 10 | 10_battle_status.csv | 保持 | ステータス例（CSV）。 |
| 11 | 11_test_battle_plan.md | 保持 | テスト戦闘の流れ。 |
| 12 | 12_skill_equipment_extension_notes.md | 保持 | スキル・装備拡張メモ。 |
| 13 | 13_companion_employment_design.md | 保持 | 仲間雇用設計。 |
| 14 | **14_battle_core_spec.md** | **保持** | 戦闘コア仕様。戦闘概要もここに集約（00 は削除済み）。 |
| 14 | 14_battle_attributes_tactics.md | 保持 | 属性・耐性・作戦。 |
| 14 | 14_battle_skill_design_draft.md | 注釈 or アーカイブ | 「設計メモ。正本は spec/038 と 042」を冒頭に追記。参照が少なければ docs/archive へ。 |
| 14 | 14_battle_tactics_impl_draft.md | 注釈 or アーカイブ | 同上。作戦実装のたたき台。 |
| 14 | **14_tactics_slot_shared.md** | **保持** | 作戦スロット共有の説明。重要。 |
| 14 | 14_初期スキル_評価と新規効果.md | 保持 | 初期スキルと効果の対応表。実装参照で使う。 |
| 14 | 14_initial_skills.csv | 保持 | スキル一覧 CSV。 |
| 15 | 15_facility_tags_and_industrial_skills.md | 保持 | 設備タグ・工業スキル。 |
| 16 | 16_base_stats_alignment.md | 保持 | 基礎ステータス整合。 |

※ 14_skill_proposals_30.csv は **docs/old/** 内。old は「参照不要」のため、整理時に対象にするかどうかだけ判断すればよい。

---

## 017 ～ 028

| 番号 | ファイル | アクション | メモ |
|------|----------|------------|------|
| 017 | 017_facility_variant_and_rare_parts.md | 保持 | 設備バリアント・レアパーツ。 |
| 017 | 017_spec_checklist.md | 保持 | 017 用 spec 作成前チェックリスト。017 実装時のみ参照。 |
| 018 | 018_facility_placement_areas.md | 保持 | 配置エリア。 |
| 019 | 019_production_receive.md | 保持 | 生産・受け取り。 |
| 020 | 020_exploration_design.md | 保持 | 探索設計。 |
| 021 | 021_equipment_cycle_design.md | 保持 | 装備サイクル設計。 |
| 022 | 022_chat_ui_design.md | 保持 | チャット UI 設計。 |
| 023 | 023_skill_cooldown_ct_design.md | 保持 | クールダウン・CT 設計。 |
| 024 | 024_mecha_design.md | 保持 | メカ設計。 |
| 026 | 026_user_inventory_and_items.md | 保持 | ユーザーアイテム所持。 |
| 027 | 027_hardcoded_and_deferred.md | **保持** | ハードコード・暫定一覧。**追加・解消時に必ず更新**。AGENTS から参照。 |
| 028 | ~~028_existing_type_errors.md~~ | **アーカイブ済み** | `docs/archive/028_existing_type_errors.md` に移動。実装時の参照には使わない。 |

---

## 041 ～ 043

| 番号 | ファイル | アクション | メモ |
|------|----------|------------|------|
| 041 | 041_skill_effects_implementation_prep.md | 保持 | 効果実装 Phase・データフロー。042 との役割分担を冒頭で明示。 |
| 042 | 042_battle_effect_types_reference.md | **保持** | effectType 定義の**正本**。新規追加時はここに追記。AGENTS から参照。 |
| 043 | 043_tactics_room_skill_info_ux_proposal.md | 保持 | 作戦室スキル情報 UX 提案。 |

---

## 048, 051 ～ 057

| 番号 | ファイル | アクション | メモ |
|------|----------|------------|------|
| 048 | 048_experience_and_levelup.md | 保持 | 経験値・レベルアップ。spec/048 と対応。 |
| 053 | 053_equipment_craft_stat_gen_master.md | 保持 | 装備・クラフトのステ生成マスタ設計。 |
| 054 | 054_quest_and_research_design.md | 保持 | クエストと研究の設計。 |
| 055 | 055_titles_design.md | 保持 | 称号の設計メモ。 |
| 056 | 056_how_to_play_guide.md | 保持 | 遊び方ガイド（プレイヤー向け）正本。 |
| 057 | 057_dashboard_layout_and_ux_handoff.md | 保持 | ダッシュボードレイアウト・UX 受け渡し。 |

---

## 059 ～ 074（番号重複の整理含む）

| 番号 | ファイル | アクション | メモ |
|------|----------|------------|------|
| 059 | 059_exploration_step_refactor.md | 保持 | 探索ステップリファクタ方針。 |
| 060 | 060_exploration_events_design.md | 保持 | 探索イベント設計。spec/073 が正本と明記済み。 |
| 061 | 061_exploration_one_row_per_user.md | 保持 | 探索 1 行/ユーザー。 |
| 061 | 061_tactics_room_companion_switch.md | **番号変更検討** | 作戦室の仲間・メカ切り替え問題。061 が 2 本あるため、**061_tactics_room_companion_switch.md** を **062_tactics_room_companion_switch.md** にリネームするか、062 と統合するか検討。※ 062 は「作戦プリセット別保持」で別テーマ。→ **062a / 062b のようにせず、061 は探索・062 は作戦で分け、companion_switch は 062 に含めず別名 **063_tactics_room_companion_switch.md** などにすると spec/063 と被る。**現状のまま 061 が 2 ファイル**で、README で両方案内するだけでも可。 |
| 062 | 062_tactics_per_preset_extension.md | 保持 | 作戦プリセット別保持。spec/063 と対応。 |
| 064 | 064_game_cycle_design.md | 保持 | ゲームサイクル設計。 |
| 065 | **065_market_design.md** | **保持** | 市場設計。 |
| 065 | **065_special_items_and_facility_speed.md** | **番号変更** | 特別アイテム・設備加速。065 が 2 本あるため、**065_special_items_and_facility_speed.md** を **065a** や **066_special_items_and_facility_speed.md** にリネームするか、066 は通知実装状況なので、**065_special_items_facility_speed.md** のままにして README で「065: 市場」「065: 特別アイテム・設備加速」と 2 行で並べるだけでも可。→ **推奨**: 番号を **066_special_items_and_facility_speed.md** に変更し、既存の 066_notification を **066_notification_implementation_status.md** のまま 1 本とする。067 も 2 本あるため下記で整理。 |
| 066 | 066_notification_implementation_status.md | 保持 | 通知実装状況。上記の番号変更時は 065 特別アイテムを 066 にすると 066 が 2 本になるので、**065 特別アイテム → 065b や 065_special_... のまま**にして「065 は 2 テーマ」と README に注釈する方が安全。 |
| 067 | **067_quest_report_completion_flow.md** | **保持** | クエスト完了・報告フロー（B 案）。設計 doc。 |
| 067 | **067_quest_implementation_status.md** | **保持** | クエスト実装状況。**067 が 2 本**。README で「067: 報告フロー」「067: 実装状況」と並列記載でよい。または report を 067a、implementation_status を 067b のようにサフィックスで区別するか。 |
| 068 | 068_quest_unlock_themes_and_research.md | 保持 | 開拓任務による機能解放。 |
| 069 | 069_equipment_relic_mecha_battle_reflection.md | 保持 | 装備・遺物・メカの戦闘反映状況。 |
| 070 | 070_battle_effective_stats_implementation_plan.md | 保持 | 戦闘時有効基礎ステ実装案。 |
| 072 | 072_equipment_hp_mp_implementation_plan.md | 保持 | 装備 HP/MP 実装プラン。 |
| 073 | **073_equipment_hp_no_multiplier_impact.md** | **保持** | 装備 HP が倍率に与えない設計メモ。 |
| 073 | **073_relic_passive_effect_types_design.md** | **存在しない** | README と manage/VERIFICATION_LOG で参照されているが、**ファイルが存在しない**。→ **参照修正**が必要。遺物パッシブ効果の effectType は **src/lib/constants/relic.ts** や spec/051 等に記載があるか確認し、**正本を 1 つに決めて README の 073 の行を実在する doc に差し替える**。または該当設計が別 doc に含まれていれば「073 は 073_equipment_hp_no_multiplier_impact のみ。遺物パッシブは ○○ 参照」と README を修正。 |
| 074 | 074_level_cap_and_cap_break_item.md | 保持 | レベルキャップ・キャップ突破アイテム。 |

---

## 999・その他

| 番号 | ファイル | アクション | メモ |
|------|----------|------------|------|
| 999 | 999_レムアリア_世界観確定稿.md | 保持 | 世界観。 |
| - | skill_fields_ja.md | 保持 | スキル項目の日本語説明。 |
| - | rename_battle_test_to_production.md | **削除 or アーカイブ** | リネーム用の一時メモであれば、実施済みなら削除、履歴として残すなら archive。 |
| - | docs/old/ | **保持（参照しない）** | 「参照不要」と明記。整理時に対象外でもよい。 |

---

## 参照修正が必要な箇所

| 対象 | 内容 |
|------|------|
| **docs/README.md** | **073_relic_passive_effect_types_design.md** は存在しない。073 は **073_equipment_hp_no_multiplier_impact.md** のみ。遺物パッシブ効果の effectType の正本が別にあるならその doc を記載するか、該当行を「遺物パッシブ効果は spec/051 および src/lib/constants/relic.ts 等を参照」に変更する。 |
| **manage/VERIFICATION_LOG.md** | 同上。`docs/073_relic_passive_effect_types_design.md` への参照を、実在する doc または「遺物パッシブは ○○」に修正。 |

---

## Cursor 実装効率とコンテキスト対策

**目的**: Cursor（AI）が実装するときに「何を読むか」で迷わず、**コンテキスト読み込み上限**を踏まえて必要最小のファイルだけ開くようにする。

### 起きがちな非効率

| 問題 | 影響 |
|------|------|
| **正本が分散** | effectType は spec/038 と docs/042 の両方に触れがあり、038 だけ読むと古い・短い方で実装してしまう。 |
| **タスクごとの「読むファイル」が暗黙** | 「effectType 追加」で 042 / 038 / 041 / seed / run-battle のどれを開くか文書にない。 |
| **設計メモを正本と誤認** | 14_battle_skill_design_draft などを開くと「草案」なのに実装の根拠に使ってしまう。 |
| **索引だけで全部読もうとする** | docs/README は全体像用。実装タスクごとに「この 2～3 ファイルだけ」が分からないとコンテキストを消費しやすい。 |
| **ideas を実装根拠に使う** | docs/ideas/ は実装に使わないと書いてあっても、開いてしまうと判断がぶれる。 |

### 対策（実施済み・推奨）

| 対策 | 内容 |
|------|------|
| **AGENTS を「タスク→最小ファイル」の入口にする** | 実装時は AGENTS の「タスク別・読むファイル最小セット」だけ見て、そこに書かれた spec/doc/コードパスだけを開く。docs/README は全体像が必要なときだけ。 |
| **正本を 1 行で明示** | 各正本 doc（042, spec/038 等）の冒頭に「effectType の正本は 042」「API の契約は本 spec」など 1 行入れる。 |
| **設計メモに「正本ではない」を冒頭に記載** | 14_battle_skill_design_draft, 14_battle_tactics_impl_draft の先頭に「【設計メモ・実装の正本ではない】実装は spec/038, docs/042 を参照。」を入れる。 |
| **ideas は開かない** | AGENTS と docs/README で「docs/ideas/ は実装判断に使わない」と明記済み。Cursor は実装タスクで ideas を参照しない。 |
| **長い doc は「要約＋リンク」に寄せる** | 経緯・背景が長い doc は、先頭に「実装に必要な要点は §X。詳細は ○○。」と書き、必要な節だけ読めるようにする。 |
| **028 など解消済みメモはアーカイブ** | 型エラー一覧など「解消済み」の doc は archive に移すか冒頭に注釈し、通常時のコンテキストから外す。 |

### コンテキスト節約の運用

- **実装タスク時**: AGENTS.md を開く → 該当テーマの「Spec」「主な実装場所」と、必要なら「タスク別最小セット」の 1～2 doc だけ開く。docs/README は「どの doc があるか」を調べるときだけ。
- **戦闘・effectType**: 042（正本）＋ spec/038（API 構造）＋ 実装するコードパス。041 は Phase 確認が必要なときだけ。14_*_draft は開かなくてよい。
- **新機能で spec がない場合**: docs/01_features と manage/MVP_PROGRESS で該当を確認してから spec を書く。そのあと AGENTS の表に 1 行追加する。

---

## 実行順序の提案

1. **参照修正**（README の 073、VERIFICATION_LOG の 073）を先に実施し、リンク切れを解消する。
2. ~~**00_battle_system_overview**~~ → **実施済み**（14 に統合のため削除）。
3. ~~**028_existing_type_errors**~~ → **実施済み**（docs/archive/ に移動）。
4. **065・067 の 2 本ずつ**は、番号変更するか README で「同番号で 2 テーマ」と明記するだけにする（推奨: まずは README で注釈のみ）。
5. **14_battle_skill_design_draft / 14_battle_tactics_impl_draft** に「設計メモ。正本は spec/038 と 042」を冒頭に追記。
6. **rename_battle_test_to_production.md** を実施済みか確認し、不要なら削除 or アーカイブ。
7. 必要に応じて **docs/archive/** を作成し、028 や old の扱いを統一。

---

## 実施後

- **docs/README.md** の「統廃合の検討」節で、本計画（**manage/DOC_CONSOLIDATION_PLAN.md**）へのリンクを追加し、「00 から順に整理する実行計画」であることを記載する。
- **00_doc_consolidation_proposal.md** は方針として残し、本計画は「実行チェックリスト」として運用する。
