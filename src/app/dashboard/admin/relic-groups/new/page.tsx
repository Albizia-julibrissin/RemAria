import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminRelicPassiveEffectList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminRelicGroupCreateForm } from "./admin-relic-group-create-form";

export default async function AdminRelicGroupNewPage() {
  if (!(await isTestUser1())) redirect("/dashboard");
  const passives = await getAdminRelicPassiveEffectList();
  if (!passives) redirect("/dashboard");
  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/admin/relic-groups" className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass">← 遺物グループ一覧</Link>
        <Link href="/dashboard/admin/content" className="text-sm text-text-muted hover:text-brass">コンテンツ管理</Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">遺物グループ新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">groupCode は RelicType.groupCode およびトークン→グループと一致させてください。ステ・耐性は鑑定時の抽選範囲です。</p>
      <AdminRelicGroupCreateForm passives={passives} />
    </main>
  );
}
