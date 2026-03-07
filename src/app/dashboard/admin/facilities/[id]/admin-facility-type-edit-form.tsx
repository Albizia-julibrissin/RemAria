"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminFacilityTypeDetail, UpdateAdminFacilityTypeInput } from "@/server/actions/admin";
import { updateAdminFacilityType } from "@/server/actions/admin";

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "resource_exploration", label: "資源探索" },
  { value: "industrial", label: "工業" },
  { value: "training", label: "訓練" },
];

type Props = {
  facility: AdminFacilityTypeDetail;
};

export function AdminFacilityTypeEditForm({ facility }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [name, setName] = useState(facility.name);
  const [kind, setKind] = useState(facility.kind);
  const [description, setDescription] = useState(facility.description ?? "");
  const [cost, setCost] = useState(String(facility.cost));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminFacilityTypeInput = {
      name: name.trim(),
      kind,
      description: description.trim() || null,
      cost: cost.trim() !== "" && /^\d+$/.test(cost.trim()) ? parseInt(cost.trim(), 10) : 40,
    };
    startTransition(async () => {
      const result = await updateAdminFacilityType(facility.id, input);
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
        <label htmlFor="name" className="block text-sm font-medium text-text-muted">
          name（ユニーク）
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="kind" className="block text-sm font-medium text-text-muted">
          kind
        </label>
        <select
          id="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-text-muted">
          description（任意）
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="cost" className="block text-sm font-medium text-text-muted">
          cost（設置枠コスト。0 以上の整数）
        </label>
        <input
          id="cost"
          type="number"
          min={0}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="mt-1 w-full max-w-[120px] rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        />
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50"
        >
          {isPending ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
