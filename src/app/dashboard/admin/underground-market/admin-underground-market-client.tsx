"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminSystemShopRow } from "@/server/actions/admin";
import {
  createAdminSystemShopItem,
  updateAdminSystemShopItem,
  deleteAdminSystemShopItem,
} from "@/server/actions/admin";

type Tab = "underground" | "black";

type Props = {
  undergroundItems: AdminSystemShopRow[];
  blackItems: AdminSystemShopRow[];
  specialItems: { id: string; code: string; name: string }[];
};

export function AdminUndergroundMarketClient({
  undergroundItems,
  blackItems,
  specialItems,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("underground");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const items = tab === "underground" ? undergroundItems : blackItems;
  const marketType = tab;
  const marketLabel = tab === "underground" ? "闇市" : "黒市";

  const [addItemId, setAddItemId] = useState(specialItems[0]?.id ?? "");
  const [addPrice, setAddPrice] = useState("2000");
  const [addOrder, setAddOrder] = useState("0");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editOrder, setEditOrder] = useState("");

  const startEdit = (row: AdminSystemShopRow) => {
    setEditingId(row.id);
    setEditPrice(String(row.priceGRA));
    setEditOrder(String(row.displayOrder));
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditPrice("");
    setEditOrder("");
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const price = parseInt(editPrice, 10);
    const order = parseInt(editOrder, 10);
    if (Number.isNaN(price) || price < 1) {
      setMessage({ type: "error", text: "価格は1以上の整数で入力してください。" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await updateAdminSystemShopItem(editingId, price, Number.isNaN(order) ? 0 : order);
      setMessage(
        result.success
          ? { type: "ok", text: "更新しました。" }
          : { type: "error", text: result.error ?? "更新に失敗しました。" }
      );
      if (result.success) {
        cancelEdit();
        router.refresh();
      }
    });
  };

  const handleAdd = () => {
    setMessage(null);
    const price = parseInt(addPrice, 10);
    const order = parseInt(addOrder, 10);
    if (!addItemId || Number.isNaN(price) || price < 1) {
      setMessage({ type: "error", text: "アイテムを選択し、価格を1以上で入力してください。" });
      return;
    }
    startTransition(async () => {
      const result = await createAdminSystemShopItem(
        marketType,
        addItemId,
        price,
        Number.isNaN(order) ? 0 : order
      );
      setMessage(
        result.success
          ? { type: "ok", text: `${marketLabel}に追加しました。` }
          : { type: "error", text: result.error ?? "追加に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("この販売品を削除しますか？")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteAdminSystemShopItem(id);
      setMessage(
        result.success
          ? { type: "ok", text: "削除しました。" }
          : { type: "error", text: result.error ?? "削除に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-base-border pb-2">
        <button
          type="button"
          onClick={() => setTab("underground")}
          className={`rounded px-4 py-2 text-sm font-medium ${
            tab === "underground" ? "bg-brass text-white" : "bg-base-elevated text-text-primary"
          }`}
        >
          闇市
        </button>
        <button
          type="button"
          onClick={() => setTab("black")}
          className={`rounded px-4 py-2 text-sm font-medium ${
            tab === "black" ? "bg-brass text-white" : "bg-base-elevated text-text-primary"
          }`}
        >
          黒市
        </button>
      </div>

      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      <section>
        <h2 className="text-lg font-medium text-text-primary">{marketLabel}の販売品</h2>
        <p className="mt-1 text-xs text-text-muted">特別カテゴリのアイテムのみ選択できます。</p>

        <div className="mt-3 flex flex-wrap items-end gap-3 rounded border border-base-border bg-base-elevated p-3">
          <div>
            <label className="block text-xs text-text-muted">アイテム（特別のみ）</label>
            <select
              value={addItemId}
              onChange={(e) => setAddItemId(e.target.value)}
              className="mt-1 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary min-w-[200px]"
            >
              {specialItems.length === 0 ? (
                <option value="">特別アイテムがありません</option>
              ) : (
                specialItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}（{it.code}）
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-muted">価格（GRA）</label>
            <input
              type="number"
              min={1}
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              className="mt-1 w-24 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted">表示順</label>
            <input
              type="number"
              value={addOrder}
              onChange={(e) => setAddOrder(e.target.value)}
              className="mt-1 w-20 rounded border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
            />
          </div>
          <button
            type="button"
            disabled={isPending || specialItems.length === 0}
            onClick={handleAdd}
            className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
          >
            追加
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse border border-base-border text-sm">
            <thead>
              <tr className="bg-base">
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  アイテム
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-24">
                  価格（GRA）
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                  表示順
                </th>
                <th className="border border-base-border px-2 py-1.5 w-20 text-center text-text-muted font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="text-text-primary">
                  <td className="border border-base-border px-2 py-1.5">
                    {row.itemName}（{row.itemCode}）
                  </td>
                  {editingId === row.id ? (
                    <>
                      <td className="border border-base-border px-2 py-1.5">
                        <input
                          type="number"
                          min={1}
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-20 rounded border border-base-border bg-base px-1.5 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-base-border px-2 py-1.5">
                        <input
                          type="number"
                          value={editOrder}
                          onChange={(e) => setEditOrder(e.target.value)}
                          className="w-16 rounded border border-base-border bg-base px-1.5 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-base-border px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={isPending}
                          className="mr-2 text-success text-sm hover:underline disabled:opacity-50"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isPending}
                          className="text-text-muted text-sm hover:underline disabled:opacity-50"
                        >
                          取消
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border border-base-border px-2 py-1.5 tabular-nums">
                        {row.priceGRA.toLocaleString()}
                      </td>
                      <td className="border border-base-border px-2 py-1.5">{row.displayOrder}</td>
                      <td className="border border-base-border px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={isPending}
                          className="mr-2 text-brass text-sm hover:underline disabled:opacity-50"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={isPending}
                          className="text-error text-sm hover:underline disabled:opacity-50"
                        >
                          削除
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="mt-2 text-sm text-text-muted">登録されている販売品はありません。</p>
          )}
        </div>
      </section>
    </div>
  );
}
