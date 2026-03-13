"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CreateAdminExplorationEventInput } from "@/server/actions/admin";
import { createAdminExplorationEvent } from "@/server/actions/admin";

const STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;
const DEFAULT_SUCCESS = "うまくいった。";
const DEFAULT_FAIL = "うまくいかなかった。";

export function AdminSkillEventCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [occurrenceMessage, setOccurrenceMessage] = useState("何かが起きた…。どう対処する？");
  const [statOptions, setStatOptions] = useState(
    STAT_KEYS.map((statKey, i) => ({
      statKey,
      sortOrder: i,
      difficultyCoefficient: 1,
      successMessage: DEFAULT_SUCCESS,
      failMessage: DEFAULT_FAIL,
    }))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateAdminExplorationEventInput = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      occurrenceMessage: occurrenceMessage.trim() || "何かが起きた…。どう対処する？",
      statOptions: statOptions.map((o) => ({
        statKey: o.statKey,
        sortOrder: o.sortOrder,
        difficultyCoefficient: Number(o.difficultyCoefficient) || 1,
        successMessage: o.successMessage.trim() || DEFAULT_SUCCESS,
        failMessage: o.failMessage.trim() || DEFAULT_FAIL,
      })),
    };
    startTransition(async () => {
      const result = await createAdminExplorationEvent(input);
      if (result.success && result.explorationEventId) {
        router.push(`/dashboard/admin/skill-events/${result.explorationEventId}`);
        return;
      }
      setMessage({ type: "error", text: result.error ?? "作成に失敗しました。" });
    });
  };

  const updateStat = (index: number, field: keyof (typeof statOptions)[0], value: string | number) => {
    setStatOptions((prev) => {
      const next = [...prev];
      (next[index] as Record<string, unknown>)[field] = value;
      return next;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-3xl space-y-6">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>{message.text}</p>
      )}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-text-primary">基本</h2>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-text-muted">code（ユニーク）</label>
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
          <label htmlFor="name" className="block text-sm font-medium text-text-muted">name（管理用）</label>
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
          <label htmlFor="description" className="block text-sm font-medium text-text-muted">description（任意）</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label htmlFor="occurrenceMessage" className="block text-sm font-medium text-text-muted">発生メッセージ</label>
          <textarea
            id="occurrenceMessage"
            value={occurrenceMessage}
            onChange={(e) => setOccurrenceMessage(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3">ステータス別（係数・成功/失敗メッセージ）</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse border border-base-border text-sm">
            <thead>
              <tr className="bg-base-elevated">
                <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted">stat</th>
                <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted w-20">係数</th>
                <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted">成功時</th>
                <th className="border border-base-border px-2 py-1.5 text-left font-medium text-text-muted">失敗時</th>
              </tr>
            </thead>
            <tbody>
              {statOptions.map((o, i) => (
                <tr key={o.statKey}>
                  <td className="border border-base-border px-2 py-1.5 font-mono text-text-primary">{o.statKey}</td>
                  <td className="border border-base-border px-2 py-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={o.difficultyCoefficient}
                      onChange={(e) => updateStat(i, "difficultyCoefficient", e.target.value)}
                      className="w-full rounded border border-base-border bg-base-elevated px-2 py-1 text-text-primary"
                    />
                  </td>
                  <td className="border border-base-border px-2 py-1.5">
                    <input
                      type="text"
                      value={o.successMessage}
                      onChange={(e) => updateStat(i, "successMessage", e.target.value)}
                      className="w-full rounded border border-base-border bg-base-elevated px-2 py-1 text-text-primary"
                    />
                  </td>
                  <td className="border border-base-border px-2 py-1.5">
                    <input
                      type="text"
                      value={o.failMessage}
                      onChange={(e) => updateStat(i, "failMessage", e.target.value)}
                      className="w-full rounded border border-base-border bg-base-elevated px-2 py-1 text-text-primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
        >
          {isPending ? "作成中…" : "作成"}
        </button>
        <Link
          href="/dashboard/admin/skill-events"
          className="rounded border border-base-border bg-base-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border/50"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
