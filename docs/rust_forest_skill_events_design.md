# 錆びれた森林スコーガルズ 技能イベント設計

`docs/森林エリア設定.ini` と spec/073 に基づく。3エリア（遊覧舗装路跡・保護管理棟跡・森林最奥地）向けの技能イベント一覧。

## 錆びれた森林 共通イベント（10個）

| code | name | 発生メッセージ |
|------|------|----------------|
| rust_forest_dust_wind | 赤茶の粉塵 | 風が吹くと赤茶の粉が舞い、視界が霞む。 |
| rust_forest_water_edge | オレンジの水辺 | 水辺がオレンジ色に濁り、足元がぬかるんでいる。 |
| rust_forest_corroded_metal | 腐食した金属 | 腐食した金属の残骸が道を塞いでいる。触ると脆そうだ。 |
| rust_forest_roots_structure | 樹根と構造物 | 樹根がリベットや継ぎ目を割って構造物に絡まっている。 |
| rust_forest_iron_wetland | 鉄酸化した湿地 | 湿地が錆色に変色し、オレンジの沈殿が見える。 |
| rust_forest_iron_dust_breath | 鉄粉の降り積もり | 鉄粉が降り積もり、息が辛い。 |
| rust_forest_bark_color | 赤茶に染まった樹皮 | 樹皮が赤茶色に染まった異様な光景が広がる。 |
| rust_forest_drone_wreck | 廃ドローン残骸 | 廃ドローンの残骸が木に絡まり、道を塞いでいる。 |
| rust_forest_dim_path | 薄暗い森道 | 日光が弱く、森道が薄暗い。 |
| rust_forest_iron_soil | 鉄濃度の高い土壌 | 鉄濃度の高い土壌が足を取る。 |

## 遊覧舗装路跡 専用イベント（5個）

| code | name | 発生メッセージ |
|------|------|----------------|
| yuran_paved_crack | 舗装のひび割れ | アスファルトが樹根で隆起し、ひびが入っている。 |
| yuran_guardrail | 錆びたガードレール | 遊覧路のガードレールが錆で崩れかけている。 |
| yuran_drainage | 詰まった排水溝 | 路肩の排水溝が鉄分で詰まっている。 |
| yuran_signboard | 腐食した案内板 | 旧観光案内板が腐食で読めない。 |
| yuran_collapse | 道路の崩落 | 遊覧道路の分岐点で道が崩落している。 |

## 保護管理棟跡 専用イベント（5個）

| code | name | 発生メッセージ |
|------|------|----------------|
| hogokan_entrance | 管理棟の入り口 | 管理棟の入り口のドアが歪んで開かない。 |
| hogokan_monitor | 監視機器の残骸 | 監視機器の残骸が転がり、配線が露出している。 |
| hogokan_storage | 備品庫の扉 | 備品庫の扉が錆で固着している。 |
| hogokan_handrail | 階段の手すり | 階段の手すりが腐食で不安定だ。 |
| hogokan_window | 変形した窓枠 | 窓枠が変形し、ガラスが割れている。 |

## 森林最奥地 専用イベント（5個）

| code | name | 発生メッセージ |
|------|------|----------------|
| forest_deep_giant_tree | 深森の巨木 | 幹が黒赤に染まった巨木が道を塞いでいる。 |
| forest_deep_untouched_wetland | 人跡未踏の湿地 | オレンジの膜が張った、人跡未踏の湿地が広がる。 |
| forest_deep_metal_tree_fusion | 機械と樹木の融合 | 機械と樹木が完全に一体化した景観が立ちはだかる。 |
| forest_deep_iron_plants | 鉄耐性植物の群生 | 鉄耐性で進化した植物が赤茶の森を形成している。 |
| forest_deep_silence | 最奥の静寂 | 粉塵が音を吸い、不気味な静寂が漂う。 |

## クリアメッセージ（ステータス別）

各イベントで、成功時・失敗時は `SkillEventStatOption` の successMessage / failMessage でステータス（STR/INT/VIT/WIS/DEX/AGI）ごとに出し分け。係数は一律 1.0。文言はシードスクリプト内で共通の短い解決文を使用（力で押しのけた／知恵で対処法を見つけた、等）。

## エリア紐づけと実行手順

- **共通 10 個**: 遊覧舗装路跡・保護管理棟跡・森林最奥地の **3 エリアすべて** に紐づく（重み 10）。
- **専用 5 個ずつ**: 該当エリアのみに紐づく（重み 10）。

**前提**: `ExplorationArea` の **name** が「遊覧舗装路跡」「保護管理棟跡」「森林最奥地」の 3 件が DB に存在すること。管理画面で探索テーマ「錆びれた森林スコーガルズ」と 3 エリアを作成してから実行する。

**実行**:

```bash
npm run db:seed-rust-forest-skill-events
```

または:

```bash
npx tsx prisma/seed-rust-forest-skill-events.ts
```

同一 code のイベントは upsert のため、再実行で文言や紐づけを上書きできる。
