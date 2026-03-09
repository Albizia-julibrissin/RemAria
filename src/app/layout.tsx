import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth/session";
import { getActiveUserCountLast5Min, touchUserActivity } from "@/server/lib/active-user";
import { Header } from "@/components/header";
import { ChatFloating } from "@/components/chat/ChatFloating";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "RE:mAria",
  description: "スチームパンク × ハイファンタジー",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const isLoggedIn = !!(session.isLoggedIn && session.userId);

  if (session.userId) {
    void touchUserActivity(session.userId);
  }
  const activeUserCount = await getActiveUserCountLast5Min();

  const headerBalances =
    session.userId && isLoggedIn
      ? await prisma.user
          .findUnique({
            where: { id: session.userId },
            select: {
              premiumCurrencyFreeBalance: true,
              premiumCurrencyPaidBalance: true,
            },
          })
          .then((u) =>
            u
              ? {
                  premiumFree: u.premiumCurrencyFreeBalance,
                  premiumPaid: u.premiumCurrencyPaidBalance,
                }
              : null
          )
      : null;

  return (
    <html lang="ja">
      <body className="min-h-screen bg-base text-text-primary antialiased font-sans flex flex-col">
        <Header
          isLoggedIn={isLoggedIn}
          activeUserCount={activeUserCount}
          balances={headerBalances}
        />
        <div className="flex-1">{children}</div>
        <ChatFloating isLoggedIn={isLoggedIn} />
      </body>
    </html>
  );
}
