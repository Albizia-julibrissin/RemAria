// docs/054 - クエスト一覧・フィルタ・進捗・クリア報告

import Link from "next/link";
import { getQuestList } from "@/server/actions/quest";
import { QuestListClient } from "./quest-list-client";

const FILTERS = [
  { value: "all" as const, label: "すべて" },
  { value: "story" as const, label: "使命" },
  { value: "research" as const, label: "研究" },
  { value: "special" as const, label: "特殊" },
  { value: "general" as const, label: "一般" },
];

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const raw = params.filter ?? "";
  const filter: "all" | "story" | "research" | "special" | "general" =
    raw === "story" || raw === "research" || raw === "special" || raw === "general"
      ? raw
      : "all";

  const result = await getQuestList(filter);

  if (!result.success) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">開拓任務</h1>
        <p className="mt-4 text-text-muted">{result.error === "UNAUTHORIZED" ? "ログインしてください。" : result.error}</p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
      </main>
    );
  }

  const { quests } = result;

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
      <h1 className="text-2xl font-bold text-text-primary">開拓任務</h1>
      <p className="mt-2 text-text-muted">
        使命・研究・特殊・一般の開拓任務の進捗を確認できます。条件を満たすと報告可能になり、報酬が付与されます。
        達成した任務は「クリア報告」でメッセージを確認し、確認するとクリア済みとして記録されます。
      </p>

      <nav className="mt-6 flex gap-2 border-b border-base-border" aria-label="開拓任務フィルタ">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/dashboard/quests" : `/dashboard/quests?filter=${f.value}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === f.value
                ? "border-brass text-brass"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <section className="mt-6 max-w-2xl">
        {quests.length === 0 ? (
          <p className="text-text-muted">該当する開拓任務はありません。</p>
        ) : (
          <QuestListClient quests={quests} />
        )}
      </section>
    </main>
  );
}
