# 型ずれの検査・是正メモ

Lint / TypeScript で出る「既存の型ずれ」の原因と対処をまとめる。主に **prisma/seed.ts** と Prisma 生成クライアントの対応。

---

## 1. 現象一覧（seed.ts で出るもの）

| 種類 | 内容 | 例 |
|------|------|-----|
| **PrismaClient のプロパティ** | `Property 'relicType' does not exist on type 'PrismaClient'` など | relicType, relicPassiveEffect, enemy, quest, title, researchGroup, … |
| **Item の skillId** | `'skillId' does not exist in type 'ItemCreateInput'` | seedSkillBookItems の create/update |
| **EquipmentType の statGenConfig** | `'statGenConfig' does not exist in type ...` | seedEquipmentTypes |
| **ExplorationArea のフィールド** | `'strongEnemyEnemyGroupCode'`, `'strongEnemyDropTableId'`, `'enemyCount1Rate'` does not exist | エリア seed |

---

## 2. 原因

### 2.1 PrismaClient のデリゲート名（relicType, enemy, quest など）

- **スキーマ**: `prisma/schema.prisma` に RelicType, Enemy, Quest, Title 等の model が定義されている。
- **生成クライアント**: `npm run db:generate` 後に **node_modules/.prisma/client/index.d.ts** を確認すると、`get relicType()`, `get enemy()`, `get quest()` などが **すべて定義されている**。
- つまり **seed の書き方（prisma.relicType など）は正しく、生成型にも存在する**。
- Lint で「存在しない」と出る場合は、**IDE/TypeScript が古い型や別経路の型を参照している**可能性が高い。
  - 例: `.prisma/client` の解決先がキャッシュや別パスになっている。

### 2.2 Item の skillId

- Prisma の **ItemCreateInput** は「リレーション形式」のみで、`skillId` というスカラは持たない（代わりに `skill?: SkillCreateNestedOneWithoutSkillBookItemsInput`）。
- **ItemUncheckedCreateInput** には `skillId` がある。
- `upsert` の `create` / `update` に `skillId: skill.id` を直で渡すと、型推論が CreateInput 側になり、`skillId` が「ない」と判定される。
- **対処**: `skillId` を使わず、**リレーション形式** `skill: { connect: { id: skill.id } }` にする（seed 側で修正済み）。

### 2.3 EquipmentType / ExplorationArea のフィールド

- **schema.prisma** には `statGenConfig`（EquipmentType）、`strongEnemyEnemyGroupCode` / `strongEnemyDropTableId` / `enemyCount1Rate`（ExplorationArea）が定義されている。
- 生成クライアント（.prisma/client/index.d.ts）にも同じ名前で出ている。
- したがって **「型定義上は存在する」**。Lint で怒られる場合は、2.1 と同様に **型の参照元が古い/ずれている** 可能性がある。

---

## 3. 是正の手順

### 3.1 必ず行うこと

1. **Prisma クライアントの再生成**  
   ```bash
   npm run db:generate
   ```
2. **TypeScript の型を読み直させる**  
   - VSCode/Cursor: `Ctrl+Shift+P` → 「TypeScript: Restart TS Server」
   - これで `node_modules/.prisma/client` の型が再度読み込まれる。

### 3.2 コード側で済ませた是正

- **Item の skillId**  
  - `prisma/seed.ts` の `seedSkillBookItems` で、`create` / `update` に `as Prisma.ItemUncheckedCreateInput` および `as Prisma.ItemUncheckedUpdateInput` を付与済み。  
  - Unchecked 型には `skillId` が定義されているため、このアサーションで型エラーを解消している。

### 3.3 それでも PrismaClient / 他モデルの型エラーが残る場合

- **node_modules の状態を確認**  
  - `node_modules/.prisma/client/index.d.ts` を開き、該当モデル（例: `relicType`, `enemy`）の `get xxx()` が定義されているか確認する。
- **パス解決の確認**  
  - `@prisma/client` の `default.d.ts` は `export * from '.prisma/client/default'` しており、実体は `.prisma/client`。  
  - 同じワークスペースに複数 tsconfig がある場合、参照先がずれていないか確認する。
- **暫定**  
  - どうしても IDE だけが古い型を見る場合は、該当行に `// @ts-expect-error` を付けて理由をコメントし、`docs/027_hardcoded_and_deferred.md` に「型ずれの暫定」として 1 行メモする。

---

## 4. 参照

- データモデル: `prisma/schema.prisma`, `docs/08_database_schema.md`
- 生成クライアント: `node_modules/.prisma/client/index.d.ts`（`npm run db:generate` 後）
- シード: `prisma/seed.ts` 先頭コメント、`manage/DB_OPERATIONS.md`
