import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminExplorationEvent } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminSkillEventEditForm } from "./admin-skill-event-edit-form";

export default async function AdminSkillEventEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isTestUser1())) redirect("/dashboard");
  const { id } = await params;
  const row = await getAdminExplorationEvent(id);
  if (!row) notFound();
  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/skill-events"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← 技能イベント一覧
        </Link>
        <Link href="/dashboard/admin/content" className="text-sm text-text-muted hover:text-brass">
          コンテンツ管理
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">技能イベント編集</h1>
      <p className="mt-2 text-sm text-text-muted">
        {row.code} — {row.name}
      </p>
      <AdminSkillEventEditForm event={row} />
    </main>
  );
}
