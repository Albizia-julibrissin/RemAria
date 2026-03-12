"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { AdminItemRow } from "@/server/actions/admin";

const CATEGORY_LABELS: Record<string, string> = {
  material: "素材",
  consumable: "消耗品",
  blueprint: "設計図",
  skill_book: "スキル分析書",
  paid: "有料",
};

const CATEGORY_FILTER_ALL = "";

type Props = {
  items: AdminItemRow[];
};

export function AdminItemListClient({ items }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>(CATEGORY_FILTER_ALL);

  const filtered = useMemo(() => {
    if (!categoryFilter) return items;
    return items.filter((row) => row.category === categoryFilter);
  }, [items, categoryFilter]);

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
          {categoryFilter && `（全 ${items.length} 件中）`}
        </span>
      </div>

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
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                  {row.code}
                </td>
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {CATEGORY_LABELS[row.category] ?? row.category}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {row.skillName ?? "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.maxCarryPerExpedition != null ? row.maxCarryPerExpedition : "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.maxOwnedPerUser != null ? row.maxOwnedPerUser : "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
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
