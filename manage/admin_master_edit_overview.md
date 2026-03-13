# マスタ編集の全体像（管理者用）

コンテンツ管理（`/dashboard/admin/content`）および管理画面で扱うマスタについて、「編集済み」と「編集候補」を整理する。  
実装・運用の振り返りや、次にどのマスタの編集機能を足すかの参照用。

---

## 1. 編集済みマスタ（管理画面あり）

以下のマスタは一覧・新規・編集（必要に応じて）の管理画面が実装済み。管理用アカウント（ADMIN_EMAIL）でログイン時のみ表示。

| マスタ | 画面パス | 主な編集項目 | 管理 Doc |
|--------|----------|--------------|----------|
| アイテム (Item) | `/dashboard/admin/items` | code / name / category / skillId / consumableEffect / maxCarryPerExpedition / maxOwnedPerUser | [admin_item_master_edit.md](./admin_item_master_edit.md) |
| エリアドロップ | `/dashboard/admin/drops` | ドロップテーブル・強敵枠・領域主枠 | [admin_area_drop_edit.md](./admin_area_drop_edit.md) |
| クラフトレシピ (CraftRecipe) | `/dashboard/admin/craft-recipes` | レシピ・素材・成果物 | [admin_craft_recipe_edit.md](./admin_craft_recipe_edit.md) |
| 設備種別 (FacilityType) | `/dashboard/admin/facilities` | code / name 等 | [admin_facility_type_edit.md](./admin_facility_type_edit.md) |
| 設備生産レシピ (Recipe) | `/dashboard/admin/recipes` | 設備×生産アイテム | [admin_facility_recipe_edit.md](./admin_facility_recipe_edit.md) |
| 遺物型 (RelicType) | `/dashboard/admin/relic-types` | code / name / groupCode | — |
| 遺物パッシブ効果 (RelicPassiveEffect) | `/dashboard/admin/relic-passive-effects` | code / name / description | — |
| 遺物グループ設定 (RelicGroupConfig) | `/dashboard/admin/relic-groups` | groupCode / ステ補正範囲 / 耐性幅 / 抽選対象パッシブ | — |
| 敵 (Enemy) | `/dashboard/admin/enemies` | code / name / 基礎ステ・配置・作戦スロット（最大10）。spec/050。 | — |
| 敵グループ (EnemyGroup) | `/dashboard/admin/enemy-groups` | code（ユニーク）・メンバー（敵・重み）。通常戦雑魚用。探索エリアで「通常戦 雑魚グループ」にここで作った code を選ぶ。 | [admin_enemy_group_edit.md](./admin_enemy_group_edit.md) |
| 探索テーマ・エリア (ExplorationTheme / ExplorationArea) | `/dashboard/admin/exploration-themes` | テーマ: code / name / 表示順。エリア: code / name / 敵グループ・体数確率・強敵・領域主・ドロップ・技能等。エリア編集画面で**技能イベント紐づけ**（重み付き）も編集可。 | [admin_exploration_theme_area_edit.md](./admin_exploration_theme_area_edit.md) |
| 技能イベント (ExplorationEvent / SkillEventDetail / SkillEventStatOption) | `/dashboard/admin/skill-events` | spec/073。code / name / 発生メッセージ / 各ステータス（係数・成功/失敗メッセージ）。エリアとはエリア編集画面の「技能イベント」で紐づけ。 | — |
| スキル (Skill) | `/dashboard/admin/skills` | name / category / 戦闘用項目（battleSkillType, powerMultiplier 等）。効果は**既存の effectType のみ**選択可。効果の説明一覧表示あり。 | [admin_skill_edit.md](./admin_skill_edit.md) |
| 研究グループ (ResearchGroup / ResearchGroupItem / ResearchUnlockCost) | `/dashboard/admin/research-groups` | グループ code / name / 表示順 / 前提グループ。解放対象（設備型 or クラフトレシピ）・派生型フラグ・表示順。解放時の消費アイテム・個数。 | [admin_research_group_edit.md](./admin_research_group_edit.md) |
| クエスト (Quest) | `/dashboard/admin/quests` | 既存クエストの編集のみ（新規作成は後回し）。code / 種別 / name / description / clearReportMessage / 前提クエスト / 達成条件（achievementType・achievementParam） / 報酬（GRA・研究記録書・称号ID・報酬アイテム複数）。spec/054。 | — |

---

## 2. 編集候補（コンテンツ一覧には出ているが編集画面なし）

コンテンツ管理ページで一覧表示されているが、現状は参照のみで編集できないマスタ。

| マスタ | 説明 | 編集すると便利な項目 | 優先度の目安 |

---

## 3. 編集候補（コンテンツ一覧外だが運用で触りたくなるもの）

| マスタ | 説明 | 編集すると便利な項目 | 優先度の目安 |
|--------|------|----------------------|--------------|
| **装備型 (EquipmentType)** | Item と別テーブル。クラフトで参照。 | 名前・スロット種別・ステ生成設定等。アイテムマスタと連動させる運用も可。 | 低〜中 |
| **メカパーツ型 (MechaPartType)** | spec/044。メカパーツの種類。 | 名前・部位・ステ等。044 未実装部分あり。 | 低（他を優先したあと） |
| **Tag** | 設備タグ等。 | 件数が少なければ seed のままでよい。 | 低 |

---

## 4. マスタの運用（バックアップ・復元）

- **マスタはシードでは投入しない**。管理画面で編集し、**バックアップ・復元**で環境を揃える。
- **`npm run db:backup`** … 現在の DB を `manage/backups/remaria_YYYYMMDD_HHmmss.dump` に出力する。
- **`npm run db:restore`** … 直近のバックアップ、または指定した .dump を復元する。復元先の既存データは上書きされる。
- 詳細は **[BACKUP_RESTORE.md](./BACKUP_RESTORE.md)** を参照。

### 編集したデータを別環境で使う手順

1. 管理画面でマスタ（設備種別・アイテム・タグ・ドロップなど）を編集する。
2. **`npm run db:backup`** を実行 → `manage/backups/` にタイムスタンプ付きの .dump ができる。
3. 必要ならそのファイルを別環境にコピーする。
4. 別環境で **`npm run db:restore`**（または `npm run db:restore -- path/to/backup.dump`）で復元する。

## 5. シード（テスト用データのみ）

- **`npm run db:seed`** … **テスト用データのみ**投入（test1/test2 ユーザー・主人公・仲間・通貨・所持品）。マスタは投入しない。マスタは事前にバックアップ復元などで用意すること。
- 初期設備の配置・強制配置はアプリ側で行うため、シードでは行わない。

---

## 6. 参照・更新の目安

- **実装したら**: 当該マスタを「1. 編集済み」に移し、必要なら manage に個別 Doc（例: admin_enemy_edit.md）を追加する。
- **優先度**: 運用で「よく変えたい」ものから。敵・探索エリアはコンテンツ追加・バランス調整に直結するため、編集機能の候補として優先しやすい。
- **認可**: 現状の管理機能は **管理用アカウント**（環境変数 `ADMIN_EMAIL` で指定、未設定時は `test1@example.com`）のみ。詳細は [ADMIN_ACCOUNT.md](./ADMIN_ACCOUNT.md)。本番では `ADMIN_EMAIL` と `ADMIN_PASSWORD` を設定してシードで管理人を作成すること。
