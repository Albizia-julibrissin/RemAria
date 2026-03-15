// 開拓任務 新規作成（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAdminQuestList,
  getAdminItemList,
  getAdminAreaList,
  getAdminEnemyList,
  getAdminExplorationThemeList,
  getAdminResearchGroupList,
  getAdminExplorationEventList,
  getAdminSkillList,
  getAdminTitleList,
} from "@/server/actions/admin";
import type { AdminQuestDetail } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminQuestEditForm } from "../[id]/admin-quest-edit-form";

const EMPTY_QUEST: AdminQuestDetail = {
  id: "",
  code: "",
  questType: "story",
  name: "",
  description: null,
  clearReportMessage: null,
  notifyChatOnClear: false,
  unlocksMarket: false,
  prerequisiteQuestIds: [],
  unlockThemeIds: [],
  unlockResearchGroupIds: [],
  achievementType: "area_clear",
  achievementParam: { areaId: undefined, count: 1 },
  rewardGra: 0,
  rewardResearchPoint: 0,
  rewardTitleId: null,
  rewardItems: [],
};

export default async function AdminQuestNewPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const [
    questList,
    itemList,
    areaList,
    enemyList,
    themeList,
    researchGroupList,
    explorationEventList,
    skillList,
    titleList,
  ] = await Promise.all([
    getAdminQuestList(),
    getAdminItemList(),
    getAdminAreaList(),
    getAdminEnemyList(),
    getAdminExplorationThemeList(),
    getAdminResearchGroupList(),
    getAdminExplorationEventList(),
    getAdminSkillList(),
    getAdminTitleList(),
  ]);

  if (
    !questList ||
    !itemList ||
    !areaList ||
    !enemyList ||
    !themeList ||
    !researchGroupList ||
    !explorationEventList ||
    !skillList ||
    !titleList
  ) {
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

      <h1 className="text-2xl font-bold text-text-primary">開拓任務 新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">code・name は必須。保存後に編集画面へ移動します。</p>

      <AdminQuestEditForm
        quest={EMPTY_QUEST}
        questList={questList}
        itemList={itemList}
        skillList={skillList}
        titleList={titleList}
        areaList={areaList}
        enemyList={enemyList}
        explorationEventList={explorationEventList}
        themeList={themeList}
        researchGroupList={researchGroupList}
      />
    </main>
  );
}
