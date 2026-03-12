// クエスト 1件編集（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  getAdminQuest,
  getAdminQuestList,
  getAdminItemList,
  getAdminAreaList,
  getAdminEnemyList,
  getAdminExplorationThemeList,
  getAdminResearchGroupList,
} from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminQuestEditForm } from "./admin-quest-edit-form";

export default async function AdminQuestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const [quest, questList, itemList, areaList, enemyList, themeList, researchGroupList] =
    await Promise.all([
      getAdminQuest(id),
      getAdminQuestList(),
      getAdminItemList(),
      getAdminAreaList(),
      getAdminEnemyList(),
      getAdminExplorationThemeList(),
      getAdminResearchGroupList(),
    ]);

  if (!quest) {
    notFound();
  }
  if (!questList || !itemList || !areaList || !enemyList || !themeList || !researchGroupList) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/quests"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← 開拓任務一覧
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">開拓任務編集</h1>
      <p className="mt-2 text-sm text-text-muted font-mono">
        {quest.code} — {quest.name}
      </p>

      <AdminQuestEditForm
        quest={quest}
        questList={questList}
        itemList={itemList}
        areaList={areaList}
        enemyList={enemyList}
        themeList={themeList}
        researchGroupList={researchGroupList}
      />
    </main>
  );
}
