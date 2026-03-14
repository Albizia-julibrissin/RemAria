# 084: 装備の鍛錬と継承

装備製造後に、**鍛錬**（ステータスの再抽選）と**継承**（CAP 上限の引き上げ）の 2 機能を追加する設計。  
docs/021・053・spec/046 の装備製造（CAP 範囲＋重み按分）を前提とする。

---

## 1. 現状の整理

- **製造時**：装備種別の statGenConfig（capMin～capMax、採用ステと重み範囲）に従い、CAP を 1 値乱数し、重みで按分して戦闘用ステ加算値を決定（equipment-stat-gen.ts）。
- **保存**：EquipmentInstance には **stats（JSON）のみ**保存。製造時に決まった「この個体のステータス合計上限（CAP）」は **保存していない**。
- 鍛錬・継承を実装するには、個体ごとに **(1) 現在のステ合計上限（statCap)** と **(2) この個体が取り得る上限の上限（capCeiling）** の 2 つを持つ必要がある。継承で上限を 150→300 に上げた場合、次の鍛錬は 150～**300** でやりたいので、**マスタの capMax ではなく個体の上限 CAP を保持する**。

---

## 2. 鍛錬（たんれん）

### 2.1 定義

- **鍛錬**：対象装備の**現在のステ合計（sum(stats)）を下限**、**その個体の上限 CAP（capCeiling）を上限**として **CAP を再度リロール**し、その新 CAP を重みで按分してステータスを更新する。鍛錬の上限は**マスタの capMax ではなく、個体が持つ capCeiling** を使う。
- 例（製造直後）：レシピが鉄の剣で CAP 50～100、ある個体が製造時に CAP 75 でできた場合、capCeiling＝100。鍛錬では **CAP を 75～100 の範囲でリロール**する。
- 例（継承後）：継承で statCap を 150→300 に上げた個体は capCeiling＝300。次の鍛錬では **CAP を 150～300 の範囲でリロール**する（マスタが 50～100 でも、この個体の上限は 300 なので 150～300）。
- **現在値＝上限（sum(stats)＝capCeiling）のときも鍛錬可能**。この場合は CAP は変わらないが、**重みの再抽選**によりステの配分だけが振り直される（例：PATK 偏重→PDEF 寄りに変えるなど）。

### 2.2 条件・前提

- 対象は**装備個体 1 つ**（EquipmentInstance）。
- 対象は**未装着**であること（装着中は鍛錬不可とするか、外してから可能とするかは運用で決定。実装では未装着を条件にすると安全）。
- 同一種別の**製造レシピ**が存在し、その**入力素材**を所持していること。

### 2.3 消費

- **製造時の素材の N 倍**を消費する。N は**定数**で持つ（例：`TEMPER_MATERIAL_MULTIPLIER = 2` → 製造素材の 2 倍）。
- 参照するレシピ：対象装備の equipmentTypeId を出力とする CraftRecipe のいずれか 1 つ（通常は 1 対 1）。そのレシピの CraftRecipeInput の各 itemId について、amount × N を消費する。

### 2.4 処理内容

1. 対象装備の **stats 合計**・**capCeiling** と、EquipmentType の statGenConfig（weights）を取得。
2. **新 CAP** を範囲 **[sum(現在の stats), 個体の capCeiling]** で乱数。sum＝capCeiling のときはその 1 値のみ（CAP は据え置き、重みの再抽選のみ）。
3. その新 CAP を、製造時と同じロジックで**重みを乱数して**按分し、新 stats を算出。
4. EquipmentInstance の **stats と statCap の両方**を更新する。**capCeiling は変更しない**。

### 2.5 スキーマ・データの影響

- 鍛錬では **statCap も更新する**（リロールした新 CAP に）。stats も新 CAP に基づいて再計算。**capCeiling は触らない**（鍛錬では個体の上限は変わらない）。
- 製造レシピ（CraftRecipe）を equipmentTypeId で引ける必要がある（既存の outputEquipmentTypeId で検索可能）。

---

## 3. 継承（けいしょう）

### 3.1 定義

- **継承**：**より高い statCap を持つ装備 1 個**を消費し、対象装備の**ステータス合計上限（statCap）そのものを引き上げる**機能。
- 消費した装備の statCap が対象より高ければ、対象の statCap を「消費装備の statCap」まで引き上げる。
- **成功率**：**初期 10％**。失敗するたびに **10％ずつ上昇**（2 回目 20％、3 回目 30％…最大 100％）。成功時にリセット。成功率は**対象装備ごと**に保持する（その装備で継承を試みるたびに、その装備の失敗回数に応じて成功率が決まる）。

### 3.2 条件・前提

- **対象装備**：継承で上限を上げる側。**現在値（stats 合計）が上限CAP（capCeiling）に達している**未装着装備のみ選択可能。
- **消費装備**：対象装備より **上限CAP（capCeiling）が高い**装備 1 個。同一ユーザー所有。未装着であること。**上限CAPが対象より高ければよく、消費装備の現在値が上限CAPに達している必要はない**。
- 対象・消費とも**未装着**とする（装着中は継承不可）。

### 3.3 処理内容

1. 対象の stats 合計と statCap が一致するか検証。不一致ならエラー。
2. 消費装備の statCap が対象の statCap より大きいか検証。そうでなければエラー。
3. **成功率判定**：**対象装備**の継承失敗回数に基づく成功率（初期 10％、失敗回数 × 10％を加算、最大 100％）で乱数。
4. **失敗時**：対象装備は**そのまま**（statCap・capCeiling・stats は変更しない）。**対象装備の継承失敗回数を +1**。**消費装備は削除する**（素材として消費した扱い）。
5. **成功時**：対象装備の **statCap** を消費装備の statCap に、**capCeiling** を消費装備の capCeiling に更新。対象の stats はそのまま。消費装備を削除。**対象装備の継承失敗回数を 0 にリセット**。

### 3.4 スキーマ・データの影響

- 成功時：対象の **statCap と capCeiling を更新**。stats は変更しない。消費装備は **削除**（DELETE）。
- 失敗時：**対象装備**は変更しない（継承失敗回数のみ +1）。**消費装備は削除する**（素材として消費した扱い）。

---

## 4. スキーマ変更（共通）

### 4.1 EquipmentInstance の拡張（statCap, capCeiling, inheritanceFailCount）

- **statCap**（Int, NOT NULL）：その装備個体の**現在のステータス合計上限**（＝振り切ったときの合計。stats の合計と一致している状態が「上限まで振り切っている」）。
  - 製造時：乱数で決めた CAP を保存（sum(stats) と等しい）。
  - 継承後：消費装備の statCap に更新する。stats はそのままなので、継承直後は stats 合計 ＜ statCap になりうる。
- **capCeiling**（Int, NOT NULL）：その装備個体が**取り得る CAP の上限**。鍛錬でリロールするときの**上限**に使う（マスタの capMax は使わない）。
  - 製造時：**config.capMax** を保存する（この個体の上限はマスタの capMax まで）。
  - 継承後：消費装備の capCeiling に更新する。継承で 150→300 にしたら capCeiling＝300 になり、次の鍛錬は [現在合計, 300] でリロールできる。
- **inheritanceFailCount**（Int, NOT NULL, default 0）：その装備を**対象**に継承を試みて失敗した連続回数。**装備個体ごと**。継承試行時の成功率 ＝ **min(100, 10 + 対象装備.inheritanceFailCount × 10)**（％）。成功時に対象の inheritanceFailCount を 0 にリセット、失敗時に対象の inheritanceFailCount を +1。
- 既存個体への対応：**既存の EquipmentInstance には stats のみ**なので、マイグレーションで `statCap = 0`, `capCeiling = 0`, `inheritanceFailCount = 0` または「statCap = sum(stats), capCeiling = マスタの capMax（種別から取得）」などを設定。0 の場合は鍛錬・継承不可とするか、表示上「不明」として扱う。

### 4.2 製造フローの変更

- 製造時：CAP を [capMin, capMax] で乱数し、重み按分で stats を決定。EquipmentInstance 作成時に **statCap = その CAP（または sum(stats)）**、**capCeiling = config.capMax** を保存する。
- 生成関数は `{ stats, cap }` を返すように拡張するか、作成後に statCap ＝ sum(stats)、capCeiling ＝ config.capMax を設定する。

### 4.3 定数

- **鍛錬時の素材倍率**：`TEMPER_MATERIAL_MULTIPLIER`（例：2）。`src/lib/constants/craft.ts` または equipment 用の定数ファイルに定義する。
- **継承の成功率**：初期 `INHERIT_BASE_SUCCESS_RATE_PERCENT = 10`（％）。失敗ごとに `INHERIT_SUCCESS_RATE_INCREMENT = 10`（％）加算、最大 100％。成功率 ＝ min(100, 10 + inheritanceFailCount × 10)。

---

## 5. 他仕様との接続

| 仕様 | 接続内容 |
|------|----------|
| docs/021, 053, spec/046 | 装備製造の CAP・重み按分。鍛錬は CAP を [stats合計, 個体の capCeiling] でリロールし、同様に重み按分（マスタの capMax は製造時のみ。鍛錬は個体の capCeiling を使用）。 |
| CraftRecipe / CraftRecipeInput | 鍛錬時の素材消費は「出力が当該 EquipmentType のレシピ」の入力 × 倍率。 |
| EquipmentType.statGenConfig | 鍛錬時の採用ステ・重み範囲の参照元。 |

---

## 6. 実装時の注意

- 鍛錬は「CAP を [sum(stats), 個体の capCeiling] で乱数し、その cap で重み按分」する。マスタの capMax は参照しない。equipment-stat-gen に、cap を引数で受け取り按分のみ行う関数を追加するか、既存の按分ロジックを流用する。
- 継承は「対象の stats 合計 === statCap」の判定を厳密に行う（浮動小数点を避け、整数合計で比較）。
- 装着中の装備を鍛錬・継承対象から外す場合、先に unequip させる必要があることを UI で案内する。

---

## 7. 更新履歴

- 初版：鍛錬・継承の要件、条件、消費、スキーマ（statCap）、製造フロー変更、定数を追加。
- 鍛錬の解釈修正：CAP を「現在の statCap～capMax」でリロールし、その新 CAP で重み按分し直す。statCap も更新。読みを「たんれん」に統一。
- 個体に上限 CAP（capCeiling）を追加：鍛錬の上限はマスタの capMax ではなく個体の capCeiling を使う。継承で 150→300 にしたら次の鍛錬は 150～300 で行うため。製造時は capCeiling＝config.capMax、継承時は capCeiling＝消費装備の capCeiling。
- 鍛錬：現在値＝上限（sum＝capCeiling）のときも実行可能。重みの再分配のみ。継承：成功率 10％、失敗ごとに +10％。対象装備ごとに inheritanceFailCount を保持。失敗時も消費装備は消費（削除）する。
