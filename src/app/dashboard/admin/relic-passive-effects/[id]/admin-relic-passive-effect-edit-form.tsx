"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRelicPassiveEffectDetail, UpdateAdminRelicPassiveEffectInput } from "@/server/actions/admin";
import { updateAdminRelicPassiveEffect, deleteAdminRelicPassiveEffect } from "@/server/actions/admin";
import {
  RELIC_PASSIVE_EFFECT_TYPES,
  RELIC_ATTRIBUTE_OPTIONS,
  needsAttribute,
  needsPct,
  needsAmount,
} from "@/lib/constants/relic-passive-effect-admin";

type Props = { effect: AdminRelicPassiveEffectDetail };

function parseParamNumber(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") return parseInt(v, 10) || 0;
  return 0;
}

function parseParamString(v: unknown): string {
  if (typeof v === "string") return v;
  return "";
}

export function AdminRelicPassiveEffectEditForm({ effect }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [code, setCode] = useState(effect.code);
  const [name, setName] = useState(effect.name);
  const [description, setDescription] = useState(effect.description ?? "");
  const [effectType, setEffectType] = useState(effect.effectType ?? "");
  const [paramPct, setParamPct] = useState(String(parseParamNumber(effect.param?.pct)));
  const [paramAttribute, setParamAttribute] = useState(parseParamString(effect.param?.attribute));
  const [paramAmount, setParamAmount] = useState(String(parseParamNumber(effect.param?.amount)));
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectTypeTrim = effectType.trim();
    let param: Record<string, unknown> | null = null;
    if (effectTypeTrim) {
      param = {};
      if (needsPct(effectTypeTrim)) param.pct = parseParamNumber(paramPct);
      if (needsAttribute(effectTypeTrim) && paramAttribute) param.attribute = paramAttribute;
      if (needsAmount(effectTypeTrim)) param.amount = Math.max(0, parseParamNumber(paramAmount));
    }
    const input: UpdateAdminRelicPassiveEffectInput = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      effectType: effectTypeTrim || null,
      param,
    };
    startTransition(async () => {
      const result = await updateAdminRelicPassiveEffect(effect.id, input);
      setMessage(
        result.success ? { type: "ok", text: "保存しました。" } : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm(`遺物パッシブ効果「${effect.code}」（${effect.name}）を削除しますか？\nこの効果を参照している遺物個体は効果なしになります。`)) return;
    setIsDeleting(true);
    deleteAdminRelicPassiveEffect(effect.id).then((result) => {
      if (result.success) {
        router.push("/dashboard/admin/relic-passive-effects");
        return;
      }
      setMessage({ type: "error", text: result.error ?? "削除に失敗しました。" });
      setIsDeleting(false);
    });
  };

  const showPct = effectType && needsPct(effectType);
  const showAttribute = effectType && needsAttribute(effectType);
  const showAmount = effectType && needsAmount(effectType);

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>{message.text}</p>
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

      <div className="border-t border-base-border pt-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">効果設定</h3>
        <div>
          <label htmlFor="effectType" className="block text-sm font-medium text-text-muted">
            エフェクトタイプ
          </label>
          <select
            id="effectType"
            value={effectType}
            onChange={(e) => setEffectType(e.target.value)}
            className="mt-1 w-full max-w-md rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
          >
            {RELIC_PASSIVE_EFFECT_TYPES.map((opt) => (
              <option key={opt.value || "_none"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {showPct && (
          <div className="mt-4">
            <label htmlFor="paramPct" className="block text-sm font-medium text-text-muted">
              割合（%）
            </label>
            <input
              id="paramPct"
              type="number"
              value={paramPct}
              onChange={(e) => setParamPct(e.target.value)}
              className="mt-1 w-24 rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
            />
            <p className="mt-1 text-xs text-text-muted">例: 10 で +10%、-5 で -5%</p>
          </div>
        )}

        {showAttribute && (
          <div className="mt-4">
            <label htmlFor="paramAttribute" className="block text-sm font-medium text-text-muted">
              属性
            </label>
            <select
              id="paramAttribute"
              value={paramAttribute}
              onChange={(e) => setParamAttribute(e.target.value)}
              className="mt-1 w-full max-w-xs rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
            >
              <option value="">— 選択 —</option>
              {RELIC_ATTRIBUTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {showAmount && (
          <div className="mt-4">
            <label htmlFor="paramAmount" className="block text-sm font-medium text-text-muted">
              HP回復数値（毎ターン）
            </label>
            <input
              id="paramAmount"
              type="number"
              min={0}
              value={paramAmount}
              onChange={(e) => setParamAmount(e.target.value)}
              className="mt-1 w-24 rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50"
        >
          {isPending ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || isDeleting}
          className="rounded border border-error bg-transparent px-4 py-2 text-base font-medium text-error hover:bg-error/10 disabled:opacity-50"
        >
          {isDeleting ? "削除中…" : "削除"}
        </button>
      </div>
    </form>
  );
}
