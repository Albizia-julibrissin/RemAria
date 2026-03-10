"use client";

// spec/039: 作戦室 - プリセット編成と3人分の作戦スロット編集

import { useState, useTransition, useCallback, memo, useMemo, useEffect } from "react";
import {
  savePresetWithTactics,
  getTacticsForCharacters,
  getBattleSkillsForCharacters,
  getTacticsSkillCatalogForCharacters,
  type TacticSlotRow,
  type BattleSkillOption,
  type TacticsSkillCatalogItem,
} from "@/server/actions/tactics";
import {
  SUBJECT_OPTIONS,
  CONDITION_OPTIONS,
  CYCLE_CONDITION_OPTIONS,
  TURN_CONDITION_OPTIONS,
  PERCENT_OPTIONS,
  ATTR_OPTIONS,
  CYCLE_N_OPTIONS,
  TURN_INDEX_OPTIONS,
  ACTION_TYPES,
  BATTLE_SKILL_TYPE_LABELS,
} from "./tactics-constants";

const DEFAULT_ROW: TacticSlotRow = {
  orderIndex: 0,
  subject: "self",
  conditionKind: "always",
  conditionParam: null,
  actionType: "normal_attack",
  skillId: null,
};

const CYCLE_CONDITION_VALUES = new Set<string>(CYCLE_CONDITION_OPTIONS.map((o) => o.value));

/** API 取得したスロット配列を編集用 rows に正規化（0.4 編成変更時のマージ用） */
function normalizeSlotsFromApi(slots: TacticSlotRow[]): TacticSlotRow[] {
  if (slots.length === 0) return [{ ...DEFAULT_ROW, orderIndex: 1 }];
  return slots
    .slice(0, MAX_SLOTS)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((s, i) => ({ ...s, orderIndex: i + 1 }));
}

function buildSlotsFromRows(rows: TacticSlotRow[]): TacticSlotRow[] {
  return rows.map((r, i) => {
    let kind = r.conditionKind;
    let param = r.conditionParam;
    if (r.subject === "cycle" && !CYCLE_CONDITION_VALUES.has(kind)) {
      kind = "cycle_is_even";
      param = null;
    } else if (r.subject === "turn" && kind !== "turn_order_in_range") {
      kind = "turn_order_in_range";
      param = { turnIndexMin: 1, turnIndexMax: 6 };
    } else if (r.conditionKind === "always") {
      param = null;
    }
    return {
      ...r,
      orderIndex: i + 1,
      conditionKind: kind,
      conditionParam: param,
    };
  });
}

type SlotCharacter = { characterId: string; displayName: string; category: string; battleCol?: number };

export type TacticsPreset = {
  id: string;
  name: string | null;
  slot1: SlotCharacter | null;
  slot2: SlotCharacter | null;
  slot3: SlotCharacter | null;
};

const MAX_SLOTS = 10;

const BATTLE_COL_OPTIONS = [
  { value: 1, label: "前列" },
  { value: 2, label: "中列" },
  { value: 3, label: "後列" },
] as const;

type CharacterTacticsTableProps = {
  char: SlotCharacter;
  rows: TacticSlotRow[];
  draggedRowIndex: number | null;
  updateSlotRow: (characterId: string, rowIndex: number, field: keyof TacticSlotRow, value: unknown) => void;
  addSlotRow: (characterId: string) => void;
  deleteSlotRow: (characterId: string, rowIndex: number) => void;
  moveSlotRow: (characterId: string, fromIndex: number, toIndex: number) => void;
  setDraggedSlot: (v: { characterId: string; rowIndex: number } | null) => void;
  battleSkillsByCharacter: Record<string, BattleSkillOption[]>;
};

const CharacterTacticsTable = memo(function CharacterTacticsTable({
  char,
  rows,
  draggedRowIndex,
  updateSlotRow,
  addSlotRow,
  deleteSlotRow,
  moveSlotRow,
  setDraggedSlot,
  battleSkillsByCharacter,
}: CharacterTacticsTableProps) {
  const skillsByType = useMemo(() => {
    const list = battleSkillsByCharacter[char.characterId] ?? [];
    const map = new Map<string, BattleSkillOption[]>();
    for (const s of list) {
      const type = s.battleSkillType ?? "other";
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(s);
    }
    return map;
  }, [battleSkillsByCharacter, char.characterId]);

  return (
    <div className="rounded-lg border border-base-border bg-base-elevated p-4">
      <h3 className="text-base font-medium text-text-primary mb-3">{char.displayName} の作戦（優先順・最大{MAX_SLOTS}）</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted border-b border-base-border">
              <th className="py-2 pr-2 w-10">#</th>
              <th className="py-2 pr-2">主語</th>
              <th className="py-2 pr-2">条件</th>
              <th className="py-2 pr-2">条件パラメータ</th>
              <th className="py-2 pr-2">行動</th>
              <th className="py-2 pr-2 w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isDragging = draggedRowIndex === i;
              return (
                <tr
                  key={i}
                  className={`border-b border-base-border/70 cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50 bg-base" : ""}`}
                  draggable
                  title="ドラッグで並び替え"
                  onDragStart={(e) => {
                    setDraggedSlot({ characterId: char.characterId, rowIndex: i });
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(i));
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
                    const toIndex = Number((e.currentTarget as HTMLTableRowElement).dataset.rowIndex);
                    if (!Number.isNaN(fromIndex) && !Number.isNaN(toIndex)) {
                      moveSlotRow(char.characterId, fromIndex, toIndex);
                    }
                    setDraggedSlot(null);
                  }}
                  onDragEnd={() => setDraggedSlot(null)}
                  data-row-index={i}
                >
                  <td className="py-1.5 pr-2 text-text-muted align-middle">{i + 1}</td>
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
                      value={
                        row.subject === "cycle"
                          ? CYCLE_CONDITION_VALUES.has(row.conditionKind)
                            ? row.conditionKind
                            : "cycle_is_even"
                          : row.subject === "turn"
                            ? "turn_order_in_range"
                            : row.conditionKind
                      }
                      onChange={(e) => updateSlotRow(char.characterId, i, "conditionKind", e.target.value)}
                      className="w-full min-w-[140px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                    >
                      {row.subject === "cycle" &&
                        CYCLE_CONDITION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      {row.subject === "turn" &&
                        TURN_CONDITION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      {row.subject !== "cycle" &&
                        row.subject !== "turn" &&
                        CONDITION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    {row.conditionKind === "always" ||
                    row.conditionKind === "cycle_is_even" ||
                    row.conditionKind === "cycle_is_odd" ? (
                      <span className="text-text-muted">—</span>
                    ) : row.conditionKind === "cycle_is_multiple_of" ||
                      row.conditionKind === "cycle_at_least" ||
                      row.conditionKind === "cycle_equals" ? (
                      <select
                        value={
                          (row.conditionParam as { n?: number } | null)?.n ??
                          (row.conditionKind === "cycle_equals" ? 1 : 2)
                        }
                        onChange={(e) =>
                          updateSlotRow(char.characterId, i, "conditionParam", {
                            n: Number(e.target.value),
                          })
                        }
                        className="min-w-[60px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                      >
                        {CYCLE_N_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    ) : row.conditionKind === "turn_order_in_range" ? (
                      <span className="flex items-center gap-1 flex-wrap">
                        <select
                          value={(row.conditionParam as { turnIndexMin?: number } | null)?.turnIndexMin ?? 1}
                          onChange={(e) => {
                            const p = (row.conditionParam as { turnIndexMin?: number; turnIndexMax?: number }) ?? {};
                            updateSlotRow(char.characterId, i, "conditionParam", {
                              ...p,
                              turnIndexMin: Number(e.target.value),
                            });
                          }}
                          className="min-w-[48px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                        >
                          {TURN_INDEX_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <span className="text-text-muted">～</span>
                        <select
                          value={(row.conditionParam as { turnIndexMax?: number } | null)?.turnIndexMax ?? 6}
                          onChange={(e) => {
                            const p = (row.conditionParam as { turnIndexMin?: number; turnIndexMax?: number }) ?? {};
                            updateSlotRow(char.characterId, i, "conditionParam", {
                              ...p,
                              turnIndexMax: Number(e.target.value),
                            });
                          }}
                          className="min-w-[48px] bg-base border border-base-border rounded px-2 py-1 text-text-primary"
                        >
                          {TURN_INDEX_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <span className="text-text-muted text-xs">番目</span>
                      </span>
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
                          {Array.from(skillsByType.entries()).map(([type, list]) => (
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
                  <td className="py-1.5 pr-2 align-middle">
                    <div className="flex items-center gap-0.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => moveSlotRow(char.characterId, i, i - 1)}
                        disabled={i === 0}
                        className="p-1 rounded border border-base-border bg-base text-text-muted hover:border-brass hover:text-brass disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="上へ"
                        title="上へ"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlotRow(char.characterId, i, i + 1)}
                        disabled={i === rows.length - 1}
                        className="p-1 rounded border border-base-border bg-base text-text-muted hover:border-brass hover:text-brass disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="下へ"
                        title="下へ"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSlotRow(char.characterId, i)}
                        className="p-1 rounded border border-base-border bg-base text-red-600 dark:text-red-400 hover:border-red-500 hover:bg-base-elevated"
                        aria-label="この行を削除"
                        title="削除"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length < MAX_SLOTS && (
              <tr>
                <td colSpan={6} className="py-2">
                  <button
                    type="button"
                    onClick={() => addSlotRow(char.characterId)}
                    className="text-sm text-brass hover:text-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base rounded px-2 py-1"
                  >
                    + 行を追加
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

interface TacticsEditorClientProps {
  preset: TacticsPreset;
  companions: { id: string; displayName: string }[];
  mechs: { id: string; displayName: string }[];
  initialTactics: { characterId: string; slots: TacticSlotRow[] }[];
  /** キャラID → そのキャラが習得している戦闘スキル一覧 */
  battleSkillsByCharacter: Record<string, BattleSkillOption[]>;
  /** 編成3人が習得している戦闘スキルの一覧（重複まとめ済み、説明・タグ付き） */
  skillCatalog: TacticsSkillCatalogItem[];
}

export function TacticsEditorClient({
  preset,
  companions,
  mechs,
  initialTactics,
  battleSkillsByCharacter,
  skillCatalog,
}: TacticsEditorClientProps) {
  const [name, setName] = useState(preset.name ?? "");
  const [slot2Id, setSlot2Id] = useState<string>(preset.slot2?.characterId ?? "");
  const [slot3Id, setSlot3Id] = useState<string>(preset.slot3?.characterId ?? "");
  const [slot1Col, setSlot1Col] = useState<number>(preset.slot1?.battleCol ?? 1);
  const [slot2Col, setSlot2Col] = useState<number>(preset.slot2?.battleCol ?? 1);
  const [slot3Col, setSlot3Col] = useState<number>(preset.slot3?.battleCol ?? 1);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showSkillList, setShowSkillList] = useState(false);

  /** spec/039 0.4: 編成変更時に追加取得したデータをマージするため state で保持 */
  const [internalBattleSkillsByCharacter, setInternalBattleSkillsByCharacter] = useState<Record<string, BattleSkillOption[]>>(battleSkillsByCharacter);
  const [internalSkillCatalog, setInternalSkillCatalog] = useState<TacticsSkillCatalogItem[]>(skillCatalog);

  const slot1 = preset.slot1!;
  const characters: SlotCharacter[] = [slot1, preset.slot2, preset.slot3].filter(Boolean) as SlotCharacter[];

  /** 編成（仲間・メカ）変更時、不足キャラの作戦・スキルを取得して state にマージ（spec/039 0.4） */
  useEffect(() => {
    const currentCharacterIds = [slot1.characterId, slot2Id, slot3Id].filter(Boolean) as string[];
    const missingIds = currentCharacterIds.filter((id) => !(id in internalBattleSkillsByCharacter));

    const mergeFetched = (
      tacticsResult: { tactics: { characterId: string; slots: TacticSlotRow[] }[] },
      skillsResult: Record<string, BattleSkillOption[]>,
      catalogResult: { skills?: TacticsSkillCatalogItem[] }
    ) => {
      setSlotsByCharacter((prev) => {
        const next = { ...prev };
        for (const t of tacticsResult.tactics) {
          next[t.characterId] = normalizeSlotsFromApi(t.slots);
        }
        return next;
      });
      setInternalBattleSkillsByCharacter((prev) => ({ ...prev, ...skillsResult }));
      if (catalogResult.skills) {
        setInternalSkillCatalog(catalogResult.skills);
      }
    };

    if (missingIds.length > 0) {
      Promise.all([
        getTacticsForCharacters(missingIds),
        getBattleSkillsForCharacters(missingIds),
        getTacticsSkillCatalogForCharacters(currentCharacterIds),
      ]).then(([tacticsResult, skillsResult, catalogResult]) => {
        if ("error" in tacticsResult) return;
        mergeFetched(tacticsResult, skillsResult, catalogResult);
      });
    } else {
      const lineupChanged = slot2Id !== (preset.slot2?.characterId ?? "") || slot3Id !== (preset.slot3?.characterId ?? "");
      if (lineupChanged) {
        getTacticsSkillCatalogForCharacters(currentCharacterIds).then((catalogResult) => {
          if ("skills" in catalogResult) {
            setInternalSkillCatalog(catalogResult.skills);
          }
        });
      }
    }
  }, [slot2Id, slot3Id, slot1.characterId, preset.slot2?.characterId, preset.slot3?.characterId]);

  /** 初期表示: 保存済みスロットがあればその数（最大10）、なければ1行 */
  const getInitialSlotsFor = (characterId: string): TacticSlotRow[] => {
    const found = initialTactics.find((t) => t.characterId === characterId);
    const existing = found?.slots ?? [];
    if (existing.length === 0) return [{ ...DEFAULT_ROW, orderIndex: 1 }];
    return existing
      .slice(0, MAX_SLOTS)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((s, i) => ({ ...s, orderIndex: i + 1 }));
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
        slot1BattleCol: Math.max(1, Math.min(3, slot1Col)),
        slot2BattleCol: slot2Id ? Math.max(1, Math.min(3, slot2Col)) : null,
        slot3BattleCol: slot3Id ? Math.max(1, Math.min(3, slot3Col)) : null,
      };
      const characterIds = [slot1.characterId, slot2Id || null, slot3Id || null].filter(Boolean) as string[];
      const tacticsByCharacter = characterIds.map((characterId) => ({
        characterId,
        slots: buildSlotsFromRows(slotsByCharacter[characterId] ?? []),
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
    Array.from({ length: MAX_SLOTS }, (_, i) => ({ ...DEFAULT_ROW, orderIndex: i + 1 }));

  const addSlotRow = useCallback((characterId: string) => {
    setSlotsByCharacter((prev) => {
      const current = prev[characterId] ?? [];
      if (current.length >= MAX_SLOTS) return prev;
      const next = [...current, { ...DEFAULT_ROW, orderIndex: current.length + 1 }];
      return { ...prev, [characterId]: next };
    });
  }, []);

  const deleteSlotRow = useCallback((characterId: string, rowIndex: number) => {
    setSlotsByCharacter((prev) => {
      const current = prev[characterId] ?? [];
      const next = current.filter((_, i) => i !== rowIndex).map((r, i) => ({ ...r, orderIndex: i + 1 }));
      return { ...prev, [characterId]: next };
    });
  }, []);

  const moveSlotRow = useCallback((characterId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setSlotsByCharacter((prev) => {
      const current = prev[characterId] ?? [];
      if (fromIndex < 0 || fromIndex >= current.length || toIndex < 0 || toIndex >= current.length) return prev;
      const next = [...current];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return { ...prev, [characterId]: next.map((r, i) => ({ ...r, orderIndex: i + 1 })) };
    });
  }, []);

  const [draggedSlot, setDraggedSlot] = useState<{ characterId: string; rowIndex: number } | null>(null);

  const updateSlotRow = useCallback((characterId: string, rowIndex: number, field: keyof TacticSlotRow, value: unknown) => {
    setSlotsByCharacter((prev) => {
      const current = prev[characterId] ?? [];
      const rows = [...current];
      const row = rows[rowIndex];
      if (!row) return prev;
      const rowCopy = { ...row };
      if (field === "subject") {
        const sub = value as string;
        if (sub === "cycle") {
          rowCopy.subject = "cycle";
          rowCopy.conditionKind = rowCopy.conditionKind && CYCLE_CONDITION_OPTIONS.some((o) => o.value === rowCopy.conditionKind) ? rowCopy.conditionKind : "cycle_is_even";
          rowCopy.conditionParam =
            rowCopy.conditionKind === "cycle_is_multiple_of"
              ? { n: 2 }
              : rowCopy.conditionKind === "cycle_at_least" || rowCopy.conditionKind === "cycle_equals"
                ? { n: 1 }
                : null;
        } else if (sub === "turn") {
          rowCopy.subject = "turn";
          rowCopy.conditionKind = "turn_order_in_range";
          rowCopy.conditionParam = { turnIndexMin: 1, turnIndexMax: 2 };
        } else {
          rowCopy.subject = sub;
          if (!CONDITION_OPTIONS.some((o) => o.value === rowCopy.conditionKind)) {
            rowCopy.conditionKind = "always";
            rowCopy.conditionParam = null;
          }
        }
      } else if (field === "conditionKind") {
        const kind = value as string;
        rowCopy.conditionKind = kind;
        if (kind === "always") rowCopy.conditionParam = null;
        else if (kind === "subject_has_attr_state") rowCopy.conditionParam = { attr: "none" };
        else if (kind === "cycle_is_even" || kind === "cycle_is_odd") rowCopy.conditionParam = null;
        else if (kind === "cycle_is_multiple_of") rowCopy.conditionParam = { n: 2 };
        else if (kind === "cycle_at_least" || kind === "cycle_equals") rowCopy.conditionParam = { n: 1 };
        else if (kind === "turn_order_in_range") rowCopy.conditionParam = { turnIndexMin: 1, turnIndexMax: 6 };
        else rowCopy.conditionParam = { percent: 50 };
      } else {
        (rowCopy as Record<string, unknown>)[field] = value;
      }
      rows[rowIndex] = rowCopy;
      return { ...prev, [characterId]: rows };
    });
  }, []);

  const getSkillsByTypeFor = (characterId: string) => {
    const list = internalBattleSkillsByCharacter[characterId] ?? [];
    const map = new Map<string, BattleSkillOption[]>();
    for (const s of list) {
      const type = s.battleSkillType ?? "other";
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(s);
    }
    return map;
  };

  /** 未設定キャラ用の安定した rows 参照（メモ化のため） */
  const defaultRowsStable = useMemo(() => getDefaultRows(), []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-base-border bg-base-elevated p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-text-primary">編成</h2>
          <button
            type="button"
            onClick={() => setShowSkillList((v) => !v)}
            className="inline-flex items-center rounded border border-base-border bg-base px-3 py-1.5 text-xs font-medium text-text-primary hover:border-brass hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          >
            {showSkillList ? "スキル一覧を閉じる" : "スキル一覧を表示"}
          </button>
        </div>
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
              <label className="block text-xs text-text-muted mt-1">列</label>
              <select
                value={slot1Col}
                onChange={(e) => setSlot1Col(Number(e.target.value))}
                className="w-full bg-base border border-base-border rounded px-2 py-1.5 text-text-primary text-sm"
              >
                {BATTLE_COL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
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
              {slot2Id ? (
                <>
                  <label className="block text-xs text-text-muted mt-1">列</label>
                  <select
                    value={slot2Col}
                    onChange={(e) => setSlot2Col(Number(e.target.value))}
                    className="w-full bg-base border border-base-border rounded px-2 py-1.5 text-text-primary text-sm"
                  >
                    {BATTLE_COL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
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
              {slot3Id ? (
                <>
                  <label className="block text-xs text-text-muted mt-1">列</label>
                  <select
                    value={slot3Col}
                    onChange={(e) => setSlot3Col(Number(e.target.value))}
                    className="w-full bg-base border border-base-border rounded px-2 py-1.5 text-text-primary text-sm"
                  >
                    {BATTLE_COL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {showSkillList && (
        <div className="rounded-lg border border-base-border bg-base-elevated p-4 space-y-3">
          <h2 className="text-base font-medium text-text-primary">編成メンバーのスキル一覧</h2>
          {internalSkillCatalog.length === 0 ? (
            <p className="text-sm text-text-muted">この編成が習得している戦闘スキルはありません。</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {internalSkillCatalog.map((s) => (
                <div key={s.id} className="flex gap-3 rounded border border-base-border bg-base px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-primary">{s.name}</span>
                      {s.battleSkillType && (
                        <span className="inline-flex items-center rounded-full bg-base border border-base-border px-2 py-0.5 text-2xs text-text-muted">
                          {BATTLE_SKILL_TYPE_LABELS[s.battleSkillType] ?? s.battleSkillType}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-base px-2 py-0.5 text-2xs text-text-muted border border-base-border/60">
                        CT{s.chargeCycles}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-base px-2 py-0.5 text-2xs text-text-muted border border-base-border/60">
                        CD{s.cooldownCycles}
                      </span>
                    </div>
                    {s.description && (
                      <p className="mt-1 text-xs text-text-muted break-words">{s.description}</p>
                    )}
                    {s.displayTags.length > 0 && (
                      <p className="mt-1 text-[11px] text-text-muted break-words">
                        {s.displayTags.join(" ")}
                      </p>
                    )}
                  </div>
                  {s.learnedBy.length > 0 && (
                    <div className="flex flex-col items-end justify-center gap-1 min-w-[96px]">
                      <span className="text-[11px] text-text-muted">習得キャラ</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {s.learnedBy.map((c) => (
                          <span
                            key={c.characterId}
                            className="inline-flex items-center rounded-full bg-base border border-base-border px-2 py-0.5 text-[11px] text-text-primary"
                          >
                            {c.displayName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
        .map((char) => (
          <CharacterTacticsTable
            key={char.characterId}
            char={char}
            rows={slotsByCharacter[char.characterId] ?? defaultRowsStable}
            draggedRowIndex={draggedSlot?.characterId === char.characterId ? draggedSlot.rowIndex : null}
            updateSlotRow={updateSlotRow}
            addSlotRow={addSlotRow}
            deleteSlotRow={deleteSlotRow}
            moveSlotRow={moveSlotRow}
            setDraggedSlot={setDraggedSlot}
            battleSkillsByCharacter={internalBattleSkillsByCharacter}
          />
        ))}

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
