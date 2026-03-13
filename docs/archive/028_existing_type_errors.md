# 既存の TypeScript 型エラー一覧（tsc --noEmit で検出）【アーカイブ】

**※ 本 doc はアーカイブ済み。2025-03 時点で以下に挙げたエラーはすべて修正済み。実装時の参照には使わず、履歴用に残している。**

---

`npx tsc --noEmit` 実行時に出る既知の型エラー。修正の優先度・方針のメモ用。

**2025-03 時点**: 以下に挙げたエラーはすべて修正済み。tsc --noEmit は通過する。

---

## 1. Prisma / JSON まわり（✅ 修正済み）

| ファイル | 行 | 内容 |
|----------|-----|------|
| **prisma/seed.ts** | 1079 | `Prisma` 名前空間が見つからない。`displayTags` に `as Prisma.InputJsonValue \| null` を使っているが、seed からは `@prisma/client` の `Prisma` を import していない可能性。 |
| **prisma/seed.ts** | 1179, 1183 | `MechaPartType` の update/create で `statRates: object \| null` を渡している。Prisma の Json 型は `InputJsonValue` 等を要求し、`null` をそのまま渡すと `NullableJsonNullValueInput` を使う必要がある。 |
| **prisma/seed.ts** | 1279, 1285 | `Item` の upsert で `consumableEffect: null`, `maxCarryPerExpedition: null`。Prisma の optional な Json/Int に `null` を渡す場合は `Prisma.JsonNull` やフィールド省略にする必要がある。 |
| **src/server/actions/exploration.ts** | 231–232 | `explorationState: null` および `{ consumables: [...] }`。Expedition の `explorationState` が Json 型のため、`null` やオブジェクトの型が Prisma の `InputJsonValue` と合わない。 |
| **src/server/actions/exploration.ts** | 914 | `explorationState` に `{ logs?: unknown; lastBattle?: unknown }` を渡している。`unknown` が Prisma の `InputJsonValue` に含まれない。 |
| **src/server/actions/exploration.ts** | 1202 | `explorationState: { ...rawState, consumables: [...] }`。`rawState` の型（`logs?: unknown` 等）が Json と合わない。 |

**方針**:  
- seed では `import { Prisma } from "@prisma/client"` を追加するか、Json フィールドには `Prisma.JsonNull` / 適切な `InputJsonValue` を渡す。  
- exploration では `explorationState` に渡すオブジェクトを `as Prisma.InputJsonValue` でキャストするか、型を `InputJsonValue` に合う形（例: `string | number | boolean | object | array`）に寄せる。

---

## 2. 戦闘位置（BattleRow / BattleCol / BattlePosition）（✅ 修正済み）

| ファイル | 行 | 内容 |
|----------|-----|------|
| **src/app/battle/test/battle-full-view.tsx** | 166 | `enemyPositions` が `{ row: number; col: number }[]` になっている。`BattlePosition[]` は `row: BattleRow`, `col: BattleCol`（リテラル 1|2|3）を要求。 |
| **src/server/actions/test-battle.ts** | 262, 356 | 同様に `row`/`col` が `number` のまま。`BattlePosition` は `row: 1|2|3`, `col: 1|2|3` が必要。 |

**方針**:  
- 位置を組み立てる箇所で `as BattleRow` / `as BattleCol` を付けるか、`row as 1|2|3` のようにアサーションする。  
- または `BattlePosition` の定義を「number だが 1〜3 のみ」に緩める（ランタイムチェックを入れる等）。

---

## 3. 作戦エディタ（tactics-editor-client）（✅ 修正済み）

| ファイル | 行 | 内容 |
|----------|-----|------|
| **src/app/dashboard/tactics/tactics-editor-client.tsx** | 35, 422 | `CYCLE_CONDITION_VALUES.has(kind)` 等で `kind` が `string` のため、`"cycle_is_even" \| "cycle_is_odd" \| ...` の引数型と合わない。 |

**方針**:  
- `kind` を適切なユニオン型に絞るか、`has` の引数を `as typeof CYCLE_CONDITION_...` でキャストする。

---

## 4. 戦闘ロジック（run-battle-with-party.ts）（✅ 修正済み）

| ファイル | 行 | 内容 |
|----------|-----|------|
| **src/lib/battle/run-battle-with-party.ts** | 435, 436, 490 | `DerivedStats` を `Record<string, number>` に変換している。`DerivedStats` に index signature がないため「意図的なら先に unknown に」と指摘される。 |
| **src/lib/battle/run-battle-with-party.ts** | 1564 | オブジェクトに `recordDamagePct` が存在しない（型定義と実装の不一致）。 |
| **src/lib/battle/run-battle-with-party.ts** | 1669 | 同様に `splashDamagePerEnemy` が型に存在しない。 |

**方針**:  
- `DerivedStats` を渡す箇所は `as unknown as Record<string, number>` にするか、`DerivedStats` 側に index signature を足す。  
- `recordDamagePct` / `splashDamagePerEnemy` は型定義（interface 等）に追加するか、該当プロパティを別名・別型に合わせる。

---

## 5. まとめ

- **Prisma / Json**: 主に `null` と `InputJsonValue`、および `unknown` の扱い。  
- **戦闘位置**: `number` とリテラル `1|2|3` の不一致。  
- **作戦**: `string` と条件種別ユニオン型の不一致。  
- **戦闘ロジック**: 型定義とプロパティ名のずれ、および `DerivedStats` の変換。

上記の「方針」に沿って修正済み。今後同種の Json / 位置型 / 条件種別の追加時は同様の扱いを参照する。
