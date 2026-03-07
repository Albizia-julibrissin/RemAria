"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ITEM_CATEGORIES } from "@/lib/constants/item-categories";
import type { CreateAdminItemInput } from "@/server/actions/admin";
import { createAdminItem } from "@/server/actions/admin";

const CATEGORY_LABELS: Record<string, string> = {
  material: "素材",
  consumable: "消耗品",
  blueprint: "設計図",
  skill_book: "スキル分析書",
  paid: "有料",
};

type Props = {
  skills: { id: string; name: string; category: string }[];
};

export function AdminItemCreateForm({ skills }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("material");
  const [skillId, setSkillId] = useState("");
  const [consumableEffectJson, setConsumableEffectJson] = useState("");
  const [maxCarry, setMaxCarry] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateAdminItemInput = {
      code,
      name,
      category,
      skillId: skillId.trim() || null,
      consumableEffectJson: consumableEffectJson.trim() || null,
      maxCarryPerExpedition:
        maxCarry.trim() !== "" && /^\d+$/.test(maxCarry.trim())
          ? parseInt(maxCarry.trim(), 10)
          : null,
    };
    startTransition(async () => {
      const result = await createAdminItem(input);
      if (result.success && result.itemId) {
        router.push(`/dashboard/admin/items/${result.itemId}`);
        return;
      }
      setMessage({
        type: "error",
        text: result.error ?? "作成に失敗しました。",
      });
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4">
      {message && (
        <p
          className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}
        >
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
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
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
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-text-muted">
          category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        >
          {ITEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="skillId" className="block text-sm font-medium text-text-muted">
          skillId（スキル分析書のとき必須）
        </label>
        <select
          id="skillId"
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          required={category === "skill_book"}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        >
          <option value="">— なし —</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              [{s.category}] {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="consumableEffect" className="block text-sm font-medium text-text-muted">
          consumableEffect（JSON。消耗品で使用。例: {`{"type":"hp_percent","value":10}`}）
        </label>
        <textarea
          id="consumableEffect"
          value={consumableEffectJson}
          onChange={(e) => setConsumableEffectJson(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 font-mono text-sm text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="maxCarry" className="block text-sm font-medium text-text-muted">
          maxCarryPerExpedition（探索1回の持ち込み上限。空で未設定）
        </label>
        <input
          id="maxCarry"
          type="number"
          min={0}
          value={maxCarry}
          onChange={(e) => setMaxCarry(e.target.value)}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        />
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50"
        >
          {isPending ? "作成中…" : "作成"}
        </button>
      </div>
    </form>
  );
}
