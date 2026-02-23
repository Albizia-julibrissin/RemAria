// spec/010_auth - アカウント登録画面
// docs/07_ui_guidelines 準拠

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const session = await getSession();
  if (session.isLoggedIn && session.userId) {
    redirect("/dashboard");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-base-elevated border border-base-border rounded-lg p-6">
        <h1 className="text-xl font-semibold text-text-primary mb-6">アカウント登録</h1>
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-text-muted">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-brass hover:text-brass-hover underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  );
}
