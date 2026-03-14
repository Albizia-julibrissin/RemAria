"use client";

// spec/030: 雇用可能回数購入（GRA 課金通貨のみ）。manage/ECONOMY_DESIGN.md

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { purchaseCompanionHire, type PurchaseCompanionHireResult } from "@/server/actions/recruit";
import { GameIcon } from "@/components/icons/game-icon";
import { PREMIUM_CURRENCY_DISPLAY_NAME, PREMIUM_CURRENCY_ICON_NAME } from "@/lib/constants/currency";

type Props = {
  premiumFreeBalance: number;
  premiumPaidBalance: number;
  pricePremium: number;
};

export function RecruitPurchaseButtons({
  premiumFreeBalance,
  premiumPaidBalance,
  pricePremium,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const totalPremium = premiumFreeBalance + premiumPaidBalance;

  function handlePurchase() {
    startTransition(async () => {
      const result: PurchaseCompanionHireResult = await purchaseCompanionHire();
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
      <div className="flex gap-3 flex-wrap items-center">
        <button
          type="button"
          onClick={handlePurchase}
          disabled={isPending || totalPremium < pricePremium}
          className="inline-flex items-center gap-2 rounded bg-brass hover:bg-brass-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 transition-colors"
        >
          <GameIcon name={PREMIUM_CURRENCY_ICON_NAME} className="w-5 h-5" ariaHidden={true} />
          {PREMIUM_CURRENCY_DISPLAY_NAME}で購入（{pricePremium}）
        </button>
      </div>
      {totalPremium < pricePremium && (
        <p className="text-sm text-error">
          {PREMIUM_CURRENCY_DISPLAY_NAME}が足りません（あと {pricePremium - totalPremium} 必要）
        </p>
      )}
    </div>
  );
}
