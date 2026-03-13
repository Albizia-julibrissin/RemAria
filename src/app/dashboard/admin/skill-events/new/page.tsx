import Link from "next/link";
import { redirect } from "next/navigation";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminSkillEventCreateForm } from "./admin-skill-event-create-form";

export default async function AdminSkillEventNewPage() {
  if (!(await isTestUser1())) redirect("/dashboard");
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
      <h1 className="text-2xl font-bold text-text-primary">技能イベント 新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">code / name / 発生メッセージ / 各ステータス（係数・成功/失敗メッセージ）</p>
      <AdminSkillEventCreateForm />
    </main>
  );
}
