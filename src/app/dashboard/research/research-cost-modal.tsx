"use client";

import { useEffect, useState } from "react";
import { getResearchCostWithStock } from "@/server/actions/research";
import type { ResearchUnlockCostItem, ResearchCostStockRow } from "@/server/actions/research";

type Props = {
  targetName: string;
  cost: ResearchUnlockCostItem[];
  onClose: () => void;
};

export function ResearchCostModal({ targetName, cost, onClose }: Props) {
  const [rows, setRows] = useState<ResearchCostStockRow[] | null>(null);

  useEffect(() => {
    if (cost.length === 0) {
      setRows([]);
      return;
    }
    getResearchCostWithStock(cost.map((c) => ({ itemId: c.itemId, amount: c.amount }))).then(
      (res) => {
        if (res.success) setRows(res.rows);
      }
    );
  }, [cost]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="research-cost-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="research-cost-modal-title" className="text-base font-medium text-text-primary">
          {targetName} — 解放に必要な材料
        </h3>
        <div className="mt-4 overflow-x-auto">
          {rows === null ? (
            <p className="text-sm text-text-muted">読み込み中…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-text-muted">必要な材料はありません。</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-base-border text-left text-text-muted">
                  <th className="py-1.5 pr-3 font-medium">材料</th>
                  <th className="py-1.5 pr-3 font-medium text-right">必要量</th>
                  <th className="py-1.5 pr-3 font-medium text-right">在庫</th>
                  <th className="py-1.5 font-medium text-right">不足数</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.itemId} className="border-b border-base-border/70">
                    <td className="py-1.5 pr-3 text-text-primary">{row.itemName}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-text-primary">
                      {row.amount}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-text-primary">
                      {row.stock}
                    </td>
                    <td className="py-1.5 text-right">
                      {row.shortfall > 0 ? (
                        <span className="tabular-nums text-error">{row.shortfall}</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          >
            中止
          </button>
        </div>
      </div>
    </div>
  );
}
