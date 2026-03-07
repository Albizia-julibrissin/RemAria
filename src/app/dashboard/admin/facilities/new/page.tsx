// 設備種別新規作成（管理者用・テストユーザー1のみ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminFacilityTypeCreateForm } from "./admin-facility-type-create-form";

export default async function AdminFacilityTypeNewPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
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

      <h1 className="text-2xl font-bold text-text-primary">設備種別新規作成</h1>
      <p className="mt-2 text-sm text-text-muted">
        name / kind / description / cost を入力して新規設備種別を登録します。name はユニークです。
      </p>

      <AdminFacilityTypeCreateForm />
    </main>
  );
}
