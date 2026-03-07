// docs/054 - 研究グループ・アイテム消費で解放

import Link from "next/link";
import { getResearchMenu } from "@/server/actions/research";
import { ResearchUnlockButton } from "./research-unlock-button";
import { GameIcon } from "@/components/icons/game-icon";

export default async function ResearchPage() {
  const result = await getResearchMenu();

  if (!result.success) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">研究</h1>
        <p className="mt-4 text-text-muted">
          {result.error === "UNAUTHORIZED" ? "ログインしてください。" : result.error}
        </p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
      </main>
    );
  }

  const { groups } = result;

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← ダッシュボード
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">研究</h1>
      <p className="mt-2 text-text-muted">
        研究グループごとに解放対象が並びます。必要なアイテムを消費して解放すると、設備の建設やクラフトレシピが利用可能になります。
        派生型以外をすべて解放すると、次の研究グループが利用可能になります。
      </p>

      <section className="mt-8 max-w-2xl space-y-8">
        {groups.map((group) => (
          <div
            key={group.id}
            className={`rounded-lg border p-6 ${
              group.isAvailable
                ? "border-base-border bg-base-elevated"
                : "border-base-border/60 bg-base-elevated/60 opacity-75"
            }`}
          >
            <div className="flex items-center gap-2">
              <GameIcon name="flask" className="h-6 w-6 text-brass" />
              <h2 className="text-lg font-semibold text-text-primary">{group.name}</h2>
              {!group.isAvailable && (
                <span className="rounded bg-amber-900/40 px-2 py-0.5 text-xs text-amber-200">
                  前提グループをクリアすると利用可能
                </span>
              )}
            </div>

            {group.items.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">解放対象はありません。</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded border border-base-border bg-base p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-primary">{item.targetName}</span>
                      {item.isVariant && (
                        <span className="rounded bg-base-border/50 px-2 py-0.5 text-xs text-text-muted">
                          派生型
                        </span>
                      )}
                      {item.isUnlocked ? (
                        <span className="rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-200">
                          解放済み
                        </span>
                      ) : null}
                    </div>
                    {!item.isUnlocked && group.isAvailable && item.cost.length > 0 && (
                      <ResearchUnlockButton
                        targetType={item.targetType}
                        targetId={item.targetId}
                        targetName={item.targetName}
                        cost={item.cost}
                      />
                    )}
                    {!item.isUnlocked && group.isAvailable && item.cost.length === 0 && (
                      <p className="mt-2 text-xs text-text-muted">解放コスト未設定</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
