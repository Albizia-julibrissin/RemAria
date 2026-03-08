"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminEnemyDetail,
  UpdateAdminEnemyInput,
} from "@/server/actions/admin";
import { updateAdminEnemy } from "@/server/actions/admin";
import {
  SUBJECT_OPTIONS,
  CONDITION_OPTIONS,
  CYCLE_CONDITION_OPTIONS,
  TURN_CONDITION_OPTIONS,
  ACTION_TYPES,
  CYCLE_N_OPTIONS,
  TURN_INDEX_OPTIONS,
  PERCENT_OPTIONS,
  ATTR_OPTIONS,
} from "@/app/dashboard/tactics/tactics-constants";

const CYCLE_CONDITION_VALUES = new Set<string>(CYCLE_CONDITION_OPTIONS.map((o) => o.value));

const BASE_STATS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK", "CAP"] as const;

type SkillOption = { id: string; name: string; battleSkillType: string | null };

type ConditionParam = Record<string, unknown> | null;

type SlotState = {
  subject: string;
  conditionKind: string;
  conditionParam: ConditionParam;
  actionType: string;
  skillId: string;
};

const defaultSlot: SlotState = {
  subject: "self",
  conditionKind: "always",
  conditionParam: null,
  actionType: "normal_attack",
  skillId: "",
};

function normalizeConditionParamFromDb(v: unknown): ConditionParam {
  if (v == null || v === undefined) return null;
  if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as unknown;
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

type Props = { enemy: AdminEnemyDetail; skillOptions: SkillOption[] };

export function AdminEnemyEditForm({ enemy, skillOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [code, setCode] = useState(enemy.code);
  const [name, setName] = useState(enemy.name);
  const [iconFilename, setIconFilename] = useState(enemy.iconFilename ?? "");
  const [description, setDescription] = useState(enemy.description ?? "");
  const [stats, setStats] = useState<Record<string, number>>({
    STR: enemy.STR,
    INT: enemy.INT,
    VIT: enemy.VIT,
    WIS: enemy.WIS,
    DEX: enemy.DEX,
    AGI: enemy.AGI,
    LUK: enemy.LUK,
    CAP: enemy.CAP,
  });
  const [defaultBattleCol, setDefaultBattleCol] = useState(enemy.defaultBattleCol);
  const [slots, setSlots] = useState<SlotState[]>(() => {
    const fromDb = enemy.tacticSlots.map((s) => ({
      subject: s.subject,
      conditionKind: s.conditionKind,
      conditionParam: normalizeConditionParamFromDb(s.conditionParam),
      actionType: s.actionType,
      skillId: s.skillId ?? "",
    }));
    if (fromDb.length > 0) return fromDb;
    return [{ ...defaultSlot }];
  });

  const addSlot = () => {
    if (slots.length >= 10) return;
    setSlots((prev) => [...prev, { ...defaultSlot }]);
  };
  const removeSlot = (i: number) => {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
  };
  const updateSlot = (i: number, patch: Partial<SlotState>) => {
    setSlots((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        const next = { ...s, ...patch };
        if (patch.subject !== undefined) {
          if (next.subject === "cycle") {
            next.conditionKind = CYCLE_CONDITION_VALUES.has(next.conditionKind)
              ? next.conditionKind
              : "cycle_is_even";
            next.conditionParam =
              next.conditionKind === "cycle_is_multiple_of"
                ? { n: 2 }
                : next.conditionKind === "cycle_at_least" || next.conditionKind === "cycle_equals"
                  ? { n: 1 }
                  : null;
          } else if (next.subject === "turn") {
            next.conditionKind = "turn_order_in_range";
            next.conditionParam = { turnIndexMin: 1, turnIndexMax: 2 };
          } else {
            if (!CONDITION_OPTIONS.some((o) => o.value === next.conditionKind)) {
              next.conditionKind = "always";
              next.conditionParam = null;
            }
          }
        }
        if (patch.conditionKind !== undefined) {
          const kind = next.conditionKind;
          if (kind === "always") next.conditionParam = null;
          else if (kind === "subject_has_attr_state") next.conditionParam = { attr: "none" };
          else if (kind === "cycle_is_even" || kind === "cycle_is_odd") next.conditionParam = null;
          else if (kind === "cycle_is_multiple_of") next.conditionParam = { n: 2 };
          else if (kind === "cycle_at_least" || kind === "cycle_equals") next.conditionParam = { n: 1 };
          else if (kind === "turn_order_in_range")
            next.conditionParam = { turnIndexMin: 1, turnIndexMax: 6 };
          else next.conditionParam = { percent: 50 };
        }
        return next;
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminEnemyInput = {
      code: code.trim(),
      name: name.trim(),
      iconFilename: iconFilename.trim() || null,
      description: description.trim() || null,
      STR: stats.STR ?? 0,
      INT: stats.INT ?? 0,
      VIT: stats.VIT ?? 0,
      WIS: stats.WIS ?? 0,
      DEX: stats.DEX ?? 0,
      AGI: stats.AGI ?? 0,
      LUK: stats.LUK ?? 0,
      CAP: stats.CAP ?? 0,
      defaultBattleRow: enemy.defaultBattleRow, // 探索では選出順で上から固定のため画面では編集しない
      defaultBattleCol,
      tacticSlots: slots.map((s, i) => ({
        orderIndex: i + 1,
        subject: s.subject,
        conditionKind: s.conditionKind,
        conditionParam: s.conditionParam ?? undefined,
        actionType: s.actionType,
        skillId: s.actionType === "skill" && s.skillId ? s.skillId : null,
      })),
    };
    startTransition(async () => {
      const result = await updateAdminEnemy(enemy.id, input);
      setMessage(
        result.success
          ? { type: "ok", text: "保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-3xl space-y-6">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">基本</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-muted">code（ユニーク）</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
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
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-text-muted">iconFilename（任意）</label>
            <input
              type="text"
              value={iconFilename}
              onChange={(e) => setIconFilename(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-text-muted">description（任意）</label>
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
        <h2 className="text-lg font-medium text-text-primary">基礎ステ</h2>
        <div className="mt-3 flex flex-wrap gap-4">
          {BASE_STATS.map((key) => (
            <div key={key} className="w-24">
              <label className="block text-xs font-medium text-text-muted">{key}</label>
              <input
                type="number"
                min={0}
                value={stats[key] ?? 0}
                onChange={(e) => setStats((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">デフォルト列（1～3）</h2>
        <p className="mt-1 text-sm text-text-muted">探索では行は選出順で上から固定。列のみマスタで指定。</p>
        <div className="mt-3">
          <label className="block text-sm font-medium text-text-muted">列</label>
          <input
            type="number"
            min={1}
            max={3}
            value={defaultBattleCol}
            onChange={(e) => setDefaultBattleCol(Number(e.target.value))}
            className="mt-1 w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
          />
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-text-primary">作戦スロット（最大10）</h2>
          <button
            type="button"
            onClick={addSlot}
            disabled={slots.length >= 10}
            className="text-sm text-brass hover:text-brass-hover disabled:opacity-50"
          >
            + 追加
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {slots.map((slot, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 rounded border border-base-border bg-base p-3"
            >
              <span className="w-6 text-sm text-text-muted">{i + 1}</span>
              <div>
                <label className="block text-xs text-text-muted">主語</label>
                <select
                  value={slot.subject}
                  onChange={(e) => updateSlot(i, { subject: e.target.value })}
                  className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
                >
                  {SUBJECT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted">条件</label>
                <select
                  value={
                    slot.subject === "cycle"
                      ? CYCLE_CONDITION_VALUES.has(slot.conditionKind)
                        ? slot.conditionKind
                        : "cycle_is_even"
                      : slot.subject === "turn"
                        ? "turn_order_in_range"
                        : slot.conditionKind
                  }
                  onChange={(e) => updateSlot(i, { conditionKind: e.target.value })}
                  className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
                >
                  {slot.subject === "cycle" &&
                    CYCLE_CONDITION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  {slot.subject === "turn" &&
                    TURN_CONDITION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  {slot.subject !== "cycle" &&
                    slot.subject !== "turn" &&
                    CONDITION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
              </div>
              <div className="flex items-end gap-1 flex-wrap">
                <label className="block w-full text-xs text-text-muted">条件param</label>
                {(slot.conditionKind === "always" ||
                  slot.conditionKind === "cycle_is_even" ||
                  slot.conditionKind === "cycle_is_odd") && (
                  <span className="text-sm text-text-muted py-1">—</span>
                )}
                {(slot.conditionKind === "cycle_is_multiple_of" ||
                  slot.conditionKind === "cycle_at_least" ||
                  slot.conditionKind === "cycle_equals") && (
                  <select
                    value={
                      (slot.conditionParam as { n?: number } | null)?.n ??
                      (slot.conditionKind === "cycle_equals" ? 1 : 2)
                    }
                    onChange={(e) =>
                      updateSlot(i, { conditionParam: { n: Number(e.target.value) } })
                    }
                    className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary min-w-[56px]"
                  >
                    {CYCLE_N_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                )}
                {slot.conditionKind === "turn_order_in_range" && (
                  <span className="flex items-center gap-1 flex-wrap">
                    <select
                      value={
                        (slot.conditionParam as { turnIndexMin?: number } | null)?.turnIndexMin ?? 1
                      }
                      onChange={(e) => {
                        const p = (slot.conditionParam as { turnIndexMin?: number; turnIndexMax?: number }) ?? {};
                        updateSlot(i, {
                          conditionParam: { ...p, turnIndexMin: Number(e.target.value) },
                        });
                      }}
                      className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary min-w-[48px]"
                    >
                      {TURN_INDEX_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <span className="text-text-muted text-xs">～</span>
                    <select
                      value={
                        (slot.conditionParam as { turnIndexMax?: number } | null)?.turnIndexMax ?? 6
                      }
                      onChange={(e) => {
                        const p = (slot.conditionParam as { turnIndexMin?: number; turnIndexMax?: number }) ?? {};
                        updateSlot(i, {
                          conditionParam: { ...p, turnIndexMax: Number(e.target.value) },
                        });
                      }}
                      className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary min-w-[48px]"
                    >
                      {TURN_INDEX_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <span className="text-text-muted text-xs">番目</span>
                  </span>
                )}
                {slot.conditionKind === "subject_has_attr_state" && (
                  <select
                    value={(slot.conditionParam as { attr?: string } | null)?.attr ?? "none"}
                    onChange={(e) =>
                      updateSlot(i, { conditionParam: { attr: e.target.value } })
                    }
                    className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary min-w-[100px]"
                  >
                    {ATTR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
                {(slot.conditionKind?.startsWith("hp_") || slot.conditionKind?.startsWith("mp_")) && (
                  <select
                    value={(slot.conditionParam as { percent?: number } | null)?.percent ?? 50}
                    onChange={(e) =>
                      updateSlot(i, { conditionParam: { percent: Number(e.target.value) } })
                    }
                    className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary min-w-[72px]"
                  >
                    {PERCENT_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}%</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs text-text-muted">行動</label>
                <select
                  value={slot.actionType}
                  onChange={(e) => updateSlot(i, { actionType: e.target.value })}
                  className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
                >
                  {ACTION_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {slot.actionType === "skill" && (
                <div className="min-w-[140px]">
                  <label className="block text-xs text-text-muted">スキル</label>
                  <select
                    value={slot.skillId}
                    onChange={(e) => updateSlot(i, { skillId: e.target.value })}
                    className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
                  >
                    <option value="">—</option>
                    {skillOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeSlot(i)}
                className="text-sm text-text-muted hover:text-error"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-4">
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
