import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminBattleSkillOptions } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminEnemyCreateForm } from "./admin-enemy-create-form";

export default async function AdminEnemyNewPage() {
  if (!(await isTestUser1())) redirect("/dashboard");
  const skillOptions = await getAdminBattleSkillOptions();
  if (!skillOptions) redirect("/dashboard");
  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/admin/enemies" className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass">← 敵一覧</Link>
        <Link href="/dashboard/admin/content" className="text-sm text-text-muted hover:text-brass">コンテンツ管理</Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">敵マスタ新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">code / name / 基礎ステ・配置・作戦スロット（最大10）。spec/050。</p>
      <AdminEnemyCreateForm skillOptions={skillOptions} />
    </main>
  );
}
