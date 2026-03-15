"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ITEM_CATEGORIES } from "@/lib/constants/item-categories";
import type { AdminItemDetail, UpdateAdminItemInput } from "@/server/actions/admin";
import { updateAdminItem, deleteAdminItem } from "@/server/actions/admin";

const CATEGORY_LABELS: Record<string, string> = {
  material: "素材",
  consumable: "消耗品",
  blueprint: "設計図",
  skill_book: "スキル分析書",
  special: "特別",
};

type Props = {
  item: AdminItemDetail;
  skills: { id: string; name: string; category: string }[];
};

export function AdminItemEditForm({ item, skills }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [code, setCode] = useState(item.code);
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [skillId, setSkillId] = useState(item.skillId ?? "");
  const [consumableEffectJson, setConsumableEffectJson] = useState(
    item.consumableEffect != null
      ? JSON.stringify(item.consumableEffect, null, 2)
      : ""
  );
  const [maxCarry, setMaxCarry] = useState(
    item.maxCarryPerExpedition != null ? String(item.maxCarryPerExpedition) : ""
  );
  const [maxOwned, setMaxOwned] = useState(
    item.maxOwnedPerUser != null ? String(item.maxOwnedPerUser) : "99999"
  );
  const [marketListable, setMarketListable] = useState(item.marketListable);
  const [marketMinPrice, setMarketMinPrice] = useState(
    item.marketMinPricePerUnit != null ? String(item.marketMinPricePerUnit) : "1"
  );
  const [marketMinQty, setMarketMinQty] = useState(
    item.marketMinQuantity != null ? String(item.marketMinQuantity) : "1"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: UpdateAdminItemInput = {
      code,
      name,
      category,
      skillId: skillId.trim() || null,
      consumableEffectJson: consumableEffectJson.trim() || null,
      maxCarryPerExpedition:
        maxCarry.trim() !== "" && /^\d+$/.test(maxCarry.trim())
          ? parseInt(maxCarry.trim(), 10)
          : null,
      maxOwnedPerUser:
        maxOwned.trim() !== "" && /^\d+$/.test(maxOwned.trim())
          ? parseInt(maxOwned.trim(), 10)
          : null,
      marketListable,
      marketMinPricePerUnit:
        marketMinPrice.trim() !== "" && /^\d+$/.test(marketMinPrice.trim())
          ? parseInt(marketMinPrice.trim(), 10)
          : null,
      marketMinQuantity:
        marketMinQty.trim() !== "" && /^\d+$/.test(marketMinQty.trim())
          ? parseInt(marketMinQty.trim(), 10)
          : null,
    };
    startTransition(async () => {
      const result = await updateAdminItem(item.id, input);
      setMessage(
        result.success
          ? { type: "ok", text: "保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm(`アイテム「${item.code}」（${item.name}）を削除しますか？\n参照（所持・レシピ・ドロップ等）がある場合は削除できません。`)) {
      return;
    }
    setIsDeleting(true);
    setMessage(null);
    deleteAdminItem(item.id).then((result) => {
      setIsDeleting(false);
      if (result.success) {
        router.push("/dashboard/admin/items");
        return;
      }
      setMessage({ type: "error", text: result.error ?? "削除に失敗しました。" });
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
        <label htmlFor="category" className="block text-sm font-medium text-text-muted">
          category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        >
          {ITEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="skillId" className="block text-sm font-medium text-text-muted">
          skillId（スキル分析書のとき必須）
        </label>
        <select
          id="skillId"
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          required={category === "skill_book"}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        >
          <option value="">— なし —</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              [{s.category}] {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="consumableEffect" className="block text-sm font-medium text-text-muted">
          consumableEffect（JSON。消耗品で使用。例: {`{"type":"hp_percent","value":10}`}）
        </label>
        <textarea
          id="consumableEffect"
          value={consumableEffectJson}
          onChange={(e) => setConsumableEffectJson(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 font-mono text-sm text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="maxCarry" className="block text-sm font-medium text-text-muted">
          maxCarryPerExpedition（探索1回の持ち込み上限。空で未設定）
        </label>
        <input
          id="maxCarry"
          type="number"
          min={0}
          value={maxCarry}
          onChange={(e) => setMaxCarry(e.target.value)}
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="maxOwned" className="block text-sm font-medium text-text-muted">
          maxOwnedPerUser（ユーザー別所持数上限。スタック可能アイテム用。デフォルト99999）
        </label>
        <input
          id="maxOwned"
          type="number"
          min={0}
          value={maxOwned}
          onChange={(e) => setMaxOwned(e.target.value)}
          placeholder="99999"
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="marketListable"
          type="checkbox"
          checked={marketListable}
          onChange={(e) => setMarketListable(e.target.checked)}
          className="rounded border-base-border"
        />
        <label htmlFor="marketListable" className="text-sm font-medium text-text-muted">
          marketListable（市場出品可。spec/075）
        </label>
      </div>

      <div>
        <label htmlFor="marketMinPrice" className="block text-sm font-medium text-text-muted">
          marketMinPricePerUnit（出品単価下限。デフォルト1）
        </label>
        <input
          id="marketMinPrice"
          type="number"
          min={0}
          value={marketMinPrice}
          onChange={(e) => setMarketMinPrice(e.target.value)}
          placeholder="1"
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        />
      </div>

      <div>
        <label htmlFor="marketMinQty" className="block text-sm font-medium text-text-muted">
          marketMinQuantity（出品数量下限・出品単位。デフォルト1。出品時の数量刻み・単位としても使用）
        </label>
        <input
          id="marketMinQty"
          type="number"
          min={0}
          value={marketMinQty}
          onChange={(e) => setMarketMinQty(e.target.value)}
          placeholder="1"
          className="mt-1 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-base font-medium text-white hover:bg-brass-hover disabled:opacity-50"
        >
          {isPending ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded border border-error bg-transparent px-4 py-2 text-base font-medium text-error hover:bg-error/10 disabled:opacity-50"
        >
          {isDeleting ? "削除中…" : "削除"}
        </button>
      </div>
    </form>
  );
}
