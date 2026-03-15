# 遺物の調律

遺物の「パッシブ以外」のステータス（基礎ステ補正・属性耐性）をリロールする機能。工房の鑑定タブで行う。

## 1. 目的

- 所持遺物の **statBonus1 / statBonus2 / attributeResistances** を再抽選する。
- **パッシブ効果（relicPassiveEffectId）は変更しない**。遺物型（relicTypeId）も変更しない。
- コストは **遺物の欠片（relic_shard）77個**（定数で管理）。

## 2. 仕様

### 2.1 コスト

- **RELIC_TEMPER_SHARD_COST** = 77（`src/lib/constants/relic.ts`）
- 調律ボタン押下時に 77 個消費。取消時は 77 個を返却する。

### 2.2 リロール範囲

- 遺物の **RelicType.groupCode** に紐づく **RelicGroupConfig** の min/max を使用（鑑定と同じ）。
- DB に設定が無い場合は `RELIC_GROUP_APPRAISAL_CONFIG[groupCode]` のフォールバックを使用。groupCode が null の遺物は `group_a` 相当で扱う。

### 2.3 フロー

1. **調律準備**  
   遺物1行に「調律準備」ボタン。未装着の遺物のみ表示可能。
2. **モーダルを開く**  
   現在のステータス（before）と、必要コスト（遺物の欠片 77個）を表示。「調律」ボタンで実行。
3. **調律**  
   - 「本当に実行しますか？」で確認。実行した時点で遺物の欠片を 77 個消費（確定・取消に関わらず戻らない）。
   - リロール結果（after）を生成し、**一時保存**（RelicTemperPending）。RelicInstance はまだ更新しない。
   - モーダルに「調律前」「調律後」を表示し、「調律確定」「調律取消」を表示。
4. **調律確定**  
   RelicInstance の statBonus1 / statBonus2 / attributeResistances を after で上書き。RelicTemperPending を削除。
5. **調律取消**  
   RelicTemperPending を削除するのみ。遺物の欠片は返却しない。遺物のステータスは変更しない。

### 2.4 永続化（調律待ち）

- **RelicTemperPending**（1ユーザー・1遺物あたり1件）
  - userId, relicInstanceId（unique）、newStatBonus1, newStatBonus2, newAttributeResistances, createdAt
- 調律実行時に作成。確定または取消で削除。
- モーダルを開いたときに「この遺物に未確定の調律結果がある」場合は、その結果を表示し、確定/取消のみ選ばせる（調律ボタンは出さない）。

## 3. API

| API | 説明 |
|-----|------|
| getRelicTemperPending(relicInstanceId) | 指定遺物の未確定調律結果があれば返す（before/after 用の現在値＋pending の after）。 |
| startRelicTemper(relicInstanceId) | 77個消費し、リロール結果を RelicTemperPending に保存。before/after を返す。 |
| confirmRelicTemper(relicInstanceId) | Pending を RelicInstance に反映し、Pending 削除。 |
| cancelRelicTemper(relicInstanceId) | 77個返却し、Pending 削除。 |

## 4. UI

- 工房に**調律**タブを追加。鑑定タブと同様の所持遺物一覧を表示し、**未装着**の遺物の行に「調律準備」ボタンのみ表示（分解は鑑定タブで行う）。
- 調律準備モーダル：必要数（77）・所持数・調律ボタン。調律後は「リロール前」「リロール後」のステータス表示と「調律確定」「調律取消」。

## 5. spec/051 との関係

- spec/051 に「遺物の調律」API と UI を追記する。
