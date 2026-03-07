# manage — 開発管理用

このフォルダは、開発の進捗ややる気の可視化用のドキュメントを置くためのものです。

## ファイル

| ファイル | 説明 |
|----------|------|
| [MVP_PROGRESS.md](./MVP_PROGRESS.md) | MVP までの進捗ダッシュボード。`docs/01_features.md` の項目と spec/実装の対応を一覧化。進捗率・カテゴリ別状況・次のステップを記載。 |
| [SECURITY_READINESS.md](./SECURITY_READINESS.md) | 認証・セッション・通貨・運用まわりのチェックリスト。商用リリースを意識した TODO を優先度付きで整理。 |
| [admin_master_edit_overview.md](./admin_master_edit_overview.md) | **管理者用** マスタ編集の全体像。編集済みマスタ一覧と編集候補（敵・探索エリア・スキル・クエスト・研究等）を優先度付きで整理。振り返り・次にどれを実装するかの参照用。 |
| [admin_area_drop_edit.md](./admin_area_drop_edit.md) | **管理者用** エリア別ドロップ編集。探索エリアごとのドロップテーブル（基本／戦闘／技能／強敵／領域主）の編集手順・API・データ構造・強敵枠の追加方法。spec/049 の 7.2 と対応。 |
| [admin_item_master_edit.md](./admin_item_master_edit.md) | **管理者用** アイテムマスタ編集。Item の code / name / category / skillId / consumableEffect / maxCarryPerExpedition の編集手順・API。spec/045 と対応。 |
| [admin_facility_type_edit.md](./admin_facility_type_edit.md) | **管理者用** 設備種別編集。FacilityType の code / name 等。 |
| [admin_facility_recipe_edit.md](./admin_facility_recipe_edit.md) | **管理者用** 設備生産レシピ編集。Recipe / RecipeInput。 |
| [admin_craft_recipe_edit.md](./admin_craft_recipe_edit.md) | **管理者用** クラフトレシピ編集。CraftRecipe / CraftRecipeInput。 |

## 使い方

- 実装や spec を追加したら **MVP_PROGRESS.md** の該当行と進捗バーを更新する。
- 週次で「今週やること」をメモしておくなど、自分用のメモをこのフォルダに追加してもよい。
