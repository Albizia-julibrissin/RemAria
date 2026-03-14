// docs/079 - 闇市・黒市の販売品編集（特別アイテムのみ登録可）

import Link from "next/link";
import { redirect } from "next/navigation";
import { isTestUser1 } from "@/server/lib/admin";
import { AdminBackButton } from "../admin-back-button";
import { AdminUndergroundMarketClient } from "./admin-underground-market-client";
import {
  getAdminSystemShopItems,
  getAdminSpecialItems,
} from "@/server/actions/admin";

export default async function AdminUndergroundMarketPage() {
  const allowed = await isTestUser1();
  if (!allowed) {
    redirect("/dashboard");
  }

  const [underground, black, specialItems] = await Promise.all([
    getAdminSystemShopItems("underground"),
    getAdminSystemShopItems("black"),
    getAdminSpecialItems(),
  ]);

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6">
        <AdminBackButton />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">闇市・黒市編集</h1>
      <p className="mt-2 text-sm text-text-muted">
        闇市（無償GRA）・黒市（有償GRA）の販売品を編集します。特別カテゴリのアイテムのみ登録できます。
      </p>
      <div className="mt-6">
        <AdminUndergroundMarketClient
          undergroundItems={underground ?? []}
          blackItems={black ?? []}
          specialItems={specialItems ?? []}
        />
      </div>
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link
          href="/dashboard/admin/content"
          className="inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-base"
        >
          ← コンテンツ管理に戻る
        </Link>
      </footer>
    </main>
  );
}
