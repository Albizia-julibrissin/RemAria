"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminExplorationThemeRow,
  UpdateAdminExplorationThemeInput,
} from "@/server/actions/admin";
import { updateAdminExplorationTheme } from "@/server/actions/admin";

type Props = {
  theme: AdminExplorationThemeRow;
};

export function AdminExplorationThemeEditForm({ theme }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [code, setCode] = useState(theme.code);
  const [name, setName] = useState(theme.name);
  const [description, setDescription] = useState(theme.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(theme.displayOrder));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminExplorationThemeInput = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      displayOrder: /^-?\d+$/.test(displayOrder.trim()) ? parseInt(displayOrder.trim(), 10) : 0,
    };
    startTransition(async () => {
      const result = await updateAdminExplorationTheme(theme.id, input);
      setMessage(
        result.success
          ? { type: "ok", text: "保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4">
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
        <label htmlFor="description" className="block text-sm font-medium text-text-muted">
          description（任意）
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="displayOrder" className="block text-sm font-medium text-text-muted">
          表示順（数値）
        </label>
        <input
          id="displayOrder"
          type="text"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
          className="mt-1 w-24 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
      >
        {isPending ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
