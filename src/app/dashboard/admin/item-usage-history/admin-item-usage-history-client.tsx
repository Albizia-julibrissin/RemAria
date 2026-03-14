"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ITEM_USAGE_REASON_LABELS } from "@/lib/constants/item-usage-reasons";

type User = { id: string; email: string; name: string };
type LogRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
};

type Props = {
  initialQuery: string;
  user: User | null;
  logs: LogRow[];
  error: string | null;
};

export function AdminItemUsageHistoryClient({
  initialQuery,
  user,
  logs,
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
      router.push(`/dashboard/admin/item-usage-history?${params.toString()}`);
    },
    [query, router, searchParams]
  );

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="item-usage-history-q" className="block text-sm text-text-muted">
            ユーザー ID またはメールアドレス
          </label>
          <input
            id="item-usage-history-q"
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

      {error && <p className="text-error">{error}</p>}

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
              特別アイテム使用履歴（直近500件・新しい順）
            </h2>
            {logs.length === 0 ? (
              <p className="p-4 text-text-muted">履歴がありません。</p>
            ) : (
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-base-border text-left text-text-muted">
                    <th className="p-2 pr-4">日時</th>
                    <th className="p-2 pr-4">アイテム</th>
                    <th className="p-2 pr-4 text-right">数量</th>
                    <th className="p-2 pr-4">理由</th>
                    <th className="p-2">参照</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) => (
                    <tr key={row.id} className="border-b border-base-border">
                      <td className="p-2 pr-4 text-text-muted whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("ja-JP")}
                      </td>
                      <td className="p-2 pr-4 text-text-primary">
                        {row.itemName}（{row.itemCode}）
                      </td>
                      <td className="p-2 pr-4 text-right tabular-nums">{row.quantity}</td>
                      <td className="p-2 pr-4">
                        {ITEM_USAGE_REASON_LABELS[row.reason] ?? row.reason}
                      </td>
                      <td className="p-2 text-text-muted text-xs">
                        {row.referenceType && row.referenceId
                          ? `${row.referenceType}: ${row.referenceId.slice(0, 8)}…`
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

      <footer className="border-t border-base-border pt-4">
        <Link
          href="/dashboard/admin/content"
          className="inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-base"
        >
          ← コンテンツ管理に戻る
        </Link>
      </footer>
    </div>
  );
}
