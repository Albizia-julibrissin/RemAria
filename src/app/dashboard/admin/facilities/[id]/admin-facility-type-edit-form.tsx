"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminFacilityTypeWithConstruction,
  AdminFacilityConstructionInputEntry,
  UpdateAdminFacilityTypeInput,
} from "@/server/actions/admin";
import {
  updateAdminFacilityType,
  deleteAdminFacilityType,
  updateAdminFacilityConstructionInputs,
} from "@/server/actions/admin";

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "resource_exploration", label: "資源探索" },
  { value: "industrial", label: "工業" },
  { value: "training", label: "訓練" },
];

type ItemOption = { id: string; code: string; name: string };

type Props = {
  facility: AdminFacilityTypeWithConstruction;
  items: ItemOption[];
};

export function AdminFacilityTypeEditForm({ facility, items }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [name, setName] = useState(facility.name);
  const [kind, setKind] = useState(facility.kind);
  const [description, setDescription] = useState(facility.description ?? "");
  const [cost, setCost] = useState(String(facility.cost));

  // 建設材料は 1 設備 1 レシピ（docs/078 派生型廃止）
  const [constructionInputs, setConstructionInputs] = useState<{ itemId: string; amount: number }[]>(
    () => facility.constructionInputs.map((inp) => ({ itemId: inp.itemId, amount: inp.amount }))
  );
  const [constructionSaving, setConstructionSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminFacilityTypeInput = {
      name: name.trim(),
      kind,
      description: description.trim() || null,
      cost: cost.trim() !== "" && /^\d+$/.test(cost.trim()) ? parseInt(cost.trim(), 10) : 40,
    };
    startTransition(async () => {
      const result = await updateAdminFacilityType(facility.id, input);
      setMessage(
        result.success
          ? { type: "ok", text: "保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    startTransition(async () => {
      const result = await deleteAdminFacilityType(facility.id);
      if (result.success) {
        router.push("/dashboard/admin/facilities");
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error ?? "削除に失敗しました。" });
        setDeleteConfirm(false);
      }
    });
  };

  const addConstructionRow = () => {
    setConstructionInputs((prev) => [...prev, { itemId: items[0]?.id ?? "", amount: 1 }]);
  };

  const removeConstructionRow = (index: number) => {
    setConstructionInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const setConstructionRow = (index: number, field: "itemId" | "amount", value: string | number) => {
    setConstructionInputs((prev) => {
      const next = [...prev];
      if (!next[index]) return next;
      if (field === "itemId") next[index] = { ...next[index], itemId: value as string };
      else next[index] = { ...next[index], amount: typeof value === "number" ? value : parseInt(String(value), 10) || 1 };
      return next;
    });
  };

  const saveConstruction = () => {
    const normalized: AdminFacilityConstructionInputEntry[] = constructionInputs
      .filter((r) => r.itemId && r.amount >= 1)
      .map((r) => ({ itemId: r.itemId, amount: r.amount }));
    setConstructionSaving(true);
    updateAdminFacilityConstructionInputs(facility.id, normalized).then((result) => {
      setConstructionSaving(false);
      setMessage(
        result.success
          ? { type: "ok", text: "建設材料を保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  return (
    <div className="mt-6 max-w-2xl space-y-8">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text-muted">
            name（ユニーク）
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
          <label htmlFor="kind" className="block text-sm font-medium text-text-muted">
            kind
          </label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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

        <div>
          <label htmlFor="cost" className="block text-sm font-medium text-text-muted">
            cost（設置枠コスト。0 以上の整数）
          </label>
          <input
            id="cost"
            type="number"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="mt-1 w-full max-w-[120px] rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
          />
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

      {/* 建設材料（1 設備 1 レシピ、docs/078） */}
      <section className="border-t border-base-border pt-8">
        <h2 className="text-lg font-medium text-text-primary">建設材料</h2>
        <p className="mt-1 text-sm text-text-muted">
          設備を設置するときに消費するアイテム。機工区の設置画面で参照されます。
        </p>
        <div className="mt-4 rounded border border-base-border bg-base-elevated p-4">
          <div className="space-y-2">
            {constructionInputs.map((row, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <select
                  value={row.itemId}
                  onChange={(e) => setConstructionRow(idx, "itemId", e.target.value)}
                  className="min-w-[140px] rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                >
                  <option value="">選択</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}（{it.code}）
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={row.amount}
                  onChange={(e) => setConstructionRow(idx, "amount", e.target.value)}
                  className="w-16 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
                />
                <span className="text-sm text-text-muted">個</span>
                <button
                  type="button"
                  onClick={() => removeConstructionRow(idx)}
                  className="text-sm text-error hover:underline"
                >
                  削除
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addConstructionRow}
              className="text-sm text-brass hover:underline"
            >
              + 行を追加
            </button>
          </div>
          <div className="mt-3">
            <button
              type="button"
              disabled={constructionSaving}
              onClick={saveConstruction}
              className="rounded bg-brass/80 px-3 py-1.5 text-sm font-medium text-white hover:bg-brass disabled:opacity-50"
            >
              {constructionSaving ? "保存中…" : "建設材料を保存"}
            </button>
          </div>
        </div>
      </section>

      {/* 削除 */}
      <section className="border-t border-base-border pt-8">
        <h2 className="text-lg font-medium text-text-primary">削除</h2>
        <p className="mt-1 text-sm text-text-muted">
          設置済み・解放済み・研究に紐づいている場合は削除できません。
        </p>
        {!deleteConfirm ? (
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="mt-3 rounded border border-error bg-transparent px-4 py-2 text-sm font-medium text-error hover:bg-error/10"
          >
            この設備種別を削除する
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-muted">削除しますか？</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/90 disabled:opacity-50"
            >
              {isPending ? "削除中…" : "削除する"}
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirm(false)}
              className="rounded border border-base-border px-4 py-2 text-sm text-text-primary hover:bg-base-elevated"
            >
              キャンセル
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
