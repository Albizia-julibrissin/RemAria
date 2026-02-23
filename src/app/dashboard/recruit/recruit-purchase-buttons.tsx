"use client";

// spec/030: 雇用可能回数購入ボタン（ゲーム通貨 / 課金通貨）

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { purchaseCompanionHire, type PurchaseCompanionHireResult } from "@/server/actions/recruit";

type Props = {
  gameCurrencyBalance: number;
  premiumFreeBalance: number;
  premiumPaidBalance: number;
  priceGame: number;
  pricePremium: number;
};

export function RecruitPurchaseButtons({
  gameCurrencyBalance,
  premiumFreeBalance,
  premiumPaidBalance,
  priceGame,
  pricePremium,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const totalPremium = premiumFreeBalance + premiumPaidBalance;

  function handlePurchase(paymentType: "game" | "premium") {
    startTransition(async () => {
      const result: PurchaseCompanionHireResult = await purchaseCompanionHire(paymentType);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">雇用可能回数を 1 購入（決済後、名前・アイコンは後で設定できます）</p>
      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => handlePurchase("game")}
          disabled={isPending || gameCurrencyBalance < priceGame}
          className="rounded bg-brass hover:bg-brass-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 transition-colors"
        >
          ゲーム通貨で購入（{priceGame}）
        </button>
        <button
          type="button"
          onClick={() => handlePurchase("premium")}
          disabled={isPending || totalPremium < pricePremium}
          className="rounded bg-base-border hover:bg-base-border/80 disabled:opacity-50 disabled:cursor-not-allowed text-text-primary font-medium py-2 px-4 transition-colors border border-base-border"
        >
          課金通貨で購入（{pricePremium}）
        </button>
      </div>
      {gameCurrencyBalance < priceGame && (
        <p className="text-sm text-error">ゲーム通貨が足りません（あと {priceGame - gameCurrencyBalance} 必要）</p>
      )}
      {totalPremium < pricePremium && (
        <p className="text-sm text-error">課金通貨が足りません（あと {pricePremium - totalPremium} 必要）</p>
      )}
    </div>
  );
}
