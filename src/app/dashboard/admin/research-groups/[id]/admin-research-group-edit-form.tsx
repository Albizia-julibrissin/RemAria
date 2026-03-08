"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminResearchGroupEditData,
  AdminResearchGroupItemRow,
} from "@/server/actions/admin";
import {
  updateAdminResearchGroup,
  saveAdminResearchGroupItems,
  saveAdminResearchUnlockCosts,
} from "@/server/actions/admin";

type ItemEdit = {
  tempId: string;
  targetType: "facility_type" | "craft_recipe";
  targetId: string;
  targetName: string;
  isVariant: boolean;
  displayOrder: number;
  costs: { itemId: string; amount: number }[];
};

function toItemEdit(row: AdminResearchGroupItemRow, index: number): ItemEdit {
  return {
    tempId: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    targetName: row.targetName,
    isVariant: row.isVariant,
    displayOrder: row.displayOrder,
    costs: row.costs.map((c) => ({ itemId: c.itemId, amount: c.amount })),
  };
}

type Props = {
  data: AdminResearchGroupEditData;
};

export function AdminResearchGroupEditForm({ data }: Props) {
  const router = useRouter();
  const { group, groupItems, facilityTypes, craftRecipes, items, researchGroups } = data;
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [code, setCode] = useState(group.code);
  const [name, setName] = useState(group.name);
  const [displayOrder, setDisplayOrder] = useState(group.displayOrder);
  const [prerequisiteGroupId, setPrerequisiteGroupId] = useState(
    group.prerequisiteGroupId ?? ""
  );

  const [editableItems, setEditableItems] = useState<ItemEdit[]>(() =>
    groupItems.map((r, i) => toItemEdit(r, i))
  );
  const itemsSig = useMemo(
    () => groupItems.map((r) => `${r.id}:${r.targetType}:${r.targetId}`).join(","),
    [groupItems]
  );
  useEffect(() => {
    setEditableItems(groupItems.map((r, i) => toItemEdit(r, i)));
  }, [group.id, itemsSig]);

  const [itemsSavePending, setItemsSavePending] = useState(false);
  const [itemsSaveMessage, setItemsSaveMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [costSavePending, setCostSavePending] = useState<string | null>(null);

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateAdminResearchGroup(group.id, {
        code: code.trim(),
        name: name.trim(),
        displayOrder,
        prerequisiteGroupId: prerequisiteGroupId.trim() || undefined,
      });
      setMessage(
        result.success
          ? { type: "ok", text: "グループを保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const handleSaveItems = () => {
    setItemsSavePending(true);
    setItemsSaveMessage(null);
    const payload = editableItems
      .filter((i) => i.targetId.trim())
      .map((i, idx) => ({
        targetType: i.targetType,
        targetId: i.targetId,
        isVariant: i.isVariant,
        displayOrder: i.displayOrder,
      }));
    saveAdminResearchGroupItems(group.id, payload).then((result) => {
      setItemsSavePending(false);
      setItemsSaveMessage(
        result.success
          ? { type: "ok", text: "解放対象を保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const handleSaveCosts = (targetType: "facility_type" | "craft_recipe", targetId: string) => {
    const key = `${targetType}:${targetId}`;
    setCostSavePending(key);
    const item = editableItems.find((i) => i.targetType === targetType && i.targetId === targetId);
    const costs = item?.costs ?? [];
    saveAdminResearchUnlockCosts(targetType, targetId, costs).then((result) => {
      setCostSavePending(null);
      setMessage(
        result.success
          ? { type: "ok", text: "消費アイテムを保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const addItem = () => {
    const firstFacility = facilityTypes[0];
    setEditableItems((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}`,
        targetType: "facility_type",
        targetId: firstFacility?.id ?? "",
        targetName: firstFacility?.name ?? "",
        isVariant: false,
        displayOrder: prev.length,
        costs: [],
      },
    ]);
  };

  const removeItem = (tempId: string) => {
    setEditableItems((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const updateItem = (
    tempId: string,
    patch: Partial<Pick<ItemEdit, "targetType" | "targetId" | "targetName" | "isVariant" | "displayOrder">>
  ) => {
    setEditableItems((prev) =>
      prev.map((i) => (i.tempId === tempId ? { ...i, ...patch } : i))
    );
  };

  const updateItemTarget = (
    tempId: string,
    targetType: "facility_type" | "craft_recipe",
    targetId: string
  ) => {
    const name =
      targetType === "facility_type"
        ? facilityTypes.find((f) => f.id === targetId)?.name ?? ""
        : craftRecipes.find((r) => r.id === targetId)?.name ?? "";
    updateItem(tempId, { targetType, targetId, targetName: name });
  };

  const addCost = (tempId: string) => {
    const firstItem = items[0];
    setEditableItems((prev) =>
      prev.map((i) =>
        i.tempId === tempId
          ? { ...i, costs: [...i.costs, { itemId: firstItem?.id ?? "", amount: 1 }] }
          : i
      )
    );
  };

  const removeCost = (tempId: string, costIndex: number) => {
    setEditableItems((prev) =>
      prev.map((i) =>
        i.tempId === tempId
          ? { ...i, costs: i.costs.filter((_, idx) => idx !== costIndex) }
          : i
      )
    );
  };

  const updateCost = (
    tempId: string,
    costIndex: number,
    field: "itemId" | "amount",
    value: string | number
  ) => {
    setEditableItems((prev) =>
      prev.map((i) => {
        if (i.tempId !== tempId) return i;
        const next = [...i.costs];
        if (!next[costIndex]) return i;
        if (field === "itemId") next[costIndex] = { ...next[costIndex], itemId: value as string };
        else next[costIndex] = { ...next[costIndex], amount: (value as number) || 1 };
        return { ...i, costs: next };
      })
    );
  };

  return (
    <div className="mt-6 max-w-4xl space-y-8">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">グループ</h2>
        <form onSubmit={handleSaveGroup} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted">code（ユニーク）</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="mt-1 w-48 rounded border border-base-border bg-base px-3 py-2 text-text-primary"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-sm font-medium text-text-muted">name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted">表示順</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-20 rounded border border-base-border bg-base px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted">前提グループ</label>
              <select
                value={prerequisiteGroupId}
                onChange={(e) => setPrerequisiteGroupId(e.target.value)}
                className="mt-1 rounded border border-base-border bg-base px-3 py-2 text-text-primary min-w-[140px]"
              >
                <option value="">なし</option>
                {researchGroups
                  .filter((g) => g.id !== group.id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} — {g.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
          >
            {isPending ? "保存中…" : "保存"}
          </button>
        </form>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">解放対象（設備型 / クラフトレシピ）</h2>
        <p className="mt-1 text-sm text-text-muted">
          このグループに含める解放対象を追加します。派生型は isVariant をオンに。
        </p>
        {itemsSaveMessage && (
          <p
            className={`mt-2 text-sm ${itemsSaveMessage.type === "ok" ? "text-success" : "text-error"}`}
          >
            {itemsSaveMessage.text}
          </p>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm border-collapse border border-base-border">
            <thead>
              <tr className="bg-base">
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-28">
                  種別
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  対象
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                  派生型
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-16">
                  順
                </th>
                <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {editableItems.map((row) => (
                <tr key={row.tempId} className="text-text-primary">
                  <td className="border border-base-border px-2 py-1.5">
                    <select
                      value={row.targetType}
                      onChange={(e) => {
                        const t = e.target.value as "facility_type" | "craft_recipe";
                        const opts = t === "facility_type" ? facilityTypes : craftRecipes;
                        const id = opts[0]?.id ?? "";
                        const targetName = opts[0]?.name ?? "";
                        updateItem(row.tempId, { targetType: t, targetId: id, targetName });
                      }}
                      className="rounded border border-base-border bg-base px-2 py-1 text-text-primary w-full"
                    >
                      <option value="facility_type">設備型</option>
                      <option value="craft_recipe">クラフトレシピ</option>
                    </select>
                  </td>
                  <td className="border border-base-border px-2 py-1.5">
                    <select
                      value={row.targetId}
                      onChange={(e) =>
                        updateItemTarget(row.tempId, row.targetType, e.target.value)
                      }
                      className="rounded border border-base-border bg-base px-2 py-1 text-text-primary w-full max-w-[200px]"
                    >
                      {(row.targetType === "facility_type" ? facilityTypes : craftRecipes).map(
                        (opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        )
                      )}
                    </select>
                  </td>
                  <td className="border border-base-border px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={row.isVariant}
                      onChange={(e) => updateItem(row.tempId, { isVariant: e.target.checked })}
                    />
                  </td>
                  <td className="border border-base-border px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      value={row.displayOrder}
                      onChange={(e) =>
                        updateItem(row.tempId, {
                          displayOrder: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-14 rounded border border-base-border bg-base px-1 py-1 text-text-primary"
                    />
                  </td>
                  <td className="border border-base-border px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(row.tempId)}
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
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addItem}
            className="rounded border border-base-border bg-base-elevated px-3 py-1.5 text-sm text-text-primary hover:bg-base disabled:opacity-50"
          >
            ＋ 対象を追加
          </button>
          <button
            type="button"
            onClick={handleSaveItems}
            disabled={itemsSavePending}
            className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
          >
            {itemsSavePending ? "保存中…" : "解放対象を保存"}
          </button>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">解放時の消費アイテム（対象ごと）</h2>
        <p className="mt-1 text-sm text-text-muted">
          各解放対象を解放するときに消費するアイテムと個数。対象を保存したあと、ここで設定して「消費を保存」を押してください。
        </p>
        <div className="mt-4 space-y-6">
          {editableItems
            .filter((i) => i.targetId)
            .map((row) => {
              const costKey = `${row.targetType}:${row.targetId}`;
              const saving = costSavePending === costKey;
              return (
                <div
                  key={row.tempId}
                  className="rounded border border-base-border bg-base p-3"
                >
                  <p className="font-medium text-text-primary text-sm">
                    {row.targetType === "facility_type" ? "設備" : "レシピ"} — {row.targetName}
                  </p>
                  <div className="mt-2 space-y-2">
                    {row.costs.map((c, cIdx) => (
                      <div key={cIdx} className="flex flex-wrap items-center gap-2">
                        <select
                          value={c.itemId}
                          onChange={(e) =>
                            updateCost(row.tempId, cIdx, "itemId", e.target.value)
                          }
                          className="rounded border border-base-border bg-base px-2 py-1 text-text-primary text-sm min-w-[160px]"
                        >
                          <option value="">選択</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name}（{it.code}）
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={c.amount}
                          onChange={(e) =>
                            updateCost(row.tempId, cIdx, "amount", parseInt(e.target.value, 10) || 1)
                          }
                          className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary text-sm"
                        />
                        <span className="text-text-muted text-sm">個</span>
                        <button
                          type="button"
                          onClick={() => removeCost(row.tempId, cIdx)}
                          className="text-error text-sm hover:underline"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addCost(row.tempId)}
                        className="text-sm text-brass hover:underline"
                      >
                        ＋ 消費を追加
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveCosts(row.targetType, row.targetId)
                        }
                        disabled={saving}
                        className="rounded bg-brass/80 px-2 py-1 text-xs font-medium text-white hover:bg-brass disabled:opacity-50"
                      >
                        {saving ? "保存中…" : "消費を保存"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
        {editableItems.filter((i) => i.targetId).length === 0 && (
          <p className="mt-2 text-sm text-text-muted">
            解放対象を追加・保存すると、ここで消費アイテムを設定できます。
          </p>
        )}
      </section>
    </div>
  );
}
