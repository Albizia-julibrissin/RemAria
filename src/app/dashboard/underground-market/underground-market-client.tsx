"use client";

// docs/079 - 闇市・黒市（タブ切り替え・購入）

import { useState, useTransition } from "react";
import {
  purchaseFromSystemShop,
  type SystemShopRow,
} from "@/server/actions/underground-market";
import { GraDisplay } from "@/components/currency/gra-display";

type Tab = "underground" | "black";

type ConfirmTarget = {
  id: string;
  itemName: string;
  priceGRA: number;
};

type Props = {
  underground: { items: SystemShopRow[]; freeBalance: number; paidBalance: number };
  black: { items: SystemShopRow[]; freeBalance: number; paidBalance: number };
};

export function UndergroundMarketClient({ underground, black }: Props) {
  const [tab, setTab] = useState<Tab>("underground");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [isPending, startTransition] = useTransition();

  const data = tab === "underground" ? underground : black;
  const isUnderground = tab === "underground";

  const doPurchase = (target: ConfirmTarget) => {
    setMessage(null);
    setConfirmTarget(null);
    startTransition(async () => {
      const result = await purchaseFromSystemShop(target.id, 1);
      if (result.success) {
        setMessage({ type: "ok", text: `${target.itemName} を購入しました。` });
      } else {
        setMessage({ type: "error", text: result.message ?? "購入に失敗しました。" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-base-border pb-2">
        <button
          type="button"
          onClick={() => setTab("underground")}
          className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
            tab === "underground"
              ? "bg-brass text-white"
              : "bg-base-elevated text-text-primary hover:bg-base-border/50"
          }`}
         >
          闇市
        </button>
        <button
          type="button"
          onClick={() => setTab("black")}
          className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
            tab === "black"
              ? "bg-brass text-white"
              : "bg-base-elevated text-text-primary hover:bg-base-border/50"
          }`}
        >
          黒市
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
        <GraDisplay
          free={data.freeBalance}
          paid={data.paidBalance}
          compact={false}
          showLabel={true}
        />
      </div>

      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      {confirmTarget && (() => {
        const price = confirmTarget.priceGRA;
        const fromFree = isUnderground
          ? Math.min(price, data.freeBalance)
          : 0;
        const fromPaid = price - fromFree;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-confirm-title"
          >
            <div className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-4 shadow-lg">
              <h2 id="purchase-confirm-title" className="text-lg font-medium text-text-primary">
                購入の確認
              </h2>
              <p className="mt-2 text-sm text-text-primary">
                {confirmTarget.itemName}（{price.toLocaleString()} GRA）を以下の通り購入します。よろしいですか？
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-muted">現在の無償</dt>
                  <dd className="tabular-nums text-text-primary">
                    {data.freeBalance.toLocaleString()} GRA
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">現在の有償</dt>
                  <dd className="tabular-nums text-text-primary">
                    {data.paidBalance.toLocaleString()} GRA
                  </dd>
                </div>
                <div className="flex justify-between border-t border-base-border pt-2">
                  <dt className="text-text-muted">購入後の無償</dt>
                  <dd className="tabular-nums text-text-primary">
                    {(data.freeBalance - fromFree).toLocaleString()} GRA
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">購入後の有償</dt>
                  <dd className="tabular-nums text-text-primary">
                    {(data.paidBalance - fromPaid).toLocaleString()} GRA
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmTarget(null)}
                  disabled={isPending}
                  className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border/50 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => doPurchase(confirmTarget)}
                  disabled={isPending}
                  className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
                >
                  購入する
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {data.items.length === 0 ? (
        <p className="text-text-muted">現在、販売中の品目はありません。</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-base-border bg-base-elevated p-3"
            >
              <div>
                <span className="font-medium text-text-primary">{row.itemName}</span>
                <span className="ml-2 text-sm text-text-muted">({row.itemCode})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-text-primary">{row.priceGRA.toLocaleString()} GRA</span>
                <button
                  type="button"
                  disabled={
                    isPending ||
                    (isUnderground
                      ? data.freeBalance + data.paidBalance < row.priceGRA
                      : data.paidBalance < row.priceGRA)
                  }
                  onClick={() =>
                    setConfirmTarget({
                      id: row.id,
                      itemName: row.itemName,
                      priceGRA: row.priceGRA,
                    })
                  }
                  className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  購入
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
