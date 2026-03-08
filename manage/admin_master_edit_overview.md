# マスタ編集の全体像（管理者用）

コンテンツ管理（`/dashboard/admin/content`）および管理画面で扱うマスタについて、「編集済み」と「編集候補」を整理する。  
実装・運用の振り返りや、次にどのマスタの編集機能を足すかの参照用。

---

## 1. 編集済みマスタ（管理画面あり）

以下のマスタは一覧・新規・編集（必要に応じて）の管理画面が実装済み。テストユーザー1でログイン時のみ表示。

| マスタ | 画面パス | 主な編集項目 | 管理 Doc |
|--------|----------|--------------|----------|
| アイテム (Item) | `/dashboard/admin/items` | code / name / category / skillId / consumableEffect / maxCarryPerExpedition | [admin_item_master_edit.md](./admin_item_master_edit.md) |
| エリアドロップ | `/dashboard/admin/drops` | ドロップテーブル・強敵枠・領域主枠 | [admin_area_drop_edit.md](./admin_area_drop_edit.md) |
| クラフトレシピ (CraftRecipe) | `/dashboard/admin/craft-recipes` | レシピ・素材・成果物 | [admin_craft_recipe_edit.md](./admin_craft_recipe_edit.md) |
| 設備種別 (FacilityType) | `/dashboard/admin/facilities` | code / name 等 | [admin_facility_type_edit.md](./admin_facility_type_edit.md) |
| 設備生産レシピ (Recipe) | `/dashboard/admin/recipes` | 設備×生産アイテム | [admin_facility_recipe_edit.md](./admin_facility_recipe_edit.md) |
| 遺物型 (RelicType) | `/dashboard/admin/relic-types` | code / name / groupCode | — |
| 遺物パッシブ効果 (RelicPassiveEffect) | `/dashboard/admin/relic-passive-effects` | code / name / description | — |
| 遺物グループ設定 (RelicGroupConfig) | `/dashboard/admin/relic-groups` | groupCode / ステ補正範囲 / 耐性幅 / 抽選対象パッシブ | — |
| 敵 (Enemy) | `/dashboard/admin/enemies` | code / name / 基礎ステ・配置・作戦スロット（最大10）。spec/050。 | — |
| 敵グループ (EnemyGroup) | `/dashboard/admin/enemy-groups` | code（ユニーク）・メンバー（敵・重み）。通常戦雑魚用。探索エリアで「通常戦 雑魚グループ」にここで作った code を選ぶ。 | [admin_enemy_group_edit.md](./admin_enemy_group_edit.md) |
| 探索テーマ・エリア (ExplorationTheme / ExplorationArea) | `/dashboard/admin/exploration-themes` | テーマ: code / name / 表示順。エリア: code / name / 敵グループ・体数確率・強敵・領域主・ドロップ・技能等。 | [admin_exploration_theme_area_edit.md](./admin_exploration_theme_area_edit.md) |
| スキル (Skill) | `/dashboard/admin/skills` | name / category / 戦闘用項目（battleSkillType, powerMultiplier 等）。効果は**既存の effectType のみ**選択可。効果の説明一覧表示あり。 | [admin_skill_edit.md](./admin_skill_edit.md) |
| 研究グループ (ResearchGroup / ResearchGroupItem / ResearchUnlockCost) | `/dashboard/admin/research-groups` | グループ code / name / 表示順 / 前提グループ。解放対象（設備型 or クラフトレシピ）・派生型フラグ・表示順。解放時の消費アイテム・個数。 | [admin_research_group_edit.md](./admin_research_group_edit.md) |

---

## 2. 編集候補（コンテンツ一覧には出ているが編集画面なし）

コンテンツ管理ページで一覧表示されているが、現状は参照のみで編集できないマスタ。

| マスタ | 説明 | 編集すると便利な項目 | 優先度の目安 |

---

## 3. 編集候補（コンテンツ一覧外だが運用で触りたくなるもの）

| マスタ | 説明 | 編集すると便利な項目 | 優先度の目安 |
|--------|------|----------------------|--------------|
| **クエスト (Quest)** | spec/054。ストーリー・研究・一般。 | 達成条件・報酬・前提クエスト・表示メッセージ。 | 中 |
| **装備型 (EquipmentType)** | Item と別テーブル。クラフトで参照。 | 名前・スロット種別・ステ生成設定等。アイテムマスタと連動させる運用も可。 | 低〜中 |
| **メカパーツ型 (MechaPartType)** | spec/044。メカパーツの種類。 | 名前・部位・ステ等。044 未実装部分あり。 | 低（他を優先したあと） |
| **Tag** | 設備タグ等。 | 件数が少なければ seed のままでよい。 | 低 |

---

## 4. 参照・更新の目安

- **実装したら**: 当該マスタを「1. 編集済み」に移し、必要なら manage に個別 Doc（例: admin_enemy_edit.md）を追加する。
- **優先度**: 運用で「よく変えたい」ものから。敵・探索エリアはコンテンツ追加・バランス調整に直結するため、編集機能の候補として優先しやすい。
- **認可**: 現状の管理機能はすべて **テストユーザー1** のみ。本番運用時は `isTestUser1()` に代えて管理者ロール等を検討する（[SECURITY_READINESS.md](./SECURITY_READINESS.md) 参照）。
