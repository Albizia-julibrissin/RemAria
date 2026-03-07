import Link from "next/link";
import { redirect } from "next/navigation";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminRelicTypeCreateForm } from "./admin-relic-type-create-form";

export default async function AdminRelicTypeNewPage() {
  if (!(await isTestUser1())) redirect("/dashboard");
  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/admin/relic-types" className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass">← 遺物型一覧</Link>
        <Link href="/dashboard/admin/content" className="text-sm text-text-muted hover:text-brass">コンテンツ管理</Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">遺物型新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">code / name / groupCode。name はユニークではありませんが code はユニークです。</p>
      <AdminRelicTypeCreateForm />
    </main>
  );
}
