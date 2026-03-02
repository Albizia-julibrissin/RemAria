// spec/010_auth - ログイン画面
// docs/07_ui_guidelines 準拠

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";
import { LoginForm } from "./login-form";
import { WelcomeCharacter } from "./welcome-character";

export default async function LoginPage() {
  const session = await getSession();
  if (session.isLoggedIn && session.userId) {
    redirect("/dashboard");
  }

  const iconFilenames = getProtagonistIconFilenames();
  const welcomeIcon =
    iconFilenames.length > 0
      ? iconFilenames[Math.floor(Math.random() * iconFilenames.length)]!
      : null;

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-base-elevated border border-base-border rounded-lg p-6">
        <WelcomeCharacter iconFilename={welcomeIcon} />
        <h1 className="text-xl font-semibold text-text-primary mb-6">ログイン</h1>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-text-muted">
          アカウントをお持ちでない方は{" "}
          <Link href="/register" className="text-brass hover:text-brass-hover underline">
            登録
          </Link>
        </p>
      </div>
    </main>
  );
}
