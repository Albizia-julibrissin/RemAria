// spec/010_auth - 保護画面（ログイン必須）
// spec/020_test_battle - 仮戦闘 / spec/025 - 宿舎 / spec/030 - 通貨表示
// docs/07_ui_guidelines 準拠

import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function DashboardPage() {
  const session = await getSession();
  let balances: { game: number; premiumFree: number; premiumPaid: number } | null = null;
  if (session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        gameCurrencyBalance: true,
        premiumCurrencyFreeBalance: true,
        premiumCurrencyPaidBalance: true,
      },
    });
    if (user) {
      balances = {
        game: user.gameCurrencyBalance,
        premiumFree: user.premiumCurrencyFreeBalance,
        premiumPaid: user.premiumCurrencyPaidBalance,
      };
    }
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <h1 className="text-2xl font-bold text-text-primary">ダッシュボード</h1>
      <p className="mt-4 text-text-muted">ようこそ。ここはログイン後に表示される保護画面です。</p>

      {balances != null && (
        <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-4 max-w-md">
          <h2 className="text-sm font-medium text-text-muted mb-2">所持通貨</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-text-muted">ゲーム通貨</dt>
              <dd className="font-medium text-text-primary tabular-nums">{balances.game}</dd>
            </div>
            <div>
              <dt className="text-text-muted">課金通貨（無償）</dt>
              <dd className="font-medium text-text-primary tabular-nums">{balances.premiumFree}</dd>
            </div>
            <div>
              <dt className="text-text-muted">課金通貨（有償）</dt>
              <dd className="font-medium text-text-primary tabular-nums">{balances.premiumPaid}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl">
        <Link
          href="/dashboard/characters"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">宿舎</span>
          <span className="mt-1 text-sm text-text-muted">キャラクター一覧</span>
        </Link>
        <Link
          href="/dashboard/recruit"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">雇用斡旋所</span>
          <span className="mt-1 text-sm text-text-muted">仲間を雇用する</span>
        </Link>
        <Link
          href="/dashboard/facilities"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">工業エリア</span>
          <span className="mt-1 text-sm text-text-muted">初期エリア・設備配置（spec/035）</span>
        </Link>
        <Link
          href="/dashboard/warehouse"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">倉庫</span>
          <span className="mt-1 text-sm text-text-muted">所持アイテムの確認</span>
        </Link>
        <Link
          href="/dashboard/tactics"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">作戦室</span>
          <span className="mt-1 text-sm text-text-muted">パーティプリセットと作戦スロットの設定</span>
        </Link>
        <Link
          href="/battle/test"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">仮戦闘</span>
          <span className="mt-1 text-sm text-text-muted">テスト戦闘を実行</span>
        </Link>
      </div>
    </main>
  );
}
