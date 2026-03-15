"use client";

// 開拓者証の称号表示。本人のときは脱着 UI、他プレイヤーは表示のみ。spec/055, docs/088

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GameIcon } from "@/components/icons/game-icon";
import { setEquippedTitle } from "@/server/actions/titles";
import type { TitleRow } from "@/server/actions/titles";

type ProfileTitleSectionProps = {
  /** 他プレイヤーのときは装備中称号名のみ。本人のときは null で一覧を表示 */
  equippedTitleName: string | null;
  /** 本人のときのみ。称号一覧＋装備中ID（脱着用） */
  titles?: TitleRow[];
  equippedTitleId?: string | null;
  isOwnProfile: boolean;
};

export function ProfileTitleSection({
  equippedTitleName,
  titles = [],
  equippedTitleId = null,
  isOwnProfile,
}: ProfileTitleSectionProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleEquip(titleId: string | null) {
    setPendingId(titleId ?? "none");
    const result = await setEquippedTitle(titleId);
    setPendingId(null);
    if (result.success) router.refresh();
    else alert(result.error);
  }

  // 他プレイヤー: 装備中称号の表示のみ
  if (!isOwnProfile) {
    return (
      <div className="mt-4">
        <h3 className="text-sm font-medium text-text-muted">称号</h3>
        <p className="mt-1 text-text-primary">
          {equippedTitleName ? (
            <span className="inline-flex items-center gap-1.5 rounded border border-base-border bg-base px-2 py-0.5">
              <GameIcon name="rank-3" className="h-4 w-4 text-brass" />
              【{equippedTitleName}】
            </span>
          ) : (
            <span className="text-text-muted">— 未装備</span>
          )}
        </p>
      </div>
    );
  }

  // 本人: 装備中表示 ＋ 解放済み一覧で脱着
  const unlocked = titles.filter((t) => t.isUnlocked);
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-text-muted">称号</h3>
      <p className="mt-1 text-text-primary">
        {equippedTitleId ? (
          <span className="inline-flex items-center gap-1.5 rounded border border-base-border bg-base px-2 py-0.5">
            <GameIcon name="rank-3" className="h-4 w-4 text-brass" />
            【{titles.find((t) => t.id === equippedTitleId)?.name ?? "?"}】
          </span>
        ) : (
          <span className="text-text-muted">— 未装備</span>
        )}
      </p>
      {unlocked.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-text-muted">装備する称号を選ぶ（解放済みのみ選択可能）</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            <li>
              <button
                type="button"
                onClick={() => handleEquip(null)}
                disabled={!!pendingId}
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-sm transition-colors ${
                  !equippedTitleId
                    ? "border-brass bg-brass/20 text-brass"
                    : "border-base-border bg-base-elevated text-text-primary hover:border-brass hover:bg-base"
                }`}
              >
                装備を外す
              </button>
            </li>
            {unlocked.map((t) => {
              const isEquipped = t.id === equippedTitleId;
              const isPending = pendingId === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => handleEquip(t.id)}
                    disabled={!!pendingId}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-sm transition-colors ${
                      isEquipped
                        ? "border-brass bg-brass/20 text-brass"
                        : "border-base-border bg-base-elevated text-text-primary hover:border-brass hover:bg-base"
                    } ${isPending ? "opacity-60" : ""}`}
                  >
                    {t.name}
                    {isPending && " …"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
