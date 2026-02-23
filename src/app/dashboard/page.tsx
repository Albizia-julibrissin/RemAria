// spec/010_auth - 保護画面（ログイン必須）
// spec/020_test_battle - 仮戦闘 / spec/025 - 宿舎カード
// docs/07_ui_guidelines 準拠

import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-base p-8">
      <h1 className="text-2xl font-bold text-text-primary">ダッシュボード</h1>
      <p className="mt-4 text-text-muted">ようこそ。ここはログイン後に表示される保護画面です。</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Link
          href="/dashboard/characters"
          className="flex flex-col rounded-lg border border-base-border bg-base-elevated p-6 text-text-primary shadow-sm transition-colors hover:border-brass hover:bg-base-elevated/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          <span className="text-lg font-medium">宿舎</span>
          <span className="mt-1 text-sm text-text-muted">キャラクター一覧</span>
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
