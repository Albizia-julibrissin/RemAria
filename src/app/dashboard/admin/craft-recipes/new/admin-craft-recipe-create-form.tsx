"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminCraftRecipeOptions,
  CreateAdminCraftRecipeInput,
} from "@/server/actions/admin";
import { createAdminCraftRecipe } from "@/server/actions/admin";
import { EQUIPMENT_STAT_KEYS, EQUIPMENT_STAT_LABELS } from "@/lib/craft/equipment-stat-gen";
import { MECHA_PART_BASE_STAT_KEYS } from "@/lib/craft/mecha-part-stat-gen";
import { EQUIPMENT_SLOTS, EQUIPMENT_SLOT_LABELS } from "@/lib/constants/equipment-slots";
import { MECHA_SLOTS, MECHA_SLOT_LABELS } from "@/lib/constants/mecha-slots";

const OUTPUT_KIND_LABELS: Record<string, string> = {
  equipment: "装備",
  mecha_part: "メカパーツ",
  item: "アイテム",
};

const BASE_STAT_LABELS: Record<string, string> = {
  STR: "筋力",
  INT: "知力",
  VIT: "体力",
  WIS: "賢さ",
  DEX: "器用",
  AGI: "敏捷",
  LUK: "運",
};

type Props = {
  options: AdminCraftRecipeOptions;
};

type InputRow = { itemId: string; amount: string };
type WeightRow = { key: string; weightMin: string; weightMax: string };

export function AdminCraftRecipeCreateForm({ options }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [outputKind, setOutputKind] = useState<"equipment" | "mecha_part" | "item">("equipment");
  const [outputEquipmentTypeId, setOutputEquipmentTypeId] = useState("");
  const [outputMechaPartTypeId, setOutputMechaPartTypeId] = useState("");
  const [outputItemId, setOutputItemId] = useState("");
  const [inputRows, setInputRows] = useState<InputRow[]>([{ itemId: "", amount: "1" }]);

  const [equipmentOutputMode, setEquipmentOutputMode] = useState<"existing" | "new">("existing");
  const [equipmentNew, setEquipmentNew] = useState({
    code: "",
    name: "",
    slot: "main_weapon",
    capMin: 70,
    capMax: 100,
    weightRows: [{ key: "PATK", weightMin: "5", weightMax: "10" }] as WeightRow[],
  });

  const [mechaPartOutputMode, setMechaPartOutputMode] = useState<"existing" | "new">("existing");
  const [mechaPartNew, setMechaPartNew] = useState({
    name: "",
    slot: "frame" as string,
    statRates: {} as Record<string, number>,
    capMin: 50,
    capMax: 100,
    weightRows: [{ key: "STR", weightMin: "5", weightMax: "10" }] as WeightRow[],
    strAdd: 0,
    intAdd: 0,
    vitAdd: 0,
    wisAdd: 0,
    dexAdd: 0,
    agiAdd: 0,
    lukAdd: 0,
    capAdd: 0,
  });

  const addInputRow = () => {
    setInputRows((prev) => [...prev, { itemId: "", amount: "1" }]);
  };
  const removeInputRow = (index: number) => {
    setInputRows((prev) => prev.filter((_, i) => i !== index));
  };
  const updateInputRow = (index: number, field: "itemId" | "amount", value: string) => {
    setInputRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addEquipmentNewWeightRow = () => {
    setEquipmentNew((p) => ({
      ...p,
      weightRows: [...p.weightRows, { key: "PATK", weightMin: "5", weightMax: "10" }],
    }));
  };
  const removeEquipmentNewWeightRow = (i: number) => {
    setEquipmentNew((p) =>
      p.weightRows.length > 1 ? { ...p, weightRows: p.weightRows.filter((_, j) => j !== i) } : p
    );
  };
  const updateEquipmentNewWeightRow = (i: number, field: keyof WeightRow, value: string) => {
    setEquipmentNew((p) => ({
      ...p,
      weightRows: p.weightRows.map((row, j) => (j === i ? { ...row, [field]: value } : row)),
    }));
  };

  const addMechaNewWeightRow = () => {
    setMechaPartNew((p) => ({
      ...p,
      weightRows: [...p.weightRows, { key: "STR", weightMin: "5", weightMax: "10" }],
    }));
  };
  const removeMechaNewWeightRow = (i: number) => {
    setMechaPartNew((p) =>
      p.weightRows.length > 1 ? { ...p, weightRows: p.weightRows.filter((_, j) => j !== i) } : p
    );
  };
  const updateMechaNewWeightRow = (i: number, field: keyof WeightRow, value: string) => {
    setMechaPartNew((p) => ({
      ...p,
      weightRows: p.weightRows.map((row, j) => (j === i ? { ...row, [field]: value } : row)),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateAdminCraftRecipeInput = {
      code: code.trim(),
      name: name.trim(),
      outputKind,
      outputEquipmentTypeId:
        outputKind === "equipment" && equipmentOutputMode === "existing"
          ? outputEquipmentTypeId || null
          : null,
      outputMechaPartTypeId:
        outputKind === "mecha_part" && mechaPartOutputMode === "existing"
          ? outputMechaPartTypeId || null
          : null,
      outputItemId: outputKind === "item" ? outputItemId || null : null,
      inputs: inputRows
        .filter((row) => row.itemId.trim())
        .map((row) => ({
          itemId: row.itemId,
          amount: parseInt(row.amount, 10) || 0,
        }))
        .filter((row) => row.amount > 0),
    };
    if (outputKind === "equipment" && equipmentOutputMode === "new") {
      input.equipmentNew = {
        code: equipmentNew.code.trim(),
        name: equipmentNew.name.trim(),
        slot: equipmentNew.slot,
        statGenConfig: {
          capMin: equipmentNew.capMin,
          capMax: equipmentNew.capMax,
          weights: equipmentNew.weightRows
            .filter((r) => r.key && r.weightMin !== "" && r.weightMax !== "")
            .map((r) => ({
              key: r.key,
              weightMin: parseInt(r.weightMin, 10) || 0,
              weightMax: parseInt(r.weightMax, 10) || 0,
            })),
        },
      };
    }
    if (outputKind === "mecha_part" && mechaPartOutputMode === "new") {
      const statRatesFiltered =
        mechaPartNew.slot === "frame"
          ? (Object.fromEntries(
              Object.entries(mechaPartNew.statRates).filter(
                ([, v]) => typeof v === "number" && Number.isFinite(v)
              )
            ) as Record<string, number>)
          : null;
      const hasStatRates = statRatesFiltered && Object.keys(statRatesFiltered).length > 0;
      input.mechaPartNew = {
        name: mechaPartNew.name.trim(),
        slot: mechaPartNew.slot,
        statRates: hasStatRates ? statRatesFiltered : null,
        statGenConfig: {
          capMin: mechaPartNew.capMin,
          capMax: mechaPartNew.capMax,
          weights: mechaPartNew.weightRows
            .filter((r) => r.key && r.weightMin !== "" && r.weightMax !== "")
            .map((r) => ({
              key: r.key,
              weightMin: parseInt(r.weightMin, 10) || 0,
              weightMax: parseInt(r.weightMax, 10) || 0,
            })),
        },
        strAdd: mechaPartNew.strAdd,
        intAdd: mechaPartNew.intAdd,
        vitAdd: mechaPartNew.vitAdd,
        wisAdd: mechaPartNew.wisAdd,
        dexAdd: mechaPartNew.dexAdd,
        agiAdd: mechaPartNew.agiAdd,
        lukAdd: mechaPartNew.lukAdd,
        capAdd: mechaPartNew.capAdd,
      };
    }
    startTransition(async () => {
      const result = await createAdminCraftRecipe(input);
      if (result.success && result.craftRecipeId) {
        router.push(`/dashboard/admin/craft-recipes/${result.craftRecipeId}`);
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
        <label htmlFor="outputKind" className="block text-sm font-medium text-text-muted">
          出力種別
        </label>
        <select
          id="outputKind"
          value={outputKind}
          onChange={(e) =>
            setOutputKind(e.target.value as "equipment" | "mecha_part" | "item")
          }
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        >
          {(Object.keys(OUTPUT_KIND_LABELS) as (keyof typeof OUTPUT_KIND_LABELS)[]).map(
            (k) => (
              <option key={k} value={k}>
                {OUTPUT_KIND_LABELS[k]}
              </option>
            )
          )}
        </select>
      </div>

      {outputKind === "equipment" && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="equipmentOutputMode"
                checked={equipmentOutputMode === "existing"}
                onChange={() => setEquipmentOutputMode("existing")}
              />
              既存の装備を選択
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="equipmentOutputMode"
                checked={equipmentOutputMode === "new"}
                onChange={() => setEquipmentOutputMode("new")}
              />
              新規装備を作成
            </label>
          </div>
          {equipmentOutputMode === "existing" ? (
            <div>
              <label
                htmlFor="outputEquipmentTypeId"
                className="block text-sm font-medium text-text-muted"
              >
                出力（装備）
              </label>
              <select
                id="outputEquipmentTypeId"
                value={outputEquipmentTypeId}
                onChange={(e) => setOutputEquipmentTypeId(e.target.value)}
                required
                className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
              >
                <option value="">— 選択 —</option>
                {options.equipmentTypes.map((et) => (
                  <option key={et.id} value={et.id}>
                    [{et.slot}] {et.code} — {et.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded border border-base-border bg-base-elevated p-4 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">新規装備（CAP・ウェイト）</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted">code</label>
                  <input
                    type="text"
                    value={equipmentNew.code}
                    onChange={(e) => setEquipmentNew((p) => ({ ...p, code: e.target.value }))}
                    required
                    className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted">name</label>
                  <input
                    type="text"
                    value={equipmentNew.name}
                    onChange={(e) => setEquipmentNew((p) => ({ ...p, name: e.target.value }))}
                    required
                    className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted">slot</label>
                <select
                  value={equipmentNew.slot}
                  onChange={(e) => setEquipmentNew((p) => ({ ...p, slot: e.target.value }))}
                  className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                >
                  {EQUIPMENT_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {EQUIPMENT_SLOT_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted">CAP min</label>
                  <input
                    type="number"
                    value={equipmentNew.capMin}
                    onChange={(e) =>
                      setEquipmentNew((p) => ({ ...p, capMin: parseInt(e.target.value, 10) || 0 }))
                    }
                    className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted">CAP max</label>
                  <input
                    type="number"
                    value={equipmentNew.capMax}
                    onChange={(e) =>
                      setEquipmentNew((p) => ({ ...p, capMax: parseInt(e.target.value, 10) || 0 }))
                    }
                    className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-text-muted">
                    ステータス重み（min～max の範囲で乱数し、CAP を按分）
                  </label>
                  <button
                    type="button"
                    onClick={addEquipmentNewWeightRow}
                    className="text-xs text-brass hover:text-brass-hover"
                  >
                    + 行追加
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {equipmentNew.weightRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={row.key}
                        onChange={(e) => updateEquipmentNewWeightRow(idx, "key", e.target.value)}
                        className="w-32 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                      >
                        {EQUIPMENT_STAT_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {EQUIPMENT_STAT_LABELS[k]}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-text-muted whitespace-nowrap">重み min</span>
                      <input
                        type="number"
                        min={0}
                        value={row.weightMin}
                        onChange={(e) =>
                          updateEquipmentNewWeightRow(idx, "weightMin", e.target.value)
                        }
                        aria-label="重み min"
                        className="w-16 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                      />
                      <span className="text-xs text-text-muted whitespace-nowrap">max</span>
                      <input
                        type="number"
                        min={0}
                        value={row.weightMax}
                        onChange={(e) =>
                          updateEquipmentNewWeightRow(idx, "weightMax", e.target.value)
                        }
                        aria-label="重み max"
                        className="w-16 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeEquipmentNewWeightRow(idx)}
                        disabled={equipmentNew.weightRows.length <= 1}
                        className="text-text-muted hover:text-error disabled:opacity-40 text-xs"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {outputKind === "mecha_part" && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mechaPartOutputMode"
                checked={mechaPartOutputMode === "existing"}
                onChange={() => setMechaPartOutputMode("existing")}
              />
              既存のメカパーツを選択
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mechaPartOutputMode"
                checked={mechaPartOutputMode === "new"}
                onChange={() => setMechaPartOutputMode("new")}
              />
              新規メカパーツを作成
            </label>
          </div>
          {mechaPartOutputMode === "existing" ? (
            <div>
              <label
                htmlFor="outputMechaPartTypeId"
                className="block text-sm font-medium text-text-muted"
              >
                出力（メカパーツ）
              </label>
              <select
                id="outputMechaPartTypeId"
                value={outputMechaPartTypeId}
                onChange={(e) => setOutputMechaPartTypeId(e.target.value)}
                required
                className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
              >
                <option value="">— 選択 —</option>
                {options.mechaPartTypes.map((mp) => (
                  <option key={mp.id} value={mp.id}>
                    [{mp.slot}] {mp.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded border border-base-border bg-base-elevated p-4 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">
                新規メカパーツ（CAP・ウェイト・補正）
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted">name</label>
                  <input
                    type="text"
                    value={mechaPartNew.name}
                    onChange={(e) => setMechaPartNew((p) => ({ ...p, name: e.target.value }))}
                    required
                    className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted">slot</label>
                  <select
                    value={mechaPartNew.slot}
                    onChange={(e) => setMechaPartNew((p) => ({ ...p, slot: e.target.value }))}
                    className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                  >
                    {MECHA_SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {MECHA_SLOT_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {mechaPartNew.slot === "frame" && (
                <div>
                  <label className="block text-xs font-medium text-text-muted">
                    基礎ステ倍率（未入力は 1.0）
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MECHA_PART_BASE_STAT_KEYS.map((statKey) => (
                      <div key={statKey} className="flex items-center gap-1">
                        <span className="text-xs text-text-muted">
                          {BASE_STAT_LABELS[statKey] ?? statKey}
                        </span>
                        <input
                          type="number"
                          step={0.1}
                          value={mechaPartNew.statRates[statKey] ?? ""}
                          onChange={(e) => {
                            const v =
                              e.target.value === "" ? undefined : parseFloat(e.target.value);
                            setMechaPartNew((p) => ({
                              ...p,
                              statRates: { ...p.statRates, [statKey]: v ?? 1 },
                            }));
                          }}
                          placeholder="1.0"
                          className="w-16 rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted">CAP min</label>
                  <input
                    type="number"
                    value={mechaPartNew.capMin}
                    onChange={(e) =>
                      setMechaPartNew((p) => ({
                        ...p,
                        capMin: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted">CAP max</label>
                  <input
                    type="number"
                    value={mechaPartNew.capMax}
                    onChange={(e) =>
                      setMechaPartNew((p) => ({
                        ...p,
                        capMax: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-text-muted">
                    基礎ステ重み（min～max の範囲で乱数し、CAP を按分）
                  </label>
                  <button
                    type="button"
                    onClick={addMechaNewWeightRow}
                    className="text-xs text-brass hover:text-brass-hover"
                  >
                    + 行追加
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {mechaPartNew.weightRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={row.key}
                        onChange={(e) => updateMechaNewWeightRow(idx, "key", e.target.value)}
                        className="w-24 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                      >
                        {MECHA_PART_BASE_STAT_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-text-muted whitespace-nowrap">重み min</span>
                      <input
                        type="number"
                        min={0}
                        value={row.weightMin}
                        onChange={(e) =>
                          updateMechaNewWeightRow(idx, "weightMin", e.target.value)
                        }
                        aria-label="重み min"
                        className="w-16 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                      />
                      <span className="text-xs text-text-muted whitespace-nowrap">max</span>
                      <input
                        type="number"
                        min={0}
                        value={row.weightMax}
                        onChange={(e) =>
                          updateMechaNewWeightRow(idx, "weightMax", e.target.value)
                        }
                        aria-label="重み max"
                        className="w-16 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeMechaNewWeightRow(idx)}
                        disabled={mechaPartNew.weightRows.length <= 1}
                        className="text-text-muted hover:text-error disabled:opacity-40 text-xs"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted">
                  フラット加算（strAdd 等）
                </label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {(
                    [
                      "strAdd",
                      "intAdd",
                      "vitAdd",
                      "wisAdd",
                      "dexAdd",
                      "agiAdd",
                      "lukAdd",
                      "capAdd",
                    ] as const
                  ).map((key) => (
                    <div key={key}>
                      <span className="text-xs text-text-muted">{key}</span>
                      <input
                        type="number"
                        value={mechaPartNew[key]}
                        onChange={(e) =>
                          setMechaPartNew((p) => ({
                            ...p,
                            [key]: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="mt-0.5 w-full rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {outputKind === "item" && (
        <div>
          <label htmlFor="outputItemId" className="block text-sm font-medium text-text-muted">
            出力（アイテム）
          </label>
          <select
            id="outputItemId"
            value={outputItemId}
            onChange={(e) => setOutputItemId(e.target.value)}
            required
            className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
          >
            <option value="">— 選択 —</option>
            {options.items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.code} — {it.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-text-muted">
            入力素材（同一アイテムは保存時に合算されます）
          </label>
          <button
            type="button"
            onClick={addInputRow}
            className="text-sm text-brass hover:text-brass-hover"
          >
            + 行追加
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {inputRows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={row.itemId}
                onChange={(e) => updateInputRow(index, "itemId", e.target.value)}
                className="flex-1 rounded border border-base-border bg-base-elevated px-3 py-2 text-sm text-text-primary"
              >
                <option value="">— アイテム選択 —</option>
                {options.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.code} — {it.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={row.amount}
                onChange={(e) => updateInputRow(index, "amount", e.target.value)}
                className="w-20 rounded border border-base-border bg-base-elevated px-2 py-2 text-sm text-text-primary"
              />
              <button
                type="button"
                onClick={() => removeInputRow(index)}
                disabled={inputRows.length <= 1}
                className="text-text-muted hover:text-error disabled:opacity-40"
                aria-label="行を削除"
              >
                削除
              </button>
            </div>
          ))}
        </div>
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
