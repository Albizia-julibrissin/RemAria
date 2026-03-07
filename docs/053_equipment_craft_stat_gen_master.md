# 053: 装備・クラフトのステータス生成をマスタに持つ設計

装備種別・メカパーツ種別ごとの **CAP 範囲**と**採用ステータスの重み範囲**を、コード内の定数（`EQUIPMENT_STAT_GEN_BY_CODE` / `MECHA_PART_STAT_GEN_BY_NAME`）から **DB マスタ**に移す設計。  
docs/021・spec/046 の「種別ごとに CAP・重みで乱数生成」を維持しつつ、設定の正本をマスタに寄せる。

---

## 1. 目的・背景

- **027 一覧 #1・#2**：装備・メカパーツのステ生成設定が `equipment-stat-gen.ts` / `mecha-part-stat-gen.ts` の定数でハードコードされている。コンテンツ追加のたびにコード変更が必要で、バランス調整もコードデプロイに依存する。
- **021 の記述**：「装備マスタ（例：鉄の剣）で以下を定義する：CAP 範囲、採用ステータスと重みの乱数範囲」→ 設計意図としてはもともとマスタで持つ想定。
- **本設計のゴール**：CAP・ウェイトを **EquipmentType / MechaPartType のマスタ**に持たせ、クラフト実行時にマスタから読んで乱数生成する。新規種別追加・数値調整は **seed または管理画面・CSV 投入**で行えるようにする。

---

## 2. 現状

| 対象 | 定義場所 | キー | 内容 |
|------|----------|------|------|
| 装備 | `src/lib/craft/equipment-stat-gen.ts` | `EQUIPMENT_STAT_GEN_BY_CODE`（code） | capMin, capMax, weights（key, weightMin, weightMax） |
| メカパーツ | `src/lib/craft/mecha-part-stat-gen.ts` | `MECHA_PART_STAT_GEN_BY_NAME`（name） | 同上（基礎ステ STR～LUK） |

- **クラフト実行**（`src/server/actions/craft.ts`）：  
  - 装備：`outputEquipmentType.code` で `generateEquipmentStats(typeCode)` を呼び、返り値を `EquipmentInstance.stats` に保存。  
  - メカパーツ：`outputMechaPartType.name` で `generateMechaPartStats(typeName)` を呼び、返り値を `MechaPartInstance.stats` に保存。

---

## 3. 設計方針

- **設定の正本**：種別マスタ（EquipmentType / MechaPartType）の **1 カラム JSON** に「ステ生成用設定」を格納する。
- **マスタ必須**：クラフト実行時は **マスタの statGenConfig のみ**を参照する。NULL または不正の場合は**フォールバックせずクラフト失敗**とし、エラーメッセージを返す（素材は消費しない）。遺物鑑定の「グループがなければ解析できません」と同様の扱い。
- **生成ロジック**：CAP と重みの乱数・按分配分のアルゴリズムは変更しない。**設定の取得元**だけを「定数」から「マスタ」に切り替える。

---

## 4. スキーマ変更

### 4.1 EquipmentType

```prisma
model EquipmentType {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  slot      String
  /// クラフト時のランダムステ生成用。NULL または不正の場合はクラフト失敗（エラー）。
  /// 形式: { "capMin": number, "capMax": number, "weights": [{ "key": "PATK"|..., "weightMin": number, "weightMax": number }] }
  statGenConfig Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ...
}
```

### 4.2 MechaPartType

```prisma
model MechaPartType {
  id        String   @id @default(cuid())
  slot      String
  name      String
  statRates Json?
  strAdd    Int?     ...
  /// クラフト時のランダム基礎ステ生成用。NULL または不正の場合はクラフト失敗（エラー）。
  /// 形式: { "capMin": number, "capMax": number, "weights": [{ "key": "STR"|"INT"|..., "weightMin": number, "weightMax": number }] }
  statGenConfig Json?
  ...
}
```

- 既存カラムはそのまま。**statGenConfig** のみ追加。
- マイグレーションは `ALTER TABLE ... ADD COLUMN statGenConfig JSON;` 相当でよい。

---

## 5. JSON 構造（型）

### 5.1 装備（EquipmentType.statGenConfig）

- キーは **戦闘用ステータス**（PATK, MATK, PDEF, MDEF, HIT, EVA）。`equipment-stat-gen.ts` の `EquipmentStatKey` と一致させる。

```ts
type EquipmentStatGenConfigJson = {
  capMin: number;
  capMax: number;
  weights: Array<{ key: string; weightMin: number; weightMax: number }>;
};
```

- バリデーション：`key` は EQUIPMENT_STAT_KEYS のいずれか、capMin ≤ capMax、weightMin/weightMax は正数、weights 長 ≥ 1 を推奨。

### 5.2 メカパーツ（MechaPartType.statGenConfig）

- キーは **基礎ステ**（STR, INT, VIT, WIS, DEX, AGI, LUK）。`mecha-part-stat-gen.ts` の `MechaPartBaseStatKey` と一致。

```ts
type MechaPartStatGenConfigJson = {
  capMin: number;
  capMax: number;
  weights: Array<{ key: string; weightMin: number; weightMax: number }>;
};
```

---

## 6. 処理フロー変更

### 6.1 executeCraft（装備）

1. レシピから `outputEquipmentType` を取得する際、`statGenConfig` を select に含める。
2. **config の検証**  
   - `statGenConfig` が NULL またはパースして有効な形でない → **クラフト失敗**。トランザクション開始前（または消費前に）エラーを返し、素材は消費しない。メッセージ例：「この装備はステータス生成設定がありません。クラフトできません。」
3. 有効な config で `generateEquipmentStatsFromConfig(config)` を呼ぶ。
4. 返り値（stats）を `EquipmentInstance.stats` に保存。

### 6.2 executeCraft（メカパーツ）

1. レシピから `outputMechaPartType` を取得する際、`statGenConfig` を select に含める。
2. **config の検証**  
   - `statGenConfig` が NULL またはパースして有効でない → **クラフト失敗**。素材は消費しない。メッセージ例：「このメカパーツはステータス生成設定がありません。クラフトできません。」
3. 有効な config で `generateMechaPartStatsFromConfig(config)` を呼ぶ。
4. 返り値を `MechaPartInstance.stats` に保存。

### 6.3 生成モジュールの変更

- **equipment-stat-gen.ts**
  - `generateEquipmentStatsFromConfig(config: EquipmentStatGenConfig): Record<string, number> | null` を追加。既存の「CAP 乱数 → 重み乱数 → 按分」ロジックをここに集約する。呼び出し元は craft のみで、**定数（EQUIPMENT_STAT_GEN_BY_CODE）からの参照は行わない**。定数は seed で statGenConfig を組み立てる参考用に残すか、削除してよい。
- **mecha-part-stat-gen.ts**
  - `generateMechaPartStatsFromConfig(config: MechaPartStatGenConfig): Record<string, number> | null` を追加。同様に **マスタの config のみ**を渡す。定数 MECHA_PART_STAT_GEN_BY_NAME は削除または参考用のみ。
- **craft.ts**
  - 装備：EquipmentType の `statGenConfig` をパース。失敗 or NULL → 即エラー返却（素材消費なし）。成功時のみ `generateEquipmentStatsFromConfig(parsed)` を呼び、EquipmentInstance を作成。  
  - メカパーツ：MechaPartType の `statGenConfig` をパース。失敗 or NULL → 即エラー返却。成功時のみ `generateMechaPartStatsFromConfig(parsed)` を呼ぶ。

---

## 7. マスタ必須・エラー方針

| 状況 | 挙動 |
|------|------|
| マスタに statGenConfig があり、パース成功 | その config でステ生成し、個体を作成 |
| マスタに statGenConfig が NULL / 空 / 不正 | **クラフト失敗**。素材は消費しない。エラーコード（例：`STAT_GEN_CONFIG_MISSING`）とメッセージ（例：「この装備はステータス生成設定がありません。クラフトできません。」）を返す |

- フォールバックは行わない。装備・メカパーツのクラフト出力種別は、必ず seed または管理運用で statGenConfig を投入しておく必要がある。

---

## 8. Seed での投入

- **EquipmentType**：クラフトで出力する全装備種別（少なくとも `iron_sword` / `cloth_armor`）に、`statGenConfig` を必ず投入する。未投入の種別をレシピにするとクラフト実行時にエラーになる。
- **MechaPartType**：クラフトで出力するメカパーツ種別があれば、同様に `statGenConfig` を投入する。未投入の種別はクラフト不可（エラー）。

例（seed 内での装備 1 件）：

```ts
await prisma.equipmentType.upsert({
  where: { code: "iron_sword" },
  create: { code: "iron_sword", name: "鉄の剣", slot: "main_weapon", statGenConfig: { capMin: 70, capMax: 100, weights: [{ key: "PATK", weightMin: 5, weightMax: 10 }, { key: "PDEF", weightMin: 1, weightMax: 5 }] } },
  update: { statGenConfig: { capMin: 70, capMax: 100, weights: [{ key: "PATK", weightMin: 5, weightMax: 10 }, { key: "PDEF", weightMin: 1, weightMax: 5 }] } },
});
```

---

## 9. 実装チェックリスト

- [ ] prisma: EquipmentType に `statGenConfig Json?` 追加
- [ ] prisma: MechaPartType に `statGenConfig Json?` 追加
- [ ] マイグレーション作成・適用
- [ ] equipment-stat-gen: `generateEquipmentStatsFromConfig(config)` を追加（既存ロジックを集約）。craft からはマスタの config のみ渡す。定数 EQUIPMENT_STAT_GEN_BY_CODE は seed 用参考として残すか削除
- [ ] mecha-part-stat-gen: `generateMechaPartStatsFromConfig(config)` を追加。同様にマスタの config のみ使用
- [ ] craft.ts: 装備作成時に EquipmentType.statGenConfig を取得。NULL またはパース失敗時はエラー返却（素材消費なし）。成功時のみ `generateEquipmentStatsFromConfig` を呼ぶ
- [ ] craft.ts: メカパーツ作成時に MechaPartType.statGenConfig を取得。同様にマスタになければエラー、あれば `generateMechaPartStatsFromConfig` のみ使用
- [ ] seed: 既存の装備種別（少なくとも iron_sword, cloth_armor）に statGenConfig を投入
- [ ] （任意）管理画面や CSV で statGenConfig を編集できるようにする
- [ ] docs/027: #1・#2 を「解消済み」に更新（または該当行削除）

---

## 10. spec/046 との関係

- spec/046 の「3.3 EquipmentType」には「ステータス範囲・重み範囲は 021 に従い、カラムまたは JSON で持つ」とある。本設計は **JSON（statGenConfig）で持つ** 案で、046 と矛盾しない。
- 実装後、046 に「ステ生成設定は EquipmentType.statGenConfig / MechaPartType.statGenConfig を参照。形式は docs/053 に従う」と 1 行追記するとよい。

---

## 11. 更新履歴

- 初版：装備・メカパーツの CAP/ウェイトをマスタに持つ設計を追加。
- マスタ必須に変更：statGenConfig が NULL/不正の場合はフォールバックせずクラフト失敗・エラー返却（素材は消費しない）。
