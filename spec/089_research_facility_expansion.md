# Spec: 研究メニュー 設備コスト拡張・設備設置上限拡張

`docs/089_research_facility_expansion.md` に基づく。研究記録書（User.researchPoint）を消費して、設備コスト上限・設備設置枠数を拡張する。

------------------------------------------------------------------------

## 1. データ

- **ResearchGroup** 追加: facilityCostExpansionLimit, facilityCostExpansionAmount, facilityCostExpansionResearchPoint。同様に facilitySlotsExpansionLimit, facilitySlotsExpansionAmount, facilitySlotsExpansionResearchPoint（いずれも Int, default 0）。グループごと。
- **UserResearchGroupCostExpansion**: userId, researchGroupId, count。グループごとのコスト拡張回数。
- **UserResearchGroupSlotsExpansion**: userId, researchGroupId, count。グループごとの設置上限拡張回数。

拡張実行時: コスト拡張は UserResearchGroupCostExpansion の count を +1 し、User.industrialMaxCost を +amount。スロット拡張は UserResearchGroupSlotsExpansion の count を +1 し、User.industrialMaxSlots を +amount。いずれも User.researchPoint を必要数減算。

------------------------------------------------------------------------

## 2. API

| API | 用途 |
|-----|------|
| getResearchMenu | 既存に加え researchPoint, facilityCostExpansions, slotsExpansions を返す。 |
| expandFacilityCost(researchGroupId) | 指定グループで設備コストを 1 回拡張。研究記録書を消費。 |
| expandFacilitySlots(researchGroupId) | 指定グループで設備設置上限を 1 回拡張。研究記録書を消費。 |

------------------------------------------------------------------------

## 3. 画面

- 研究メニュー（/dashboard/research）の**上部**に、1. 設備コスト拡張（利用可能グループごと）、2. 設備設置上限拡張（利用可能グループごと）、を表示。その**下**に既存の「解放されている研究」（グループ・レシピ解放一覧）。

------------------------------------------------------------------------

## 4. 研究記録書

- **所持**: User.researchPoint（アイテムではない）。開拓任務の報酬で加算（spec/054、quest.ts の grantQuestRewards）。
