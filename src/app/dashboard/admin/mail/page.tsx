// spec/090: 郵便送信履歴（管理）

import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminBackButton } from "../admin-back-button";
import { getAdminMailList } from "@/server/actions/mail";
import { isAdminUser } from "@/server/lib/admin";

function formatDate(d: Date) {
  return new Date(d).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminMailPage() {
  const allowed = await isAdminUser();
  if (!allowed) {
    redirect("/dashboard");
  }

  const result = await getAdminMailList();
  if (!result.success) {
    redirect("/dashboard");
  }
  const { items } = result;

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <AdminBackButton />
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">郵便</h1>
          <p className="mt-2 text-sm text-text-muted">
            spec/090。運営からプレイヤーへお知らせと付与物を送信します。送信すると「郵便が届きました。」通知（郵便画面へのリンク付き）が各ユーザーに届きます。
          </p>
        </div>
        <Link
          href="/dashboard/admin/mail/send"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          新規送信
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse border border-base-border text-sm">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted">
                タイトル
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted w-36">
                送信日
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted w-28">
                有効期限
              </th>
              <th className="border border-base-border px-2 py-1.5 text-center font-medium text-text-muted w-20">
                配布先
              </th>
              <th className="border border-base-border px-2 py-1.5 text-center font-medium text-text-muted w-20">
                受取済
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5">{row.title}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {formatDate(row.createdAt)}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {row.expiresAt ? formatDate(row.expiresAt) : "無期限"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  {row.recipientCount}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  {row.receivedCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">計 {items.length} 件</p>
    </main>
  );
}
