"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminRelicGroupConfigDetail,
  AdminRelicPassiveEffectRow,
  UpdateAdminRelicGroupConfigInput,
} from "@/server/actions/admin";
import { updateAdminRelicGroupConfig } from "@/server/actions/admin";

type Props = { config: AdminRelicGroupConfigDetail; passives: AdminRelicPassiveEffectRow[] };

export function AdminRelicGroupEditForm({ config, passives }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [groupCode, setGroupCode] = useState(config.groupCode);
  const [name, setName] = useState(config.name ?? "");
  const [statBonus1Min, setStatBonus1Min] = useState(config.statBonus1Min);
  const [statBonus1Max, setStatBonus1Max] = useState(config.statBonus1Max);
  const [statBonus2Min, setStatBonus2Min] = useState(config.statBonus2Min);
  const [statBonus2Max, setStatBonus2Max] = useState(config.statBonus2Max);
  const [attributeResistMin, setAttributeResistMin] = useState(config.attributeResistMin);
  const [attributeResistMax, setAttributeResistMax] = useState(config.attributeResistMax);
  const [includeNoEffect, setIncludeNoEffect] = useState(config.includeNoEffect);
  const [passiveEffectIds, setPassiveEffectIds] = useState<string[]>(
    config.passiveEffects.map((p) => p.id)
  );

  const togglePassive = (id: string) => {
    setPassiveEffectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminRelicGroupConfigInput = {
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
      const result = await updateAdminRelicGroupConfig(config.id, input);
      setMessage(result.success ? { type: "ok", text: "保存しました。" } : { type: "error", text: result.error ?? "保存に失敗しました。" });
      if (result.success) router.refresh();
    });
  };

  const passivesWithoutNone = passives.filter((p) => p.code !== "none");

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-4">
      {message && <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>{message.text}</p>}
      <div>
        <label htmlFor="groupCode" className="block text-sm font-medium text-text-muted">groupCode（ユニーク）</label>
        <input id="groupCode" type="text" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} required className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
      </div>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-text-muted">name（表示名。任意）</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary" />
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
          <label htmlFor="resistMin" className="block text-sm font-medium text-text-muted">耐性倍率 min</label>
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
            <span className="text-sm text-text-muted">パッシブ効果がありません</span>
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
        <button type="submit" disabled={isPending} className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50">{isPending ? "保存中…" : "保存"}</button>
      </div>
    </form>
  );
}
