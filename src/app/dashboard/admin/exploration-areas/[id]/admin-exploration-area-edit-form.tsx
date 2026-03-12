"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminExplorationAreaEditData,
  AdminEnemyGroupEntryRow,
  AdminExplorationAreaCostRow,
  UpdateAdminExplorationAreaInput,
} from "@/server/actions/admin";
import {
  updateAdminExplorationArea,
  saveEnemyGroupEntries,
  saveAdminExplorationAreaCosts,
} from "@/server/actions/admin";

type GroupEntryEdit = {
  tempId: string;
  enemyId: string;
  enemyCode: string;
  enemyName: string;
  weight: number;
};

type CostRowEdit = {
  tempId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
};

type Props = {
  data: AdminExplorationAreaEditData;
};

function toEditEntry(e: AdminEnemyGroupEntryRow): GroupEntryEdit {
  return {
    tempId: e.id,
    enemyId: e.enemyId,
    enemyCode: e.enemyCode,
    enemyName: e.enemyName,
    weight: e.weight,
  };
}

function toCostRow(c: AdminExplorationAreaCostRow): CostRowEdit {
  return {
    tempId: c.id,
    itemId: c.itemId,
    itemCode: c.itemCode,
    itemName: c.itemName,
    quantity: c.quantity,
  };
}

export function AdminExplorationAreaEditForm({ data }: Props) {
  const router = useRouter();
  const { area, enemyGroupCodes, enemies, normalEnemyGroup, areaCosts, itemsForCost } = data;
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [code, setCode] = useState(area.code);
  const [name, setName] = useState(area.name);
  const [description, setDescription] = useState(area.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(area.displayOrder ?? 0));
  const [difficultyRank, setDifficultyRank] = useState(String(area.difficultyRank));
  const [recommendedLevel, setRecommendedLevel] = useState(String(area.recommendedLevel));
  const [baseDropMin, setBaseDropMin] = useState(String(area.baseDropMin));
  const [baseDropMax, setBaseDropMax] = useState(String(area.baseDropMax));
  const [baseSkillEventRate, setBaseSkillEventRate] = useState(String(area.baseSkillEventRate));
  const [skillCheckRequiredValue, setSkillCheckRequiredValue] = useState(
    String(area.skillCheckRequiredValue)
  );
  const [normalBattleCount, setNormalBattleCount] = useState(String(area.normalBattleCount));
  const [normalEnemyGroupCode, setNormalEnemyGroupCode] = useState(
    area.normalEnemyGroupCode ?? ""
  );
  const [enemyCount1Rate, setEnemyCount1Rate] = useState(String(area.enemyCount1Rate));
  const [enemyCount2Rate, setEnemyCount2Rate] = useState(String(area.enemyCount2Rate));
  const [enemyCount3Rate, setEnemyCount3Rate] = useState(String(area.enemyCount3Rate));
  const [strongEnemyEnemyId, setStrongEnemyEnemyId] = useState(area.strongEnemyEnemyId ?? "");
  const [areaLordEnemyId, setAreaLordEnemyId] = useState(area.areaLordEnemyId ?? "");
  const [areaLordAppearanceRate, setAreaLordAppearanceRate] = useState(
    String(area.areaLordAppearanceRate ?? 50)
  );

  const [groupEntries, setGroupEntries] = useState<GroupEntryEdit[]>(() =>
    normalEnemyGroup ? normalEnemyGroup.entries.map(toEditEntry) : []
  );
  const [groupSaveMessage, setGroupSaveMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [groupSavePending, setGroupSavePending] = useState(false);

  const [costRows, setCostRows] = useState<CostRowEdit[]>(() =>
    data.areaCosts.map(toCostRow)
  );
  const [costSaveMessage, setCostSaveMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [costSavePending, setCostSavePending] = useState(false);

  useEffect(() => {
    if (normalEnemyGroup) {
      setGroupEntries(normalEnemyGroup.entries.map(toEditEntry));
    } else {
      setGroupEntries([]);
    }
  }, [normalEnemyGroup]);

  useEffect(() => {
    setCostRows(data.areaCosts.map(toCostRow));
  }, [data.areaCosts]);

  const handleSaveGroupEntries = () => {
    if (!normalEnemyGroup) return;
    setGroupSavePending(true);
    setGroupSaveMessage(null);
    saveEnemyGroupEntries(
      normalEnemyGroup.id,
      groupEntries.map((e) => ({ enemyId: e.enemyId, weight: e.weight }))
    ).then((result) => {
      setGroupSavePending(false);
      setGroupSaveMessage(
        result.success
          ? { type: "ok", text: "グループのメンバーを保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const addGroupEntry = () => {
    const first = enemies[0];
    if (!first) return;
    setGroupEntries((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}`,
        enemyId: first.id,
        enemyCode: first.code,
        enemyName: first.name,
        weight: 1,
      },
    ]);
  };

  const removeGroupEntry = (tempId: string) => {
    setGroupEntries((prev) => prev.filter((e) => e.tempId !== tempId));
  };

  const updateGroupEntry = (tempId: string, patch: Partial<GroupEntryEdit>) => {
    setGroupEntries((prev) =>
      prev.map((e) => (e.tempId === tempId ? { ...e, ...patch } : e))
    );
  };

  const addCostRow = () => {
    const first = itemsForCost[0];
    if (!first) return;
    setCostRows((prev) => [
      ...prev,
      {
        tempId: `cost-${Date.now()}`,
        itemId: first.id,
        itemCode: first.code,
        itemName: first.name,
        quantity: 1,
      },
    ]);
  };
  const removeCostRow = (tempId: string) => {
    setCostRows((prev) => prev.filter((r) => r.tempId !== tempId));
  };
  const updateCostRow = (tempId: string, patch: Partial<CostRowEdit>) => {
    setCostRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r))
    );
  };
  const handleSaveCosts = () => {
    setCostSavePending(true);
    setCostSaveMessage(null);
    saveAdminExplorationAreaCosts(
      area.id,
      costRows.map((r) => ({ itemId: r.itemId, quantity: r.quantity }))
    ).then((result) => {
      setCostSavePending(false);
      setCostSaveMessage(
        result.success
          ? { type: "ok", text: "出撃コストを保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const num = (v: string, def: number) =>
    v.trim() !== "" && /^\d+$/.test(v.trim()) ? parseInt(v.trim(), 10) : def;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminExplorationAreaInput = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      displayOrder: num(displayOrder, 0),
      difficultyRank: num(difficultyRank, 1),
      recommendedLevel: num(recommendedLevel, 1),
      baseDropMin: num(baseDropMin, 3),
      baseDropMax: num(baseDropMax, 5),
      baseSkillEventRate: num(baseSkillEventRate, 25),
      skillCheckRequiredValue: num(skillCheckRequiredValue, 80),
      normalBattleCount: num(normalBattleCount, 5),
      normalEnemyGroupCode: normalEnemyGroupCode.trim() || null,
      enemyCount1Rate: num(enemyCount1Rate, 34),
      enemyCount2Rate: num(enemyCount2Rate, 33),
      enemyCount3Rate: num(enemyCount3Rate, 33),
      strongEnemyEnemyId: strongEnemyEnemyId.trim() || null,
      areaLordEnemyId: areaLordEnemyId.trim() || null,
      areaLordAppearanceRate: num(areaLordAppearanceRate, 50),
    };
    startTransition(async () => {
      const result = await updateAdminExplorationArea(area.id, input);
      setMessage(
        result.success
          ? { type: "ok", text: "保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-3xl space-y-6">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">基本</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-muted">code（ユニーク）</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-text-muted">description（任意）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">表示順・難易度・推奨レベル</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted">displayOrder（テーマ内の表示順・小さいほど上）</label>
            <input
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              className="mt-1 w-20 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">difficultyRank</label>
            <input
              type="number"
              min={1}
              value={difficultyRank}
              onChange={(e) => setDifficultyRank(e.target.value)}
              className="mt-1 w-20 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">recommendedLevel</label>
            <input
              type="number"
              min={1}
              value={recommendedLevel}
              onChange={(e) => setRecommendedLevel(e.target.value)}
              className="mt-1 w-20 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">ドロップ・技能</h2>
        <p className="mt-1 text-xs text-text-muted">枠レンジ・技能発生率・必要値・雑魚戦回数</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-text-muted">baseDropMin</label>
            <input
              type="number"
              min={0}
              value={baseDropMin}
              onChange={(e) => setBaseDropMin(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">baseDropMax</label>
            <input
              type="number"
              min={0}
              value={baseDropMax}
              onChange={(e) => setBaseDropMax(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">baseSkillEventRate（%）</label>
            <input
              type="number"
              min={0}
              max={100}
              value={baseSkillEventRate}
              onChange={(e) => setBaseSkillEventRate(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">skillCheckRequiredValue</label>
            <input
              type="number"
              min={1}
              value={skillCheckRequiredValue}
              onChange={(e) => setSkillCheckRequiredValue(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">normalBattleCount</label>
            <input
              type="number"
              min={1}
              value={normalBattleCount}
              onChange={(e) => setNormalBattleCount(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">敵（spec/050）</h2>
        <div className="mt-3 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted">
              通常戦 雑魚グループ（EnemyGroup.code）
            </label>
            <select
              value={normalEnemyGroupCode}
              onChange={(e) => setNormalEnemyGroupCode(e.target.value)}
              className="mt-1 rounded border border-base-border bg-base px-3 py-2 text-text-primary min-w-[200px]"
            >
              <option value="">— 未設定 —</option>
              {enemyGroupCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-muted">
              グループを保存したあと、下でこのグループに出す敵と重みを編集できます。グループがまだない場合は
              <a
                href="/dashboard/admin/enemy-groups"
                className="text-brass hover:text-brass-hover ml-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                敵グループ編集
              </a>
              で新規作成してください。
            </p>
          </div>

          {normalEnemyGroup && (
            <div className="space-y-2 rounded border border-base-border bg-base p-3 sm:col-span-2">
              <h3 className="text-sm font-medium text-text-primary">
                このグループのメンバー（通常戦で抽選される敵）
              </h3>
              {groupSaveMessage && (
                <p
                  className={`text-sm ${groupSaveMessage.type === "ok" ? "text-success" : "text-error"}`}
                >
                  {groupSaveMessage.text}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-sm border-collapse border border-base-border">
                  <thead>
                    <tr className="bg-base">
                      <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                        敵
                      </th>
                      <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                        重み
                      </th>
                      <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupEntries.map((row) => (
                      <tr key={row.tempId} className="text-text-primary">
                        <td className="border border-base-border px-2 py-1.5">
                          <select
                            value={row.enemyId}
                            onChange={(e) => {
                              const en = enemies.find((x) => x.id === e.target.value);
                              if (en)
                                updateGroupEntry(row.tempId, {
                                  enemyId: en.id,
                                  enemyCode: en.code,
                                  enemyName: en.name,
                                });
                            }}
                            className="w-full max-w-[200px] rounded border border-base-border bg-base px-2 py-1 text-text-primary"
                          >
                            {enemies.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.code} — {e.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-base-border px-2 py-1.5">
                          <input
                            type="number"
                            min={1}
                            value={row.weight}
                            onChange={(e) =>
                              updateGroupEntry(row.tempId, {
                                weight: parseInt(e.target.value, 10) || 1,
                              })
                            }
                            className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
                          />
                        </td>
                        <td className="border border-base-border px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeGroupEntry(row.tempId)}
                            className="text-error hover:underline text-xs"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addGroupEntry}
                  disabled={enemies.length === 0}
                  className="rounded border border-base-border bg-base-elevated px-3 py-1.5 text-sm text-text-primary hover:bg-base disabled:opacity-50"
                >
                  ＋ 敵を追加
                </button>
                <button
                  type="button"
                  onClick={handleSaveGroupEntries}
                  disabled={groupSavePending}
                  className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
                >
                  {groupSavePending ? "保存中…" : "メンバーを保存"}
                </button>
              </div>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-text-muted">
              体数 1/2/3 の出現率（合計100）
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={enemyCount1Rate}
                onChange={(e) => setEnemyCount1Rate(e.target.value)}
                className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={enemyCount2Rate}
                onChange={(e) => setEnemyCount2Rate(e.target.value)}
                className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={enemyCount3Rate}
                onChange={(e) => setEnemyCount3Rate(e.target.value)}
                className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">強敵（Enemy 1体）</label>
            <select
              value={strongEnemyEnemyId}
              onChange={(e) => setStrongEnemyEnemyId(e.target.value)}
              className="mt-1 rounded border border-base-border bg-base px-3 py-2 text-text-primary min-w-[200px]"
            >
              <option value="">— 未設定 —</option>
              {enemies.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">領域主（Enemy 1体）</label>
            <select
              value={areaLordEnemyId}
              onChange={(e) => setAreaLordEnemyId(e.target.value)}
              className="mt-1 rounded border border-base-border bg-base px-3 py-2 text-text-primary min-w-[200px]"
            >
              <option value="">— 未設定 —</option>
              {enemies.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">領域主出現率（%）</label>
            <p className="mt-0.5 text-xs text-text-muted">強敵勝利後に領域主が出現する確率。0～100。</p>
            <input
              type="number"
              min={0}
              max={100}
              value={areaLordAppearanceRate}
              onChange={(e) => setAreaLordAppearanceRate(e.target.value)}
              className="mt-1 w-20 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">出撃コスト（spec/049）</h2>
        <p className="mt-1 text-sm text-text-muted">
          探索開始時にユーザー在庫から消費するアイテム・数量。1行＝1種類。同一アイテムは1行のみ（保存時にまとめます）。
        </p>
        {costSaveMessage && (
          <p
            className={`mt-2 text-sm ${costSaveMessage.type === "ok" ? "text-success" : "text-error"}`}
          >
            {costSaveMessage.text}
          </p>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm border-collapse border border-base-border">
            <thead>
              <tr className="bg-base">
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  アイテム
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-24">
                  数量
                </th>
                <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {costRows.map((row) => (
                <tr key={row.tempId} className="text-text-primary">
                  <td className="border border-base-border px-2 py-1.5">
                    <select
                      value={row.itemId}
                      onChange={(e) => {
                        const it = itemsForCost.find((x) => x.id === e.target.value);
                        if (it)
                          updateCostRow(row.tempId, {
                            itemId: it.id,
                            itemCode: it.code,
                            itemName: it.name,
                          });
                      }}
                      className="w-full max-w-[220px] rounded border border-base-border bg-base px-2 py-1 text-text-primary"
                    >
                      {itemsForCost.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.code} — {it.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-base-border px-2 py-1.5">
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) =>
                        updateCostRow(row.tempId, {
                          quantity: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className="w-20 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
                    />
                  </td>
                  <td className="border border-base-border px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeCostRow(row.tempId)}
                      className="text-error hover:underline text-xs"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addCostRow}
            disabled={itemsForCost.length === 0}
            className="rounded border border-base-border bg-base-elevated px-3 py-1.5 text-sm text-text-primary hover:bg-base disabled:opacity-50"
          >
            ＋ 行を追加
          </button>
          <button
            type="button"
            onClick={handleSaveCosts}
            disabled={costSavePending}
            className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
          >
            {costSavePending ? "保存中…" : "出撃コストを保存"}
          </button>
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
      >
        {isPending ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
