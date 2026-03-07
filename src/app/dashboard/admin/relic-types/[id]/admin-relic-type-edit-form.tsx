"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRelicTypeDetail, UpdateAdminRelicTypeInput } from "@/server/actions/admin";
import { updateAdminRelicType } from "@/server/actions/admin";

type Props = { relicType: AdminRelicTypeDetail };

export function AdminRelicTypeEditForm({ relicType }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [code, setCode] = useState(relicType.code);
  const [name, setName] = useState(relicType.name);
  const [groupCode, setGroupCode] = useState(relicType.groupCode ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminRelicTypeInput = {
      code: code.trim(),
      name: name.trim(),
      groupCode: groupCode.trim() || null,
    };
    startTransition(async () => {
      const result = await updateAdminRelicType(relicType.id, input);
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
        <label htmlFor="groupCode" className="block text-sm font-medium text-text-muted">groupCode（鑑定グループ。任意）</label>
        <input id="groupCode" type="text" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} placeholder="例: group_a" className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
      </div>
      <div className="flex gap-4 pt-4">
        <button type="submit" disabled={isPending} className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50">{isPending ? "保存中…" : "保存"}</button>
      </div>
    </form>
  );
}
