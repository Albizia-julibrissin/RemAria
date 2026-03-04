"use client";

// spec/045 - バッグの種別タブ

import { useState } from "react";
import type {
  StackableItem,
  EquipmentInstanceSummary,
  MechaPartInstanceSummary,
} from "@/server/actions/inventory";

type Props = {
  stackable: StackableItem[];
  equipmentInstances: EquipmentInstanceSummary[];
  mechaPartInstances: MechaPartInstanceSummary[];
  allTabIds: string[];
};

const TAB_LABELS: Record<string, string> = {
  material: "資源",
  consumable: "消耗品",
  blueprint: "設計図",
  skill_book: "スキル分析書",
  paid: "課金",
  equipment: "装備",
  mecha_parts: "メカパーツ",
};

export function BagTabs({
  stackable,
  equipmentInstances,
  mechaPartInstances,
  allTabIds,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(allTabIds[0] ?? "material");

  const filteredStackable =
    activeTab === "equipment" || activeTab === "mecha_parts"
      ? []
      : stackable.filter((s) => s.category === activeTab);

  return (
    <section className="mt-8 rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
      <div className="flex flex-wrap gap-2 border-b border-base-border pb-3">
        {allTabIds.map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${
              activeTab === tabId
                ? "bg-brass text-base border border-brass"
                : "bg-base text-text-muted hover:bg-base-border hover:text-text-primary border border-base-border"
            }`}
          >
            {TAB_LABELS[tabId] ?? tabId}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-[120px]">
        {activeTab === "equipment" && (
          <ul className="space-y-3">
            {equipmentInstances.length === 0 ? (
              <li className="text-sm text-text-muted">装備を所持していません。</li>
            ) : (
              equipmentInstances.map((ei) => (
                <li
                  key={ei.id}
                  className="flex justify-between items-center rounded border border-base-border bg-base px-4 py-3"
                >
                  <span className="font-medium text-text-primary">
                    {ei.equipmentTypeName}
                  </span>
                  <span className="text-sm text-text-muted">{ei.slot}</span>
                </li>
              ))
            )}
          </ul>
        )}

        {activeTab === "mecha_parts" && (
          <ul className="space-y-3">
            {mechaPartInstances.length === 0 ? (
              <li className="text-sm text-text-muted">
                メカパーツを所持していません。
              </li>
            ) : (
              mechaPartInstances.map((mp) => (
                <li
                  key={mp.id}
                  className="flex justify-between items-center rounded border border-base-border bg-base px-4 py-3"
                >
                  <span className="font-medium text-text-primary">
                    {mp.mechaPartTypeName}
                  </span>
                  <span className="text-sm text-text-muted">{mp.slot}</span>
                </li>
              ))
            )}
          </ul>
        )}

        {activeTab !== "equipment" && activeTab !== "mecha_parts" && (
          <ul className="space-y-3">
            {filteredStackable.length === 0 ? (
              <li className="text-sm text-text-muted">
                この種別のアイテムはありません。
              </li>
            ) : (
              filteredStackable.map((row) => (
                <li
                  key={row.itemId}
                  className="flex justify-between items-center rounded border border-base-border bg-base px-4 py-3"
                >
                  <span className="font-medium text-text-primary">{row.name}</span>
                  <span className="tabular-nums text-text-primary">
                    {row.quantity}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
