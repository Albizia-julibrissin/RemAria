// docs/081 - 特別アイテム使用履歴の運営ビュー

import { redirect } from "next/navigation";
import { isTestUser1 } from "@/server/lib/admin";
import {
  getAdminUserForCurrencyHistory,
  getAdminItemUsageHistory,
} from "@/server/actions/admin";
import { AdminBackButton } from "../admin-back-button";
import { AdminItemUsageHistoryClient } from "./admin-item-usage-history-client";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminItemUsageHistoryPage({ searchParams }: Props) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const { q } = await searchParams;
  let user: { id: string; email: string; name: string } | null = null;
  let logs: {
    id: string;
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    reason: string;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: Date;
  }[] = [];
  let error: string | null = null;

  if (q?.trim()) {
    const resolved = await getAdminUserForCurrencyHistory(q.trim());
    if (resolved) {
      const data = await getAdminItemUsageHistory(resolved.id);
      if (data) {
        user = data.user;
        logs = data.logs;
      } else {
        error = "ユーザーまたは履歴の取得に失敗しました。";
      }
    } else {
      error = "ユーザーが見つかりません。ID またはメールアドレスを確認してください。";
    }
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6">
        <AdminBackButton />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">特別アイテム使用履歴（ユーザー別）</h1>
      <p className="mt-2 text-sm text-text-muted">
        docs/081。ユーザー ID またはメールアドレスで検索し、特別アイテム（category=special）の消費履歴を確認できます。
      </p>

      <AdminItemUsageHistoryClient
        initialQuery={q ?? ""}
        user={user}
        logs={logs}
        error={error}
      />
    </main>
  );
}
