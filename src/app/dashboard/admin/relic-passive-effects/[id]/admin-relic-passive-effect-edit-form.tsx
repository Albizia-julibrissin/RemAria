"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRelicPassiveEffectDetail, UpdateAdminRelicPassiveEffectInput } from "@/server/actions/admin";
import { updateAdminRelicPassiveEffect } from "@/server/actions/admin";

type Props = { effect: AdminRelicPassiveEffectDetail };

export function AdminRelicPassiveEffectEditForm({ effect }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [code, setCode] = useState(effect.code);
  const [name, setName] = useState(effect.name);
  const [description, setDescription] = useState(effect.description ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminRelicPassiveEffectInput = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
    };
    startTransition(async () => {
      const result = await updateAdminRelicPassiveEffect(effect.id, input);
      setMessage(result.success ? { type: "ok", text: "保存しました。" } : { type: "error", text: result.error ?? "保存に失敗しました。" });
      if (result.success) router.refresh();
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
        <button type="submit" disabled={isPending} className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50">{isPending ? "保存中…" : "保存"}</button>
      </div>
    </form>
  );
}
