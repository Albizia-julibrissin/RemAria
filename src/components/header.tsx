"use client";

// spec/010_auth - ヘッダー（ログアウト配置・アクティブユーザー数）
// docs/07_ui_guidelines 準拠

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { logoutAndRedirect } from "@/server/actions/auth";
import { GameIcon } from "@/components/icons/game-icon";
import { NotificationDropdown } from "@/components/notification/NotificationDropdown";

interface HeaderProps {
  isLoggedIn: boolean;
  activeUserCount?: number;
  /** 未読通知件数。ヘッダーバッジ用。 */
  unreadNotificationCount?: number;
}

export function Header({ isLoggedIn, activeUserCount, unreadNotificationCount = 0 }: HeaderProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const closeAll = () => {
    setHelpOpen(false);
    setSettingsOpen(false);
    setNotificationOpen(false);
  };

  return (
    <header className="bg-base-elevated border-b border-base-border">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={isLoggedIn ? "/dashboard" : "/"}
            className="flex items-center hover:text-brass transition-colors"
            aria-label="RE:mAria 開拓拠点へ"
          >
            <Image
              src="/images/logo-remaria.png"
              alt="RE:mAria"
              width={660}
              height={220}
              className="h-10 w-auto"
              priority
            />
          </Link>
          {typeof activeUserCount === "number" && (
            <span
              className="hidden sm:inline text-text-muted text-sm"
              title="直近5分以内に操作があった人数"
            >
              現在
              <span className="mx-0.5 text-success font-semibold">
                {activeUserCount}
              </span>
              人が開拓中
            </span>
          )}
        </div>
        <nav className="relative flex items-center gap-4">
          {isLoggedIn && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationOpen((v) => !v);
                  setHelpOpen(false);
                  setSettingsOpen(false);
                }}
                className="relative inline-flex items-center justify-center rounded-full border border-base-border bg-base px-2 py-1 text-text-muted hover:text-brass hover:border-brass transition-colors"
                title="通知を表示"
                aria-expanded={notificationOpen}
              >
                <GameIcon name="ringing-bell" className="w-4 h-4" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                )}
              </button>
              <NotificationDropdown
                isOpen={notificationOpen}
                onClose={() => setNotificationOpen(false)}
              />
            </div>
          )}

          {/* ヘルプメニュー */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setHelpOpen((v) => !v);
                setSettingsOpen(false);
              }}
              className="text-text-muted hover:text-brass transition-colors text-sm"
            >
              ヘルプ
            </button>
            {helpOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-md border border-base-border bg-base-elevated shadow-lg z-40">
                <Link
                  href="/guide"
                  onClick={closeAll}
                  className="block px-3 py-2 text-xs text-text-primary hover:bg-base"
                >
                  遊び方ガイド
                </Link>
              </div>
            )}
          </div>

          {/* 設定メニュー */}
          {isLoggedIn ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen((v) => !v);
                  setHelpOpen(false);
                }}
                className="text-text-muted hover:text-brass transition-colors text-sm"
              >
                設定
              </button>
              {settingsOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-md border border-base-border bg-base-elevated shadow-lg z-40">
                  <form
                    action={logoutAndRedirect}
                    className="border-b border-base-border last:border-b-0"
                    onSubmit={closeAll}
                  >
                    <button
                      type="submit"
                      className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-base"
                    >
                      ログアウト
                    </button>
                  </form>
                </div>
              )}
            </div>
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

