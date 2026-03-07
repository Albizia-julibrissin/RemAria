"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CreateAdminRelicPassiveEffectInput } from "@/server/actions/admin";
import { createAdminRelicPassiveEffect } from "@/server/actions/admin";

export function AdminRelicPassiveEffectCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateAdminRelicPassiveEffectInput = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
    };
    startTransition(async () => {
      const result = await createAdminRelicPassiveEffect(input);
      if (result.success && result.relicPassiveEffectId) {
        router.push(`/dashboard/admin/relic-passive-effects/${result.relicPassiveEffectId}`);
        return;
      }
      setMessage({ type: "error", text: result.error ?? "作成に失敗しました。" });
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4">
      {message && <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>{message.text}</p>}
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-text-muted">code（ユニーク）</label>
        <input id="code" type="text" value={code} onChange={(e) => setCode(e.target.value)} required className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
      </div>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-text-muted">name</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-text-muted">description（任意）</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
      </div>
      <div className="flex gap-4 pt-4">
        <button type="submit" disabled={isPending} className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50">{isPending ? "作成中…" : "作成"}</button>
      </div>
    </form>
  );
}
