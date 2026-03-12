// 管理画面の突入条件: 管理用アカウント（ADMIN_EMAIL で指定されたユーザー）のみ入室可。
// 各ページでも isAdminUser/isTestUser1 を参照しているが、ここで一括チェックして未許可は /dashboard へリダイレクトする。

import { redirect } from "next/navigation";
import { isAdminUser } from "@/server/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await isAdminUser();
  if (!allowed) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
