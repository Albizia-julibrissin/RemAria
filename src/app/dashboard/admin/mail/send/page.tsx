// spec/090: 郵便 新規送信（管理）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminItemList, getAdminTitleList } from "@/server/actions/admin";
import { isAdminUser } from "@/server/lib/admin";
import { AdminMailSendForm } from "../admin-mail-send-form";

export default async function AdminMailSendPage() {
  const allowed = await isAdminUser();
  if (!allowed) {
    redirect("/dashboard");
  }

  const [itemList, titleList] = await Promise.all([
    getAdminItemList(),
    getAdminTitleList(),
  ]);
  if (!itemList || !titleList) {
    redirect("/dashboard");
  }

  const itemRows = itemList.map((r) => ({ id: r.id, code: r.code, name: r.name }));
  const titleRows = titleList.map((r) => ({ id: r.id, code: r.code, name: r.name }));

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/admin/mail"
          className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
        >
          ← 郵便一覧
        </Link>
        <Link
          href="/dashboard/admin/content"
          className="text-sm text-text-muted hover:text-brass"
        >
          実装済み一覧
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary">郵便 新規送信</h1>
      <p className="mt-2 text-sm text-text-muted">
        送信すると対象ユーザーに「郵便が届きました。」通知（郵便画面へのリンク付き）が届き、受信箱に表示されます。
      </p>

      <AdminMailSendForm itemList={itemRows} titleList={titleRows} />
    </main>
  );
}
