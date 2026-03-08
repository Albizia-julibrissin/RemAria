// アイテムマスタ一覧（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminItemList, getAdminEquipmentTypeListForItemMaster } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminEquipmentTypeNameEdit } from "./admin-equipment-type-name-edit";

const CATEGORY_LABELS: Record<string, string> = {
  material: "素材",
  consumable: "消耗品",
  blueprint: "設計図",
  skill_book: "スキル分析書",
  paid: "有料",
};

export default async function AdminItemsPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const [items, equipmentTypes] = await Promise.all([
    getAdminItemList(),
    getAdminEquipmentTypeListForItemMaster(),
  ]);
  if (!items) {
    redirect("/dashboard");
  }
  const equipmentTypeList = equipmentTypes ?? [];

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← ダッシュボード
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
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

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                code
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                name
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-28">
                category
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                スキル（skill_book時）
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                持ち込み上限
              </th>
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                  {row.code}
                </td>
                <td className="border border-base-border px-2 py-1.5">{row.name}</td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {CATEGORY_LABELS[row.category] ?? row.category}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted text-xs">
                  {row.skillName ?? "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-text-muted">
                  {row.maxCarryPerExpedition != null ? row.maxCarryPerExpedition : "—"}
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <Link
                    href={`/dashboard/admin/items/${row.id}`}
                    className="text-brass hover:text-brass-hover"
                  >
                    編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">計 {items.length} 件</p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-text-primary border-b border-base-border pb-2">
          装備型（EquipmentType）
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          クラフトで製造する装備の種類。名前のみ編集できます。どの装備をレシピで作るかはクラフトレシピ編集で設定します。
        </p>
        <AdminEquipmentTypeNameEdit equipmentTypes={equipmentTypeList} />
      </section>
    </main>
  );
}
