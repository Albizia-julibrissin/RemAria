// spec/075 Phase 3, manage/OPERATIONAL_LOGS.md §2.3 - 通貨履歴の運営ビュー

import Link from "next/link";
import { redirect } from "next/navigation";
import { isTestUser1 } from "@/server/lib/admin";
import {
  getAdminUserForCurrencyHistory,
  getAdminCurrencyHistory,
} from "@/server/actions/admin";
import { AdminBackButton } from "../admin-back-button";
import { AdminCurrencyHistoryClient } from "./admin-currency-history-client";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminCurrencyHistoryPage({ searchParams }: Props) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const { q } = await searchParams;
  let user: { id: string; email: string; name: string } | null = null;
  let transactions: { id: string; currencyType: string; amount: number; beforeBalance: number | null; afterBalance: number | null; reason: string | null; referenceType: string | null; referenceId: string | null; createdAt: Date }[] = [];
  let error: string | null = null;

  if (q?.trim()) {
    const resolved = await getAdminUserForCurrencyHistory(q.trim());
    if (resolved) {
      const data = await getAdminCurrencyHistory(resolved.id);
      if (data) {
        user = data.user;
        transactions = data.transactions;
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
      <h1 className="text-2xl font-bold text-text-primary">通貨履歴（ユーザー別）</h1>
      <p className="mt-2 text-sm text-text-muted">
        問い合わせ対応・不正検知用。ユーザー ID またはメールアドレスで検索し、GRA の増減履歴を確認できます。
      </p>

      <AdminCurrencyHistoryClient
        initialQuery={q ?? ""}
        user={user}
        transactions={transactions}
        error={error}
      />
    </main>
  );
}
