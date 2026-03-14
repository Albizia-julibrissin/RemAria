"use client";

// 設備行：1行目に名称・(i)・受取待機、押下で2行目に生産詳細を表示

import { useState } from "react";
import type { IndustrialFacility } from "@/server/actions/initial-area";
import { DismantleFacilityButton } from "./dismantle-facility-button";

type Props = {
  facility: IndustrialFacility;
};

export function FacilityRow({ facility: f }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const hasRecipe = f.recipe != null;

  return (
    <li className="rounded border border-base-border bg-base p-3">
      {/* 1行目: 名称　(i)　［詳細時のみ解体］　［右寄せ］受取待機 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-text-primary">{f.facilityName}</span>
        {hasRecipe && (
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-base-border bg-base-elevated text-xs text-text-muted transition-colors hover:border-brass hover:text-brass"
            aria-label="生産詳細を表示"
            title="詳細"
          >
            !
          </button>
        )}
        {showDetail &&
          (f.isForced ? (
            <span className="text-xs text-text-muted">解体不可能な設備です</span>
          ) : (
            <DismantleFacilityButton
              facilityInstanceId={f.id}
              facilityName={f.facilityName}
            />
          ))}
        <div className="ml-auto flex items-center gap-2">
          {f.receivableCycles > 0 && (
            <span className="text-sm text-brass">受取待機：{f.receivableOutputAmount}個</span>
          )}
        </div>
      </div>

      {/* 押下で表示：共通グリッドで1行目コスト・生産間隔、2行目産出系、3行目以降投入系（産出量・投入量は生産間隔の真下に揃える） */}
      {showDetail && (
        <div className="mt-2 border-t border-base-border pt-2 text-sm text-text-muted">
          <div
            className="grid gap-x-2 gap-y-1 items-baseline"
            style={{ gridTemplateColumns: "auto minmax(5rem, 1fr) auto minmax(3rem, auto)" }}
          >
            <span>コスト</span>
            <span className="tabular-nums text-success text-left">{f.cost}</span>
            {f.recipe && (
              <>
                <span>生産間隔</span>
                <span className="tabular-nums text-success text-left">{f.recipe.cycleMinutes}分</span>
                <span>産出物</span>
                <span className="text-success truncate text-left" title={f.recipe.outputItemName}>
                  {f.recipe.outputItemName}
                </span>
                <span>産出量</span>
                <span className="tabular-nums text-success text-left">{f.recipe.outputAmount}個</span>
                {f.recipe.inputs.flatMap((i) => [
                  <span key={`l1-${i.itemId}`}>投入物</span>,
                  <span key={`v1-${i.itemId}`} className="text-success truncate text-left" title={i.itemName}>
                    {i.itemName}
                  </span>,
                  <span key={`l2-${i.itemId}`}>投入量</span>,
                  <span key={`v2-${i.itemId}`} className="tabular-nums text-success text-left">
                    {i.amount}個
                  </span>,
                ])}
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
