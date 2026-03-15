// spec/090: 郵便（受信箱）。有効期限切れは非表示。

import { getMailList } from "@/server/actions/mail";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { MailPageClient } from "./mail-page-client";
import Link from "next/link";

export default async function MailPage() {
  const result = await getMailList();
  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  if (!result.success) {
    return (
      <main className="min-h-screen bg-base p-8">
        <MenuPageHeaderClient
          title="郵便"
          description="運営からのお知らせと付与物"
          currentPath="/dashboard/mail"
        />
        <p className="text-text-muted">
          {result.error === "UNAUTHORIZED" ? "ログインしてください。" : result.error}
        </p>
        <Link href="/login" className="mt-4 inline-block text-brass hover:underline">
          ログインへ
        </Link>
        <footer className="mt-8 border-t border-base-border pt-4">
          <Link href="/dashboard" className={footerLinkClass}>
            ← 開拓拠点に戻る
          </Link>
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="郵便"
        description="運営からのお知らせと付与物。左の一覧から選択し、付与がある場合は「受け取る」で受け取れます。"
        currentPath="/dashboard/mail"
      />
      <MailPageClient items={result.items} />
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
