# 設備の派生型（Variant）削除：影響範囲と対応方針

設備の「基本型／派生型」をテーブルで持つ方式をやめ、派生はレシピを増やして対応する形に変更するための影響範囲と対応メモ。

---

## 1. 変更方針

- **削除する概念**: 設備種別（FacilityType）に紐づく「型」（FacilityVariant）。基本型・派生型の区別と、型ごとの建設レシピ（FacilityConstructionRecipeInput）の「型」経由の紐づけ。
- **残す・変更する**: 建設に必要な資源は「設備種別 1 つにつき 1 セット」とする。FacilityVariant を廃止し、建設レシピを FacilityType に直接紐づける（後述のスキーマ案）。
- **研究の isVariant**: ResearchGroupItem.isVariant は**クラフトレシピ**用には残す（「派生型以外をすべて解放で次グループ解放」の判定など）。**設備（facility_type）**については派生型を廃止するため、設備対象の isVariant は常に false として扱う／表示から「派生型」を出さない。

---

## 2. スキーマ影響

| 対象 | 現状 | 対応 |
|------|------|------|
| **FacilityVariant** | 設備種別ごとに base / alpha / beta 等の型。1 型 : 1 建設レシピ。 | **削除**。 |
| **FacilityConstructionRecipeInput** | facilityVariantId で FacilityVariant に紐づく。 | **変更**: facilityTypeId に紐づける形に変更（FacilityType 1 につき 1 セット）。@@unique([facilityTypeId, itemId])。 |
| **FacilityInstance** | facilityTypeId, variantCode（'base' 等）。 | variantCode を**削除**するか、残しても常に無視（互換のためカラムだけ残す場合は default "base" のまま）。 |
| **FacilityType** | facilityVariants リレーション。 | facilityVariants を削除。建設レシピ用に facilityConstructionInputs 等のリレーションを追加（後述）。 |
| **ResearchGroupItem** | targetType, targetId, **isVariant**。 | **そのまま**。設備対象では isVariant は使わない（表示で「派生型」を出さない）。クラフトレシピ用には継続利用。 |

### 2.1 スキーマ変更案（要約）

- **FacilityVariant** モデルを削除。
- **FacilityConstructionRecipeInput** を次のいずれかに変更:
  - **案A**: facilityVariantId を facilityTypeId に変更し、FacilityType に直接リレーション。FacilityVariant を削除。
  - **案B**: 新テーブル名（例: FacilityTypeConstructionInput）にして facilityTypeId のみで FacilityType に紐づける。
- **FacilityInstance**: variantCode カラムを削除（マイグレーションで削除）、または残して参照しない。
- **FacilityType**: facilityVariants を削除し、constructionInputs（案A/B に合わせた名前）を 1 対多で持つ。

---

## 3. コード・機能の影響一覧

### 3.1 Prisma・DB

| ファイル／対象 | 内容 |
|----------------|------|
| prisma/schema.prisma | FacilityVariant 削除。FacilityConstructionRecipeInput の FK を facilityTypeId に変更。FacilityInstance から variantCode 削除（または残置）。FacilityType の facilityVariants 削除、建設レシピ用リレーション追加。 |
| prisma/seed.ts | FacilityVariant 作成を行っている場合は削除し、建設レシピは FacilityType 直下に作成。 |
| prisma/migrate-river-mountain-names.ts | FacilityVariant を参照。設備派生型廃止後は不要になるか、スクリプトから該当処理を削除。 |
| prisma/migrate-remove-suisou.ts | FacilityVariant / FacilityConstructionRecipeInput を参照。同様に削除または修正。 |
| prisma/sync-masters-to-target.ts | "facilityVariant" を同期対象から削除。 |

### 3.2 Server Actions

| ファイル | 内容 |
|----------|------|
| src/server/actions/facilities-placement.ts | getConstructionRecipe(facilityTypeId, variantCode) → facilityTypeId のみで取得する形に変更。placeFacility の variantCode 引数を削除し、建設レシピは FacilityType 直下から取得。FacilityInstance 作成時の variantCode を削除または固定値で保存しない。 |
| src/server/actions/initial-area.ts | FacilityInstance 作成時の variantCode: "base" を削除（カラム削除時）またはそのまま（残置時）。 |
| src/server/actions/admin.ts | getAdminFacilityTypeList の facilityVariants 取得・AdminFacilityVariantWithInputs を削除。建設レシピは FacilityType 直下の 1 セットとして取得・保存。updateAdminFacilityConstructionInputs(facilityTypeId, variantCode, ...) → facilityTypeId のみの API に変更。createAdminFacilityVariantBase を削除。設備種別作成時（createAdminFacilityType 等）の FacilityVariant 作成を削除し、必要なら FacilityType 用建設レシピを 1 セット作成。 |

### 3.3 管理画面（Admin）

| ファイル | 内容 |
|----------|------|
| src/app/dashboard/admin/facilities/[id]/admin-facility-type-edit-form.tsx | 「型」ごとのタブ／型選択を削除。建設材料は「この設備種別の建設レシピ 1 セット」のみ編集。createAdminFacilityVariantBase、updateAdminFacilityConstructionInputs(variantCode) の利用をやめ、FacilityType 直下の建設レシピ 1 セットの取得・保存に変更。 |

### 3.4 研究・研究グループ

| ファイル | 内容 |
|----------|------|
| src/server/actions/research.ts | ResearchGroupItemSummary.isVariant はそのまま（クラフトレシピ用）。変更なし。 |
| src/app/dashboard/research/research-group-list.tsx | 解放対象の「派生型」表示は targetType === "craft_recipe" のときのみ表示するようにする（設備では出さない）。 |
| src/app/dashboard/admin/research-groups/[id]/admin-research-group-edit-form.tsx | 解放対象が facility_type のときは「派生型」チェックを非表示または無効化（保存時は false）。 |

### 3.5 その他

| ファイル | 内容 |
|----------|------|
| src/app/dashboard/facilities/*（設備建造 UI） | 型選択が無ければ変更不要。variantCode を渡している場合は facilityTypeId のみに変更。 |

---

## 4. ドキュメント・仕様の更新

| ファイル | 対応 |
|----------|------|
| docs/017_facility_variant_and_rare_parts.md | 派生型のテーブル・型選択の記述を削除または「廃止。レシピ増設で対応」と明記。 |
| docs/018_facility_placement_areas.md | 型（基本型／派生型）の記述を削除または簡略化。 |
| docs/08_database_schema.md | FacilityVariant 削除、FacilityConstructionRecipeInput の facilityType 直結、FacilityInstance の variantCode 削除を反映。 |
| docs/054_quest_and_research_design.md | 研究グループの「派生型」の説明を、設備では使わずクラフトレシピ用のみと明記。 |
| docs/026_user_inventory_and_items.md | 設備派生型・設計図の記述を必要に応じて修正。 |
| spec/047_research_unlock_construction.md | FacilityVariant 廃止、建設レシピは FacilityType 1 対 1 に変更と明記。 |
| manage/ROADMAP_1_3_MONTHS.md | 派生型まわりの見直し方針を「設備は派生型テーブル廃止済み」に更新。 |
| manage/admin_research_group_edit.md | facility_type の isVariant は使わない旨を追記。 |
| manage/admin_master_edit_overview.md | 設備型（Variant）の記述を削除または更新。 |

---

## 5. データ移行（マイグレーション）

1. **FacilityConstructionRecipeInput の移行**  
   既存の FacilityVariant のうち variantCode = 'base' の行に対して、その constructionInputs を「FacilityType 直下の建設レシピ」として移す。  
   - 新テーブル／新カラムが facilityTypeId を持つ場合: 既存の facilityVariantId から facilityTypeId を経由してコピー。  
   - 同一 facilityTypeId に複数型がある場合は base のみ移行し、alpha/beta 等は捨てる（運用で「基本型のみ」にしておく前提）。
2. **FacilityInstance**  
   variantCode カラムを削除するマイグレーションでは、既存行はそのまま（もともと base のみ運用なら実質影響なし）。
3. **FacilityVariant 削除**  
   上記移行後に FacilityVariant を削除。

---

## 6. 実装順序の提案

1. 上記ドキュメント・仕様の更新（方針の確定）。
2. スキーマ変更: FacilityConstructionRecipeInput を facilityTypeId に変更、FacilityVariant 削除、FacilityInstance.variantCode 削除（または残置）。
3. データ移行スクリプト: base の建設レシピを FacilityType 直下にコピー。
4. facilities-placement.ts / initial-area.ts / admin.ts の修正。
5. 管理画面の設備種別編集を「1 設備 1 建設レシピ」に変更。
6. 研究 UI で設備対象の「派生型」表示を出さないようにする。
7. 既存の migrate / sync スクリプトから FacilityVariant 参照を削除または修正。
8. docs/017 をはじめとする参照ドキュメントの更新。

---

## 7. 参照

- 現状の型マスタ: spec/047_research_unlock_construction.md §3.1 FacilityVariant
- 設備配置: docs/018_facility_placement_areas.md
- 研究グループ: docs/054_quest_and_research_design.md §4.3.1
