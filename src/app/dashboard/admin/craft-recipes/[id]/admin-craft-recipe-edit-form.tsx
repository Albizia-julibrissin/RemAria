"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminCraftRecipeDetail,
  AdminCraftRecipeOptions,
  AdminEquipmentOutputDetail,
  AdminMechaPartOutputDetail,
  UpdateAdminCraftRecipeInput,
} from "@/server/actions/admin";
import { updateAdminCraftRecipe, deleteAdminCraftRecipe } from "@/server/actions/admin";
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
  recipe: AdminCraftRecipeDetail;
  options: AdminCraftRecipeOptions;
};

type InputRow = { itemId: string; amount: string };
type WeightRow = { key: string; weightMin: string; weightMax: string };

type EquipmentOutputFormState = {
  code: string;
  name: string;
  slot: string;
  capMin: number;
  capMax: number;
  weightRows: WeightRow[];
};

type MechaPartOutputFormState = {
  name: string;
  slot: string;
  statRates: Record<string, number>;
  capMin: number;
  capMax: number;
  weightRows: WeightRow[];
  strAdd: number;
  intAdd: number;
  vitAdd: number;
  wisAdd: number;
  dexAdd: number;
  agiAdd: number;
  lukAdd: number;
  capAdd: number;
};

function buildEquipmentFormFrom(et: AdminEquipmentOutputDetail | null): EquipmentOutputFormState | null {
  if (!et) return null;
  const weights = (et.statGenConfig?.weights ?? []).map((w) => ({
    key: w.key,
    weightMin: String(w.weightMin),
    weightMax: String(w.weightMax),
  }));
  return {
    code: et.code,
    name: et.name,
    slot: et.slot,
    capMin: et.statGenConfig?.capMin ?? 50,
    capMax: et.statGenConfig?.capMax ?? 100,
    weightRows: weights.length > 0 ? weights : [{ key: "PATK", weightMin: "5", weightMax: "10" }],
  };
}

function buildMechaPartFormFrom(
  mp: AdminMechaPartOutputDetail | null
): MechaPartOutputFormState | null {
  if (!mp) return null;
  const weights = (mp.statGenConfig?.weights ?? []).map((w) => ({
    key: w.key,
    weightMin: String(w.weightMin),
    weightMax: String(w.weightMax),
  }));
  return {
    name: mp.name,
    slot: mp.slot,
    statRates: mp.statRates ?? {},
    capMin: mp.statGenConfig?.capMin ?? 50,
    capMax: mp.statGenConfig?.capMax ?? 100,
    weightRows: weights.length > 0 ? weights : [{ key: "STR", weightMin: "5", weightMax: "10" }],
    strAdd: mp.strAdd,
    intAdd: mp.intAdd,
    vitAdd: mp.vitAdd,
    wisAdd: mp.wisAdd,
    dexAdd: mp.dexAdd,
    agiAdd: mp.agiAdd,
    lukAdd: mp.lukAdd,
    capAdd: mp.capAdd,
  };
}

export function AdminCraftRecipeEditForm({ recipe, options }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [code, setCode] = useState(recipe.code);
  const [name, setName] = useState(recipe.name);
  const [outputKind, setOutputKind] = useState<
    "equipment" | "mecha_part" | "item"
  >(recipe.outputKind as "equipment" | "mecha_part" | "item");
  const [outputEquipmentTypeId, setOutputEquipmentTypeId] = useState(
    recipe.outputEquipmentTypeId ?? ""
  );
  const [outputMechaPartTypeId, setOutputMechaPartTypeId] = useState(
    recipe.outputMechaPartTypeId ?? ""
  );
  const [outputItemId, setOutputItemId] = useState(recipe.outputItemId ?? "");
  const [inputRows, setInputRows] = useState<InputRow[]>(
    recipe.inputs.length > 0
      ? recipe.inputs.map((inp) => ({ itemId: inp.itemId, amount: String(inp.amount) }))
      : [{ itemId: "", amount: "1" }]
  );

  const [equipmentOutputForm, setEquipmentOutputForm] = useState<EquipmentOutputFormState | null>(
    () =>
      buildEquipmentFormFrom(
        recipe.outputEquipmentType ??
          options.equipmentTypes.find((et) => et.id === recipe.outputEquipmentTypeId) ??
          null
      )
  );

  const [mechaPartOutputForm, setMechaPartOutputForm] = useState<MechaPartOutputFormState | null>(
    () =>
      buildMechaPartFormFrom(
        recipe.outputMechaPartType ??
          options.mechaPartTypes.find((mp) => mp.id === recipe.outputMechaPartTypeId) ??
          null
      )
  );

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

  const addEquipmentWeightRow = () => {
    setEquipmentOutputForm((prev) =>
      prev
        ? {
            ...prev,
            weightRows: [...prev.weightRows, { key: "PATK", weightMin: "5", weightMax: "10" }],
          }
        : null
    );
  };
  const removeEquipmentWeightRow = (index: number) => {
    setEquipmentOutputForm((prev) =>
      prev && prev.weightRows.length > 1
        ? { ...prev, weightRows: prev.weightRows.filter((_, i) => i !== index) }
        : prev
    );
  };
  const updateEquipmentWeightRow = (
    index: number,
    field: keyof WeightRow,
    value: string
  ) => {
    setEquipmentOutputForm((prev) =>
      prev
        ? {
            ...prev,
            weightRows: prev.weightRows.map((row, i) =>
              i === index ? { ...row, [field]: value } : row
            ),
          }
        : null
    );
  };

  const addMechaWeightRow = () => {
    setMechaPartOutputForm((prev) =>
      prev
        ? {
            ...prev,
            weightRows: [...prev.weightRows, { key: "STR", weightMin: "5", weightMax: "10" }],
          }
        : null
    );
  };
  const removeMechaWeightRow = (index: number) => {
    setMechaPartOutputForm((prev) =>
      prev && prev.weightRows.length > 1
        ? { ...prev, weightRows: prev.weightRows.filter((_, i) => i !== index) }
        : prev
    );
  };
  const updateMechaWeightRow = (index: number, field: keyof WeightRow, value: string) => {
    setMechaPartOutputForm((prev) =>
      prev
        ? {
            ...prev,
            weightRows: prev.weightRows.map((row, i) =>
              i === index ? { ...row, [field]: value } : row
            ),
          }
        : null
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminCraftRecipeInput = {
      code: code.trim(),
      name: name.trim(),
      outputKind,
      outputEquipmentTypeId: outputKind === "equipment" ? outputEquipmentTypeId || null : null,
      outputMechaPartTypeId: outputKind === "mecha_part" ? outputMechaPartTypeId || null : null,
      outputItemId: outputKind === "item" ? outputItemId || null : null,
      inputs: inputRows
        .filter((row) => row.itemId.trim())
        .map((row) => ({
          itemId: row.itemId,
          amount: parseInt(row.amount, 10) || 0,
        }))
        .filter((row) => row.amount > 0),
    };

    if (outputKind === "equipment" && outputEquipmentTypeId && equipmentOutputForm) {
      input.equipmentOutput = {
        code: equipmentOutputForm.code.trim(),
        name: equipmentOutputForm.name.trim(),
        slot: equipmentOutputForm.slot,
        statGenConfig: {
          capMin: equipmentOutputForm.capMin,
          capMax: equipmentOutputForm.capMax,
          weights: equipmentOutputForm.weightRows
            .filter((r) => r.key && r.weightMin !== "" && r.weightMax !== "")
            .map((r) => ({
              key: r.key,
              weightMin: parseInt(r.weightMin, 10) || 0,
              weightMax: parseInt(r.weightMax, 10) || 0,
            })),
        },
      };
    }
    if (outputKind === "mecha_part" && outputMechaPartTypeId && mechaPartOutputForm) {
      const statRatesFiltered =
        mechaPartOutputForm.slot === "frame"
          ? (Object.fromEntries(
              Object.entries(mechaPartOutputForm.statRates).filter(
                ([, v]) => typeof v === "number" && Number.isFinite(v)
              )
            ) as Record<string, number>)
          : null;
      const hasStatRates =
        statRatesFiltered && Object.keys(statRatesFiltered).length > 0;
      input.mechaPartOutput = {
        name: mechaPartOutputForm.name.trim(),
        slot: mechaPartOutputForm.slot,
        statRates: hasStatRates ? statRatesFiltered! : null,
        statGenConfig: {
          capMin: mechaPartOutputForm.capMin,
          capMax: mechaPartOutputForm.capMax,
          weights: mechaPartOutputForm.weightRows
            .filter((r) => r.key && r.weightMin !== "" && r.weightMax !== "")
            .map((r) => ({
              key: r.key,
              weightMin: parseInt(r.weightMin, 10) || 0,
              weightMax: parseInt(r.weightMax, 10) || 0,
            })),
        },
        strAdd: mechaPartOutputForm.strAdd,
        intAdd: mechaPartOutputForm.intAdd,
        vitAdd: mechaPartOutputForm.vitAdd,
        wisAdd: mechaPartOutputForm.wisAdd,
        dexAdd: mechaPartOutputForm.dexAdd,
        agiAdd: mechaPartOutputForm.agiAdd,
        lukAdd: mechaPartOutputForm.lukAdd,
        capAdd: mechaPartOutputForm.capAdd,
      };
    }

    startTransition(async () => {
      const result = await updateAdminCraftRecipe(recipe.id, input);
      setMessage(
        result.success
          ? { type: "ok", text: "保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
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
            onChange={(e) => {
              const id = e.target.value;
              setOutputEquipmentTypeId(id);
              const et = options.equipmentTypes.find((x) => x.id === id);
              setEquipmentOutputForm(buildEquipmentFormFrom(et ?? null));
            }}
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
      )}
      {outputKind === "mecha_part" && (
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
            onChange={(e) => {
              const id = e.target.value;
              setOutputMechaPartTypeId(id);
              const mp = options.mechaPartTypes.find((x) => x.id === id);
              setMechaPartOutputForm(buildMechaPartFormFrom(mp ?? null));
            }}
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

      {outputKind === "equipment" && outputEquipmentTypeId && equipmentOutputForm && (
          <div className="rounded border border-base-border bg-base-elevated p-4 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">出力装備の設定（CAP・ウェイト）</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted">code</label>
                <input
                  type="text"
                  value={equipmentOutputForm.code}
                  onChange={(e) =>
                    setEquipmentOutputForm((p) => (p ? { ...p, code: e.target.value } : null))
                  }
                  className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted">name</label>
                <input
                  type="text"
                  value={equipmentOutputForm.name}
                  onChange={(e) =>
                    setEquipmentOutputForm((p) => (p ? { ...p, name: e.target.value } : null))
                  }
                  className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted">slot</label>
              <select
                value={equipmentOutputForm.slot}
                onChange={(e) =>
                  setEquipmentOutputForm((p) => (p ? { ...p, slot: e.target.value } : null))
                }
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
                  value={equipmentOutputForm.capMin}
                  onChange={(e) =>
                    setEquipmentOutputForm((p) =>
                      p ? { ...p, capMin: parseInt(e.target.value, 10) || 0 } : null
                    )
                  }
                  className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted">CAP max</label>
                <input
                  type="number"
                  value={equipmentOutputForm.capMax}
                  onChange={(e) =>
                    setEquipmentOutputForm((p) =>
                      p ? { ...p, capMax: parseInt(e.target.value, 10) || 0 } : null
                    )
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
                  onClick={addEquipmentWeightRow}
                  className="text-xs text-brass hover:text-brass-hover"
                >
                  + 行追加
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {equipmentOutputForm.weightRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.key}
                      onChange={(e) => updateEquipmentWeightRow(idx, "key", e.target.value)}
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
                      onChange={(e) => updateEquipmentWeightRow(idx, "weightMin", e.target.value)}
                      aria-label="重み min"
                      className="w-16 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                    />
                    <span className="text-xs text-text-muted whitespace-nowrap">max</span>
                    <input
                      type="number"
                      min={0}
                      value={row.weightMax}
                      onChange={(e) => updateEquipmentWeightRow(idx, "weightMax", e.target.value)}
                      aria-label="重み max"
                      className="w-16 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeEquipmentWeightRow(idx)}
                      disabled={equipmentOutputForm.weightRows.length <= 1}
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

      {outputKind === "mecha_part" && outputMechaPartTypeId && mechaPartOutputForm && (
          <div className="rounded border border-base-border bg-base-elevated p-4 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">
              出力メカパーツの設定（CAP・ウェイト・補正）
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted">name</label>
                <input
                  type="text"
                  value={mechaPartOutputForm.name}
                  onChange={(e) =>
                    setMechaPartOutputForm((p) => (p ? { ...p, name: e.target.value } : null))
                  }
                  className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted">slot</label>
                <select
                  value={mechaPartOutputForm.slot}
                  onChange={(e) =>
                    setMechaPartOutputForm((p) => (p ? { ...p, slot: e.target.value } : null))
                  }
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
            {mechaPartOutputForm.slot === "frame" && (
              <div>
                <label className="block text-xs font-medium text-text-muted">
                  基礎ステ倍率（フレーム用。未入力は 1.0）
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MECHA_PART_BASE_STAT_KEYS.map((statKey) => (
                    <div key={statKey} className="flex items-center gap-1">
                      <span className="text-xs text-text-muted">{BASE_STAT_LABELS[statKey] ?? statKey}</span>
                      <input
                        type="number"
                        step={0.1}
                        value={mechaPartOutputForm.statRates[statKey] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                          setMechaPartOutputForm((p) =>
                            p
                              ? {
                                  ...p,
                                  statRates: {
                                    ...p.statRates,
                                    [statKey]: v ?? 1,
                                  },
                                }
                              : null
                          );
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
                  value={mechaPartOutputForm.capMin}
                  onChange={(e) =>
                    setMechaPartOutputForm((p) =>
                      p ? { ...p, capMin: parseInt(e.target.value, 10) || 0 } : null
                    )
                  }
                  className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted">CAP max</label>
                <input
                  type="number"
                  value={mechaPartOutputForm.capMax}
                  onChange={(e) =>
                    setMechaPartOutputForm((p) =>
                      p ? { ...p, capMax: parseInt(e.target.value, 10) || 0 } : null
                    )
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
                  onClick={addMechaWeightRow}
                  className="text-xs text-brass hover:text-brass-hover"
                >
                  + 行追加
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {mechaPartOutputForm.weightRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.key}
                      onChange={(e) => updateMechaWeightRow(idx, "key", e.target.value)}
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
                      onChange={(e) => updateMechaWeightRow(idx, "weightMin", e.target.value)}
                      aria-label="重み min"
                      className="w-16 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                    />
                    <span className="text-xs text-text-muted whitespace-nowrap">max</span>
                    <input
                      type="number"
                      min={0}
                      value={row.weightMax}
                      onChange={(e) => updateMechaWeightRow(idx, "weightMax", e.target.value)}
                      aria-label="重み max"
                      className="w-16 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeMechaWeightRow(idx)}
                      disabled={mechaPartOutputForm.weightRows.length <= 1}
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
                {(["strAdd", "intAdd", "vitAdd", "wisAdd", "dexAdd", "agiAdd", "lukAdd", "capAdd"] as const).map(
                  (key) => (
                    <div key={key}>
                      <span className="text-xs text-text-muted">{key}</span>
                      <input
                        type="number"
                        value={mechaPartOutputForm[key]}
                        onChange={(e) =>
                          setMechaPartOutputForm((p) =>
                            p ? { ...p, [key]: parseInt(e.target.value, 10) || 0 } : null
                          )
                        }
                        className="mt-0.5 w-full rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
                      />
                    </div>
                  )
                )}
              </div>
            </div>
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

      <div className="flex flex-wrap gap-4 pt-4">
        <button
          type="submit"
          disabled={isPending || isDeleting}
          className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50"
        >
          {isPending ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              !confirm(
                `レシピ「${recipe.code}」（${recipe.name}）を削除しますか？\n\n入力素材・研究解放の紐づけ・ユーザの解放済み状態もすべて削除されます。この操作は取り消せません。`
              )
            )
              return;
            setIsDeleting(true);
            deleteAdminCraftRecipe(recipe.id).then((result) => {
              if (result.success) {
                router.push("/dashboard/admin/craft-recipes");
                return;
              }
              setMessage({ type: "error", text: result.error ?? "削除に失敗しました。" });
              setIsDeleting(false);
            });
          }}
          disabled={isPending || isDeleting}
          className="rounded border border-error bg-transparent px-4 py-2 text-base font-medium text-error hover:bg-error/10 disabled:opacity-50"
        >
          {isDeleting ? "削除中…" : "削除"}
        </button>
      </div>
    </form>
  );
}
