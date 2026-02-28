# Spec: 作戦スロットの戦闘時評価（行動決定）

作戦スロットに沿って「そのターンに何をするか」を決める処理の仕様。  
実装時は本 spec と `docs/14_battle_attributes_tactics.md` 6.2～6.6 を合わせて参照する。

------------------------------------------------------------------------

## 0. 目的

- **入力**：行動者（味方 1 人）、そのキャラの作戦スロット 10 件、**戦闘コンテキスト**。
- **出力**：採用する行動（`normal_attack` または `skill` + skillId）。不発は「行動決定後に MP チェック」で別扱い（spec/038）。
- 本 spec は「**どの条件をどう評価するか**」と「**主語の解決**」を定義し、実装の抜け漏れを防ぐ。

------------------------------------------------------------------------

## 1. 評価フロー（概要）

1. 行動者の TacticSlot を **orderIndex の昇順**で並べる。
2. 先頭から順に、**条件を評価**する（下記 3～5）。
3. **最初に true になったスロットの行動**を採用する（actionType + skillId）。
4. **いずれも true にならなかった**場合は **通常攻撃**とする。
5. 採用した行動がスキルの場合、**発動時に MP 不足なら不発**（次スロットにはフォールバックしない）。

------------------------------------------------------------------------

## 2. 戦闘コンテキスト（評価の入力）

条件評価時に参照する「今の戦闘状態」を **TacticEvaluationContext** とする。実装で持つべき最小限は次のとおり。

| 項目 | 型・内容 | 用途 |
|------|----------|------|
| **cycle** | number | 現在サイクル番号（1 始まり）。cycleIsEven, cycleIsMultipleOf, cycleAtLeast 用。 |
| **turnIndexInCycle** | number | 本サイクル内で何番目に行動するか（1 始まり）。turnOrderInRange 用。 |
| **actorPartyIndex** | number | 行動者が味方パーティの何番目か（0～2）。主語「自分」の解決用。 |
| **party** | 味方 1 体あたり { currentHp, maxHp, currentMp, maxMp, attrStates[], debuffs[] } の配列（長さ 1～3） | HP/MP 閾値・属性状態・状態異常の評価用。 |
| **enemies** | 敵 1 体あたり { currentHp, maxHp, attrStates[] } の配列（長さ 3）、および生存フラグ | HP 閾値・属性状態・「正面の相手」の解決用。 |
| **partyPositions** | 味方の位置（row, col）の配列 | front_enemy の解決用（自分の row と同じ敵のうち、列が一番前の生存者）。 |
| **enemyPositions** | 敵の位置（row, col）の配列 | 上記同上。 |

※ 属性状態（attrStates）・状態異常（debuffs）のデータ構造は、属性状態・状態異常の仕様に合わせて定義する。本 spec では「指定の属性が含まれるか」「デバフが 1 つでもあるか」だけ参照できればよい。

------------------------------------------------------------------------

## 3. 主語の解決（subject → 対象のリスト）

条件は「主語で指定された対象」の状態を見る。主語から **評価対象のユニットのリスト** を求める。

| subject（コード） | 意味 | 解決結果（対象のリスト） |
|-------------------|------|---------------------------|
| **self** | 自分 | 行動者 1 人のみ。party[actorPartyIndex] に対応する 1 要素のリスト。 |
| **any_ally** | 味方のいずれか | 生存している味方全員（party の生存者）。 |
| **any_enemy** | 相手のいずれか | 生存している敵全員（enemies の生存者）。 |
| **front_enemy** | 正面の相手 | 行動者と同じ row にいる敵のうち、列が一番前（col が最小）の生存者 1 体。いなければ空リスト。 |

- **条件の意味**：「対象のリストのうち、**少なくとも 1 体**が条件を満たせば true」とする（any 系）。  
  - 単体（self / front_enemy で 1 体）の場合は、その 1 体について条件が成り立てば true。

------------------------------------------------------------------------

## 4. 条件種別（conditionKind）と conditionParam

各スロットの conditionKind と conditionParam（JSON）に応じて、**真偽を 1 つ**返す。  
主語で得た「対象のリスト」の各要素に対して条件を適用し、**いずれか 1 体でも満たせば true** とする（上記 3 の any の解釈と一致）。

### 4.1 常に成立

| conditionKind | conditionParam | 評価 |
|---------------|----------------|------|
| **always** | 不要（無視してよい） | 常に **true**。 |

※ UI では「常に」を選んだとき conditionKind = "always" で保存する。

### 4.2 HP・MP 閾値

主語で得た対象それぞれについて、`currentHp / maxHp` または `currentMp / maxMp` を計算する。**対象のうち 1 体でも**条件を満たせば true。

| conditionKind | conditionParam | 意味 |
|---------------|----------------|------|
| **hp_below_percent** | `{ "percent": number }`（10～90 の 10 刻み推奨） | その対象の HP 割合が percent 以下なら true。 |
| **hp_above_percent** | 同上 | その対象の HP 割合が percent 以上なら true。 |
| **mp_below_percent** | 同上 | その対象の MP 割合が percent 以下なら true。（敵は MP 未定義の場合は false） |
| **mp_above_percent** | 同上 | その対象の MP 割合が percent 以上なら true。 |

- maxHp / maxMp が 0 の場合は割合を 0 として扱うか、条件不成立とするかは実装で統一する（推奨：0 として扱い、hp_above_percent なら false、hp_below_percent なら true）。

### 4.3 主語が特定の属性状態

| conditionKind | conditionParam | 意味 |
|---------------|----------------|------|
| **subject_has_attr_state** | `{ "attr": string }`（crush / slash / pierce / burn / freeze / corrode / polarity / none） | 主語で得た対象のうち、**少なくとも 1 体**が指定の属性状態を持っていれば true。 |

※ 敵・味方とも「属性状態」は戦闘中の一時データ（仕様では 2 サイクル持続など）。実装では各ユニットの attrStates に指定 attr が含まれるかで判定する。

### 4.4 自分が状態異常（デバフ）

| conditionKind | conditionParam | 意味 |
|---------------|----------------|------|
| **self_has_debuff** | 不要（主語は常に自分として扱う） | 行動者本人が、デバフ効果を持つ状態異常を **1 つでも**持っていれば true。 |

※ 主語は subject を無視し、常に「自分」とする。状態異常の一覧は別仕様に依存する。

### 4.5 サイクル

主語は不要。コンテキストの cycle のみで判定する。

| conditionKind | conditionParam | 意味 |
|---------------|----------------|------|
| **cycle_is_even** | 不要 | 現在サイクルが偶数なら true（2, 4, 6, ...）。 |
| **cycle_is_multiple_of** | `{ "n": number }`（例: 3） | 現在サイクルが n の倍数なら true。 |
| **cycle_at_least** | `{ "n": number }` | 現在サイクルが n 以上なら true。 |

### 4.6 本サイクルの行動順

主語は不要。コンテキストの turnIndexInCycle のみで判定する。

| conditionKind | conditionParam | 意味 |
|---------------|----------------|------|
| **turn_order_in_range** | `{ "turnIndexMin": number, "turnIndexMax": number }`（1 始まり） | turnIndexInCycle が turnIndexMin 以上かつ turnIndexMax 以下なら true。 |

------------------------------------------------------------------------

## 5. 実装時のチェックリスト

- [ ] 戦闘ループで「味方のターン」になったとき、そのキャラの TacticSlot を orderIndex 昇順で取得している。
- [ ] コンテキストに cycle / turnIndexInCycle / actorPartyIndex / party（HP・MP・属性状態・状態異常）/ enemies（同様）/ 位置情報 を渡している。
- [ ] 主語の解決（self / any_ally / any_enemy / front_enemy）を実装している。front_enemy は「同じ row の敵のうち col 最小の生存者」。
- [ ] 各 conditionKind について、上記 4 の表どおり conditionParam を読んで true/false を返す関数を用意している。
- [ ] 「対象のうち 1 体でも満たせば true」を、主語で得たリストに対して適用している。
- [ ] 最初に true になったスロットの actionType + skillId を採用し、それ以降のスロットは見ない。
- [ ] 採用した行動がスキルの場合、MP 不足なら不発（次スロットへは行かず、そのターンは不発で終了）。

------------------------------------------------------------------------

## 6. 未定義・別 spec に委ねるもの

- **属性状態・状態異常**のランタイム表現（どのキーで持つか、持続ターン数の管理）は、属性状態・状態異常の仕様に従う。
- **正面の相手**で「同じ row に敵が複数いる場合の列の比較」は、列 1～3 の大小で「前列＝1、中列＝2、後列＝3」とし、最小の col の生存者を 1 体選ぶ。
- 新規の conditionKind を追加するときは、本 spec の 4 に「conditionKind / conditionParam / 評価」を 1 行ずつ追記し、実装側で分岐を足す。
