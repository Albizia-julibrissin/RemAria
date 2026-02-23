import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth/session";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "RemAria",
  description: "スチームパンク × ハイファンタジー",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="ja">
      <body className="min-h-screen bg-base text-text-primary antialiased font-sans flex flex-col">
        <Header isLoggedIn={!!(session.isLoggedIn && session.userId)} />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
