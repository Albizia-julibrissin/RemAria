"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  CreateAdminRelicGroupConfigInput,
  AdminRelicPassiveEffectRow,
} from "@/server/actions/admin";
import { createAdminRelicGroupConfig } from "@/server/actions/admin";

type Props = { passives: AdminRelicPassiveEffectRow[] };

export function AdminRelicGroupCreateForm({ passives }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [groupCode, setGroupCode] = useState("");
  const [name, setName] = useState("");
  const [statBonus1Min, setStatBonus1Min] = useState(3);
  const [statBonus1Max, setStatBonus1Max] = useState(8);
  const [statBonus2Min, setStatBonus2Min] = useState(2);
  const [statBonus2Max, setStatBonus2Max] = useState(5);
  const [attributeResistMin, setAttributeResistMin] = useState(0.85);
  const [attributeResistMax, setAttributeResistMax] = useState(0.95);
  const [includeNoEffect, setIncludeNoEffect] = useState(true);
  const [passiveEffectIds, setPassiveEffectIds] = useState<string[]>([]);

  const togglePassive = (id: string) => {
    setPassiveEffectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateAdminRelicGroupConfigInput = {
      groupCode: groupCode.trim(),
      name: name.trim() || null,
      statBonus1Min,
      statBonus1Max,
      statBonus2Min,
      statBonus2Max,
      attributeResistMin,
      attributeResistMax,
      includeNoEffect,
      passiveEffectIds,
    };
    startTransition(async () => {
      const result = await createAdminRelicGroupConfig(input);
      if (result.success && result.relicGroupConfigId) {
        router.push(`/dashboard/admin/relic-groups/${result.relicGroupConfigId}`);
        return;
      }
      setMessage({ type: "error", text: result.error ?? "作成に失敗しました。" });
    });
  };

  const passivesWithoutNone = passives.filter((p) => p.code !== "none");

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4">
      {message && <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>{message.text}</p>}
      <div>
        <label htmlFor="groupCode" className="block text-sm font-medium text-text-muted">groupCode（ユニーク。例: group_a）</label>
        <input id="groupCode" type="text" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} required placeholder="group_a" className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
      </div>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-text-muted">name（表示名。任意）</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="グループA" className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="stat1Min" className="block text-sm font-medium text-text-muted">ステ補正1 min %</label>
          <input id="stat1Min" type="number" value={statBonus1Min} onChange={(e) => setStatBonus1Min(Number(e.target.value))} className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
        </div>
        <div>
          <label htmlFor="stat1Max" className="block text-sm font-medium text-text-muted">ステ補正1 max %</label>
          <input id="stat1Max" type="number" value={statBonus1Max} onChange={(e) => setStatBonus1Max(Number(e.target.value))} className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="stat2Min" className="block text-sm font-medium text-text-muted">ステ補正2 min %</label>
          <input id="stat2Min" type="number" value={statBonus2Min} onChange={(e) => setStatBonus2Min(Number(e.target.value))} className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
        </div>
        <div>
          <label htmlFor="stat2Max" className="block text-sm font-medium text-text-muted">ステ補正2 max %</label>
          <input id="stat2Max" type="number" value={statBonus2Max} onChange={(e) => setStatBonus2Max(Number(e.target.value))} className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="resistMin" className="block text-sm font-medium text-text-muted">耐性倍率 min（0.85=15%軽減）</label>
          <input id="resistMin" type="number" step="0.01" min="0" max="1" value={attributeResistMin} onChange={(e) => setAttributeResistMin(Number(e.target.value))} className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
        </div>
        <div>
          <label htmlFor="resistMax" className="block text-sm font-medium text-text-muted">耐性倍率 max</label>
          <input id="resistMax" type="number" step="0.01" min="0" max="1" value={attributeResistMax} onChange={(e) => setAttributeResistMax(Number(e.target.value))} className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input id="includeNoEffect" type="checkbox" checked={includeNoEffect} onChange={(e) => setIncludeNoEffect(e.target.checked)} className="rounded border-base-border" />
        <label htmlFor="includeNoEffect" className="text-sm text-text-muted">効果なしを抽選プールに含める</label>
      </div>
      <div>
        <p className="block text-sm font-medium text-text-muted mb-2">抽選対象パッシブ効果（複数選択可）</p>
        <div className="flex flex-wrap gap-3 rounded border border-base-border bg-base-elevated p-3">
          {passivesWithoutNone.length === 0 ? (
            <span className="text-sm text-text-muted">パッシブ効果がありません（code=none は除外）</span>
          ) : (
            passivesWithoutNone.map((p) => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={passiveEffectIds.includes(p.id)} onChange={() => togglePassive(p.id)} className="rounded border-base-border" />
                <span className="text-sm text-text-primary">{p.name}</span>
                <span className="text-xs text-text-muted font-mono">({p.code})</span>
              </label>
            ))
          )}
        </div>
      </div>
      <div className="flex gap-4 pt-4">
        <button type="submit" disabled={isPending} className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50">{isPending ? "作成中…" : "作成"}</button>
      </div>
    </form>
  );
}
