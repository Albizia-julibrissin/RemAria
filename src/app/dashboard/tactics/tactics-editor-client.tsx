"use client";

// spec/039: 作戦室 - プリセット編成と3人分の作戦スロット編集

import { useState, useTransition } from "react";
import { savePresetWithTactics, type TacticSlotRow, type BattleSkillOption } from "@/server/actions/tactics";
import {
  SUBJECT_OPTIONS,
  CONDITION_OPTIONS,
  PERCENT_OPTIONS,
  ATTR_OPTIONS,
  ACTION_TYPES,
  BATTLE_SKILL_TYPE_LABELS,
} from "./tactics-constants";

const DEFAULT_ROW: TacticSlotRow = {
  orderIndex: 0,
  subject: "any_enemy",
  conditionKind: "always",
  conditionParam: null,
  actionType: "normal_attack",
  skillId: null,
};

function buildSlotsFromRows(rows: TacticSlotRow[]): TacticSlotRow[] {
  return rows.map((r, i) => ({
    ...r,
    orderIndex: i + 1,
    conditionParam: r.conditionKind === "always" ? null : r.conditionParam,
  }));
}

type SlotCharacter = { characterId: string; displayName: string; category: string };

export type TacticsPreset = {
  id: string;
  name: string | null;
  slot1: SlotCharacter | null;
  slot2: SlotCharacter | null;
  slot3: SlotCharacter | null;
};

interface TacticsEditorClientProps {
  preset: TacticsPreset;
  companions: { id: string; displayName: string }[];
  mechs: { id: string; displayName: string }[];
  initialTactics: { characterId: string; slots: TacticSlotRow[] }[];
  /** キャラID → そのキャラが習得している戦闘スキル一覧 */
  battleSkillsByCharacter: Record<string, BattleSkillOption[]>;
}

export function TacticsEditorClient({
  preset,
  companions,
  mechs,
  initialTactics,
  battleSkillsByCharacter,
}: TacticsEditorClientProps) {
  const [name, setName] = useState(preset.name ?? "");
  const [slot2Id, setSlot2Id] = useState<string>(preset.slot2?.characterId ?? "");
  const [slot3Id, setSlot3Id] = useState<string>(preset.slot3?.characterId ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const slot1 = preset.slot1!;
  const characters: SlotCharacter[] = [slot1, preset.slot2, preset.slot3].filter(Boolean) as SlotCharacter[];

  const getInitialSlotsFor = (characterId: string): TacticSlotRow[] => {
    const found = initialTactics.find((t) => t.characterId === characterId);
    const existing = found?.slots ?? [];
    const byOrder = new Map(existing.map((s) => [s.orderIndex, s]));
    return Array.from({ length: 10 }, (_, i) => {
      const order = i + 1;
      const existingSlot = byOrder.get(order);
      if (existingSlot) return { ...existingSlot, orderIndex: order };
      return { ...DEFAULT_ROW, orderIndex: order };
    });
  };

  const [slotsByCharacter, setSlotsByCharacter] = useState<Record<string, TacticSlotRow[]>>(() => {
    const next: Record<string, TacticSlotRow[]> = {};
    for (const c of characters) {
      next[c.characterId] = getInitialSlotsFor(c.characterId);
    }
    return next;
  });

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const presetData = {
        name: name.trim() || null,
        slot2CharacterId: slot2Id.trim() || null,
        slot3CharacterId: slot3Id.trim() || null,
      };
      const characterIds = [slot1.characterId, slot2Id || null, slot3Id || null].filter(Boolean) as string[];
      const tacticsByCharacter = characterIds.map((characterId) => ({
        characterId,
        slots: buildSlotsFromRows(slotsByCharacter[characterId] ?? getDefaultRows()),
      }));

      const result = await savePresetWithTactics(preset.id, presetData, tacticsByCharacter);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error === "UNAUTHORIZED" ? "ログインし直してください" : result.error === "NOT_FOUND" ? "プリセットが見つかりません" : "保存に失敗しました");
      }
    });
  };

  const getDefaultRows = () =>
    Array.from({ length: 10 }, (_, i) => ({ ...DEFAULT_ROW, orderIndex: i + 1 }));

  const updateSlotRow = (characterId: string, rowIndex: number, field: keyof TacticSlotRow, value: unknown) => {
    setSlotsByCharacter((prev) => {
      const current = prev[characterId] ?? getDefaultRows();
      const rows = [...current];
      const row = { ...rows[rowIndex] };
      if (field === "conditionKind") {
        row.conditionParam = value === "always" ? null : value === "subject_has_attr_state" ? { attr: "none" } : { percent: 50 };
      }
      (row as Record<string, unknown>)[field] = value;
      rows[rowIndex] = row;
      return { ...prev, [characterId]: rows };
    });
  };

  const getSkillsByTypeFor = (characterId: string) => {
    const list = battleSkillsByCharacter[characterId] ?? [];
    const map = new Map<string, BattleSkillOption[]>();
    for (const s of list) {
      const type = s.battleSkillType ?? "other";
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(s);
    }
    return map;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary mb-3">編成</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-text-muted mb-1">プリセット名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-base border border-base-border rounded px-3 py-2 text-text-primary"
              placeholder="プリセット1"
            />
          </div>
          <div className="sm:col-span-2 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">1. 主人公</label>
              <p className="py-2 text-text-primary font-medium">{slot1.displayName}</p>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">2. 仲間</label>
              <select
                value={slot2Id}
                onChange={(e) => setSlot2Id(e.target.value)}
                className="w-full bg-base border border-base-border rounded px-3 py-2 text-text-primary"
              >
                <option value="">未選択</option>
                {companions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">3. メカ</label>
              <select
                value={slot3Id}
                onChange={(e) => setSlot3Id(e.target.value)}
                className="w-full bg-base border border-base-border rounded px-3 py-2 text-text-primary"
              >
                <option value="">未選択</option>
                {mechs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {[
        slot1,
        slot2Id
          ? {
              characterId: slot2Id,
              displayName: (preset.slot2?.characterId === slot2Id ? preset.slot2.displayName : companions.find((c) => c.id === slot2Id)?.displayName) ?? "",
              category: "companion",
            }
          : null,
        slot3Id
          ? {
              characterId: slot3Id,
              displayName: (preset.slot3?.characterId === slot3Id ? preset.slot3.displayName : mechs.find((c) => c.id === slot3Id)?.displayName) ?? "",
              category: "mech",
            }
          : null,
      ]
        .filter((c): c is SlotCharacter => c != null && !!c.characterId)
        .map((char) => {
          const rows = slotsByCharacter[char.characterId] ?? getDefaultRows();
          return (
            <div key={char.characterId} className="rounded-lg border border-base-border bg-base-elevated p-4">
              <h3 className="text-base font-medium text-text-primary mb-3">{char.displayName} の作戦（優先順）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-base-border">
                      <th className="py-2 pr-2 w-10">#</th>
                      <th className="py-2 pr-2">主語</th>
                      <th className="py-2 pr-2">条件</th>
                      <th className="py-2 pr-2">条件パラメータ</th>
                      <th className="py-2 pr-2">行動</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }, (_, i) => {
                      const row = rows[i] ?? { ...DEFAULT_ROW, orderIndex: i + 1 };
                      return (
                        <tr key={i} className="border-b border-base-border/70">
                          <td className="py-1.5 pr-2 text-text-muted">{i + 1}</td>
                          <td className="py-1.5 pr-2">
                            <select
                              value={row.subject}
                              onChange={(e) => updateSlotRow(char.characterId, i, "subject", e.target.value)}
                              className="w-full min-w-[120px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                            >
                              {SUBJECT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 pr-2">
                            <select
                              value={row.conditionKind}
                              onChange={(e) => updateSlotRow(char.characterId, i, "conditionKind", e.target.value)}
                              className="w-full min-w-[140px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                            >
                              {CONDITION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 pr-2">
                            {row.conditionKind === "always" ? (
                              <span className="text-text-muted">—</span>
                            ) : row.conditionKind === "subject_has_attr_state" ? (
                              <select
                                value={(row.conditionParam as { attr?: string } | null)?.attr ?? "none"}
                                onChange={(e) => updateSlotRow(char.characterId, i, "conditionParam", { attr: e.target.value })}
                                className="min-w-[100px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                              >
                                {ATTR_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value={(row.conditionParam as { percent?: number } | null)?.percent ?? 50}
                                onChange={(e) => updateSlotRow(char.characterId, i, "conditionParam", { percent: Number(e.target.value) })}
                                className="min-w-[80px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                              >
                                {PERCENT_OPTIONS.map((p) => (
                                  <option key={p} value={p}>
                                    {p}%
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="py-1.5 pr-2">
                            <div className="flex flex-wrap gap-1 items-center">
                              <select
                                value={row.actionType}
                                onChange={(e) => {
                                  const v = e.target.value as "normal_attack" | "skill";
                                  updateSlotRow(char.characterId, i, "actionType", v);
                                  if (v === "normal_attack") updateSlotRow(char.characterId, i, "skillId", null);
                                }}
                                className="min-w-[100px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                              >
                                {ACTION_TYPES.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              {row.actionType === "skill" && (
                                <select
                                  value={row.skillId ?? ""}
                                  onChange={(e) => updateSlotRow(char.characterId, i, "skillId", e.target.value || null)}
                                  className="min-w-[140px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                                >
                                  <option value="">スキルを選択</option>
                                  {Array.from(getSkillsByTypeFor(char.characterId).entries()).map(([type, list]) => (
                                    <optgroup key={type} label={BATTLE_SKILL_TYPE_LABELS[type] ?? type}>
                                      {list.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

      {error && (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-success text-sm" role="status">
          保存しました。
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-white font-medium hover:bg-brass-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          {isPending ? "保存中…" : "プリセットを保存"}
        </button>
      </div>
    </div>
  );
}
