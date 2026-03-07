// 設備種別 1件編集（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAdminFacilityType } from "@/server/actions/admin";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminFacilityTypeEditForm } from "./admin-facility-type-edit-form";

export default async function AdminFacilityTypeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const facility = await getAdminFacilityType(id);

  if (!facility) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/facilities"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← 設備一覧
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">設備種別編集</h1>
      <p className="mt-2 text-sm text-text-muted">
        {facility.name}
      </p>

      <AdminFacilityTypeEditForm facility={facility} />
    </main>
  );
}
