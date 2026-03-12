// クエスト一覧（管理者用・テストユーザー1のみ）。既存クエストの編集のみ（新規作成は後回し）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminQuestList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";

const QUEST_TYPE_LABELS: Record<string, string> = {
  story: "使命",
  research: "研究",
  special: "特殊",
  general: "一般",
};

export default async function AdminQuestsPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const list = await getAdminQuestList();
  if (!list) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← ダッシュボード
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-text-primary">開拓任務編集</h1>
        <p className="mt-2 text-sm text-text-muted">
          spec/054。既存の開拓任務の名前・説明・達成条件・報酬（GRA・研究記録書・アイテム）を編集します。新規作成は後回し。
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                code
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-24">
                種別
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                name
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium max-w-[180px]">
                前提任務
              </th>
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                  {row.code}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {QUEST_TYPE_LABELS[row.questType] ?? row.questType}
                </td>
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {row.prerequisiteCodes.length > 0 ? row.prerequisiteCodes.join(", ") : "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <Link
                    href={`/dashboard/admin/quests/${row.id}`}
                    className="text-brass hover:text-brass-hover"
                  >
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
