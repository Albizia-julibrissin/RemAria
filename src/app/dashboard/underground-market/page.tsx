// docs/079 - 闇市メニュー（闇市・黒市タブで特別アイテムを GRA 購入）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSystemShopItems } from "@/server/actions/underground-market";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { UndergroundMarketClient } from "./underground-market-client";

export default async function UndergroundMarketPage() {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }

  const [undergroundResult, blackResult] = await Promise.all([
    getSystemShopItems("underground"),
    getSystemShopItems("black"),
  ]);

  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  if (!undergroundResult.success || !blackResult.success) {
    return (
      <main className="min-h-screen bg-base p-8">
        <        MenuPageHeaderClient
          title="闇市"
          description="GRAで特別アイテムを購入。黒市は有償GRAでのみ購入可能。"
          currentPath="/dashboard/underground-market"
        />
        <p className="text-text-muted">データの取得に失敗しました。</p>
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
        title="闇市"
        description="GRAで特別アイテムを購入。黒市は有償GRAでのみ購入可能。"
        currentPath="/dashboard/underground-market"
      />

      <section className="mt-6 max-w-2xl">
        <UndergroundMarketClient
          underground={{
            items: undergroundResult.items,
            freeBalance: undergroundResult.freeBalance,
            paidBalance: undergroundResult.paidBalance,
          }}
          black={{
            items: blackResult.items,
            freeBalance: blackResult.freeBalance,
            paidBalance: blackResult.paidBalance,
          }}
        />
      </section>

      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
