"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { GameIcon } from "@/components/icons/game-icon";
import {
  getResearchCostWithStock,
  expandFacilityCost,
  expandFacilitySlots,
  type ResearchGroupSummary,
  type ResearchGroupItemSummary,
  type ResearchCostStockRow,
  type FacilityCostExpansionSummary,
  type SlotsExpansionSummary,
} from "@/server/actions/research";
import { ResearchUnlockButton } from "./research-unlock-button";

type Props = {
  groups: ResearchGroupSummary[];
  researchPoint: number;
  facilityCostExpansions: FacilityCostExpansionSummary[];
  slotsExpansions: SlotsExpansionSummary[];
};

type TabKind = "all" | "facility" | "craft" | "expansion";
type UnlockFilter = "all" | "unlocked" | "locked";

function filterItems(items: ResearchGroupItemSummary[], tab: TabKind): ResearchGroupItemSummary[] {
  if (tab === "all") return items;
  if (tab === "facility") return items.filter((i) => i.targetType === "facility_type");
  if (tab === "craft") return items.filter((i) => i.targetType === "craft_recipe");
  return items; // expansion tab: items not used
}

function filterByUnlock(
  items: ResearchGroupItemSummary[],
  unlockFilter: UnlockFilter
): ResearchGroupItemSummary[] {
  if (unlockFilter === "all") return items;
  if (unlockFilter === "unlocked") return items.filter((i) => i.isUnlocked);
  return items.filter((i) => !i.isUnlocked);
}

export function ResearchGroupList({
  groups,
  researchPoint,
  facilityCostExpansions,
  slotsExpansions,
}: Props) {
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKind>("all");
  const [unlockFilter, setUnlockFilter] = useState<UnlockFilter>("all");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [costRowsCache, setCostRowsCache] = useState<
    Record<string, { status: "loading" } | { status: "done"; rows: ResearchCostStockRow[] }>
  >({});
  const [expansionError, setExpansionError] = useState<string | null>(null);
  const [pendingCostGroupId, setPendingCostGroupId] = useState<string | null>(null);
  const [pendingSlotsGroupId, setPendingSlotsGroupId] = useState<string | null>(null);
  const [expandedExpansionKind, setExpandedExpansionKind] = useState<"cost" | "slots" | null>(null);

  const availableGroups = groups.filter((g) => g.isAvailable);
  const selectedGroup = selectedGroupId
    ? availableGroups.find((g) => g.id === selectedGroupId)
    : null;

  const costExpansionForGroup = selectedGroupId
    ? facilityCostExpansions.find((e) => e.researchGroupId === selectedGroupId)
    : null;
  const slotsExpansionForGroup = selectedGroupId
    ? slotsExpansions.find((e) => e.researchGroupId === selectedGroupId)
    : null;
  const hasExpansionForGroup = !!(costExpansionForGroup || slotsExpansionForGroup);

  const displayedItems = selectedGroup
    ? filterByUnlock(filterItems(selectedGroup.items, tab), unlockFilter)
    : [];

  const handleExpandCost = async (researchGroupId: string) => {
    setExpansionError(null);
    setPendingCostGroupId(researchGroupId);
    try {
      const res = await expandFacilityCost(researchGroupId);
      if (!res.success) setExpansionError(res.message ?? res.error);
      if (res.success) router.refresh();
    } finally {
      setPendingCostGroupId(null);
    }
  };

  const handleExpandSlots = async (researchGroupId: string) => {
    setExpansionError(null);
    setPendingSlotsGroupId(researchGroupId);
    try {
      const res = await expandFacilitySlots(researchGroupId);
      if (!res.success) setExpansionError(res.message ?? res.error);
      if (res.success) router.refresh();
    } finally {
      setPendingSlotsGroupId(null);
    }
  };

  useEffect(() => {
    setExpandedItemId(null);
    setExpandedExpansionKind(null);
  }, [selectedGroupId, tab, unlockFilter]);

  useEffect(() => {
    if (!expandedItemId || costRowsCache[expandedItemId]) return;
    const item = displayedItems.find((i) => i.id === expandedItemId);
    if (!item || item.cost.length === 0) return;
    setCostRowsCache((c) => ({ ...c, [expandedItemId]: { status: "loading" } }));
    getResearchCostWithStock(
      item.cost.map((co) => ({ itemId: co.itemId, amount: co.amount }))
    ).then((res) => {
      if (res.success) {
        setCostRowsCache((c) => ({ ...c, [expandedItemId]: { status: "done", rows: res.rows } }));
      }
    });
  }, [expandedItemId, displayedItems]);

  return (
    <section className="mt-6 max-w-2xl space-y-6">
      <h2 className="text-base font-medium text-text-primary">解放されている研究</h2>
      <ul className="space-y-2">
        {availableGroups.length === 0 ? (
          <li className="rounded-lg border border-base-border bg-base-elevated p-4 text-sm text-text-muted">
            利用可能な研究グループはありません。開拓任務を進めると解放されます。
          </li>
        ) : (
          availableGroups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupId((id) => (id === group.id ? null : group.id));
                  setTab("all");
                }}
                className={`flex w-full items-center gap-2 rounded-lg border p-4 text-left transition-colors hover:border-brass hover:bg-base-elevated focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${
                  selectedGroupId === group.id
                    ? "border-brass bg-base-elevated"
                    : "border-base-border bg-base-elevated"
                }`}
              >
                <GameIcon name="expanded-rays" className="h-5 w-5 shrink-0 text-brass" />
                <span className="font-medium text-text-primary">{group.name}</span>
                <span className="ml-auto text-text-muted">
                  {selectedGroupId === group.id ? "▼" : "▶"}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      {selectedGroup && (
        <div className="rounded-lg border border-base-border bg-base-elevated p-6">
          <h3 className="flex items-center gap-2 text-base font-medium text-text-primary">
            <GameIcon name="expanded-rays" className="h-5 w-5 text-brass" />
            {selectedGroup.name}
          </h3>

          <p className="mt-2 text-sm text-text-muted">
            研究記録書 所持: {researchPoint} 枚
          </p>

          <div className="mt-4 flex gap-2 border-b border-base-border pb-2">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "all"
                  ? "border-brass bg-brass/10 text-brass"
                  : "border-base-border bg-base text-text-primary hover:border-brass"
              }`}
            >
              全て
            </button>
            <button
              type="button"
              onClick={() => setTab("facility")}
              className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "facility"
                  ? "border-brass bg-brass/10 text-brass"
                  : "border-base-border bg-base text-text-primary hover:border-brass"
              }`}
            >
              設備
            </button>
            <button
              type="button"
              onClick={() => setTab("craft")}
              className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "craft"
                  ? "border-brass bg-brass/10 text-brass"
                  : "border-base-border bg-base text-text-primary hover:border-brass"
              }`}
            >
              工房
            </button>
            <button
              type="button"
              onClick={() => setTab("expansion")}
              className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "expansion"
                  ? "border-brass bg-brass/10 text-brass"
                  : "border-base-border bg-base text-text-primary hover:border-brass"
              }`}
            >
              拡張
            </button>
          </div>

          {tab !== "expansion" && (
            <div className="mt-2 flex gap-2 border-b border-base-border pb-2">
              <button
                type="button"
                onClick={() => setUnlockFilter("all")}
                className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                  unlockFilter === "all"
                    ? "border-brass bg-brass/10 text-brass"
                    : "border-base-border bg-base text-text-primary hover:border-brass"
                }`}
              >
                全て
              </button>
              <button
                type="button"
                onClick={() => setUnlockFilter("unlocked")}
                className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                  unlockFilter === "unlocked"
                    ? "border-brass bg-brass/10 text-brass"
                    : "border-base-border bg-base text-text-primary hover:border-brass"
                }`}
              >
                解放済
              </button>
              <button
                type="button"
                onClick={() => setUnlockFilter("locked")}
                className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                  unlockFilter === "locked"
                    ? "border-brass bg-brass/10 text-brass"
                    : "border-base-border bg-base text-text-primary hover:border-brass"
                }`}
              >
                未開放
              </button>
            </div>
          )}

          {expansionError && (
            <p className="mt-3 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {expansionError}
            </p>
          )}

          {/* 上2行: 動力強化・区画拡張（他行と同じレイアウト、!で研究記録書の必要資材表示） */}
          {(tab === "all" || tab === "expansion") && hasExpansionForGroup && selectedGroupId && (
            <ul className="mt-4 space-y-4">
              {costExpansionForGroup && (
                <li className="rounded border border-base-border bg-base">
                  <div className="flex flex-wrap items-center gap-2 p-4">
                    <span className="font-medium text-text-primary">動力強化</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedExpansionKind((k) => (k === "cost" ? null : "cost"));
                      }}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${
                        expandedExpansionKind === "cost"
                          ? "border-brass bg-brass/10 text-brass"
                          : "border-base-border bg-base-elevated text-text-muted hover:border-brass hover:text-brass"
                      }`}
                      title="必要資材を表示"
                      aria-label="必要資材を表示"
                      aria-expanded={expandedExpansionKind === "cost"}
                    >
                      !
                    </button>
                    <span className="text-text-muted text-sm">
                      {costExpansionForGroup.currentCount}/{costExpansionForGroup.limit}回
                      {costExpansionForGroup.amount > 0 && `（+${costExpansionForGroup.amount}コスト/回）`}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {costExpansionForGroup.currentCount >= costExpansionForGroup.limit ? (
                        <span className="rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-200">
                          上限に達しています
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            researchPoint < costExpansionForGroup.researchPoint ||
                            pendingCostGroupId === selectedGroupId
                          }
                          onClick={() => handleExpandCost(selectedGroupId)}
                          className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
                        >
                          {pendingCostGroupId === selectedGroupId ? "実行中…" : "拡張する"}
                        </button>
                      )}
                    </span>
                  </div>
                  {expandedExpansionKind === "cost" && (
                    <div className="border-t border-base-border bg-base-elevated/50 px-4 py-3">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[20rem] border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-base-border text-text-muted">
                              <th className="py-2 pr-4 text-left font-medium">必要資材</th>
                              <th className="py-2 pr-4 text-left font-medium">必要量</th>
                              <th className="py-2 pr-4 text-left font-medium">在庫</th>
                              <th className="py-2 text-left font-medium">不足数</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-base-border/60">
                              <td className="py-2 pr-4 text-text-primary">研究記録書</td>
                              <td className="py-2 pr-4 tabular-nums text-text-primary">
                                {costExpansionForGroup.researchPoint}
                              </td>
                              <td className="py-2 pr-4 tabular-nums text-text-primary">
                                {researchPoint}
                              </td>
                              <td className="py-2">
                                {Math.max(0, costExpansionForGroup.researchPoint - researchPoint) > 0 ? (
                                  <span className="tabular-nums text-error">
                                    {Math.max(0, costExpansionForGroup.researchPoint - researchPoint)}
                                  </span>
                                ) : (
                                  <span className="text-text-muted">—</span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </li>
              )}
              {slotsExpansionForGroup && (
                <li className="rounded border border-base-border bg-base">
                  <div className="flex flex-wrap items-center gap-2 p-4">
                    <span className="font-medium text-text-primary">区画拡張</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedExpansionKind((k) => (k === "slots" ? null : "slots"));
                      }}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${
                        expandedExpansionKind === "slots"
                          ? "border-brass bg-brass/10 text-brass"
                          : "border-base-border bg-base-elevated text-text-muted hover:border-brass hover:text-brass"
                      }`}
                      title="必要資材を表示"
                      aria-label="必要資材を表示"
                      aria-expanded={expandedExpansionKind === "slots"}
                    >
                      !
                    </button>
                    <span className="text-text-muted text-sm">
                      {slotsExpansionForGroup.currentCount}/{slotsExpansionForGroup.limit}回
                      {slotsExpansionForGroup.amount > 0 && `（+${slotsExpansionForGroup.amount}枠/回）`}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {slotsExpansionForGroup.currentCount >= slotsExpansionForGroup.limit ? (
                        <span className="rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-200">
                          上限に達しています
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            researchPoint < slotsExpansionForGroup.researchPoint ||
                            pendingSlotsGroupId === selectedGroupId
                          }
                          onClick={() => handleExpandSlots(selectedGroupId)}
                          className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
                        >
                          {pendingSlotsGroupId === selectedGroupId ? "実行中…" : "拡張する"}
                        </button>
                      )}
                    </span>
                  </div>
                  {expandedExpansionKind === "slots" && (
                    <div className="border-t border-base-border bg-base-elevated/50 px-4 py-3">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[20rem] border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-base-border text-text-muted">
                              <th className="py-2 pr-4 text-left font-medium">必要資材</th>
                              <th className="py-2 pr-4 text-left font-medium">必要量</th>
                              <th className="py-2 pr-4 text-left font-medium">在庫</th>
                              <th className="py-2 text-left font-medium">不足数</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-base-border/60">
                              <td className="py-2 pr-4 text-text-primary">研究記録書</td>
                              <td className="py-2 pr-4 tabular-nums text-text-primary">
                                {slotsExpansionForGroup.researchPoint}
                              </td>
                              <td className="py-2 pr-4 tabular-nums text-text-primary">
                                {researchPoint}
                              </td>
                              <td className="py-2">
                                {Math.max(0, slotsExpansionForGroup.researchPoint - researchPoint) > 0 ? (
                                  <span className="tabular-nums text-error">
                                    {Math.max(0, slotsExpansionForGroup.researchPoint - researchPoint)}
                                  </span>
                                ) : (
                                  <span className="text-text-muted">—</span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </li>
              )}
            </ul>
          )}

          {tab === "expansion" && (
            <>
              {!hasExpansionForGroup && (
                <p className="mt-4 text-sm text-text-muted">
                  このグループでは工業拡張はありません。
                </p>
              )}
            </>
          )}

          {tab !== "expansion" && displayedItems.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">解放対象はありません。</p>
          ) : tab !== "expansion" ? (
            <ul className="mt-4 space-y-4">
              {displayedItems.map((item) => {
                const isExpanded = expandedItemId === item.id;
                const cached = costRowsCache[item.id];
                return (
                  <li
                    key={item.id}
                    className="rounded border border-base-border bg-base"
                  >
                    <div className="flex flex-wrap items-center gap-2 p-4">
                      <span className="font-medium text-text-primary">{item.targetName}</span>
                      {(item.cost.length > 0 && (item.requiredResearchPoint ?? 0) > 0) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedItemId((id) => (id === item.id ? null : item.id));
                          }}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${
                            isExpanded
                              ? "border-brass bg-brass/10 text-brass"
                              : "border-base-border bg-base-elevated text-text-muted hover:border-brass hover:text-brass"
                          }`}
                          title="解放に必要な材料を表示"
                          aria-label="解放に必要な材料を表示"
                          aria-expanded={isExpanded}
                        >
                          !
                        </button>
                      )}
                      {item.targetType === "craft_recipe" && item.isVariant && (
                        <span className="rounded bg-base-border/50 px-2 py-0.5 text-xs text-text-muted">
                          派生型
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-2">
                        {item.isUnlocked ? (
                          <span className="rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-200">
                            解放済み
                          </span>
                        ) : (
                          <>
                            <span className="rounded bg-base-border/50 px-2 py-0.5 text-xs text-text-muted">
                              未解放
                            </span>
                            {item.cost.length > 0 && (item.requiredResearchPoint ?? 0) > 0 && (
                              <ResearchUnlockButton
                                targetType={item.targetType}
                                targetId={item.targetId}
                                targetName={item.targetName}
                                cost={item.cost}
                              />
                            )}
                          </>
                        )}
                      </span>
                      {!item.isUnlocked &&
                        (item.cost.length === 0 || (item.requiredResearchPoint ?? 0) <= 0) && (
                          <span className="ml-auto text-xs text-text-muted">
                            解放コスト未設定（アイテム・研究記録書の両方必要）
                          </span>
                        )}
                    </div>
                    {isExpanded &&
                      (item.cost.length > 0 || (item.requiredResearchPoint ?? 0) > 0) && (
                      <div className="border-t border-base-border bg-base-elevated/50 px-4 py-3">
                        {item.cost.length > 0 && (!cached || cached.status === "loading") ? (
                          <p className="text-sm text-text-muted">読み込み中…</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[20rem] border-collapse text-sm">
                              <thead>
                                <tr className="border-b border-base-border text-text-muted">
                                  <th className="py-2 pr-4 text-left font-medium">必要資材</th>
                                  <th className="py-2 pr-4 text-left font-medium">必要量</th>
                                  <th className="py-2 pr-4 text-left font-medium">在庫</th>
                                  <th className="py-2 text-left font-medium">不足数</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cached?.status === "done" &&
                                  cached.rows.map((row) => (
                                    <tr key={row.itemId} className="border-b border-base-border/60">
                                      <td className="py-2 pr-4 text-text-primary">{row.itemName}</td>
                                      <td className="py-2 pr-4 tabular-nums text-text-primary">
                                        {row.amount}
                                      </td>
                                      <td className="py-2 pr-4 tabular-nums text-text-primary">
                                        {row.stock}
                                      </td>
                                      <td className="py-2">
                                        {row.shortfall > 0 ? (
                                          <span className="tabular-nums text-error">
                                            {row.shortfall}
                                          </span>
                                        ) : (
                                          <span className="text-text-muted">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                {(item.requiredResearchPoint ?? 0) > 0 && (
                                  <tr className="border-b border-base-border/60">
                                    <td className="py-2 pr-4 text-text-primary">研究記録書</td>
                                    <td className="py-2 pr-4 tabular-nums text-text-primary">
                                      {item.requiredResearchPoint}
                                    </td>
                                    <td className="py-2 pr-4 tabular-nums text-text-primary">
                                      {researchPoint}
                                    </td>
                                    <td className="py-2">
                                      {Math.max(0, (item.requiredResearchPoint ?? 0) - researchPoint) >
                                      0 ? (
                                        <span className="tabular-nums text-error">
                                          {Math.max(
                                            0,
                                            (item.requiredResearchPoint ?? 0) - researchPoint
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-text-muted">—</span>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
