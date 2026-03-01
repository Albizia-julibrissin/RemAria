import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getSession();
  if (session.isLoggedIn && session.userId) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold text-text-primary">RE:mAria</h1>
      <nav className="mt-6 flex gap-4">
        <Link
          href="/login"
          className="text-brass hover:text-brass-hover underline"
        >
          ログイン
        </Link>
        <Link
          href="/register"
          className="text-brass hover:text-brass-hover underline"
        >
          登録
        </Link>
      </nav>
    </main>
  );
}
