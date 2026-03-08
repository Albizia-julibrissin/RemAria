// 装備型（EquipmentType）編集（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminEquipmentTypeListForItemMaster } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminEquipmentTypeList } from "./admin-equipment-type-list";

export default async function AdminEquipmentTypesPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const equipmentTypes = await getAdminEquipmentTypeListForItemMaster();
  if (!equipmentTypes) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/content"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← 実装済み一覧
        </Link>
        <Link
          href="/dashboard/admin/items"
          className="text-sm text-text-muted hover:text-brass"
        >
          アイテムマスタ編集
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">装備型（EquipmentType）編集</h1>
      <p className="mt-2 text-sm text-text-muted">
        クラフトで製造する装備の種類。名前の編集と削除ができます。どの装備をレシピで作るかはクラフトレシピ編集で設定します。
      </p>

      <AdminEquipmentTypeList equipmentTypes={equipmentTypes} />
    </main>
  );
}
