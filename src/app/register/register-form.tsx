"use client";

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
          表示名（任意）
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          className="w-full bg-base-elevated border border-base-border rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          placeholder="冒険者"
        />
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
