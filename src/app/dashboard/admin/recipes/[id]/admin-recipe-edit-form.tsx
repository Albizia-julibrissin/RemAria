"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminRecipeDetail,
  AdminRecipeOptions,
  UpdateAdminRecipeInput,
} from "@/server/actions/admin";
import { updateAdminRecipe } from "@/server/actions/admin";

type Props = {
  recipe: AdminRecipeDetail;
  options: AdminRecipeOptions;
};

type InputRow = { itemId: string; amount: string };

export function AdminRecipeEditForm({ recipe, options }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [cycleMinutes, setCycleMinutes] = useState(String(recipe.cycleMinutes));
  const [outputItemId, setOutputItemId] = useState(recipe.outputItemId);
  const [outputAmount, setOutputAmount] = useState(String(recipe.outputAmount));
  const [inputRows, setInputRows] = useState<InputRow[]>(
    recipe.inputs.length > 0
      ? recipe.inputs.map((inp) => ({ itemId: inp.itemId, amount: String(inp.amount) }))
      : [{ itemId: "", amount: "1" }]
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminRecipeInput = {
      cycleMinutes: parseInt(cycleMinutes, 10) || 1,
      outputItemId: outputItemId.trim(),
      outputAmount: parseInt(outputAmount, 10) || 1,
      inputs: inputRows
        .filter((row) => row.itemId.trim())
        .map((row) => ({
          itemId: row.itemId,
          amount: parseInt(row.amount, 10) || 0,
        }))
        .filter((row) => row.amount > 0),
    };
    startTransition(async () => {
      const result = await updateAdminRecipe(recipe.id, input);
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
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      <p className="text-sm text-text-muted">設備: {recipe.facilityName}（変更不可）</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="cycleMinutes" className="block text-sm font-medium text-text-muted">
            周期（分）
          </label>
          <input
            id="cycleMinutes"
            type="number"
            min={1}
            value={cycleMinutes}
            onChange={(e) => setCycleMinutes(e.target.value)}
            required
            className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
          />
        </div>
        <div>
          <label htmlFor="outputAmount" className="block text-sm font-medium text-text-muted">
            出力数（1回あたり）
          </label>
          <input
            id="outputAmount"
            type="number"
            min={1}
            value={outputAmount}
            onChange={(e) => setOutputAmount(e.target.value)}
            required
            className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="outputItemId" className="block text-sm font-medium text-text-muted">
          出力アイテム
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

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-text-muted">
            入力素材（同一アイテムは保存時に合算）
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
                min={0}
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
          {isPending ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
