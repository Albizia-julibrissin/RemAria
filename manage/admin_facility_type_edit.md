# 設備種別編集（管理者用）

FacilityType の name / kind / description / cost の編集・新規作成に加え、**削除**と**建設材料（FacilityTypeConstructionInput）の編集**が可能。docs/078 により設備派生型は廃止し、1 設備種別につき 1 建設レシピ。

- **Spec 正本**: spec/035（初期エリア・設備）、spec/047（研究・解放・建設）、docs/018（設備コスト）。
- **実装**: `src/server/actions/admin.ts`（API）、`src/app/dashboard/admin/facilities/`（一覧・新規・編集画面）。

---

## 1. 目的・前提

- **目的**: 運用中に設備種別の表示名・種別・説明・設置コストを変更・追加できるようにする。加えて、設備**削除**（参照がある場合は不可）と、設備を**建設するときに必要な材料**の編集が可能。
- **前提**: 対象は **テストユーザー1** でログインしている場合のみ。既存設備の編集・削除・建設材料の編集が可能。

---

## 2. 画面・操作

| 項目 | 内容 |
|------|------|
| **一覧 URL** | `/dashboard/admin/facilities`。テーブルで全設備種別を表示。「新規作成」ボタンあり。 |
| **新規作成 URL** | `/dashboard/admin/facilities/new`。新規登録フォーム。作成成功後は編集画面へ遷移。 |
| **編集 URL** | `/dashboard/admin/facilities/[id]`。1件編集フォーム＋建設材料（1 セット）＋削除。 |
| **入口** | 実装済み一覧（`/dashboard/admin/content`）の「設備種別編集」リンク。 |
| **操作** | 一覧で「新規作成」→ 入力 → 「作成」。または一覧で「編集」→ 基本項目を変更 → 「保存」。編集画面で「建設材料」を変更 → 「建設材料を保存」。削除する場合は「この設備種別を削除する」→ 確認後「削除する」。 |

---

## 3. API（Server Actions）

いずれも `src/server/actions/admin.ts`。テストユーザー1のみ。

| 関数名 | 役割 |
|--------|------|
| `getAdminFacilityTypeList()` | 全 FacilityType 一覧（id, name, kind, description, cost）。 |
| `getAdminFacilityType(facilityTypeId)` | 1件取得（基本項目のみ）。 |
| `getAdminFacilityTypeWithConstruction(facilityTypeId)` | 1件取得（基本項目＋建設材料 1 セット）。編集画面で使用。 |
| `updateAdminFacilityType(facilityTypeId, input)` | 1件更新。input: name, kind, description, cost。 |
| `createAdminFacilityType(input)` | 新規作成。input は update と同様。成功時は `{ success: true, facilityTypeId }`。name の重複時はエラー。 |
| `deleteAdminFacilityType(facilityTypeId)` | 削除。参照がある場合は `{ success: false, error }`。 |
| `updateAdminFacilityConstructionInputs(facilityTypeId, inputs)` | この設備種別の建設材料を置き換え。inputs: `{ itemId, amount }[]`。 |

- **削除不可条件**: 設置済み（FacilityInstance）・解放済みユーザー（UserFacilityTypeUnlock）・研究解放に紐づき（ResearchGroupItem / ResearchUnlockCost）のいずれかがある場合は削除できず、エラーメッセージを返す。
- **建設材料**: 1 設備種別につき 1 セット（FacilityTypeConstructionInput）。同一種別内で itemId はユニーク。amount は 1 以上。機工区の設備設置では `getConstructionRecipe` / `placeFacility` が都度 DB を参照するため、管理画面で変更した内容は設置画面に即反映される。

---

## 4. データ構造（参照）

- **FacilityType**: id, name（ユニーク）, kind, description?, cost。schema は `prisma/schema.prisma`。
- **FacilityTypeConstructionInput**: facilityTypeId, itemId, amount。建設時に消費するアイテム（1 設備種別 1 レシピ、docs/078）。
- 設備生産レシピ（Recipe / RecipeInput）は「設備生産レシピ編集」で別管理。

---

## 5. 削除できない代表例と理由

| 設備名 | 消せない主な理由 |
|--------|------------------|
| **川探索** | spec/035 の**初期強制配置 5 設備**のひとつ。全テストユーザーに「設置済み」として FacilityInstance が作られるため、**設置済みのため削除できません** となる。 |
| **山探索** | 研究グループ「錆びれた森林研究」の**解放対象**（ResearchGroupItem）および**解放コスト**（ResearchUnlockCost）に紐づいているため、**研究解放に紐づいているため削除できません** となる。 |

- 山探索を削除したい場合: 先に**研究グループ編集**で「錆びれた森林研究」から山探索を解放対象・コスト対象から外す必要がある。
- 川探索はゲーム仕様上、新規ユーザーに必ず配置される設備のため、運用では削除しない想定（`src/lib/constants/initial-area.ts` の INITIAL_FACILITY_NAMES を変更する場合は、既存ユーザーの設置データやシードとの整合を別途検討する）。

---

## 6. 運用メモ

- name の変更は可能。他テーブルで name をキーにしている場合は注意。
- 新規作成時は name の重複チェックを行う。既存の name と被る場合は「この name は既に使用されています。」とエラーになる。
- 機工区の設備設置画面（`/dashboard/facilities`）は、必要資源を `getConstructionRecipe` で都度取得し、`placeFacility` でも DB の建設材料を参照して在庫消費するため、管理画面で建設材料を変更すると次回以降の設置から反映される。
- 似た名前の設備が 2 つある場合、重複した方を消したいときは上記「5. 削除できない代表例」を参照し、研究解放の紐づけを外してから削除する。
- **川探索拠点／山探索拠点 → 川探索／山探索 に統一したい（DB は残す）**: 1 回だけ `npx tsx prisma/migrate-river-mountain-names.ts` を実行する。参照を移行してから旧名の設備種別を削除する。詳細は `prisma/migrate-river-mountain-names.ts` の先頭コメント参照。
- **貯水槽を削除したい**: 1 回だけ `npx tsx prisma/migrate-remove-suisou.ts` を実行する。研究・設置・解放・レシピ等の参照を削除してから設備種別を削除する。seed からも貯水槽は外してある。
