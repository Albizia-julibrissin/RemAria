"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  MarketListEntry,
  MyListingRow,
  MarketListableStack,
  MarketUserHistoryEntry,
  MarketPriceHistory,
  MarketItemPriceTier,
  MarketItemListingsResult,
} from "@/server/actions/market";
import {
  buyFromMarket,
  listMarketItem,
  cancelMarketListing,
  getMarketPriceHistory,
  getMarketItemListings,
} from "@/server/actions/market";
import { GameIcon } from "@/components/icons/game-icon";

type View = "buy" | "sell" | "listings" | "history";

type Props = {
  initialEntries: MarketListEntry[];
  initialMyListings: MyListingRow[];
  listableItems: MarketListableStack[];
  initialHistory: MarketUserHistoryEntry[];
  graBalance: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  material: "素材",
  consumable: "消耗品",
  blueprint: "設計図",
  skill_book: "スキル分析書",
  paid: "有料",
};

export function MarketClient({
  initialEntries,
  initialMyListings,
  listableItems,
  initialHistory,
  graBalance,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("buy");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [entries, setEntries] = useState(initialEntries);
  const [myListings, setMyListings] = useState(initialMyListings);
  const [historyEntries, setHistoryEntries] = useState(initialHistory);
  const [balance, setBalance] = useState(graBalance);

  const showMessage = (type: "ok" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("buy")}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            view === "buy"
              ? "border-brass bg-brass/10 text-brass"
              : "border-base-border bg-base text-text-primary hover:border-brass"
          }`}
        >
          <GameIcon name="hand-bag" className="w-4 h-4" />
          購入
        </button>
        <button
          type="button"
          onClick={() => setView("sell")}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            view === "sell"
              ? "border-brass bg-brass/10 text-brass"
              : "border-base-border bg-base text-text-primary hover:border-brass"
          }`}
        >
          <GameIcon name="shop" className="w-4 h-4" />
          出品
        </button>
        <button
          type="button"
          onClick={() => setView("listings")}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            view === "listings"
              ? "border-brass bg-brass/10 text-brass"
              : "border-base-border bg-base text-text-primary hover:border-brass"
          }`}
        >
          <GameIcon name="scroll-quill" className="w-4 h-4" />
          取下げ
        </button>
        <button
          type="button"
          onClick={() => setView("history")}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            view === "history"
              ? "border-brass bg-brass/10 text-brass"
              : "border-base-border bg-base text-text-primary hover:border-brass"
          }`}
        >
          <GameIcon name="hourglass" className="w-4 h-4" />
          履歴
        </button>
      </div>

      {message && (
        <p
          className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}
        >
          {message.text}
        </p>
      )}

      {view === "buy" && (
        <BuyView
          entries={entries}
          balance={balance}
          isPending={isPending}
          onBuy={({ itemId, quantity }) => {
            startTransition(async () => {
              const result = await buyFromMarket(itemId, quantity);
              if (result.success) {
                setBalance((b) => b - result.totalCost);
                showMessage("ok", `${result.quantity}個 購入しました（${result.totalCost} GRA 消費）。`);
                router.refresh();
                import("@/server/actions/market").then((m) => m.getMarketUserHistory()).then((h) => h.success && setHistoryEntries(h.entries));
                setEntries((prev) => {
                  const e = prev.find((x) => x.itemId === itemId);
                  if (!e) return prev;
                  const newQty = e.quantityAtBestPrice - result.quantity;
                  if (newQty <= 0) return prev.filter((x) => x.itemId !== itemId);
                  return prev.map((x) =>
                    x.itemId === itemId
                      ? { ...x, quantityAtBestPrice: newQty }
                      : x
                  );
                });
              } else {
                showMessage("error", result.error);
              }
            });
          }}
        />
      )}

      {view === "sell" && (
        <SellView
          listableItems={listableItems}
          isPending={isPending}
          onList={({ itemId, quantity, pricePerUnit }) => {
            startTransition(async () => {
              const result = await listMarketItem(itemId, quantity, pricePerUnit);
              if (result.success) {
                showMessage("ok", "出品しました。");
                router.refresh();
                import("@/server/actions/market").then((m) => m.getMarketUserHistory()).then((h) => h.success && setHistoryEntries(h.entries));
                setMyListings((prev) => [
                  {
                    id: result.listingId,
                    itemId,
                    itemCode: listableItems.find((i) => i.itemId === itemId)?.code ?? "",
                    itemName: listableItems.find((i) => i.itemId === itemId)?.name ?? "",
                    quantity,
                    pricePerUnit,
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                  },
                  ...prev,
                ]);
              } else {
                showMessage("error", result.error);
              }
            });
          }}
        />
      )}

      {view === "listings" && (
        <ListingsView
          listings={myListings}
          isPending={isPending}
          onCancel={(listingId) => {
            startTransition(async () => {
              const result = await cancelMarketListing(listingId);
              if (result.success) {
                showMessage("ok", "取り下げました。");
                setMyListings((prev) => prev.filter((l) => l.id !== listingId));
                router.refresh();
                const hist = await import("@/server/actions/market").then((m) => m.getMarketUserHistory());
                if (hist.success) setHistoryEntries(hist.entries);
              } else {
                showMessage("error", result.error);
              }
            });
          }}
        />
      )}

      {view === "history" && <HistoryView entries={historyEntries} />}
    </div>
  );
}

const TIERS_PER_PAGE = 5;

/** 最安から数量を埋めたときの合計 GRA を計算（単価をまたぐ購入に対応） */
function calcEstimatedCost(
  priceTiers: MarketItemPriceTier[],
  quantity: number
): number {
  let remaining = quantity;
  let cost = 0;
  for (const t of priceTiers) {
    const take = Math.min(remaining, t.quantity);
    cost += take * t.pricePerUnit;
    remaining -= take;
    if (remaining <= 0) break;
  }
  return cost;
}

function BuyView({
  entries,
  balance,
  isPending,
  onBuy,
}: {
  entries: MarketListEntry[];
  balance: number;
  isPending: boolean;
  onBuy: (params: { itemId: string; quantity: number }) => void;
}) {
  const [modalItemId, setModalItemId] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-base-border bg-base-elevated p-6">
      <h2 className="text-lg font-medium text-text-primary">購入</h2>
      <p className="mt-1 text-sm text-text-muted">
        所持 GRA: <span className="font-medium text-text-primary">{balance}</span>
        {"　"}アイテムの行をクリックで詳細・購入
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 text-text-muted">現在、出品はありません。</p>
      ) : (
        <table className="mt-4 w-full max-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-base-border text-left text-text-muted">
              <th className="py-2 pr-4">アイテム</th>
              <th className="py-2 pr-4">種別</th>
              <th className="py-2 pr-4">最安単価</th>
              <th className="py-2">在庫</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.itemId}
                role="button"
                tabIndex={0}
                onClick={() => setModalItemId(e.itemId)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setModalItemId(e.itemId);
                  }
                }}
                className="border-b border-base-border cursor-pointer hover:bg-brass/5 focus:bg-brass/5 focus:outline-none focus:ring-2 focus:ring-brass"
              >
                <td className="py-2 pr-4 font-medium text-text-primary">{e.itemName}</td>
                <td className="py-2 pr-4 text-text-muted">
                  {CATEGORY_LABELS[e.category] ?? e.category}
                </td>
                <td className="py-2 pr-4">{e.bestPricePerUnit} GRA</td>
                <td className="py-2">{e.quantityAtBestPrice}個</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalItemId && (
        <BuyDetailModal
          itemId={modalItemId}
          entry={entries.find((e) => e.itemId === modalItemId) ?? null}
          balance={balance}
          isPending={isPending}
          onClose={() => setModalItemId(null)}
          onBuy={(params) => {
            onBuy(params);
            setModalItemId(null);
          }}
        />
      )}
    </section>
  );
}

function BuyDetailModal({
  itemId,
  entry,
  balance,
  isPending,
  onClose,
  onBuy,
}: {
  itemId: string;
  entry: MarketListEntry | null;
  balance: number;
  isPending: boolean;
  onClose: () => void;
  onBuy: (params: { itemId: string; quantity: number }) => void;
}) {
  const [listings, setListings] = useState<MarketItemListingsResult | null>(null);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<MarketPriceHistory | null | "loading">("loading");
  const [quantity, setQuantity] = useState("");
  const [tierPage, setTierPage] = useState(0);

  useEffect(() => {
    getMarketItemListings(itemId).then((r) => {
      if (r.success) setListings(r.data);
      else setListingsError(r.error);
    });
    getMarketPriceHistory(itemId).then((r) => {
      if (r.success) setPriceHistory(r.data);
      else setPriceHistory(null);
    });
  }, [itemId]);

  const priceTiers = listings?.priceTiers ?? [];
  const totalAvailable = listings?.totalAvailable ?? 0;
  const tierPageCount = Math.max(1, Math.ceil(priceTiers.length / TIERS_PER_PAGE));
  const currentTiers = priceTiers.slice(
    tierPage * TIERS_PER_PAGE,
    tierPage * TIERS_PER_PAGE + TIERS_PER_PAGE
  );

  const qtyNum = parseInt(quantity, 10) || 0;
  const estimatedCost = qtyNum >= 1 && qtyNum <= totalAvailable ? calcEstimatedCost(priceTiers, qtyNum) : 0;
  const canSubmit =
    qtyNum >= 1 &&
    qtyNum <= totalAvailable &&
    estimatedCost <= balance &&
    !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onBuy({ itemId, quantity: qtyNum });
    setQuantity("");
  };

  const displayName = entry?.itemName ?? listings?.itemName ?? "アイテム";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-base-border bg-base-elevated p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h3 id="buy-modal-title" className="text-lg font-medium text-text-primary">
            {displayName} を購入
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-base-border hover:text-text-primary"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {listingsError && (
          <p className="mt-2 text-sm text-error">{listingsError}</p>
        )}

        {listings && (
          <>
            <p className="mt-1 text-sm text-text-muted">
              {CATEGORY_LABELS[listings.category] ?? listings.category}　所持 GRA: {balance}
            </p>

            <h4 className="mt-4 text-sm font-medium text-text-muted">出品単価ごとの在庫（最安順）</h4>
            {priceTiers.length === 0 ? (
              <p className="mt-1 text-sm text-text-muted">現在このアイテムの出品はありません。</p>
            ) : (
              <>
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-base-border text-left text-text-muted">
                      <th className="py-1.5 pr-3">単価（GRA）</th>
                      <th className="py-1.5">在庫（個）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTiers.map((t) => (
                      <tr key={t.pricePerUnit} className="border-b border-base-border">
                        <td className="py-1.5 pr-3 font-medium">{t.pricePerUnit}</td>
                        <td className="py-1.5">{t.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tierPageCount > 1 && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-text-muted">
                    <button
                      type="button"
                      onClick={() => setTierPage((p) => Math.max(0, p - 1))}
                      disabled={tierPage === 0}
                      className="rounded border border-base-border px-2 py-1 hover:bg-base disabled:opacity-50"
                    >
                      前へ
                    </button>
                    <span>
                      {tierPage + 1} / {tierPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTierPage((p) => Math.min(tierPageCount - 1, p + 1))}
                      disabled={tierPage >= tierPageCount - 1}
                      className="rounded border border-base-border px-2 py-1 hover:bg-base disabled:opacity-50"
                    >
                      次へ
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="mt-4 rounded border border-base-border bg-base/50 px-3 py-2 text-sm">
              <span className="font-medium text-text-muted">価格履歴（直近成約）</span>
              {priceHistory === "loading" && <p className="mt-0.5 text-text-muted">取得中…</p>}
              {priceHistory && priceHistory !== "loading" && (
                <p className="mt-0.5 text-text-primary">
                  平均 {priceHistory.avg} / 中央値 {priceHistory.median} / 最小 {priceHistory.min} / 最大 {priceHistory.max} GRA（{priceHistory.count}件）
                </p>
              )}
              {priceHistory === null && <p className="mt-0.5 text-text-muted">成約履歴はありません。</p>}
            </div>

            {priceTiers.length > 0 && (
              <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="buy-modal-qty" className="block text-sm text-text-muted">
                    購入数量（最大 {totalAvailable} 個）
                  </label>
                  <input
                    id="buy-modal-qty"
                    type="number"
                    min={1}
                    max={totalAvailable}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="mt-1 w-28 rounded border border-base-border bg-base px-3 py-2 text-text-primary"
                  />
                </div>
                {qtyNum >= 1 && qtyNum <= totalAvailable && (
                  <p className="text-sm text-text-primary">
                    合計 <strong>{estimatedCost} GRA</strong>
                    {estimatedCost > balance && (
                      <span className="ml-2 text-error">（GRA 不足）</span>
                    )}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
                >
                  {isPending ? "処理中…" : "購入する"}
                </button>
              </form>
            )}
          </>
        )}

        {!listings && !listingsError && (
          <p className="mt-4 text-text-muted">読み込み中…</p>
        )}
      </div>
    </div>
  );
}

function SellView({
  listableItems,
  isPending,
  onList,
}: {
  listableItems: MarketListableStack[];
  isPending: boolean;
  onList: (params: {
    itemId: string;
    quantity: number;
    pricePerUnit: number;
  }) => void;
}) {
  const [modalItem, setModalItem] = useState<MarketListableStack | null>(null);

  if (listableItems.length === 0) {
    return (
      <section className="rounded-lg border border-base-border bg-base-elevated p-6">
        <h2 className="text-lg font-medium text-text-primary">出品</h2>
        <p className="mt-4 text-text-muted">
          出品可能なアイテムを所持していません。物資庫でスタック型アイテムを用意し、管理画面でアイテムの「市場出品可」を有効にすると出品できます。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-base-border bg-base-elevated p-6">
      <h2 className="text-lg font-medium text-text-primary">出品</h2>
      <p className="mt-1 text-sm text-text-muted">
        出品可能な所持アイテム。行をクリックして数量・単価を指定して出品します。
      </p>

      <table className="mt-4 w-full max-w-2xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-base-border text-left text-text-muted">
            <th className="py-2 pr-4">名前</th>
            <th className="py-2 pr-4">種別</th>
            <th className="py-2">在庫数</th>
          </tr>
        </thead>
        <tbody>
          {listableItems.map((i) => (
            <tr
              key={i.itemId}
              role="button"
              tabIndex={0}
              onClick={() => setModalItem(i)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  setModalItem(i);
                }
              }}
              className="border-b border-base-border cursor-pointer hover:bg-brass/5 focus:bg-brass/5 focus:outline-none focus:ring-2 focus:ring-brass"
            >
              <td className="py-2 pr-4 font-medium text-text-primary">{i.name}</td>
              <td className="py-2 pr-4 text-text-muted">
                {CATEGORY_LABELS[i.category] ?? i.category}
              </td>
              <td className="py-2">{i.quantity}個</td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalItem && (
        <SellDetailModal
          item={modalItem}
          isPending={isPending}
          onClose={() => setModalItem(null)}
          onList={(params) => {
            onList(params);
            setModalItem(null);
          }}
        />
      )}
    </section>
  );
}

function SellDetailModal({
  item,
  isPending,
  onClose,
  onList,
}: {
  item: MarketListableStack;
  isPending: boolean;
  onClose: () => void;
  onList: (params: { itemId: string; quantity: number; pricePerUnit: number }) => void;
}) {
  const [listings, setListings] = useState<MarketItemListingsResult | null>(null);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [tierPage, setTierPage] = useState(0);

  useEffect(() => {
    getMarketItemListings(item.itemId).then((r) => {
      if (r.success) setListings(r.data);
      else setListingsError(r.error);
    });
  }, [item.itemId]);

  const priceTiers = listings?.priceTiers ?? [];
  const tierPageCount = Math.max(1, Math.ceil(priceTiers.length / TIERS_PER_PAGE));
  const currentTiers = priceTiers.slice(
    tierPage * TIERS_PER_PAGE,
    tierPage * TIERS_PER_PAGE + TIERS_PER_PAGE
  );

  const qtyNum = parseInt(quantity, 10) || 0;
  const priceNum = parseInt(pricePerUnit, 10) || 0;
  const canSubmit =
    qtyNum >= item.minQuantity &&
    qtyNum <= item.quantity &&
    priceNum >= item.minPricePerUnit &&
    !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onList({ itemId: item.itemId, quantity: qtyNum, pricePerUnit: priceNum });
    setQuantity("");
    setPricePerUnit("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sell-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-base-border bg-base-elevated p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h3 id="sell-modal-title" className="text-lg font-medium text-text-primary">
            {item.name} を出品
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-base-border hover:text-text-primary"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <p className="mt-1 text-sm text-text-muted">
          {CATEGORY_LABELS[item.category] ?? item.category}　所持: {item.quantity}個
        </p>

        {listingsError && (
          <p className="mt-2 text-sm text-error">{listingsError}</p>
        )}

        {listings && (
          <>
            <h4 className="mt-4 text-sm font-medium text-text-muted">現在の出品（このアイテム・単価ごと）</h4>
            {priceTiers.length === 0 ? (
              <p className="mt-1 text-sm text-text-muted">現在このアイテムの出品はありません。</p>
            ) : (
              <>
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-base-border text-left text-text-muted">
                      <th className="py-1.5 pr-3">単価（GRA）</th>
                      <th className="py-1.5">在庫（個）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTiers.map((t) => (
                      <tr key={t.pricePerUnit} className="border-b border-base-border">
                        <td className="py-1.5 pr-3 font-medium">{t.pricePerUnit}</td>
                        <td className="py-1.5">{t.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tierPageCount > 1 && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-text-muted">
                    <button
                      type="button"
                      onClick={() => setTierPage((p) => Math.max(0, p - 1))}
                      disabled={tierPage === 0}
                      className="rounded border border-base-border px-2 py-1 hover:bg-base disabled:opacity-50"
                    >
                      前へ
                    </button>
                    <span>{tierPage + 1} / {tierPageCount}</span>
                    <button
                      type="button"
                      onClick={() => setTierPage((p) => Math.min(tierPageCount - 1, p + 1))}
                      disabled={tierPage >= tierPageCount - 1}
                      className="rounded border border-base-border px-2 py-1 hover:bg-base disabled:opacity-50"
                    >
                      次へ
                    </button>
                  </div>
                )}
              </>
            )}

            <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="sell-modal-qty" className="block text-sm text-text-muted">
                  数量（最小{item.minQuantity}、最大{item.quantity}）
                </label>
                <input
                  id="sell-modal-qty"
                  type="number"
                  min={item.minQuantity}
                  max={item.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 w-28 rounded border border-base-border bg-base px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label htmlFor="sell-modal-price" className="block text-sm text-text-muted">
                  単価（最小{item.minPricePerUnit} GRA）
                </label>
                <input
                  id="sell-modal-price"
                  type="number"
                  min={item.minPricePerUnit}
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(e.target.value)}
                  className="mt-1 w-28 rounded border border-base-border bg-base px-3 py-2 text-text-primary"
                />
              </div>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
              >
                {isPending ? "出品中…" : "出品する"}
              </button>
            </form>
          </>
        )}

        {!listings && !listingsError && (
          <p className="mt-4 text-text-muted">読み込み中…</p>
        )}
      </div>
    </div>
  );
}

function ListingsView({
  listings,
  isPending,
  onCancel,
}: {
  listings: MyListingRow[];
  isPending: boolean;
  onCancel: (listingId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-base-border bg-base-elevated p-6">
      <h2 className="text-lg font-medium text-text-primary">取下げ</h2>
      <p className="mt-1 text-sm text-text-muted">
        現在出品中の一覧。取り下げると在庫に戻ります。
      </p>

      {listings.length === 0 ? (
        <p className="mt-4 text-text-muted">出品はありません。</p>
      ) : (
        <table className="mt-4 w-full max-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-base-border text-left text-text-muted">
              <th className="py-2 pr-4">アイテム</th>
              <th className="py-2 pr-4">数量</th>
              <th className="py-2 pr-4">単価</th>
              <th className="py-2 pr-4">有効期限</th>
              <th className="py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id} className="border-b border-base-border">
                <td className="py-2 pr-4 font-medium text-text-primary">{l.itemName}</td>
                <td className="py-2 pr-4">{l.quantity}個</td>
                <td className="py-2 pr-4">{l.pricePerUnit} GRA</td>
                <td className="py-2 pr-4 text-text-muted">
                  {l.expiresAt ? l.expiresAt.toLocaleDateString("ja-JP") : "—"}
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => onCancel(l.id)}
                    disabled={isPending}
                    className="rounded border border-base-border px-2 py-1 text-sm text-text-muted hover:border-error hover:text-error disabled:opacity-50"
                  >
                    取り下げ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const HISTORY_KIND_LABELS: Record<MarketUserHistoryEntry["kind"], string> = {
  bought: "購入",
  sold: "成約（売却）",
  cancelled: "手動取り下げ",
  expired: "期限切れで自動戻し",
};

function HistoryView({ entries }: { entries: MarketUserHistoryEntry[] }) {
  return (
    <section className="rounded-lg border border-base-border bg-base-elevated p-6">
      <h2 className="text-lg font-medium text-text-primary">履歴</h2>
      <p className="mt-1 text-sm text-text-muted">
        成約・取り下げ・期限切れを時系列で表示します。
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 text-text-muted">履歴はありません。</p>
      ) : (
        <table className="mt-4 w-full max-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-base-border text-left text-text-muted">
              <th className="py-2 pr-4">日時</th>
              <th className="py-2 pr-4">種別</th>
              <th className="py-2 pr-4">アイテム</th>
              <th className="py-2 pr-4">数量</th>
              <th className="py-2">単価</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={`${e.kind}-${e.itemId}-${e.createdAt.toISOString()}-${i}`} className="border-b border-base-border">
                <td className="py-2 pr-4 text-text-muted">
                  {e.createdAt.toLocaleString("ja-JP")}
                </td>
                <td className="py-2 pr-4">{HISTORY_KIND_LABELS[e.kind]}</td>
                <td className="py-2 pr-4 font-medium text-text-primary">{e.itemName}</td>
                <td className="py-2 pr-4">{e.quantity}個</td>
                <td className="py-2">{e.pricePerUnit} GRA</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
