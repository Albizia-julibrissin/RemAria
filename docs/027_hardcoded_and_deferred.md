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
| 3 | `src/lib/battle/run-battle-with-party.ts` | **DEBUFF_STAT_MULT_BY_CODE**：デバフコード（paralysis, accuracy_down）ごとの statMult（EVA 0.5 等）を定数で保持。 | デバフ効果のマスタまたは 042 の effectType 定義に「デフォルト statMult」を持たせる。 |
| 4 | `src/lib/battle/run-battle-with-party.ts` | **POISON_DOT_PCT**：毒デバフの DoT 割合（0.05）。 | バランス用パラメータとしてマスタまたは 042 の effectType 定義に持たせる。 |
| 5 | `src/lib/battle/default-enemy.ts` | **仮戦闘用の敵**：DB に持たず定数で定義。練習戦闘（/battle/practice）で使用。 | 本番敵は敵マスタ（Enemy / EnemyGroup）で管理済み。仮戦闘用は「テスト用」として残すか、テスト専用マスタに移す。 |
| 9 | `src/server/actions/facilities-placement.ts` | **getResearchState**：MVP では「解放済み設備種別一覧」のみ返す。未解放の条件要約は未実装。 | 047 の研究仕様に合わせ、未解放設備と解放条件の要約を返す。 |
| 10 | （解消済み） | **getCraftRecipes**：UserCraftRecipeUnlock で解放済みレシピのみ返すように変更済み。研究画面（/dashboard/research）でアイテム消費解放。 | — |
| 12 | `prisma/seed.ts` | **test1 の設備枠・コスト上限**：industrialMaxSlots: 20, industrialMaxCost: 1000 を test1 だけ上書き。 | テスト用として明示的に「テスト用シード」であることをコメントで残す。本番は進行で解放する想定なので、この箇所は「テスト用」のままでよい。 |
| 13 | `prisma/seed.ts` | **建設レシピ・クラフトレシピ・設備型・解放**：素材の種類・数量・設備名・レシピ名などはすべて seed 内の配列で定義。 | コンテンツが増えたら「マスタ CSV / 管理画面」から投入する運用を検討。現状は seed がマスタの役割。 |
| 14 | `src/server/lib/resolve-exploration-enemies.ts` | **探索エリアごとの敵編成**：敵マスタ（Enemy / EnemyGroup）と ExplorationArea の紐づけは実装済み。敵の作戦・スキルは run-battle と resolve で対応済み（#24 解消）。 | 敵マスタにスキル・作戦を登録すれば探索戦闘で使用される。未登録の敵は従来どおり通常攻撃のみ。 |
| 15 | `src/server/actions/exploration.ts`, `src/app/dashboard/exploration-log-client.tsx` | **continueExploration（仮）**：探索本流は `advanceExplorationStep`（内部で getNextExplorationStep + runExplorationBattle / pendingSkillEvent 保存）と表示用 getExplorationLastBattleDisplay / getExplorationPendingSkillDisplay で実装済み。explorationState には「直近 1 ステップ分の表示用データ」を載せる形（059 案 B）で、戦闘結果は lastBattle、技能イベントは pendingSkillEvent として保持しており、副次的に技能イベントの表示用データも同じ仕組みで持てている。`continueExploration` はダッシュボードの exploration-log-client からのみ呼ばれ、ログ行とカウンタの更新だけを行う仮実装のまま。 | ダッシュボードの「探索ログ」用途を整理し、continueExploration を削除するか別用途に統合する。 |
| 16 | （解消済み） | **探索中の HP/MP 持ち回り**：戦闘結果の HP/MP を Expedition に書き戻し次の戦闘に渡す処理は実装済み（runTestBattle の initialHpMpByCharacterId、runExplorationBattle での currentHpMp 更新）。 | — |
| 17 | （解消済み） | **探索終了時の経験値・ドロップ付与**：UserInventory へのドロップ加算・参加キャラへの経験値付与（grantCharacterExp）は実装済み。 | — |
| 19 | `src/server/actions/exploration.ts` | **技能イベントの発生時メッセージ**：`getNextExplorationStep` 内で `eventMessage` を "何かが起きた…。どう対処する？" と固定している。 | エリア別・イベント種別でマスタ（または explorationState の種別）にメッセージを持たせ、表示時に参照する。 |
| 20 | `src/app/battle/exploration/page.tsx` | **探索戦闘画面の「戦闘後のパーティ状況（仮）」**：見出しおよび「持ち回り・次イベント抽選は後続で実装」の説明文が古い。HP/MP 持ち回りと次ステップ抽選は実装済み。 | 見出しの（仮）削除と説明文を実態（持ち回り・抽選済み）に合わせて修正する。 |
| 21 | 探索消耗品（spec/049 Phase 4） | **ステータスブースト系アイテム**：docs/020 で想定している「次のイベント時にSTRアップ」等のバフ消耗品は未実装。現状は HP/MP 割合回復のみ。 | Item.consumableEffect にバフ種別（例：next_event_str_up）を追加し、探索ラウンド開始時や戦闘開始時に explorationState のバフを参照してステ補正する処理を実装する。 |
| 22 | （解消済み） | **技能イベント途中離脱時の扱い**：059 案 B で explorationState に pendingSkillEvent を保持する形にしたため、技能イベント表示中に離脱しても復帰時に同じイベント（getExplorationPendingSkillDisplay）が表示され、選択するまで待てる。 | — |
| 25 | `src/lib/battle/run-battle-with-party.ts` | **includeCurrent: false**：持続効果の param で「付与サイクルを含めない」を指定されても未参照。常に includeCurrent: true 扱い。 | remainingCycles の初期値を「durationCycles + 1」にする等、param.includeCurrent に応じた分岐を実装する。 |
| 26 | （方針確定） | **装備の属性耐性**：装備側の属性耐性は**行わない（オミット）**とする。遺物のみ戦闘に attributeResistances を渡す。 | 実装不要。027 一覧からは解消扱い。 |
| 27 | `docs/041_skill_effects_implementation_prep.md` §9 | **logMessageOnCondition の表示**：条件達成時の追加メッセージをログにどう出すか要検討。現状は「決壊」等のインライン表示のみの可能性。 | spec/038 や 042 で表示仕様を決め、必要なら別行で条件達成メッセージを出す。 |
| 28 | `src/server/actions/exploration.ts`, `src/app/battle/exploration/` | **技能イベント後の消耗品使用**：戦闘後の消耗品使用 UI・HP/MP 回復は実装済み。技能イベントの**後**に消耗品を使う UI・効果適用は未実装（spec/049）。 | 技能イベント結果表示後に「消耗品を使う」ボタンと選択 UIを出し、使用後に次ステップへ進むフローを追加する。 |
| 29 | `src/lib/constants/relic.ts` | **RELIC_GROUP_APPRAISAL_CONFIG**：遺物鑑定のステ・耐性・パッシブ抽選の既定値。 | 鑑定時は DB の RelicGroupConfig を優先し、該当 groupCode の設定が無い場合のみこの定数をフォールバックとして参照。管理画面で遺物グループ編集可能。 |
| 30 | `src/app/battle/exploration/`（ExplorationNextButton 等） | **「次へ」ボタンの無効解除**：押下後に 1.5 秒の setTimeout で無効を解除している。 | サーバー応答／処理完了でボタンを戻す（例: サーバーから渡す key で remount、または Server Action + useFormStatus）。方法は本 doc または会話で検討済み。 |
| 31 | （解消済み） | **通知機能**：066 にて Notification テーブル・未読件数・一覧・既読・作成 API とヘッダー通知ドロップダウンを実装済み。任務受注時の通知追加は別タスク。 | — |
| 32 | （解消済み） | **探索開始直後の「復帰画面」最終手段案**：059 Phase 4 で advanceExplorationStep を探索開始直後に 1 回だけ呼ぶフローを実装し、「探索開始 → いきなり 1 戦目」を安全に実現済み。 | — |
| 33 | `src/server/actions/exploration.ts` | **技能イベントの HP/MP 処理**：技能イベントの表示用データ（`getNextExplorationStep` の skill_check 分岐および `getExplorationPendingSkillDisplay` で参照する partyHp / partyMp / partyMaxHp / partyMaxMp）を組み立てる際、最大値に**装備・遺物・メカを含まない** `computeDerivedStats(キャラ基礎のみ)` を使用している。クランプ式は `Math.min(derived.HP, override.hp)` で再開サマリと同じ。 | 戦闘・再開サマリと同様に、装備込みの derived（computeEffectiveBaseStats + 装備合算の derivedBonus）で最大値を算出し、currentHpMp とのクランプを行う。docs/072 §4「再開・表示」の推奨対応に同じ。 |

---

## 3. 運用メモ

- **「仮戦闘」**（spec/020）はテスト用のため、敵やフローが「仮」であることは仕様として許容。本一覧では「本番に影響するハードコード」を優先して掲載している。
- **UI の placeholder**（入力欄の「user@example.com」等）は UX 上のヒントであり、本一覧の「暫定実装」には含めていない。
- **docs 内の「暫定」「後で検討」**は設計メモであり、コードのハードコード一覧とは別。必要なら docs 側で「未決事項一覧」を別ファイルにまとめる。

---

## 4. 更新履歴（要約）

- 初版：装備/メカパーツのステータス生成、戦闘デバフ定数、初期設備名、生産キャップ、API の MVP 限定挙動、キャラ詳細のエラー表示、seed のテスト用・マスタ的定義を一覧化。
- #5 パスを test-enemy.ts → default-enemy.ts に修正。#14 を「探索は敵マスタ連携済み・敵スキル/AI は未実装」に更新。#23～#28 を追加：enemy_all、敵スキル・AI、includeCurrent: false、装備からの耐性、logMessageOnCondition 表示、技能イベント後の消耗品使用。
- **#7・#8 解消**：PRODUCTION_CAP_MINUTES を `src/lib/constants/production.ts` に一元化。initial-area.ts と receive-production.ts は同定数を参照。docs/019 で「貯められるのは最大24時間分まで」と明文化。
- **#6 解消**：INITIAL_FACILITY_NAMES を `src/lib/constants/initial-area.ts` に一元化。initial-area.ts は同定数を import。seed は同定数を import し INITIAL_AREA_FACILITY_NAMES を削除。
- **#11 解消**：ステータス再配分をクライアントコンポーネント（CharacterStatAllocationForm）に切り出し、allocateCharacterStats の成功/失敗メッセージを画面に表示。送信中はボタン無効化と「送信中…」表示。
- **#18 解消 + 後続方針変更**：当初は「戦闘ログを永続化しない」方針とし、runExplorationBattle の戻り値を同一リクエストで表示、ready_to_finish 時は getLastExplorationBattle を廃止し、explorationState に lastBattle を書かないことで、戦闘結果をメモリ上のみで扱っていた。その後、探索中の UX と中断復帰を成立させるため、「長期履歴として戦闘ログを貯めない」ことを原則としつつ、探索ライフサイクル中に限っては直近 1 戦分のログ（lastBattle）や未解決技能イベント（pendingSkillEvent）など最小限の情報を explorationState 等に一時的に保持してよい、という例外ルールを追加した（探索終了時には必ず削除する）。059 リファクタで「直近 1 ステップ分の表示用データ」を explorationState に載せる形（案 B）にした結果、戦闘結果に加えて技能イベントの表示用データも同じ仕組みで持てている。
- **#23 解消**：targetScope: enemy_all を対応。列指定（damage_target_columns）がない場合も敵生存者全員を対象にする分岐を追加。
- **#24 解消**：敵のスキル・AI は実装済み。run-battle-with-party で敵ターンに evaluateTacticsFromSpec・スキル実行・CT 管理を実装。探索敵は resolve-exploration-enemies で tacticSlots・enemySkills を渡す。
- **#1・#2 解消**：装備・メカパーツのステ生成をマスタに移行（docs/053）。EquipmentType.statGenConfig / MechaPartType.statGenConfig を追加。クラフト実行時はマスタの config のみ参照し、未設定ならエラー。seed で鉄の剣・布の鎧・おんぼろシリーズに statGenConfig を投入し、おんぼろ 6 種のクラフトレシピを追加。
- **#32 解消**：059 Phase 4 で探索開始直後に advanceExplorationStep を 1 回呼ぶフローを実装。復帰画面の「最終手段案」は不要になったため解消済みとした。
- **#22 解消**：059 案 B で explorationState に pendingSkillEvent を保持する形にしたため、技能イベント表示中に離脱しても復帰時に同じイベントが表示される。スキップ扱いではなく「同じイベントに戻れる」状態になったため解消済みとした。
- **#26 方針確定**：装備の属性耐性は**行わない（オミット）**とする。遺物のみ戦闘に attributeResistances を渡す。一覧では解消扱い（実装しない方針のため「未実装」項目から外す）。
- **#33 追加**：技能イベントの HP/MP 表示・クランプが装備なしの derived で算出していることを一覧に記載。解消方針は docs/072 §4 の再開・表示と同様。

---

## 5. 設計上の注意メモ（インスタンス管理・JSON など）

- **装備・メカパーツを「すべて個体テーブルで管理する」ことについて**  
  - ハクスラ前提のゲームでは、**「個体ごとの違いが価値」**なので、`EquipmentInstance` / `MechaPartInstance` を 1 個 1 行で持つのは素直な設計。  
  - 実際の ARPG でも、インベントリ行数は数万〜数十万までなら RDB で普通に捌ける（インデックスとクエリ設計が適切なら問題になりにくい）。  
  - 将来もし行数が問題になった場合は、(1) 古い個体のアーカイブテーブル移動、(2) ページング＆検索前提 UI、(3) シャーディングや別ストア移行、などで段階的に対処できる。

- **JSON フィールド（装備 stats・メカパーツ stats・フレーム倍率）について**  
  - 021・044 の設計どおり、「どのステータスを持つか」を柔軟に変えたいので、初期段階では JSON を採用している。  
  - 欲しくなったときに「集計・分析用のビュー or ETL」を追加し、よく使う指標だけを別テーブルや集計テーブルに正規カラムとして投影する運用が現実的。

- **今のデータ構造が「作り直しレベルで危険」かどうか**  
  - 現状の `UserInventory` + `EquipmentInstance` + `MechaPartInstance` + Unlock テーブル構成は、ハクスラ＋拡張性の観点でも妥当で、「根本から作り直したくなるリスク」は低い。  
  - 注意すべきは「どこまでを JSON に閉じ込めるか」「どこを文字列コードにするか」の線引きであり、これは 027 と docs/021, 044 を見ながら都度判断すれば十分と考えている。
