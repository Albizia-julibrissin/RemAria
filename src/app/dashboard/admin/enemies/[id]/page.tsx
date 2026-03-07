import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminEnemy, getAdminBattleSkillOptions } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminEnemyEditForm } from "./admin-enemy-edit-form";

export default async function AdminEnemyEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isTestUser1())) redirect("/dashboard");
  const { id } = await params;
  const [enemy, skillOptions] = await Promise.all([
    getAdminEnemy(id),
    getAdminBattleSkillOptions(),
  ]);
  if (!enemy || !skillOptions) notFound();
  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/admin/enemies" className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass">← 敵一覧</Link>
        <Link href="/dashboard/admin/content" className="text-sm text-text-muted hover:text-brass">コンテンツ管理</Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">敵マスタ編集</h1>
      <p className="mt-2 text-sm text-text-muted">{enemy.code} — {enemy.name}</p>
      <AdminEnemyEditForm enemy={enemy} skillOptions={skillOptions} />
    </main>
  );
}
