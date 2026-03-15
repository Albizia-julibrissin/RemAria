# 工房の遺物鑑定・分解

工房に「鑑定」タブを追加し、遺物の鑑定機能を物資庫から移す。あわせて遺物の分解機能を追加する。

## 1. 背景・目的

- **鑑定の移設**: これまで物資庫（バッグ）の遺物タブで行っていた「遺物トークン1個消費→遺物個体1個生成」の鑑定を、工房の鑑定タブで行う。物資庫の遺物タブは「所持遺物一覧」の確認のみ残す。
- **分解の追加**: 所持している遺物個体を1個消費し、アイテム `relic_shard`（遺物の欠片）を1個付与する。装着中の遺物は分解できない。

## 2. 仕様

### 2.1 鑑定（既存 API の利用先変更）

- **API**: 既存の `appraiseRelicToken(itemCode)`（spec/051）をそのまま利用する。
- **UI の場所**: 工房 `/dashboard/craft` の「鑑定」タブ。所持トークン数と「1個鑑定する」ボタンを表示する。
- **データ**: 工房ページで `getRelicInstances` とトークン所持数（getInventory の stackable から `relic_group_a_token` 相当）を取得し、鑑定タブに渡す。

### 2.2 分解

- **入力**: 遺物個体 ID（`relicInstanceId`）。未装着の遺物のみ対象。
- **処理**:
  1. 対象が自分の遺物かつ未装着であることを検証。
  2. `RelicInstance` を削除。装着枠（CharacterRelic）に参照があれば先に解除する想定だが、未装着のみ許可するので通常は不要。
  3. Item code が `relic_shard` のアイテムを 1 個、当該ユーザーの `UserInventory` に加算（存在しなければ quantity=1 で作成）。
- **出力**: 成功時は `{ success: true }`。失敗時は `{ success: false, error, message }`（例: 装着中、他人の遺物、relic_shard マスタ未登録）。
- **API 名**: `decomposeRelic(relicInstanceId: string)`。実装場所は `src/server/actions/relic.ts`。

### 2.3 アイテム relic_shard

- **Item.code**: `relic_shard`（固定）。
- **用途**: 遺物を分解したときの報酬。将来のクラフトや交換用素材として利用する想定。
- **マスタ**: アイテムマスタに `code: "relic_shard"` の 1 件を登録する必要がある。管理画面「アイテムマスタ」で追加するか、運用で投入する。実装側では code で参照し、存在しなければ「分解に失敗しました」等のメッセージを返す。

## 3. UI 配置

| 画面       | 変更内容 |
|------------|----------|
| 工房       | タブに「鑑定」を追加。鑑定タブ内で「原石所持数＋鑑定ボタン」「所持遺物一覧＋各遺物に分解ボタン」を表示。 |
| 物資庫     | 遺物タブから鑑定ボタン・鑑定用 state を削除。所持遺物一覧の表示のみ残す。 |

## 4. 実装時の参照

- 遺物 API・型: `spec/051_relics.md`、`src/server/actions/relic.ts`
- 工房タブの追加方法: `src/app/dashboard/craft/craft-tabs.tsx`（製造・鍛錬・継承タブのパターンに倣う）
- アイテム付与: `UserInventory` の upsert（quantity increment）。Item は code で検索。

## 5. spec/051 との関係

- spec/051 の「8. UI 要件」を更新し、鑑定 UI は工房に記載。バッグは「所持 RelicInstance 一覧」のみとする。
- 分解 API を spec/051 の「5. API 仕様」に追加する。
