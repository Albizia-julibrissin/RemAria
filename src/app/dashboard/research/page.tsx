// docs/054 - 研究グループ・アイテム消費で解放

import Link from "next/link";
import { getResearchMenu } from "@/server/actions/research";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { ResearchGroupList } from "./research-group-list";

export default async function ResearchPage() {
  const result = await getResearchMenu();

  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  if (!result.success) {
    return (
      <main className="min-h-screen bg-base p-8">
        <MenuPageHeaderClient title="研究局" description="設備やレシピを解放する" currentPath="/dashboard/research" />
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

  const { groups } = result;

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="研究局"
        description="設備やレシピを解放する。解放されている研究を選ぶと、そのグループの解放可能なレシピ・設備が表示されます。"
        currentPath="/dashboard/research"
      />
      <ResearchGroupList groups={groups} />
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
