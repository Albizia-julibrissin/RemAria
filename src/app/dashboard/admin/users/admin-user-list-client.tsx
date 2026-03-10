"use client";

import { useMemo, useState } from "react";
import type { AdminUserRow } from "@/server/actions/admin";

/** DBのUTC日時を日本時間（JST）で表示 */
function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type SortKey =
  | "email"
  | "accountId"
  | "name"
  | "accountStatus"
  | "createdAt"
  | "lastLoginAt"
  | "lastActiveAt"
  | "hasProtagonist";
type SortDir = "asc" | "desc";

function compare(a: unknown, b: unknown, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;
  if (a === b) return 0;
  if (a == null && b == null) return 0;
  if (a == null) return mul * 1;
  if (b == null) return mul * -1;
  if (typeof a === "string" && typeof b === "string") return mul * a.localeCompare(b);
  if (typeof a === "boolean" && typeof b === "boolean") return mul * (a === b ? 0 : a ? 1 : -1);
  if (a instanceof Date && b instanceof Date) return mul * (a.getTime() - b.getTime());
  return 0;
}

function getSortValue(row: AdminUserRow, key: SortKey): unknown {
  switch (key) {
    case "email":
      return row.email;
    case "accountId":
      return row.accountId;
    case "name":
      return row.name;
    case "accountStatus":
      return row.accountStatus;
    case "createdAt":
      return row.createdAt;
    case "lastLoginAt":
      return row.lastLoginAt;
    case "lastActiveAt":
      return row.lastActiveAt;
    case "hasProtagonist":
      return row.hasProtagonist;
    default:
      return undefined;
  }
}

type Props = { users: AdminUserRow[] };

export function AdminUserListClient({ users }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (sortKey === "lastLoginAt" || sortKey === "lastActiveAt" || sortKey === "createdAt") {
        // null は末尾に（asc のときは最小扱い、desc のときは最大扱い）
        const na = va == null;
        const nb = vb == null;
        if (na && nb) return 0;
        if (na) return sortDir === "asc" ? 1 : -1;
        if (nb) return sortDir === "asc" ? -1 : 1;
        const ta = new Date(va as Date | string).getTime();
        const tb = new Date(vb as Date | string).getTime();
        return sortDir === "asc" ? ta - tb : tb - ta;
      }
      return compare(va, vb, sortDir);
    });
  }, [users, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortableTh = ({
    label,
    keyName,
    className = "",
  }: {
    label: string;
    keyName: SortKey;
    className?: string;
  }) => (
    <th className={`border border-base-border ${className}`}>
      <button
        type="button"
        onClick={() => toggleSort(keyName)}
        className="w-full text-left px-2 py-1.5 text-text-muted font-medium hover:text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass rounded"
      >
        {label}
        {sortKey === keyName ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <SortableTh label="email" keyName="email" />
              <SortableTh label="accountId" keyName="accountId" />
              <SortableTh label="表示名" keyName="name" />
              <SortableTh label="状態" keyName="accountStatus" className="w-24" />
              <SortableTh label="登録日時" keyName="createdAt" />
              <SortableTh label="最終ログイン" keyName="lastLoginAt" />
              <SortableTh label="最終アクティブ" keyName="lastActiveAt" />
              <th className="border border-base-border w-20">
                <button
                  type="button"
                  onClick={() => toggleSort("hasProtagonist")}
                  className="w-full text-center px-2 py-1.5 text-text-muted font-medium hover:text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass rounded block"
                >
                  主人公
                  {sortKey === "hasProtagonist" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5">{row.email}</td>
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                  {row.accountId}
                </td>
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.accountStatus}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {formatDate(row.createdAt)}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {row.lastLoginAt ? formatDate(row.lastLoginAt) : "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {row.lastActiveAt ? formatDate(row.lastActiveAt) : "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center text-text-muted">
                  {row.hasProtagonist ? "済" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">計 {users.length} 件</p>
    </>
  );
}
