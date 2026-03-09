import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth/session";
import { getActiveUserCountLast5Min, touchUserActivity } from "@/server/lib/active-user";
import { Header } from "@/components/header";
import { ChatFloating } from "@/components/chat/ChatFloating";

export const metadata: Metadata = {
  title: "RE:mAria",
  description: "????????????",
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

  return (
    <html lang="ja">
      <body className="min-h-screen bg-base text-text-primary antialiased font-sans flex flex-col">
        <Header isLoggedIn={isLoggedIn} activeUserCount={activeUserCount} />
        <div className="flex-1">{children}</div>
        <ChatFloating isLoggedIn={isLoggedIn} />
      </body>
    </html>
  );
}
