// docs/054 - クエスト一覧・フィルタ・進捗・クリア報告

import Link from "next/link";
import { getQuestList } from "@/server/actions/quest";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { QuestListClient } from "./quest-list-client";

const FILTERS = [
  { value: "all" as const, label: "すべて" },
  { value: "story" as const, label: "使命" },
  { value: "research" as const, label: "研究" },
  { value: "special" as const, label: "特殊" },
  { value: "general" as const, label: "一般" },
  { value: "completed" as const, label: "完了" },
];

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const raw = params.filter ?? "";
  const filter: "all" | "story" | "research" | "special" | "general" | "completed" =
    raw === "story" || raw === "research" || raw === "special" || raw === "general" || raw === "completed"
      ? raw
      : "all";

  const result = await getQuestList(filter);

  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  if (!result.success) {
    return (
      <main className="min-h-screen bg-base p-8">
        <MenuPageHeaderClient
          title="開拓任務"
          description="使命・研究・特殊・一般の開拓任務の進捗"
          currentPath="/dashboard/quests"
        />
        <p className="text-text-muted">{result.error === "UNAUTHORIZED" ? "ログインしてください。" : result.error}</p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
        <footer className="mt-8 border-t border-base-border pt-4">
          <Link href="/dashboard" className={footerLinkClass}>
            ← 開拓拠点に戻る
          </Link>
        </footer>
      </main>
    );
  }

  const { quests } = result;

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="開拓任務"
        description="使命・研究・特殊・一般の開拓任務の進捗。条件を満たすと報告可能になり報酬が付与されます。達成した任務は「クリア報告」でメッセージを確認するとクリア済みとして記録されます。"
        currentPath="/dashboard/quests"
      />
      <nav className="mt-2 flex gap-2 border-b border-base-border" aria-label="開拓任務フィルタ">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={
              f.value === "all"
                ? "/dashboard/quests"
                : `/dashboard/quests?filter=${f.value}`
            }
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
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
