import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminRelicGroupConfig, getAdminRelicPassiveEffectList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminRelicGroupEditForm } from "./admin-relic-group-edit-form";

export default async function AdminRelicGroupEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isTestUser1())) redirect("/dashboard");
  const { id } = await params;
  const [config, passives] = await Promise.all([
    getAdminRelicGroupConfig(id),
    getAdminRelicPassiveEffectList(),
  ]);
  if (!config || !passives) notFound();
  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/admin/relic-groups" className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass">← 遺物グループ一覧</Link>
        <Link href="/dashboard/admin/content" className="text-sm text-text-muted hover:text-brass">コンテンツ管理</Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">遺物グループ編集</h1>
      <p className="mt-2 text-sm text-text-muted">{config.groupCode} — {config.name ?? "（名前未設定）"}</p>
      <AdminRelicGroupEditForm config={config} passives={passives} />
    </main>
  );
}
