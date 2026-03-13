// 技能イベント一覧（管理者用・spec/073）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminExplorationEventList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

export default async function AdminSkillEventsPage() {
  const allowed = await isTestUser1();
  if (!allowed) redirect("/dashboard");

  const list = await getAdminExplorationEventList();
  if (!list) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/content"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← コンテンツ管理
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">技能イベント編集</h1>
          <p className="mt-2 text-sm text-text-muted">
            ExplorationEvent（skill_check）。発生メッセージ・ステータス別係数・成功/失敗メッセージ。spec/073。
          </p>
        </div>
        <Link
          href="/dashboard/admin/skill-events/new"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass"
        >
          新規作成
        </Link>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse border border-base-border text-sm">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted">code</th>
              <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted">name</th>
              <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted max-w-[280px]">発生メッセージ</th>
              <th className="w-16 border border-base-border px-2 py-1.5 text-center font-medium text-text-muted">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">{row.code}</td>
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="max-w-[280px] truncate border border-base-border px-2 py-1.5 text-text-muted">
                  {row.occurrenceMessage ?? "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <Link href={`/dashboard/admin/skill-events/${row.id}`} className="text-brass hover:text-brass-hover">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">計 {list.length} 件</p>
    </main>
  );
}
