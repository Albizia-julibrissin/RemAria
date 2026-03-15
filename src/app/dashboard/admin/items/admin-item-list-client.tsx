"use client";

import Link from "next/link";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AdminItemRow, AdminItemListUpdateRow } from "@/server/actions/admin";
import { bulkUpdateAdminItems } from "@/server/actions/admin";

const CATEGORY_LABELS: Record<string, string> = {
  material: "素材",
  consumable: "消耗品",
  blueprint: "設計図",
  skill_book: "スキル分析書",
  special: "特別",
};

const CATEGORY_FILTER_ALL = "";

type EditableRow = AdminItemRow & {
  /** 数値入力の文字列（空は null 扱い） */
  _maxCarryInput?: string;
  _maxOwnedInput?: string;
  _marketMinPriceInput?: string;
  _marketMinQuantityInput?: string;
};

function toEditableRow(row: AdminItemRow): EditableRow {
  return {
    ...row,
    _maxCarryInput: row.maxCarryPerExpedition != null ? String(row.maxCarryPerExpedition) : "",
    _maxOwnedInput: row.maxOwnedPerUser != null ? String(row.maxOwnedPerUser) : "",
    _marketMinPriceInput: row.marketMinPricePerUnit != null ? String(row.marketMinPricePerUnit) : "",
    _marketMinQuantityInput: row.marketMinQuantity != null ? String(row.marketMinQuantity) : "",
  };
}

function editableRowToUpdateRow(r: EditableRow): AdminItemListUpdateRow {
  const num = (s: string | undefined): number | null => {
    if (s == null || s.trim() === "") return null;
    const n = parseInt(s.trim(), 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    skillId: r.skillId,
    maxCarryPerExpedition: num(r._maxCarryInput),
    maxOwnedPerUser: num(r._maxOwnedInput),
    marketListable: r.marketListable,
    marketMinPricePerUnit: num(r._marketMinPriceInput),
    marketMinQuantity: num(r._marketMinQuantityInput),
  };
}

type SkillOption = { id: string; name: string; category: string };

type Props = {
  items: AdminItemRow[];
  skillOptions: SkillOption[];
};

export function AdminItemListClient({ items, skillOptions }: Props) {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<string>(CATEGORY_FILTER_ALL);
  const [rows, setRows] = useState<EditableRow[]>(() => items.map(toEditableRow));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(items.map(toEditableRow));
  }, [items]);

  const filtered = useMemo(() => {
    if (!categoryFilter) return rows;
    return rows.filter((row) => row.category === categoryFilter);
  }, [rows, categoryFilter]);

  const updateRow = useCallback((id: string, patch: Partial<EditableRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    const payload: AdminItemListUpdateRow[] = rows.map(editableRowToUpdateRow);
    const result = await bulkUpdateAdminItems(payload);
    setSaving(false);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? "保存に失敗しました。");
    }
  }, [rows, router]);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label htmlFor="admin-item-category-filter" className="text-sm font-medium text-text-muted">
          カテゴリで絞り込み
        </label>
        <select
          id="admin-item-category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded border border-base-border bg-base-elevated px-3 py-2 text-sm text-text-primary"
        >
          <option value={CATEGORY_FILTER_ALL}>すべて</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-sm text-text-muted">
          {filtered.length} 件
          {categoryFilter && `（全 ${rows.length} 件中）`}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
        >
          {saving ? "保存中…" : "一括保存"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                code
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                name
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-28">
                category
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                スキル（skill_book時）
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                持ち込み上限
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                所持上限
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-16">
                出品可
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                金額下限
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                数量下限
              </th>
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1 font-mono text-xs">
                  {row.code}
                </td>
                <td className="border border-base-border px-2 py-1">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    className="w-full min-w-[80px] rounded border border-base-border bg-base px-1.5 py-0.5 text-text-primary"
                  />
                </td>
                <td className="border border-base-border px-2 py-1">
                  <select
                    value={row.category}
                    onChange={(e) =>
                      updateRow(row.id, {
                        category: e.target.value,
                        skillId: e.target.value === "skill_book" ? row.skillId : null,
                      })
                    }
                    className="w-full rounded border border-base-border bg-base px-1.5 py-0.5 text-text-primary"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border border-base-border px-2 py-1">
                  {row.category === "skill_book" ? (
                    <select
                      value={row.skillId ?? ""}
                      onChange={(e) =>
                        updateRow(row.id, { skillId: e.target.value || null })
                      }
                      className="w-full min-w-[100px] rounded border border-base-border bg-base px-1.5 py-0.5 text-text-primary"
                    >
                      <option value="">—</option>
                      {skillOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="border border-base-border px-2 py-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row._maxCarryInput ?? ""}
                    onChange={(e) =>
                      updateRow(row.id, { _maxCarryInput: e.target.value })
                    }
                    placeholder="—"
                    className="w-14 rounded border border-base-border bg-base px-1.5 py-0.5 text-right text-text-primary"
                  />
                </td>
                <td className="border border-base-border px-2 py-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row._maxOwnedInput ?? ""}
                    onChange={(e) =>
                      updateRow(row.id, { _maxOwnedInput: e.target.value })
                    }
                    placeholder="—"
                    className="w-14 rounded border border-base-border bg-base px-1.5 py-0.5 text-right text-text-primary"
                  />
                </td>
                <td className="border border-base-border px-2 py-1">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={row.marketListable}
                      onChange={(e) =>
                        updateRow(row.id, { marketListable: e.target.checked })
                      }
                      className="rounded border-base-border"
                    />
                    {row.marketListable ? "可" : "不可"}
                  </label>
                </td>
                <td className="border border-base-border px-2 py-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row._marketMinPriceInput ?? ""}
                    onChange={(e) =>
                      updateRow(row.id, { _marketMinPriceInput: e.target.value })
                    }
                    placeholder="—"
                    className="w-14 rounded border border-base-border bg-base px-1.5 py-0.5 text-right text-text-primary"
                  />
                </td>
                <td className="border border-base-border px-2 py-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row._marketMinQuantityInput ?? ""}
                    onChange={(e) =>
                      updateRow(row.id, { _marketMinQuantityInput: e.target.value })
                    }
                    placeholder="—"
                    className="w-14 rounded border border-base-border bg-base px-1.5 py-0.5 text-right text-text-primary"
                  />
                </td>
                <td className="border border-base-border px-2 py-1 text-center">
                  <Link
                    href={`/dashboard/admin/items/${row.id}`}
                    className="text-brass hover:text-brass-hover"
                  >
                    編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        計 {filtered.length} 件
        {categoryFilter && `（カテゴリ「${CATEGORY_LABELS[categoryFilter] ?? categoryFilter}」で表示）`}
      </p>
    </>
  );
}
