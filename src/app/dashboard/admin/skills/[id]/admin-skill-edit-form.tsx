"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminSkillEditData,
  UpdateAdminSkillInput,
} from "@/server/actions/admin";
import { updateAdminSkill } from "@/server/actions/admin";

type EffectRow = { tempId: string; effectType: string; paramJson: string };

type Props = {
  data: AdminSkillEditData;
};

function safeParamJson(param: unknown): string {
  if (param == null) return "{}";
  try {
    return typeof param === "string" ? param : JSON.stringify(param, null, 2);
  } catch {
    return "{}";
  }
}

/** spec/038: スキル属性。none + 7属性 */
const ATTRIBUTE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "none", label: "none" },
  { value: "crush", label: "crush（打撃）" },
  { value: "slash", label: "slash（斬撃）" },
  { value: "pierce", label: "pierce（穿孔）" },
  { value: "burn", label: "burn（炎）" },
  { value: "freeze", label: "freeze（氷）" },
  { value: "corrode", label: "corrode（侵食）" },
  { value: "polarity", label: "polarity（極）" },
];

export function AdminSkillEditForm({ data }: Props) {
  const router = useRouter();
  const { skill, skillEffects, effectTypeOptions, effectTypeInfo } = data;
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [showEffectRef, setShowEffectRef] = useState(false);

  const [name, setName] = useState(skill.name);
  const [category, setCategory] = useState(skill.category);
  const [description, setDescription] = useState(skill.description ?? "");
  const [battleSkillType, setBattleSkillType] = useState(skill.battleSkillType ?? "");
  const [mpCostCapCoef, setMpCostCapCoef] = useState(
    skill.mpCostCapCoef != null ? String(skill.mpCostCapCoef) : ""
  );
  const [mpCostFlat, setMpCostFlat] = useState(
    skill.mpCostFlat != null ? String(skill.mpCostFlat) : ""
  );
  const [chargeCycles, setChargeCycles] = useState(
    skill.chargeCycles != null ? String(skill.chargeCycles) : ""
  );
  const [cooldownCycles, setCooldownCycles] = useState(
    skill.cooldownCycles != null ? String(skill.cooldownCycles) : ""
  );
  const [powerMultiplier, setPowerMultiplier] = useState(
    skill.powerMultiplier != null ? String(skill.powerMultiplier) : ""
  );
  const [hitsMin, setHitsMin] = useState(skill.hitsMin != null ? String(skill.hitsMin) : "");
  const [hitsMax, setHitsMax] = useState(skill.hitsMax != null ? String(skill.hitsMax) : "");
  const [resampleTargetPerHit, setResampleTargetPerHit] = useState(
    skill.resampleTargetPerHit ?? false
  );
  const [targetScope, setTargetScope] = useState(skill.targetScope ?? "");
  const [attribute, setAttribute] = useState(skill.attribute ?? "");
  const [weightAddFront, setWeightAddFront] = useState(
    skill.weightAddFront != null ? String(skill.weightAddFront) : ""
  );
  const [weightAddMid, setWeightAddMid] = useState(
    skill.weightAddMid != null ? String(skill.weightAddMid) : ""
  );
  const [weightAddBack, setWeightAddBack] = useState(
    skill.weightAddBack != null ? String(skill.weightAddBack) : ""
  );
  const [logMessage, setLogMessage] = useState(skill.logMessage ?? "");
  const [logMessageOnCondition, setLogMessageOnCondition] = useState(
    skill.logMessageOnCondition ?? ""
  );

  const [effectRows, setEffectRows] = useState<EffectRow[]>(() =>
    skillEffects.map((e) => ({
      tempId: e.id,
      effectType: e.effectType,
      paramJson: safeParamJson(e.param),
    }))
  );

  const parseNum = (v: string): number | null =>
    v.trim() === "" ? null : Number(v.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effects: { effectType: string; param: unknown }[] = [];
    for (const row of effectRows) {
      if (!row.effectType.trim()) continue;
      let param: unknown = {};
      try {
        param = JSON.parse(row.paramJson || "{}");
      } catch {
        setMessage({ type: "error", text: "効果の param が不正な JSON です。" });
        return;
      }
      effects.push({ effectType: row.effectType.trim(), param });
    }

    const input: UpdateAdminSkillInput = {
      name: name.trim(),
      category: category.trim() || "battle_active",
      description: description.trim() || null,
      battleSkillType: battleSkillType.trim() || null,
      mpCostCapCoef: parseNum(mpCostCapCoef),
      mpCostFlat: parseNum(mpCostFlat) ?? null,
      chargeCycles: parseNum(chargeCycles) ?? null,
      cooldownCycles: parseNum(cooldownCycles) ?? null,
      powerMultiplier: parseNum(powerMultiplier),
      hitsMin: parseNum(hitsMin) ?? null,
      hitsMax: parseNum(hitsMax) ?? null,
      resampleTargetPerHit,
      targetScope: targetScope.trim() || null,
      attribute: attribute.trim() || null,
      weightAddFront: parseNum(weightAddFront),
      weightAddMid: parseNum(weightAddMid),
      weightAddBack: parseNum(weightAddBack),
      logMessage: logMessage.trim() || null,
      logMessageOnCondition: logMessageOnCondition.trim() || null,
      skillEffects: effects,
    };

    startTransition(async () => {
      const result = await updateAdminSkill(skill.id, input);
      setMessage(
        result.success
          ? { type: "ok", text: "保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const addEffect = () => {
    const first = effectTypeOptions[0];
    setEffectRows((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}`,
        effectType: first?.effectType ?? "",
        paramJson: "{}",
      },
    ]);
  };

  const removeEffect = (tempId: string) => {
    setEffectRows((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const updateEffect = (tempId: string, patch: Partial<EffectRow>) => {
    setEffectRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r))
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-4xl space-y-6">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">基本</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-muted">name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-text-muted">description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">戦闘スキル用（spec/038）</h2>
        <p className="mt-1 text-xs text-text-muted">
          category=battle_active のとき使用。空欄は null。
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-text-muted">battleSkillType</label>
            <select
              value={battleSkillType}
              onChange={(e) => setBattleSkillType(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            >
              <option value="">—</option>
              <option value="physical">physical</option>
              <option value="magic">magic</option>
              <option value="support">support</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">mpCostCapCoef</label>
            <input
              type="text"
              value={mpCostCapCoef}
              onChange={(e) => setMpCostCapCoef(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">mpCostFlat</label>
            <input
              type="text"
              value={mpCostFlat}
              onChange={(e) => setMpCostFlat(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">chargeCycles</label>
            <input
              type="text"
              value={chargeCycles}
              onChange={(e) => setChargeCycles(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">cooldownCycles</label>
            <input
              type="text"
              value={cooldownCycles}
              onChange={(e) => setCooldownCycles(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">powerMultiplier</label>
            <input
              type="text"
              value={powerMultiplier}
              onChange={(e) => setPowerMultiplier(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">hitsMin / hitsMax</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={hitsMin}
                onChange={(e) => setHitsMin(e.target.value)}
                className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
              />
              <input
                type="text"
                value={hitsMax}
                onChange={(e) => setHitsMax(e.target.value)}
                className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
              />
            </div>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={resampleTargetPerHit}
                onChange={(e) => setResampleTargetPerHit(e.target.checked)}
                className="rounded border-base-border"
              />
              resampleTargetPerHit
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">targetScope</label>
            <input
              type="text"
              value={targetScope}
              onChange={(e) => setTargetScope(e.target.value)}
              placeholder="enemy_single, enemy_all, ally_all, self..."
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">attribute</label>
            <select
              value={attribute}
              onChange={(e) => setAttribute(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            >
              {ATTRIBUTE_OPTIONS.map((opt) => (
                <option key={opt.value || "_"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">weightAdd Front/Mid/Back</label>
            <div className="mt-1 flex gap-1">
              <input
                type="text"
                value={weightAddFront}
                onChange={(e) => setWeightAddFront(e.target.value)}
                className="w-14 rounded border border-base-border bg-base px-1 py-1 text-text-primary text-xs"
              />
              <input
                type="text"
                value={weightAddMid}
                onChange={(e) => setWeightAddMid(e.target.value)}
                className="w-14 rounded border border-base-border bg-base px-1 py-1 text-text-primary text-xs"
              />
              <input
                type="text"
                value={weightAddBack}
                onChange={(e) => setWeightAddBack(e.target.value)}
                className="w-14 rounded border border-base-border bg-base px-1 py-1 text-text-primary text-xs"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-muted">logMessage</label>
            <input
              type="text"
              value={logMessage}
              onChange={(e) => setLogMessage(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">logMessageOnCondition</label>
            <input
              type="text"
              value={logMessageOnCondition}
              onChange={(e) => setLogMessageOnCondition(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">スキル効果（既存の effectType のみ選択可）</h2>
        <p className="mt-1 text-xs text-text-muted">
          効果の追加は docs/042 と run-battle-with-party の実装に合わせて行ってください。ここでは既に DB に存在する効果タイプだけ選べます。
        </p>

        <div className="mt-3 space-y-4">
          {effectRows.map((row) => (
            <div
              key={row.tempId}
              className="rounded border border-base-border bg-base p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-[200px] flex-1">
                  <label className="block text-xs font-medium text-text-muted">effectType</label>
                  <select
                    value={row.effectType}
                    onChange={(e) => updateEffect(row.tempId, { effectType: e.target.value })}
                    className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
                  >
                    <option value="">— 選択 —</option>
                    {effectTypeOptions.map((opt) => (
                      <option key={opt.effectType} value={opt.effectType}>
                        {opt.effectType} — {opt.label}
                      </option>
                    ))}
                  </select>
                  {row.effectType && (
                    <p className="mt-1 text-xs text-text-muted">
                      {effectTypeInfo[row.effectType]?.description ?? "（説明未登録）"}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeEffect(row.tempId)}
                  className="text-error hover:underline text-xs"
                >
                  削除
                </button>
              </div>
              <div className="mt-2">
                <label className="block text-xs font-medium text-text-muted">param（JSON）</label>
                <textarea
                  value={row.paramJson}
                  onChange={(e) => updateEffect(row.tempId, { paramJson: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 font-mono text-sm text-text-primary"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addEffect}
          disabled={effectTypeOptions.length === 0}
          className="mt-2 rounded border border-base-border bg-base-elevated px-3 py-1.5 text-sm text-text-primary hover:bg-base disabled:opacity-50"
        >
          ＋ 効果を追加
        </button>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <button
          type="button"
          onClick={() => setShowEffectRef((b) => !b)}
          className="text-sm font-medium text-brass hover:text-brass-hover"
        >
          {showEffectRef ? "▼ " : "▶ "}効果タイプの説明一覧（docs/042）
        </button>
        {showEffectRef && (
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(effectTypeInfo).map(([type, { label, description }]) => (
              <li key={type} className="border-b border-base-border pb-2 last:border-0">
                <span className="font-mono text-text-primary">{type}</span>
                <span className="ml-2 text-text-muted">— {label}</span>
                <p className="mt-0.5 text-xs text-text-muted">{description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
