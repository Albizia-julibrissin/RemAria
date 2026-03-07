import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminRelicPassiveEffect } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminRelicPassiveEffectEditForm } from "./admin-relic-passive-effect-edit-form";

export default async function AdminRelicPassiveEffectEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isTestUser1())) redirect("/dashboard");
  const { id } = await params;
  const row = await getAdminRelicPassiveEffect(id);
  if (!row) notFound();
  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/admin/relic-passive-effects" className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass">← 遺物パッシブ効果一覧</Link>
        <Link href="/dashboard/admin/content" className="text-sm text-text-muted hover:text-brass">コンテンツ管理</Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">遺物パッシブ効果編集</h1>
      <p className="mt-2 text-sm text-text-muted">{row.code} — {row.name}</p>
      <AdminRelicPassiveEffectEditForm effect={row} />
    </main>
  );
}
