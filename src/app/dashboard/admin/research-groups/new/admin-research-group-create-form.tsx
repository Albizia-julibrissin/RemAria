"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAdminResearchGroup } from "@/server/actions/admin";

export function AdminResearchGroupCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createAdminResearchGroup({
        code: code.trim(),
        name: name.trim(),
        displayOrder,
      });
      if (result.success && result.researchGroupId) {
        router.push(`/dashboard/admin/research-groups/${result.researchGroupId}`);
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

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-text-muted">
          name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="displayOrder" className="block text-sm font-medium text-text-muted">
          表示順（数値）
        </label>
        <input
          id="displayOrder"
          type="number"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
          className="mt-1 w-24 rounded border border-base-border bg-base px-3 py-2 text-text-primary"
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
          キャンセル
        </button>
      </div>
    </form>
  );
}
