// spec/010_auth - ヘッダー（ログアウト配置・アクティブユーザー数）
// docs/07_ui_guidelines 準拠

import Link from "next/link";
import { logoutAndRedirect } from "@/server/actions/auth";

interface HeaderProps {
  isLoggedIn: boolean;
  activeUserCount?: number;
}

export function Header({ isLoggedIn, activeUserCount }: HeaderProps) {
  return (
    <header className="bg-base-elevated border-b border-base-border">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-text-primary hover:text-brass transition-colors">
          RE:mAria
        </Link>
        <nav className="flex items-center gap-4">
          {typeof activeUserCount === "number" && (
            <span className="text-text-muted text-sm" title="直近5分以内に操作があった人数">
              いま{activeUserCount}人がプレイ中
            </span>
          )}
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="text-text-muted hover:text-brass transition-colors">
                ダッシュボード
              </Link>
              <form action={logoutAndRedirect}>
                <button
                  type="submit"
                  className="text-text-muted hover:text-brass transition-colors text-sm"
                >
                  ログアウト
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-text-muted hover:text-brass transition-colors">
                ログイン
              </Link>
              <Link href="/register" className="text-brass hover:text-brass-hover underline">
                登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
