"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminQuestDetail,
  AdminQuestRow,
  AdminExplorationThemeRow,
  AdminResearchGroupRow,
  UpdateAdminQuestInput,
} from "@/server/actions/admin";
import { updateAdminQuest } from "@/server/actions/admin";
import type { AdminItemRow } from "@/server/actions/admin";

const QUEST_TYPES = [
  { value: "story", label: "使命" },
  { value: "research", label: "研究" },
  { value: "special", label: "特殊" },
  { value: "general", label: "一般" },
];

const ACHIEVEMENT_TYPES = [
  { value: "area_clear", label: "エリア探索" },
  { value: "enemy_defeat", label: "エネミー撃破" },
];

type AreaOption = { id: string; code: string; name: string; themeName: string };
type EnemyOption = { id: string; code: string; name: string };

type Props = {
  quest: AdminQuestDetail;
  questList: AdminQuestRow[];
  itemList: AdminItemRow[];
  areaList: AreaOption[];
  enemyList: EnemyOption[];
  themeList: AdminExplorationThemeRow[];
  researchGroupList: AdminResearchGroupRow[];
};

function parseAchievementParam(param: unknown): {
  type: "area_clear" | "enemy_defeat";
  areaId: string;
  enemyId: string;
  count: number;
} {
  const p = param as { areaId?: string; enemyId?: string; count?: number } | null;
  if (p && typeof p.areaId === "string") {
    return {
      type: "area_clear",
      areaId: p.areaId,
      enemyId: "",
      count: typeof p.count === "number" && p.count >= 0 ? p.count : 1,
    };
  }
  if (p && typeof p.enemyId === "string") {
    return {
      type: "enemy_defeat",
      areaId: "",
      enemyId: p.enemyId,
      count: typeof p.count === "number" && p.count >= 0 ? p.count : 1,
    };
  }
  return { type: "area_clear", areaId: "", enemyId: "", count: 1 };
}

export function AdminQuestEditForm({
  quest,
  questList,
  itemList,
  areaList,
  enemyList,
  themeList,
  researchGroupList,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const parsed = parseAchievementParam(quest.achievementParam);

  const [code, setCode] = useState(quest.code);
  const [questType, setQuestType] = useState(quest.questType);
  const [name, setName] = useState(quest.name);
  const [description, setDescription] = useState(quest.description ?? "");
  const [clearReportMessage, setClearReportMessage] = useState(
    quest.clearReportMessage ?? ""
  );
  const [prerequisiteQuestIds, setPrerequisiteQuestIds] = useState<string[]>(
    quest.prerequisiteQuestIds ?? []
  );
  const [achievementType, setAchievementType] = useState<"area_clear" | "enemy_defeat">(
    ACHIEVEMENT_TYPES.some((t) => t.value === quest.achievementType)
      ? (quest.achievementType as "area_clear" | "enemy_defeat")
      : parsed.type
  );
  const [achievementAreaId, setAchievementAreaId] = useState(parsed.areaId);
  const [achievementEnemyId, setAchievementEnemyId] = useState(parsed.enemyId);
  const [achievementCount, setAchievementCount] = useState(parsed.count);
  const [rewardGra, setRewardGra] = useState(String(quest.rewardGra));
  const [rewardResearchPoint, setRewardResearchPoint] = useState(
    String(quest.rewardResearchPoint)
  );
  const [rewardTitleId, setRewardTitleId] = useState(quest.rewardTitleId ?? "");
  const [rewardItems, setRewardItems] = useState<{ itemId: string; amount: number }[]>(
    quest.rewardItems.length > 0 ? [...quest.rewardItems] : [{ itemId: "", amount: 1 }]
  );
  const [unlockThemeIds, setUnlockThemeIds] = useState<string[]>(
    quest.unlockThemeIds ?? []
  );
  const [unlockResearchGroupIds, setUnlockResearchGroupIds] = useState<string[]>(
    quest.unlockResearchGroupIds ?? []
  );

  const prerequisiteOptions = questList.filter((q) => q.id !== quest.id);

  const toggleTheme = (themeId: string) => {
    setUnlockThemeIds((prev) =>
      prev.includes(themeId) ? prev.filter((id) => id !== themeId) : [...prev, themeId]
    );
  };
  const toggleResearchGroup = (groupId: string) => {
    setUnlockResearchGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const count = Math.max(0, Number(achievementCount) || 0);
    const achievementParamJson =
      achievementType === "area_clear"
        ? JSON.stringify({ areaId: achievementAreaId || undefined, count: count || 1 })
        : JSON.stringify({ enemyId: achievementEnemyId || undefined, count });

    const input: UpdateAdminQuestInput = {
      code,
      questType,
      name,
      description: description.trim() || null,
      clearReportMessage: clearReportMessage.trim() || null,
      prerequisiteQuestIds,
      achievementType,
      achievementParamJson,
      rewardGra: /^\d+$/.test(rewardGra.trim()) ? parseInt(rewardGra.trim(), 10) : 0,
      rewardResearchPoint: /^\d+$/.test(rewardResearchPoint.trim())
        ? parseInt(rewardResearchPoint.trim(), 10)
        : 0,
      rewardTitleId: rewardTitleId.trim() || null,
      rewardItems: rewardItems.filter((r) => r.itemId.trim() && r.amount > 0),
      unlockThemeIds,
      unlockResearchGroupIds,
    };
    startTransition(async () => {
      const result = await updateAdminQuest(quest.id, input);
      setMessage(
        result.success
          ? { type: "ok", text: "保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const addRewardItemRow = () => {
    setRewardItems((prev) => [...prev, { itemId: "", amount: 1 }]);
  };
  const removeRewardItemRow = (index: number) => {
    setRewardItems((prev) => prev.filter((_, i) => i !== index));
  };
  const updateRewardItem = (index: number, field: "itemId" | "amount", value: string | number) => {
    setRewardItems((prev) => {
      const next = [...prev];
      if (field === "itemId") next[index] = { ...next[index], itemId: String(value) };
      else next[index] = { ...next[index], amount: typeof value === "number" ? value : parseInt(String(value), 10) || 0 };
      return next;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
      {message && (
        <p
          className={`text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}
        >
          {message.text}
        </p>
      )}

      <section className="space-y-4 rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          基本
        </h2>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-text-muted">
            code（ユニーク）
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label htmlFor="questType" className="block text-sm font-medium text-text-muted">
            種別
          </label>
          <select
            id="questType"
            value={questType}
            onChange={(e) => setQuestType(e.target.value)}
            className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
          >
            {QUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text-muted">
            name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-muted">
            description（任意）
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label htmlFor="clearReportMessage" className="block text-sm font-medium text-text-muted">
            clearReportMessage（クリア報告モーダル用・任意）
          </label>
          <textarea
            id="clearReportMessage"
            rows={3}
            value={clearReportMessage}
            onChange={(e) => setClearReportMessage(e.target.value)}
            className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <span className="block text-sm font-medium text-text-muted">
            前提開拓任務（複数可・すべて完了で出現）
          </span>
          <ul className="mt-2 space-y-1.5 rounded border border-base-border bg-base p-3 max-h-48 overflow-y-auto">
            {prerequisiteOptions.map((q) => (
              <li key={q.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`prereq-${q.id}`}
                  checked={prerequisiteQuestIds.includes(q.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPrerequisiteQuestIds((prev) => [...prev, q.id]);
                    } else {
                      setPrerequisiteQuestIds((prev) => prev.filter((id) => id !== q.id));
                    }
                  }}
                  className="rounded border-base-border text-brass focus:ring-brass"
                />
                <label htmlFor={`prereq-${q.id}`} className="text-sm text-text-primary cursor-pointer">
                  {q.code} — {q.name}
                </label>
              </li>
            ))}
            {prerequisiteOptions.length === 0 && (
              <li className="text-sm text-text-muted">他に任務がありません。</li>
            )}
          </ul>
        </div>
      </section>

      <section className="space-y-4 rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          達成条件
        </h2>
        <div>
          <label htmlFor="achievementType" className="block text-sm font-medium text-text-muted">
            種類
          </label>
          <select
            id="achievementType"
            value={achievementType}
            onChange={(e) =>
              setAchievementType(e.target.value as "area_clear" | "enemy_defeat")
            }
            className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
          >
            {ACHIEVEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {achievementType === "area_clear" && (
          <>
            <div>
              <label
                htmlFor="achievementAreaId"
                className="block text-sm font-medium text-text-muted"
              >
                どのエリアか？
              </label>
              <select
                id="achievementAreaId"
                value={achievementAreaId}
                onChange={(e) => setAchievementAreaId(e.target.value)}
                className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
              >
                <option value="">— 選択 —</option>
                {areaList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}（{a.themeName} / {a.code}）
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="achievementCountArea"
                className="block text-sm font-medium text-text-muted"
              >
                何回クリアか？
              </label>
              <input
                id="achievementCountArea"
                type="number"
                min={1}
                value={achievementCount}
                onChange={(e) => setAchievementCount(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
              />
            </div>
          </>
        )}

        {achievementType === "enemy_defeat" && (
          <>
            <div>
              <label
                htmlFor="achievementEnemyId"
                className="block text-sm font-medium text-text-muted"
              >
                どのエネミーか？
              </label>
              <select
                id="achievementEnemyId"
                value={achievementEnemyId}
                onChange={(e) => setAchievementEnemyId(e.target.value)}
                className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
              >
                <option value="">— 選択 —</option>
                {enemyList.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}（{e.code}）
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="achievementCountEnemy"
                className="block text-sm font-medium text-text-muted"
              >
                何体撃破か？
              </label>
              <input
                id="achievementCountEnemy"
                type="number"
                min={0}
                value={achievementCount}
                onChange={(e) => setAchievementCount(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
              />
            </div>
          </>
        )}
      </section>

      <section className="space-y-4 rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          機能解放（spec/068）
        </h2>
        <p className="text-sm text-text-muted">
          この任務をクリア報告すると、選択した探索テーマ・研究グループが解放されます。
        </p>
        <div>
          <span className="block text-sm font-medium text-text-muted mb-2">
            解放する探索テーマ（複数可）
          </span>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {themeList.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <input
                  id={`theme-${t.id}`}
                  type="checkbox"
                  checked={unlockThemeIds.includes(t.id)}
                  onChange={() => toggleTheme(t.id)}
                  className="rounded border-base-border text-brass focus:ring-brass"
                />
                <label htmlFor={`theme-${t.id}`} className="text-sm text-text-primary">
                  {t.name}（{t.code}）
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="block text-sm font-medium text-text-muted mb-2">
            解禁する研究グループ（複数可）
          </span>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {researchGroupList.map((g) => (
              <li key={g.id} className="flex items-center gap-2">
                <input
                  id={`group-${g.id}`}
                  type="checkbox"
                  checked={unlockResearchGroupIds.includes(g.id)}
                  onChange={() => toggleResearchGroup(g.id)}
                  className="rounded border-base-border text-brass focus:ring-brass"
                />
                <label htmlFor={`group-${g.id}`} className="text-sm text-text-primary">
                  {g.name}（{g.code}）
                </label>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4 rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          報酬
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rewardGra" className="block text-sm font-medium text-text-muted">
              報酬 GRA（無償）
            </label>
            <input
              id="rewardGra"
              type="number"
              min={0}
              value={rewardGra}
              onChange={(e) => setRewardGra(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
          <div>
            <label htmlFor="rewardResearchPoint" className="block text-sm font-medium text-text-muted">
              報酬 研究記録書
            </label>
            <input
              id="rewardResearchPoint"
              type="number"
              min={0}
              value={rewardResearchPoint}
              onChange={(e) => setRewardResearchPoint(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
        </div>
        <div>
          <label htmlFor="rewardTitleId" className="block text-sm font-medium text-text-muted">
            rewardTitleId（称号・任意）
          </label>
          <input
            id="rewardTitleId"
            type="text"
            value={rewardTitleId}
            onChange={(e) => setRewardTitleId(e.target.value)}
            placeholder="称号のID（未実装時は空で可）"
            className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-text-muted">
              報酬アイテム
            </label>
            <button
              type="button"
              onClick={addRewardItemRow}
              className="text-sm text-brass hover:text-brass-hover"
            >
              + 行追加
            </button>
          </div>
          <ul className="mt-2 space-y-2">
            {rewardItems.map((row, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <select
                  value={row.itemId}
                  onChange={(e) => updateRewardItem(index, "itemId", e.target.value)}
                  className="min-w-[200px] rounded border border-base-border bg-base px-3 py-1.5 text-sm text-text-primary"
                >
                  <option value="">— 選択 —</option>
                  {itemList.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code} — {it.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={row.amount}
                  onChange={(e) =>
                    updateRewardItem(index, "amount", parseInt(e.target.value, 10) || 0)
                  }
                  className="w-20 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                />
                <span className="text-sm text-text-muted">個</span>
                <button
                  type="button"
                  onClick={() => removeRewardItemRow(index)}
                  className="text-sm text-text-muted hover:text-error"
                  aria-label="この行を削除"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
        >
          {isPending ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/admin/quests")}
          className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border/50 focus:outline-none focus:ring-2 focus:ring-brass"
        >
          開拓任務一覧へ戻る
        </button>
      </div>
    </form>
  );
}
