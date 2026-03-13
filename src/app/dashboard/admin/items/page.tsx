// アイテムマスタ一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminBackButton } from "../admin-back-button";
import { getAdminItemList } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminItemListClient } from "./admin-item-list-client";

export default async function AdminItemsPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const items = await getAdminItemList();
  if (!items) {
    redirect("/dashboard");
  }

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
        <Link
          href="/dashboard/admin/equipment-types"
          className="text-sm text-text-muted hover:text-brass"
        >
          装備型編集
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">アイテムマスタ編集</h1>
          <p className="mt-2 text-sm text-text-muted">
            アイテム（Item）の code / name / category / skillId / consumableEffect / maxCarryPerExpedition を編集します。行の「編集」で編集画面へ。
          </p>
        </div>
        <Link
          href="/dashboard/admin/items/new"
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass"
        >
          新規作成
        </Link>
      </div>

      <AdminItemListClient items={items} />

      <p className="mt-6 text-sm text-text-muted">
        <Link href="/dashboard/admin/equipment-types" className="text-brass hover:text-brass-hover">
          装備型（EquipmentType）の編集はこちら
        </Link>
      </p>
    </main>
  );
}
