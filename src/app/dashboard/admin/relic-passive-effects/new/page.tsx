import Link from "next/link";
import { redirect } from "next/navigation";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminRelicPassiveEffectCreateForm } from "./admin-relic-passive-effect-create-form";

export default async function AdminRelicPassiveEffectNewPage() {
  if (!(await isTestUser1())) redirect("/dashboard");
  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/admin/relic-passive-effects" className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass">← 遺物パッシブ効果一覧</Link>
        <Link href="/dashboard/admin/content" className="text-sm text-text-muted hover:text-brass">コンテンツ管理</Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">遺物パッシブ効果新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">code / name / description。code はユニークです。</p>
      <AdminRelicPassiveEffectCreateForm />
    </main>
  );
}
