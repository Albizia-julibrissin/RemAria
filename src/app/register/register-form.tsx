"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type AuthResult } from "@/server/actions/auth";

async function registerAction(_prev: AuthResult | null, formData: FormData): Promise<AuthResult | null> {
  return register(formData);
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.success === false && (
        <p className="text-error text-sm" role="alert">
          {state.message}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm text-text-muted">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full bg-base-elevated border border-base-border rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          placeholder="user@example.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="accountId" className="text-sm text-text-muted">
          ID（英数字・必須）
        </label>
        <input
          id="accountId"
          name="accountId"
          type="text"
          required
          minLength={3}
          maxLength={24}
          autoComplete="username"
          className="w-full bg-base-elevated border border-base-border rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          placeholder="my_id_123"
        />
        <p className="text-xs text-text-muted">3〜24文字。英数字とアンダースコアのみ。重複不可。</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm text-text-muted">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="w-full bg-base-elevated border border-base-border rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          placeholder="8文字以上"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm text-text-muted">
          名前（必須）
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="w-full bg-base-elevated border border-base-border rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          placeholder="冒険者"
        />
        <p className="text-xs text-text-muted">主人公の表示名としても使用されます。</p>
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="agreeTerms"
            value="on"
            required
            className="mt-1 rounded border-base-border bg-base-elevated text-brass focus:ring-brass focus:ring-offset-base"
            aria-describedby="terms-desc"
          />
          <span id="terms-desc" className="text-sm text-text-primary">
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-brass hover:text-brass-hover underline">
              利用規約
            </Link>
            に同意する
          </span>
        </label>
      </div>
      <button
        type="submit"
        className="mt-2 w-full bg-brass hover:bg-brass-hover text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base transition-colors"
      >
        登録
      </button>
    </form>
  );
}
