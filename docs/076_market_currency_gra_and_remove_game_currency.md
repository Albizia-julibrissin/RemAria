# 市場通貨の GRA 化と gameCurrency 廃止の修正計画

**※ 本計画は実装済み（市場 GRA 化・仲間雇用 GRA のみ・gameCurrencyBalance 削除）。**

市場で使う通貨を**ゲーム内通貨（gameCurrencyBalance）から GRA（premium 通貨）に変更**し、**無償分から消費**する。あわせて **gameCurrencyBalance を DB から廃止**する（使わない方針）。

---

## 1. 方針まとめ

| 項目 | 変更後 |
|------|--------|
| 市場の通貨 | **GRA**（premiumCurrencyFreeBalance + premiumCurrencyPaidBalance）。購入時は**無償分から先に消費**。 |
| gameCurrencyBalance | **廃止**。User からカラム削除。用途だった「市場」「仲間雇用」は GRA に統一。 |
| 仲間雇用の支払い | **GRA のみ**に統一。`paymentType: "game"` を廃止し、GRA（無償→有償の順で消費）のみ受け付ける。 |

---

## 2. 影響範囲（現状の gameCurrency 利用箇所）

- **市場**（spec/075）  
  - buyFromMarket: 買い手の gameCurrencyBalance を減算、売り手に加算。  
  - → **GRA に変更**。買い手は無償→有償の順で減算。売り手への入金は**無償として加算**するか、運用で決める（後述）。
- **仲間雇用**（spec/030）  
  - paymentType `"game"`: gameCurrencyBalance 1000 で 1 回購入。  
  - → **game を廃止**。支払いは GRA（COMPANION_HIRE_PRICE_PREMIUM）のみ。無償→有償の順で消費（既存ロジック流用）。
- **シード**  
  - 管理人に gameCurrencyBalance: 5000 を付与。  
  - → **削除**。GRA（premiumCurrencyFreeBalance）は既に付与しているので変更なし。
- **DB スキーマ**  
  - User.gameCurrencyBalance カラム。  
  - → **マイグレーションで削除**。
- **CurrencyTransaction**  
  - currencyType: `"game"` のレコードが仲間雇用で挿入されている可能性。  
  - → **新規の "game" 挿入は行わない**。既存データは残す（履歴として参照する場合のみ）。型・定数から "game" を消すかは任意。

---

## 3. 市場の GRA 化（詳細）

### 3.1 購入時（買い手）

- 必要額を **premiumCurrencyFreeBalance から優先して減算**し、足りなければ **premiumCurrencyPaidBalance** から減算。
- ロジックは仲間雇用（recruit.ts の premium 分支）と同様:  
  `fromFree = min(必要額, premiumCurrencyFreeBalance)`  
  `fromPaid = 必要額 - fromFree`
- **CurrencyTransaction** に履歴を残す場合:  
  - 消費: `currencyType: "premium_free"` で -fromFree、`"premium_paid"` で -fromPaid（それぞれ amount &gt; 0 のときのみ 1 件ずつ）。  
  - reason は例: `"market_purchase"`。

### 3.2 成約時（売り手への入金）

- 手数料 10% 控除後を売り手に加算するが、**どこに加算するか**を決める必要がある。  
  - **案 A**: すべて **premiumCurrencyFreeBalance** に加算（シンプル）。  
  - **案 B**: 買い手の消費内訳に合わせて按分（複雑）。  
- **推奨**: **案 A**（売り手への成約金は無償 GRA として付与）。実装が簡単で、市場で得た GRA をまた市場で使う流れも自然。

### 3.3 画面・API

- 市場の「所持 G」表示は、**GRA 合計**（premiumCurrencyFreeBalance + premiumCurrencyPaidBalance）に変更。
- 既存の「所持ゲーム通貨」の文言は「所持 GRA」などに変更。

---

## 4. gameCurrencyBalance 廃止（詳細）

### 4.1 仲間雇用の変更（spec/030 + recruit.ts）

- **paymentType** から `"game"` を削除。**GRA のみ**受け付ける（実質的に `"premium"` のみ、または paymentType を廃止して常に GRA）。
- フロント: ゲーム通貨で購入する選択肢を削除。GRA のみのボタン／表示にする。
- 定数: `COMPANION_HIRE_PRICE_GAME` は削除。`COMPANION_HIRE_PRICE_PREMIUM` のみ使用。

### 4.2 シード（prisma/seed.ts）

- 管理人の `gameCurrencyBalance: 5000` を削除。  
- （すでに premiumCurrencyFreeBalance 等を付与しているため、市場・仲間雇用は GRA で問題なし。）

### 4.3 DB マイグレーション

- **User** から `gameCurrencyBalance` カラムを削除するマイグレーションを 1 本作成。
- 既存データは 0 や未使用のため、データ移行は不要でよい。

### 4.4 参照箇所の削除・修正

- **prisma/schema.prisma**: User の `gameCurrencyBalance` を削除。
- **src/server/actions/market.ts**: 上記「3. 市場の GRA 化」に従い、買い手は GRA（無償→有償）、売り手は無償 GRA で加算。
- **src/server/actions/recruit.ts**: game 分支を削除。GRA のみに統一。
- **src/app/dashboard/market/page.tsx**: `gameCurrencyBalance` の取得をやめ、GRA 合計を取得して表示。
- **src/app/dashboard/...** で gameCurrency を表示している箇所があれば削除または GRA 表示に変更。
- **docs/08_database_schema.md**, **docs/065_market_design.md**, **spec/075_market.md**, **spec/030_companion_employment.md**: 通貨の記述を GRA に統一し、gameCurrencyBalance への言及を削除。
- **manage/ECONOMY_DESIGN.md**: game 通貨を「廃止した」旨に更新。

---

## 5. 実装順序（推奨）

1. **spec / docs の更新**  
   - 075: 市場の通貨を GRA（無償から消費）に変更。  
   - 030: 仲間雇用は GRA のみ。  
   - 065, 08, ECONOMY_DESIGN: 上記に合わせて記述修正。
2. **市場の GRA 化（コード）**  
   - market.ts: buyFromMarket で GRA（無償→有償）で減算、売り手は premiumCurrencyFreeBalance に加算。  
   - 市場ページ: 表示を GRA 合計に変更。
3. **仲間雇用を GRA のみに**  
   - recruit.ts: paymentType "game" 分支を削除。  
   - フロント: ゲーム通貨購入 UI を削除。
4. **gameCurrencyBalance の削除**  
   - シードから gameCurrencyBalance 付与を削除。  
   - 上記以外で gameCurrencyBalance を参照している箇所をすべて削除。  
   - Prisma で User から gameCurrencyBalance を削除し、マイグレーション作成・適用。
5. **CurrencyTransaction**  
   - 新規で currencyType "game" を挿入しないことを確認。  
   - （任意）型や定数から "game" を外す、または「履歴用のため残す」とコメントで明記。

---

## 6. 売り手入金の履歴（CurrencyTransaction）

- 売り手への成約金加算を **premiumCurrencyFreeBalance** にする場合、履歴は例:  
  - reason: `"market_sale"`  
  - currencyType: `"premium_free"`  
  - amount: 手数料控除後の正の値  
- 買い手の消費履歴は「3.1 購入時」のとおり。

---

## 7. 参照

- 市場: spec/075_market.md, docs/065_market_design.md  
- 仲間雇用: spec/030_companion_employment.md  
- 経済設計: manage/ECONOMY_DESIGN.md  
- DB: docs/08_database_schema.md  

この計画に沿って実装する場合は、上記の順序で spec/docs 更新 → 市場 GRA 化 → 仲間 GRA 統一 → gameCurrency 削除、と進めればよい。
