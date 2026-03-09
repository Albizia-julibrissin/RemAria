// 倉庫：所持アイテム一覧（docs/02 固定設備の倉庫）

import Link from "next/link";
import { getWarehouse } from "@/server/actions/warehouse";

export default async function WarehousePage() {
  const items = await getWarehouse();

  if (items === null) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">倉庫</h1>
        <p className="mt-4 text-text-muted">ログインしてください。</p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← ダッシュボード
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">倉庫</h1>
      <p className="mt-2 text-text-muted">所持している素材・製品の一覧です。機工区で受け取ったものがここに貯まります。</p>

      <section className="mt-8 rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
        <h2 className="text-lg font-medium text-text-primary mb-4">所持数</h2>
        <ul className="space-y-3">
          {items.map((row) => (
            <li
              key={row.itemId}
              className="flex justify-between items-center rounded border border-base-border bg-base px-4 py-3"
            >
              <span className="font-medium text-text-primary">{row.itemName}</span>
              <span className="tabular-nums text-text-primary">{row.quantity}</span>
            </li>
          ))}
        </ul>
        {items.length === 0 && (
          <p className="text-sm text-text-muted">アイテムが登録されていません。</p>
        )}
      </section>
    </main>
  );
}
