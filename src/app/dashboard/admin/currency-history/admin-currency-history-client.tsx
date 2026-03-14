"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { CURRENCY_REASON_LABELS } from "@/lib/constants/currency-transaction-reasons";

type User = { id: string; email: string; name: string };
type Tx = {
  id: string;
  currencyType: string;
  amount: number;
  beforeBalance: number | null;
  afterBalance: number | null;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
};

type Props = {
  initialQuery: string;
  user: User | null;
  transactions: Tx[];
  error: string | null;
};

const CURRENCY_TYPE_LABELS: Record<string, string> = {
  premium_free: "無償GRA",
  premium_paid: "有償GRA",
};

export function AdminCurrencyHistoryClient({
  initialQuery,
  user,
  transactions,
  error,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams);
      if (query.trim()) {
        params.set("q", query.trim());
      } else {
        params.delete("q");
      }
      router.push(`/dashboard/admin/currency-history?${params.toString()}`);
    },
    [query, router, searchParams]
  );

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="currency-history-q" className="block text-sm text-text-muted">
            ユーザー ID またはメールアドレス
          </label>
          <input
            id="currency-history-q"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例: test2@example.com"
            className="mt-1 w-72 rounded border border-base-border bg-base px-3 py-2 text-text-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover"
        >
          検索
        </button>
      </form>

      {error && (
        <p className="text-error">{error}</p>
      )}

      {user && (
        <>
          <div className="rounded border border-base-border bg-base-elevated p-4">
            <h2 className="text-sm font-semibold text-text-muted">対象ユーザー</h2>
            <p className="mt-1 text-text-primary">
              {user.name}（{user.email}） / ID: {user.id}
            </p>
          </div>

          <div className="rounded border border-base-border bg-base-elevated overflow-x-auto">
            <h2 className="p-4 text-sm font-semibold text-text-muted border-b border-base-border">
              通貨履歴（直近500件・新しい順）
            </h2>
            {transactions.length === 0 ? (
              <p className="p-4 text-text-muted">履歴がありません。</p>
            ) : (
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-base-border text-left text-text-muted">
                    <th className="p-2 pr-4">日時</th>
                    <th className="p-2 pr-4">種別</th>
                    <th className="p-2 pr-4">理由</th>
                    <th className="p-2 pr-4 text-right">増減</th>
                    <th className="p-2 pr-4 text-right">変更前</th>
                    <th className="p-2 pr-4 text-right">変更後</th>
                    <th className="p-2">参照</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-base-border">
                      <td className="p-2 pr-4 text-text-muted whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString("ja-JP")}
                      </td>
                      <td className="p-2 pr-4">
                        {CURRENCY_TYPE_LABELS[tx.currencyType] ?? tx.currencyType}
                      </td>
                      <td className="p-2 pr-4">
                        {(tx.reason && CURRENCY_REASON_LABELS[tx.reason]) ?? tx.reason ?? "—"}
                      </td>
                      <td className="p-2 pr-4 text-right font-medium">
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} GRA
                      </td>
                      <td className="p-2 pr-4 text-right text-text-muted">
                        {tx.beforeBalance != null ? tx.beforeBalance : "—"}
                      </td>
                      <td className="p-2 pr-4 text-right text-text-muted">
                        {tx.afterBalance != null ? tx.afterBalance : "—"}
                      </td>
                      <td className="p-2 text-text-muted text-xs">
                        {tx.referenceType && tx.referenceId
                          ? `${tx.referenceType}: ${tx.referenceId.slice(0, 8)}…`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
