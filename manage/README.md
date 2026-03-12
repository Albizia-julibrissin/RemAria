# manage — 開発管理用

このフォルダは、開発の進捗ややる気の可視化用のドキュメントを置くためのものです。

## ファイル

| ファイル | 説明 |
|----------|------|
| [DB_OPERATIONS.md](./DB_OPERATIONS.md) | **DB 運営**。起動・マイグレーション・シード（マスタ/テスト/エクスポート）の使い分け、編集内容の初期シード反映、管理画面との関係。 |
| [MVP_PROGRESS.md](./MVP_PROGRESS.md) | MVP までの進捗ダッシュボード。`docs/01_features.md` の項目と spec/実装の対応を一覧化。進捗率・カテゴリ別状況・次のステップを記載。 |
| [SECURITY_READINESS.md](./SECURITY_READINESS.md) | 認証・セッション・通貨・運用まわりのチェックリスト。商用リリースを意識した TODO を優先度付きで整理。 |
| [ECONOMY_DESIGN.md](./ECONOMY_DESIGN.md) | **経済設計メモ**。課金通貨の統一方針（無償/有償のみ・表示1単位・無償から消費）、円→通貨の価格表、初期・ストーリー・デイリー付与。 |
| [RELEASE.md](./RELEASE.md) | **リリース相談用**。リリースの種類・前チェックリスト・実行手順の例・ロールバック・相談メモ。本番に出すときの参照・更新用。 |
| [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md) | **デプロイ先の検討**。Railway 一式 vs Vercel+Neon/Supabase の比較・料金の目安・RemAria 向けのおすすめ。決まったら RELEASE の手順を具体化する。 |
| [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) | **Railway でデプロイする手順**。初回（プロジェクト作成・PostgreSQL・Web サービス・環境変数・マイグレーション・シード）と 2 回目以降の流れ。 |
| [GITHUB_BASICS.md](./GITHUB_BASICS.md) | **GitHub を初めて使う人向け**。リポジトリの作り方・ローカルから push する手順（RemAria を GitHub に上げて Railway と連携するまで）。 |
| [admin_master_edit_overview.md](./admin_master_edit_overview.md) | **管理者用** マスタ編集の全体像。編集済みマスタ一覧と編集候補（敵・探索エリア・スキル・クエスト・研究等）を優先度付きで整理。振り返り・次にどれを実装するかの参照用。 |
| [admin_area_drop_edit.md](./admin_area_drop_edit.md) | **管理者用** エリア別ドロップ編集。探索エリアごとのドロップテーブル（基本／戦闘／技能／強敵／領域主）の編集手順・API・データ構造・強敵枠の追加方法。spec/049 の 7.2 と対応。 |
| [admin_enemy_group_edit.md](./admin_enemy_group_edit.md) | **管理者用** 敵グループ編集。EnemyGroup の code・メンバー（敵・重み）。通常戦雑魚用。spec/050。 |
| [admin_exploration_theme_area_edit.md](./admin_exploration_theme_area_edit.md) | **管理者用** 探索テーマ・エリア編集。ExplorationTheme の code/name/表示順、ExplorationArea の code/name・敵グループ・体数確率・強敵・領域主等。spec/049・docs/020。 |
| [admin_skill_edit.md](./admin_skill_edit.md) | **管理者用** スキル編集。name / 戦闘用項目。効果は既存 effectType のみ選択可。効果の説明一覧あり。spec/038・docs/042。 |
| [admin_research_group_edit.md](./admin_research_group_edit.md) | **管理者用** 研究グループ編集。ResearchGroup / ResearchGroupItem / ResearchUnlockCost。spec/047。 |
| [admin_item_master_edit.md](./admin_item_master_edit.md) | **管理者用** アイテムマスタ編集。Item の code / name / category / skillId / consumableEffect / maxCarryPerExpedition / maxOwnedPerUser の編集手順・API。spec/045 と対応。 |
| [admin_facility_type_edit.md](./admin_facility_type_edit.md) | **管理者用** 設備種別編集。FacilityType の code / name 等。 |
| [admin_facility_recipe_edit.md](./admin_facility_recipe_edit.md) | **管理者用** 設備生産レシピ編集。Recipe / RecipeInput。 |
| [admin_craft_recipe_edit.md](./admin_craft_recipe_edit.md) | **管理者用** クラフトレシピ編集。CraftRecipe / CraftRecipeInput。 |
| [TYPE_MISMATCH_INSPECTION.md](./TYPE_MISMATCH_INSPECTION.md) | **型ずれ**。seed と Prisma 型の不整合の原因・対処（db:generate、TS 再起動、Item skillId 等）。 |
| [VERIFICATION_LOG.md](./VERIFICATION_LOG.md) | **検証ログ**。戦闘ログ内の検証用表示（遺物適用前ダメージ等）の取り扱い。環境変数・表示条件・今後の拡張方針。 |

## 使い方

- 実装や spec を追加したら **MVP_PROGRESS.md** の該当行と進捗バーを更新する。
- 週次で「今週やること」をメモしておくなど、自分用のメモをこのフォルダに追加してもよい。
