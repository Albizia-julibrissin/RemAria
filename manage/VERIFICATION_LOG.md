# 検証ログ（戦闘ログ内の検証用表示）

戦闘ログに「検証用の表示」を出す仕組み。開発・検証時のみ有効にし、本番では非表示にする。

## 概要

- **検証ログ**は、戦闘結果の妥当性を確認するための補足表示のグループ名。
- 表示内容は今後も増やす想定（遺物適用前ダメージ、バフ倍率、その他デバッグ用の値など）で、すべてこのグループに集約する。
- 表示のオン/オフは **環境変数 1 本** で切り替える。

## 環境変数

| 変数名 | 説明 | 本番 |
|--------|------|------|
| `NEXT_PUBLIC_SHOW_VERIFICATION_LOG` | `"true"` のとき、戦闘ログに検証ログを表示する。 | 未設定（非表示） |

- `.env` または `.env.local` に `NEXT_PUBLIC_SHOW_VERIFICATION_LOG="true"` を追加すると、戦闘ログに「検証: …」の行が表示される。
- 本番環境では設定しない。未設定のときは検証ログは一切表示されない。
- ビルド時に定数に置き換わるため、実行時の負荷は無視できる。

## 表示場所・実装

- **戦闘ログ内**: `src/app/battle/practice/battle-log-view.tsx`
  - 定数 `SHOW_VERIFICATION_LOG = process.env.NEXT_PUBLIC_SHOW_VERIFICATION_LOG === "true"` で判定。
  - 多ヒット・単一ヒットの両方で、`relicDamageBefore` / `relicDamageNote` がある場合に「検証: 適用前 X → [遺物: …]」を表示。
- **ログデータ**: `src/lib/battle/run-battle-with-party.ts` の `BattleLogEntryWithParty` および `hitDetails` の各要素に、検証用のオプション項目（例: `relicDamageBefore`, `relicDamageNote`）を追加して渡す。
- **探索戦闘トップ**: `src/app/battle/exploration/page.tsx` と `src/app/battle/exploration/exploration-verification-stats-table.tsx`
  - 進行中（in_progress）のとき、上記と同じ環境変数で検証ログが有効なら、各キャラの「装備前」「装備後」の戦闘ステ（HP, MP, 物攻, 魔攻, 物防, 魔防, 命中, 回避, 運）をテーブルで表示する。データは `getExplorationPartyStatsVerification()`（`src/server/actions/exploration.ts`）で取得。装備前は有効基礎ステから算出した派生ステ、装備後はそれに装備由来の加算を足した値。

## 検証ログに含めるもの（現在・今後）

- **現在**:
  - 遺物パッシブによるダメージ倍率適用前の値と倍率メモ（`relicDamageBefore`, `relicDamageNote`）。戦闘ログ内に表示。
  - 探索戦闘トップでのパーティ戦闘ステ（装備前・装備後）テーブル。`verificationPartyStats` / `getExplorationPartyStatsVerification` で取得し、`ExplorationVerificationStatsTable` で表示。
- **今後**: 同様に「検証したい値」は、ログ型にオプション項目を追加するか、別 API で取得し、`SHOW_VERIFICATION_LOG` が true のときだけ表示する。

## 関連

- AGENTS.md の「検証ログ」の項。
- 遺物パッシブ効果: spec/051 および `src/lib/constants/relic-passive-effect-admin.ts`。
