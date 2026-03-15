# 研究メニュー：設備コスト拡張・設備設置上限拡張

研究メニューに「設備コスト拡張」と「設備設置上限拡張」を追加する。いずれも **研究記録書（User.researchPoint）** を消費して実行する。

---

## 1. 研究記録書の扱い（確認）

- **所持**: **User.researchPoint**（ユーザー単位の数値。アイテムではない）。
- **加算**: 開拓任務のクリア報告時、Quest.rewardResearchPoint を User.researchPoint に加算（`src/server/actions/quest.ts` の grantQuestRewards）。
- **消費**: 研究での解放（将来はレシピ解放でも使用可）および**本機能（設備コスト拡張・設置上限拡張）**で消費。

---

## 2. 設備コスト拡張（グループごと）

- **設定場所**: ResearchGroup に以下を追加。
  - **facilityCostExpansionLimit** (Int, default 0): このグループで可能な拡張回数。0 のときはこのグループではコスト拡張を行わない。
  - **facilityCostExpansionAmount** (Int, default 0): 1 回の拡張で増えるコスト上限（industrialMaxCost への加算量）。
  - **facilityCostExpansionResearchPoint** (Int, default 0): 1 回の拡張に必要な研究記録書の数。
- **利用条件**: その研究グループが「利用可能」（任務解放済み or ゲートなし）であること。グループ内のレシピ解放とは独立。
- **ユーザーごとの回数**: UserResearchGroupCostExpansion (userId, researchGroupId, count) で「そのグループで何回拡張したか」を記録。拡張実行時に count を +1 し、User.industrialMaxCost を +facilityCostExpansionAmount する。
- **表示**: 研究メニュー**上部**に「設備コスト拡張」として、利用可能なグループごとに「グループ名・現在回数/上限・1回あたり効果・必要研究記録書・実行ボタン」を表示。

---

## 3. 設備設置上限拡張（グループごと）

- **設定場所**: ResearchGroup に以下を追加（設備コスト拡張と同様にグループごと）。
  - **facilitySlotsExpansionLimit** (Int, default 0): このグループで可能な拡張回数。0 のときはこのグループでは設置上限拡張を行わない。
  - **facilitySlotsExpansionAmount** (Int, default 0): 1 回の拡張で増える設置枠数（industrialMaxSlots への加算量）。
  - **facilitySlotsExpansionResearchPoint** (Int, default 0): 1 回の拡張に必要な研究記録書の数。
- **ユーザーごとの回数**: UserResearchGroupSlotsExpansion (userId, researchGroupId, count) で「そのグループで何回拡張したか」を記録。拡張実行時に count を +1 し、User.industrialMaxSlots を +facilitySlotsExpansionAmount する。
- **表示**: 研究メニュー**上部**に「設備設置上限拡張」として、利用可能なグループごとに「グループ名・現在回数/上限・1回あたり効果・必要研究記録書・実行ボタン」を表示。設備コスト拡張の下、レシピ解放の上（順序: 1. 設備コスト拡張、2. 設備設置上限拡張、3. 解放されている研究）。

---

## 3.5 レシピ・設備解放時の研究記録書

- **ResearchGroupItem.requiredResearchPoint** (Int, default 0): その解放対象を解放するときに必要な研究記録書の数。
- **解放にはアイテムと研究記録書の両方が必須**。消費アイテム（ResearchUnlockCost が 1 件以上）と requiredResearchPoint > 0 の両方を満たす場合のみ解放可能。どちらかが未設定の場合は「解放にはアイテムと研究記録書の両方の設定が必要です。」とエラーにする。
- 管理画面（研究グループ編集の「解放対象」テーブル）で、行ごとに「研究記録書」列で必要数を設定可能。保存は「解放対象を保存」で ResearchGroupItem と一緒に保存される。

---

## 4. 研究メニュー画面レイアウト

1. **設備コスト拡張**: 利用可能な研究グループのうち、facilityCostExpansionLimit > 0 のグループを一覧。各グループで「〇回/△回拡張済み」「+X コスト/回」「研究記録書 Y 枚」「拡張する」ボタン。上限に達しているグループは「上限に達しています」表示。
2. **設備設置上限拡張**: 利用可能なグループごとに「グループ名・〇回/△回拡張済み」「+Z 枠/回」「研究記録書 W 枚」「拡張する」ボタン。上限に達したグループは「上限に達しています」表示。
3. **解放されている研究**: 既存の ResearchGroupList（グループ選択 → レシピ・設備解放一覧）。

---

## 5. API

- **getResearchMenu**: 既存の groups に加え、以下を返す。
  - **researchPoint**: ユーザーの所持研究記録書。
  - **facilityCostExpansions**: グループごとの設定（利用可能なグループのみ）とユーザーの現在回数。
  - **slotsExpansions**: グループごとの設置上限拡張の設定とユーザーの現在回数。
- **expandFacilityCost(researchGroupId)**: 指定グループで設備コストを 1 回拡張。条件・研究記録書不足時はエラー。
- **expandFacilitySlots(researchGroupId)**: 指定グループで設備設置上限を 1 回拡張。条件・研究記録書不足時はエラー。

---

## 6. 管理画面

- **研究グループ編集**（`/dashboard/admin/research-groups/[id]`）：グループ基本の下に「設備コスト拡張（spec/089）」と「設備設置上限拡張（spec/089）」の 2 セクション。各グループで facilityCostExpansion* と facilitySlotsExpansion* の 3 項目ずつを編集可能。manage/admin_research_group_edit.md 参照。
