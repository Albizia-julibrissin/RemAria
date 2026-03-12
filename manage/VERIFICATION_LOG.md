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

- **表示**: `src/app/battle/practice/battle-log-view.tsx`
  - 定数 `SHOW_VERIFICATION_LOG = process.env.NEXT_PUBLIC_SHOW_VERIFICATION_LOG === "true"` で判定。
  - 多ヒット・単一ヒットの両方で、`relicDamageBefore` / `relicDamageNote` がある場合に「検証: 適用前 X → [遺物: …]」を表示。
- **ログデータ**: `src/lib/battle/run-battle-with-party.ts` の `BattleLogEntryWithParty` および `hitDetails` の各要素に、検証用のオプション項目（例: `relicDamageBefore`, `relicDamageNote`）を追加して渡す。

## 検証ログに含めるもの（現在・今後）

- **現在**: 遺物パッシブによるダメージ倍率適用前の値と倍率メモ（`relicDamageBefore`, `relicDamageNote`）。
- **今後**: 同様に「検証したい値」は、ログ型にオプション項目を追加し、`SHOW_VERIFICATION_LOG` が true のときだけ `battle-log-view.tsx` で「検証: …」として表示する。

## 関連

- AGENTS.md の「検証ログ」の項。
- 遺物パッシブ効果: `docs/073_relic_passive_effect_types_design.md`。
