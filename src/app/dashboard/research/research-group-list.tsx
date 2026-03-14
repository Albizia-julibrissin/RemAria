"use client";

import { useState } from "react";
import { GameIcon } from "@/components/icons/game-icon";
import type { ResearchGroupSummary } from "@/server/actions/research";
import { ResearchUnlockButton } from "./research-unlock-button";

type Props = {
  groups: ResearchGroupSummary[];
};

export function ResearchGroupList({ groups }: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const availableGroups = groups.filter((g) => g.isAvailable);
  const selectedGroup = selectedGroupId
    ? availableGroups.find((g) => g.id === selectedGroupId)
    : null;

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
                onClick={() =>
                  setSelectedGroupId((id) => (id === group.id ? null : group.id))
                }
                className={`flex w-full items-center gap-2 rounded-lg border p-4 text-left transition-colors hover:border-brass hover:bg-base-elevated focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${
                  selectedGroupId === group.id
                    ? "border-brass bg-base-elevated"
                    : "border-base-border bg-base-elevated"
                }`}
              >
                <GameIcon name="flask" className="h-5 w-5 shrink-0 text-brass" />
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
            <GameIcon name="flask" className="h-5 w-5 text-brass" />
            {selectedGroup.name} — 解放可能なレシピ
          </h3>
          {selectedGroup.items.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">解放対象はありません。</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {selectedGroup.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded border border-base-border bg-base p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text-primary">
                      {item.targetName}
                    </span>
                    {item.targetType === "craft_recipe" && item.isVariant && (
                      <span className="rounded bg-base-border/50 px-2 py-0.5 text-xs text-text-muted">
                        派生型
                      </span>
                    )}
                    {item.isUnlocked ? (
                      <span className="rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-200">
                        解放済み
                      </span>
                    ) : null}
                  </div>
                  {!item.isUnlocked && item.cost.length > 0 && (
                    <ResearchUnlockButton
                      targetType={item.targetType}
                      targetId={item.targetId}
                      targetName={item.targetName}
                      cost={item.cost}
                    />
                  )}
                  {!item.isUnlocked && item.cost.length === 0 && (
                    <p className="mt-2 text-xs text-text-muted">解放コスト未設定</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
