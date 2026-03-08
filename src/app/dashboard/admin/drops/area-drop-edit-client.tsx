"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  AreaDropEditData,
  AreaDropTableInfo,
  SaveDropTableEntryInput,
} from "@/server/actions/admin";
import { saveDropTableEntries } from "@/server/actions/admin";

type ItemOption = { id: string; code: string; name: string; category: string };

const CATEGORY_LABELS: Record<string, string> = {
  material: "素材",
  consumable: "消耗品",
  blueprint: "設計図",
  skill_book: "スキル分析書",
  paid: "有料",
};

type Props = {
  data: AreaDropEditData;
  items: ItemOption[];
  kindLabels: Record<string, string>;
};

type LocalRow = SaveDropTableEntryInput & { tempId?: string };

function TableEditor({
  table,
  kindKey,
  kindLabel,
  items,
  onSaved,
}: {
  table: AreaDropTableInfo;
  kindKey: string;
  kindLabel: string;
  items: ItemOption[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<LocalRow[]>(() =>
    table?.entries.map((e) => ({
      itemId: e.itemId,
      minQuantity: e.minQuantity,
      maxQuantity: e.maxQuantity,
      weight: e.weight,
    })) ?? []
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // カテゴリで絞り込み。選択中アイテムはフィルタに含まれていなくても候補に残す
  const itemOptions = useMemo(() => {
    const base = categoryFilter
      ? items.filter((i) => i.category === categoryFilter)
      : [...items];
    const selectedIds = new Set(rows.map((r) => r.itemId).filter(Boolean));
    const additional = items.filter((i) => selectedIds.has(i.id) && !base.some((b) => b.id === i.id));
    return [...base, ...additional].sort((a, b) => a.code.localeCompare(b.code));
  }, [items, categoryFilter, rows]);

  if (!table) {
    return (
      <div className="rounded-lg border border-base-border bg-base-elevated p-4">
        <h3 className="font-medium text-text-muted">{kindLabel}</h3>
        <p className="mt-2 text-sm text-text-muted">未設定（このエリアにはドロップテーブルが紐づいていません）</p>
      </div>
    );
  }

  const addRow = () => {
    const firstItem = items[0];
    setRows((prev) => [
      ...prev,
      {
        itemId: firstItem?.id ?? "",
        minQuantity: 1,
        maxQuantity: 1,
        weight: 1,
        tempId: `t-${Date.now()}`,
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof LocalRow, value: number | string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const totalWeight = rows.reduce(
    (sum, r) => sum + (typeof r.weight === "number" && r.weight >= 0 ? r.weight : Number(r.weight) || 0),
    0
  );

  const handleSave = () => {
    const valid = rows.filter(
      (r) =>
        r.itemId &&
        Number.isInteger(r.minQuantity) &&
        r.minQuantity >= 0 &&
        Number.isInteger(r.maxQuantity) &&
        r.maxQuantity >= r.minQuantity &&
        Number.isInteger(r.weight) &&
        r.weight >= 1
    );
    if (valid.length === 0 && rows.length > 0) {
      setMessage({ type: "error", text: "有効な行がありません（アイテム選択・数量・重みを確認）" });
      return;
    }
    startTransition(async () => {
      const result = await saveDropTableEntries(table.id, valid);
      setMessage(
        result.success
          ? { type: "ok", text: "保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) onSaved();
    });
  };

  return (
    <div className="rounded-lg border border-base-border bg-base-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-text-primary">
          {kindLabel} — {table.name}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`drop-category-${kindKey}`} className="text-sm text-text-muted">
            アイテム絞り込み
          </label>
          <select
            id={`drop-category-${kindKey}`}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
          >
            <option value="">すべて</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addRow}
            className="rounded bg-base border border-base-border px-2 py-1 text-sm text-text-primary hover:bg-base-border"
          >
            行を追加
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-brass px-3 py-1 text-sm text-base hover:bg-brass-hover disabled:opacity-50"
          >
            {isPending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
      {message && (
        <p
          className={`mt-2 text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}
        >
          {message.text}
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                アイテム
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-24">
                最小数
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-24">
                最大数
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                重み
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                確率
              </th>
              <th className="border border-base-border px-2 py-1.5 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-base-border px-2 py-3 text-text-muted text-center">
                  エントリがありません。「行を追加」で追加してください。
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.tempId ?? index}>
                  <td className="border border-base-border px-2 py-1">
                    <select
                      value={row.itemId}
                      onChange={(e) => updateRow(index, "itemId", e.target.value)}
                      className="w-full min-w-[140px] rounded border border-base-border bg-base-elevated px-2 py-1 text-text-primary"
                    >
                      <option value="">— 選択 —</option>
                      {itemOptions.map((it) => (
                        <option key={it.id} value={it.id}>
                          [{it.code}] {it.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-base-border px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      value={row.minQuantity}
                      onChange={(e) =>
                        updateRow(index, "minQuantity", parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full rounded border border-base-border bg-base-elevated px-2 py-1 text-text-primary"
                    />
                  </td>
                  <td className="border border-base-border px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      value={row.maxQuantity}
                      onChange={(e) =>
                        updateRow(index, "maxQuantity", parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full rounded border border-base-border bg-base-elevated px-2 py-1 text-text-primary"
                    />
                  </td>
                  <td className="border border-base-border px-2 py-1">
                    <input
                      type="number"
                      min={1}
                      value={row.weight}
                      onChange={(e) =>
                        updateRow(index, "weight", parseInt(e.target.value, 10) || 1)
                      }
                      className="w-full rounded border border-base-border bg-base-elevated px-2 py-1 text-text-primary"
                    />
                  </td>
                  <td className="border border-base-border px-2 py-1 text-text-muted text-sm">
                    {totalWeight > 0
                      ? `${(((Number(row.weight) || 0) / totalWeight) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="border border-base-border px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="text-text-muted hover:text-error"
                      aria-label="行を削除"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AreaDropEditClient({ data, items, kindLabels }: Props) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-text-primary border-b border-base-border pb-2">
        {data.area.name}（{data.area.code}）のドロップテーブル
      </h2>
      <div className="mt-4 space-y-6">
        <TableEditor
          key={data.base ? `base-${data.base.id}-${data.base.entries.map((e) => e.id).join(",")}` : "base-null"}
          table={data.base}
          kindKey="base"
          kindLabel={kindLabels.base ?? "基本"}
          items={items}
          onSaved={refresh}
        />
        <TableEditor
          key={data.battle ? `battle-${data.battle.id}-${data.battle.entries.map((e) => e.id).join(",")}` : "battle-null"}
          table={data.battle}
          kindKey="battle"
          kindLabel={kindLabels.battle_bonus ?? "戦闘ボーナス"}
          items={items}
          onSaved={refresh}
        />
        <TableEditor
          key={data.skill ? `skill-${data.skill.id}-${data.skill.entries.map((e) => e.id).join(",")}` : "skill-null"}
          table={data.skill}
          kindKey="skill"
          kindLabel={kindLabels.skill ?? "技能イベント枠"}
          items={items}
          onSaved={refresh}
        />
        <TableEditor
          key={data.strongEnemy ? `strong-${data.strongEnemy.id}-${data.strongEnemy.entries.map((e) => e.id).join(",")}` : "strong-null"}
          table={data.strongEnemy}
          kindKey="strongEnemy"
          kindLabel={kindLabels.strong_enemy ?? "強敵"}
          items={items}
          onSaved={refresh}
        />
        <TableEditor
          key={data.areaLord ? `lord-${data.areaLord.id}-${data.areaLord.entries.map((e) => e.id).join(",")}` : "lord-null"}
          table={data.areaLord}
          kindKey="areaLord"
          kindLabel={kindLabels.area_lord_special ?? "領域主専用"}
          items={items}
          onSaved={refresh}
        />
      </div>
    </section>
  );
}
