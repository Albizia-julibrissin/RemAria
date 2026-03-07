# 戦闘まわりの「test」リネーム案

探索が動くことを最優先。仮戦闘メニューは壊れてもよい前提。

---

## 1. Server Action（最優先・探索に直結）

| 現在 | 変更後 |
|------|--------|
| `src/server/actions/test-battle.ts` | `src/server/actions/battle.ts` |
| `runTestBattle` | `runBattle` |
| `RunTestBattleSuccess` | `RunBattleSuccess` |
| `RunTestBattleError` | `RunBattleError` |
| `RunTestBattleResult` | `RunBattleResult` |

**参照する側の変更:**
- `src/server/actions/exploration.ts` … `runTestBattle` → `runBattle`、型を `RunBattleSuccess` 等に
- `src/app/battle/test/battle-test-client.tsx` … 同上（仮戦闘側）

---

## 2. デフォルト敵（敵未指定時のスライム）

| 現在 | 変更後 |
|------|--------|
| `src/lib/battle/test-enemy.ts` | `src/lib/battle/default-enemy.ts` |
| `TEST_ENEMY_NAME` | `DEFAULT_ENEMY_NAME` |
| `TEST_ENEMY_ICON_FILENAME` | `DEFAULT_ENEMY_ICON_FILENAME` |
| `TEST_ENEMY_BASE_STATS` | `DEFAULT_ENEMY_BASE_STATS` |
| `TEST_ENEMY_POSITIONS_1V3` | `DEFAULT_ENEMY_POSITIONS_1V3` |
| `TEST_ENEMY_SKILL_ID_ADVANCE` | `DEFAULT_ENEMY_SKILL_ID_ADVANCE` |
| `TEST_ENEMY_TACTIC_SLOTS` | `DEFAULT_ENEMY_TACTIC_SLOTS` |
| `TEST_ENEMY_SKILLS` | `DEFAULT_ENEMY_SKILLS` |

**参照する側:**
- `src/server/actions/battle.ts`（旧 test-battle.ts）
- `src/app/battle/…/battle-full-view.tsx`
- `src/app/battle/…/battle-log-view.tsx`（`ENEMY_LABEL = DEFAULT_ENEMY_NAME` のまま）

---

## 3. 仮戦闘のルート・フォルダ

| 現在 | 変更後 |
|------|--------|
| `src/app/battle/test/` | `src/app/battle/practice/` |
| URL `/battle/test` | `/battle/practice` |
| `battle-test-client.tsx` | `battle-practice-client.tsx` |

**参照する側:**
- `src/app/dashboard/page.tsx` … `href="/battle/test"` → `href="/battle/practice"`
- `src/app/battle/exploration/page.tsx` … `from "../test/battle-full-view"` → `from "../practice/battle-full-view"`
- `src/app/battle/exploration/exploration-skill-event-block.tsx` … `from "../test/battle-grid-view"` → `from "../practice/battle-grid-view"`
- `src/app/battle/practice/page.tsx` … 内部で `BattlePracticeClient` を参照するように

---

## 4. 古い戦闘ループ（通常攻撃のみ・未使用の可能性）

| 現在 | 変更後 |
|------|--------|
| `src/lib/battle/run-test-battle.ts` | `src/lib/battle/run-simple-battle.ts` |
| `runTestBattleLoop` | `runSimpleBattleLoop` |

※ 他ファイルから import されていなければ、リネームのみでよい。

---

## 5. 実施順序（探索を壊さないように）

1. **default-enemy** … ファイル名変更 + 定数リネーム + 全参照修正
2. **battle action** … ファイル名 `test-battle.ts` → `battle.ts`、関数・型リネーム + exploration.ts の参照を先に修正（探索を守る）
3. **practice** … フォルダ `test` → `practice`、URL・コンポーネント名・dashboard/exploration の import 修正
4. **run-simple-battle** … 未使用なら最後でよい

---

## 6. ドキュメント・AGENTS の追従（任意・後回し可）

- `AGENTS.md` の「仮戦闘」行 … `test-battle.ts` → `battle.ts`、`test-enemy.ts` → `default-enemy.ts`、`run-test-battle.ts` → `run-simple-battle.ts`
- `spec/020_test_battle.md` … runTestBattle → runBattle 等の記述
- `docs/027_hardcoded_and_deferred.md`、`spec/049_exploration.md`、`spec/050_enemy_master.md` 等の test-battle / test-enemy 言及

以上。
