// spec/075_market.md Phase 1 - 市場（購入・出品・取下げ）

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  getMarketList,
  getMyListings,
  getMarketListableInventory,
  getMarketUserHistory,
} from "@/server/actions/market";
import { MenuPageHeaderClient } from "../menu-page-header-client";
import { MarketClient } from "./market-client";

export default async function MarketPage() {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }

  const [user, listResult, myListingsResult, listableResult, historyResult] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        marketUnlocked: true,
        premiumCurrencyFreeBalance: true,
        premiumCurrencyPaidBalance: true,
      },
    }),
    getMarketList(),
    getMyListings(),
    getMarketListableInventory(),
    getMarketUserHistory(),
  ]);

  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  if (!user?.marketUnlocked) {
    return (
      <main className="min-h-screen bg-base p-8">
        <MenuPageHeaderClient
          title="市場"
          description="出品・購入。開拓任務をクリアすると利用可能になります。"
          currentPath="/dashboard/market"
        />
        <p className="text-text-muted">開拓任務をクリアすると利用可能になります。</p>
        <footer className="mt-8 border-t border-base-border pt-4">
          <Link href="/dashboard" className={footerLinkClass}>
            ← 開拓拠点に戻る
          </Link>
        </footer>
      </main>
    );
  }

  const entries = listResult.success ? listResult.entries : [];
  const myListings = myListingsResult.success ? myListingsResult.listings : [];
  const listableItems = listableResult.success ? listableResult.items : [];
  const historyEntries = historyResult.success ? historyResult.entries : [];
  const graBalance =
    (user?.premiumCurrencyFreeBalance ?? 0) + (user?.premiumCurrencyPaidBalance ?? 0);

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="市場"
        description="出品・購入。購入・出品・取下げは画面内のボタンで切り替えます。"
        currentPath="/dashboard/market"
      />
      <MarketClient
        initialEntries={entries}
        initialMyListings={myListings}
        listableItems={listableItems}
        initialHistory={historyEntries}
        graBalance={graBalance}
      />
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
