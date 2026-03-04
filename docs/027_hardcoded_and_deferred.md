# ハードコード・暫定実装のルールと一覧

「後でちゃんと実装する」前提のコードやマスタでない定義を**一覧化**し、解消時に追記・削除できるようにする。

---

## 1. ルール

1. **新規にハードコード・暫定実装を入れるとき**  
   本一覧の「2. 現在の一覧」に**必ず 1 行追加**する。  
   - ファイルパス・該当箇所の概要・「本来どうあるべきか / 解消方針」を書く。
2. **解消したとき**  
   該当行を**削除**する（または「解消済み」にし、日付をメモ）。
3. **一覧の置き場所**  
   本ファイル（`docs/027_hardcoded_and_deferred.md`）を正本とする。  
   - `AGENTS.md` から本ファイルへの参照がある。実装・レビュー時に一覧を確認する。

---

## 2. 現在の一覧

以下の表は**アプリ・lib 内の「コードで固定している」「後でマスタ/仕様に寄せる」箇所**をまとめたもの。  
seed 内のテスト用データ（テストユーザー・初期設備名など）は「テスト用として許容」のため、必要に応じてのみ記載する。

| # | ファイル（パス） | 内容 | 本来どうあるべきか / 解消方針 |
|---|------------------|------|------------------------------|
| 1 | `src/lib/craft/equipment-stat-gen.ts` | **EQUIPMENT_STAT_GEN_BY_CODE**：装備種別 code（iron_sword, cloth_armor）ごとの CAP 範囲・重み範囲を定数で保持。021 準拠の乱数生成に使用。 | 装備種別マスタ（EquipmentType または別テーブル）に statCapMin/Max・重み設定を持たせる。クラフト実行時にマスタから読む。 |
| 2 | `src/lib/craft/mecha-part-stat-gen.ts` | **MECHA_PART_STAT_GEN_BY_NAME**：メカパーツ種別名ごとの CAP・重み。現状は空で、常に null を返す。 | メカパーツ種別マスタ（MechaPartType または別テーブル）に同様の設定を持たせる。クラフト実行時にマスタから読む。 |
| 3 | `src/lib/battle/run-battle-with-party.ts` | **DEBUFF_STAT_MULT_BY_CODE**：デバフコード（paralysis, accuracy_down）ごとの statMult（EVA 0.5 等）を定数で保持。 | デバフ効果のマスタまたは 042 の effectType 定義に「デフォルト statMult」を持たせる。 |
| 4 | `src/lib/battle/run-battle-with-party.ts` | **POISON_DOT_PCT**：毒デバフの DoT 割合（0.05）。 | バランス用パラメータとしてマスタまたは 042 の effectType 定義に持たせる。 |
| 5 | `src/lib/battle/test-enemy.ts` | **スライム 1～3 の基礎ステ**：DB に持たず定数で定義。仮戦闘用。 | 本番敵は敵マスタ（Enemy / Encounter）で管理。仮戦闘用は「テスト用」として残すか、テスト専用マスタに移す。 |
| 6 | `src/server/actions/initial-area.ts` | **INITIAL_FACILITY_NAMES**：強制配置する 5 設備の名前を配列で保持。ensureInitialFacilities で参照。 | 初期設備は「初期化設定」マスタまたは spec/035 で定義した定数一覧を 1 箇所（例: constants または seed の export）にまとめ、名前の重複を防ぐ。 |
| 7 | `src/server/actions/initial-area.ts` | **PRODUCTION_CAP_MINUTES**（1440 = 24h）：生産受け取りのキャップ。receive-production.ts にも同値が重複。 | docs/019 の 24 時間と一致。定数は 1 箇所に集約（例: `lib/constants/production.ts`）。マスタ化は将来検討。 |
| 8 | `src/server/actions/receive-production.ts` | **PRODUCTION_CAP_MINUTES**（1440）：上記と同じ数値の重複定義。 | 上記と統合し 1 箇所参照にする。 |
| 9 | `src/server/actions/facilities-placement.ts` | **getResearchState**：MVP では「解放済み設備種別一覧」のみ返す。未解放の条件要約は未実装。 | 047 の研究仕様に合わせ、未解放設備と解放条件の要約を返す。 |
| 10 | `src/server/actions/craft.ts` | **getCraftRecipes**：MVP では「全レシピ」を返す。解放条件（設計図消費等）は未実装。 | UserCraftRecipeUnlock 等で「解放済みレシピ」だけ返す。 |
| 11 | `src/app/dashboard/characters/[id]/page.tsx` | **ステータス再配分**：allocateCharacterStats 失敗時、コンソールにだけエラー出力。UI には成功/失敗メッセージを出していない。 | サーバから返却したエラーメッセージを画面に表示する。 |
| 12 | `prisma/seed.ts` | **test1 の設備枠・コスト上限**：industrialMaxSlots: 20, industrialMaxCost: 1000 を test1 だけ上書き。 | テスト用として明示的に「テスト用シード」であることをコメントで残す。本番は進行で解放する想定なので、この箇所は「テスト用」のままでよい。 |
| 13 | `prisma/seed.ts` | **建設レシピ・クラフトレシピ・設備型・解放**：素材の種類・数量・設備名・レシピ名などはすべて seed 内の配列で定義。 | コンテンツが増えたら「マスタ CSV / 管理画面」から投入する運用を検討。現状は seed がマスタの役割。 |

---

## 3. 運用メモ

- **「仮戦闘」**（spec/020）はテスト用のため、敵やフローが「仮」であることは仕様として許容。本一覧では「本番に影響するハードコード」を優先して掲載している。
- **UI の placeholder**（入力欄の「user@example.com」等）は UX 上のヒントであり、本一覧の「暫定実装」には含めていない。
- **docs 内の「暫定」「後で検討」**は設計メモであり、コードのハードコード一覧とは別。必要なら docs 側で「未決事項一覧」を別ファイルにまとめる。

---

## 4. 更新履歴（要約）

- 初版：装備/メカパーツのステータス生成、戦闘デバフ定数、初期設備名、生産キャップ、API の MVP 限定挙動、キャラ詳細のエラー表示、seed のテスト用・マスタ的定義を一覧化。
