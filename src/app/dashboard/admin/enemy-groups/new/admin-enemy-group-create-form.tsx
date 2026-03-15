"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAdminEnemyGroup } from "@/server/actions/admin";

export function AdminEnemyGroupCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createAdminEnemyGroup({ code: code.trim() });
      if (result.success && result.enemyGroupId) {
        router.push(`/dashboard/admin/enemy-groups/${result.enemyGroupId}`);
        return;
      }
      setMessage({
        type: "error",
        text: result.error ?? "作成に失敗しました。",
      });
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-text-muted">
          code（ユニーク）
        </label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
        >
          {isPending ? "作成中…" : "作成"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-base-border px-4 py-2 text-sm text-text-primary hover:bg-base-elevated"
        >
          中止
        </button>
      </div>
    </form>
  );
}
