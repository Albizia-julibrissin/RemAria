# Spec: 装備の鍛錬と継承

docs/084_equipment_temper_and_inherit.md に基づき、**鍛錬**（たんれん。CAP のリロール＋ステ再抽選）と**継承**（statCap 引き上げ）の API・データ・検証を定義する。

------------------------------------------------------------------------

## 0. 依存・横断

### 0.1 依存する spec

- **045_inventory_and_items**：EquipmentInstance, EquipmentType, 所持・装着。
- **046_item_craft**：executeCraft, CraftRecipe, CraftRecipeInput。鍛錬時の素材参照。
- **docs/021, 053**：装備の CAP・重み按分、statGenConfig。

### 0.2 提供する API

| API | 用途 |
|-----|------|
| temperEquipment | 指定装備個体を鍛錬する。製造レシピの入力 × 倍率を消費し、CAP を [stats合計, 個体の capCeiling] でリロールして stats と statCap を更新。 |
| inheritEquipmentCap | 指定装備（対象）の statCap を、指定した別装備（消費）の statCap まで引き上げる。消費装備は削除。 |

------------------------------------------------------------------------

## 1. データ・スキーマ

### 1.1 EquipmentInstance の拡張

| カラム | 型 | 説明 |
|--------|-----|------|
| **statCap** | **Int, NOT NULL, default 0** | この個体の現在のステータス合計上限。製造時は rolled cap。継承で消費装備の statCap に更新。 |
| **capCeiling** | **Int, NOT NULL, default 0** | この個体が取り得る CAP の上限。鍛錬のリロール範囲の上限に使用（マスタの capMax は使わない）。製造時は config.capMax。継承で消費装備の capCeiling に更新。 |
| **inheritanceFailCount** | **Int, NOT NULL, default 0** | この装備を**対象**に継承を試みて失敗した連続回数。成功率 = min(100, 10 + inheritanceFailCount × 10)％。成功時に 0 にリセット。**装備個体ごと**。 |

- 鍛錬では「新 CAP ∈ [sum(stats), capCeiling]」でリロール。継承で 150→300 にした個体は capCeiling＝300 なので、次の鍛錬は 150～300。
- 既存データ：マイグレーションで statCap / capCeiling を 0 または種別から算出。inheritanceFailCount は 0。0 の場合は鍛錬・継承を不可とするか、表示上「不明」として扱う。

### 1.2 定数

- **TEMPER_MATERIAL_MULTIPLIER**（Int）：鍛錬時に消費する素材量 = 製造レシピ入力の amount × この値。初期値 2。
- **INHERIT_BASE_SUCCESS_RATE_PERCENT**（Int）：継承の初期成功率。10。
- **INHERIT_SUCCESS_RATE_INCREMENT**（Int）：継承失敗ごとの成功率加算。10。最大 100％。

------------------------------------------------------------------------

## 2. API: temperEquipment

### 2.1 入力

- **equipmentInstanceId**：鍛錬する装備個体 ID。セッションの userId に属し、**いずれのキャラにも装着されていない**こと。

### 2.2 検証

1. セッションあり・userId 取得。
2. 装備個体が存在し、userId が一致する。
3. 装備個体が CharacterEquipment のいずれにも紐づいていない（未装着）。
4. statCap > 0 かつ capCeiling > 0 であること（未設定個体は不可）。capCeiling >= sum(stats) であること（**sum(stats) ＝ capCeiling のときも鍛錬可能**。CAP は据え置きで重みの再抽選のみ）。
5. 当該 equipmentTypeId を出力とする CraftRecipe が 1 件以上存在する。複数ある場合は 1 つを採用（例：先頭）。
6. そのレシピの各 CraftRecipeInput について、ユーザーの所持数 ≥ amount × TEMPER_MATERIAL_MULTIPLIER。

### 2.3 処理

1. 上記レシピの入力について、amount × TEMPER_MATERIAL_MULTIPLIER を UserInventory から減算。
2. EquipmentType の statGenConfig（weights）を取得。**新 CAP** を **[sum(現在の stats), 個体の capCeiling]** で乱数（sum＝capCeiling のときはその 1 値＝重み再抽選のみ。マスタの capMax は使わない）。
3. その新 CAP を製造時と同じく**重みを乱数して**按分し、新 stats を算出。
4. EquipmentInstance の **stats と statCap** を更新する。**capCeiling は変更しない**。

### 2.4 出力

- 成功：更新後の装備個体情報（id, stats, statCap 等）。
- 失敗：エラーコード（UNAUTHORIZED / NOT_FOUND / EQUIPPED / STAT_CAP_INVALID / RECIPE_NOT_FOUND / INVENTORY）とメッセージ。

------------------------------------------------------------------------

## 3. API: inheritEquipmentCap

### 3.1 入力

- **targetEquipmentInstanceId**：上限を引き上げる装備（対象）。
- **consumeEquipmentInstanceId**：消費する装備（statCap が対象より高いもの）。

### 3.2 検証

1. セッションあり・userId 一致。
2. 対象・消費とも存在し、userId が一致する。
3. 対象 ≠ 消費（別個体）。
4. 対象・消費とも**未装着**（CharacterEquipment に紐づいていない）。
5. 対象の stats 合計 === 対象の **capCeiling**（対象装備は現在値が上限CAPに達していること）。
6. 消費の **capCeiling** > 対象の capCeiling（消費装備は上限CAPが対象より高ければよい。消費装備の現在値が上限CAPに達している必要はない）。

### 3.3 処理

1. **成功率判定**：成功率 = min(100, 10 + **対象装備**.inheritanceFailCount × 10)（％）。乱数で判定。
2. **失敗時**：対象装備は変更しない（**対象装備の inheritanceFailCount を +1** のみ）。**消費装備は削除する**（素材として消費した扱い）。戻り値で「継承に失敗しました。次の成功率は XX％です」等を返す。
3. **成功時**：対象の **statCap** を消費の statCap に、**capCeiling** を消費の capCeiling に更新。対象の stats は変更しない。消費装備を削除。**対象装備の inheritanceFailCount = 0** にリセット。

### 3.4 出力

- 成功：更新後の対象装備情報。対象の inheritanceFailCount は 0 にリセット済み。
- 失敗（確率）：`{ success: false, reason: "INHERIT_FAILED", nextSuccessRatePercent: 20 }` など。消費装備は削除済み（素材として消費）。対象装備の inheritanceFailCount は +1 済み。
- 失敗（検証エラー）：エラーコード（UNAUTHORIZED / NOT_FOUND / EQUIPPED / STAT_SUM_MISMATCH / CAP_NOT_HIGHER）とメッセージ。STAT_SUM_MISMATCH は「対象装備の現在値が上限CAPに達していない」。CAP_NOT_HIGHER は「消費装備の上限CAPが対象以下」。

------------------------------------------------------------------------

## 4. 製造フロー変更（046 との整合）

- executeCraft で装備個体を作成する際、**statCap = 生成時の cap（または sum(stats)）**、**capCeiling = statGenConfig.capMax** を EquipmentInstance に保存する。
- 既存の generateEquipmentStatsFromConfig を拡張して cap を返すか、作成後に statCap ＝ sum(stats)、capCeiling ＝ config.capMax を設定する。

------------------------------------------------------------------------

## 5. 実装場所（目安）

| 項目 | 場所 |
|------|------|
| statCap / capCeiling マイグレーション | prisma/schema.prisma, 新規マイグレーション |
| EquipmentInstance.inheritanceFailCount 追加 | statCap/capCeiling と同一マイグレーションで追加可 |
| 定数 TEMPER_MATERIAL_MULTIPLIER | src/lib/constants/craft.ts または equipment 用定数 |
| 鍛錬ロジック（CAP を [sum(stats), capCeiling] で乱数→按分） | src/lib/craft/equipment-stat-gen.ts に固定 cap で按分する関数を追加、または既存按分を流用 |
| temperEquipment / inheritEquipmentCap | src/server/actions/craft.ts または equipment.ts（新規） |
| UI（鍛錬・継承ボタン・モーダル） | 工房の鍛錬タブ・継承タブ（装備一覧・選択・実行） |

------------------------------------------------------------------------

## 6. 実装フェーズ

### Phase 1：スキーマ・製造フロー・定数

- **スキーマ**：EquipmentInstance に `statCap`, `capCeiling`, `inheritanceFailCount` を追加。マイグレーション作成・適用。
- **既存データ**：既存 EquipmentInstance のマイグレーション（statCap / capCeiling を 0 または種別から算出、inheritanceFailCount = 0）。
- **製造フロー**：executeCraft で装備作成時に statCap（＝生成時の cap または sum(stats)）と capCeiling（＝statGenConfig.capMax）を保存。generateEquipmentStatsFromConfig の拡張または作成後算出。
- **定数**：TEMPER_MATERIAL_MULTIPLIER, INHERIT_BASE_SUCCESS_RATE_PERCENT, INHERIT_SUCCESS_RATE_INCREMENT を定義（craft または equipment 用定数ファイル）。
- **確認**：既存の製造が statCap / capCeiling 付きで作成されること。既存個体は 0 の場合の表示・鍛錬/継承不可の扱いを決める。

### Phase 2：鍛錬

- **ロジック**：equipment-stat-gen に「固定 cap で重み按分」する関数を追加（または既存按分を流用）。鍛錬用に [sum(stats), capCeiling] で cap を乱数し、その cap で按分。
- **API**：temperEquipment(equipmentInstanceId) を実装。検証・素材消費・stats/statCap 更新。§2 に従う。
- **UI**：工房の鍛錬タブで、未装着の装備一覧を表示し、装備を選択して鍛錬実行ボタン。必要素材（製造レシピ×倍率）の表示。成功/失敗メッセージ。
- **確認**：鍛錬で stats/statCap が更新されること。sum＝capCeiling のときも重み再抽選で実行できること。

### Phase 3：継承

- **API**：inheritEquipmentCap(targetEquipmentInstanceId, consumeEquipmentInstanceId) を実装。検証・成功率判定・失敗時（対象の inheritanceFailCount +1、消費装備削除）・成功時（対象の statCap/capCeiling 更新・消費装備削除・inheritanceFailCount リセット）。§3 に従う。
- **UI**：工房の継承タブで、対象装備（上限まで振り切ったもの）と消費装備（対象より statCap が高いもの）を選択する UI。成功率の表示。実行ボタン。成功/失敗（確率）/検証エラーのメッセージ。
- **確認**：成功時に対象の statCap/capCeiling が更新され、失敗時は対象の inheritanceFailCount が増え消費装備が消えること。成功率が失敗ごとに上昇すること。
