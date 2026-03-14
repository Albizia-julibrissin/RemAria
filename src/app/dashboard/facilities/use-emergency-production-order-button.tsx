"use client";

// spec/083: 緊急製造指示書を使うボタン。押すとモーダルで枚数表示・0枚時は黒市案内。設備が上限未満なら実行前に確認。docs/065 §7.6

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEmergencyProductionOrder } from "@/server/actions/emergency-production-order";

type Props = {
  emergencyProductionOrderCount: number;
  usedSlots: number;
  maxSlots: number;
};

export function UseEmergencyProductionOrderButton({
  emergencyProductionOrderCount,
  usedSlots,
  maxSlots,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const needsConfirm = usedSlots < maxSlots;

  const canUse = emergencyProductionOrderCount >= 1;

  const runUse = async () => {
    if (!canUse) return;
    setPending(true);
    setResultMessage(null);
    const result = await useEmergencyProductionOrder();
    setPending(false);
    setResultMessage(result.message);
    if (result.success) {
      router.refresh();
    }
  };

  const handleUseClick = () => {
    if (needsConfirm) {
      const ok = window.confirm("設備が設置上限より少ない状態です。本当に実行しますか？");
      if (!ok) return;
    }
    runUse();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setResultMessage(null);
          setShowExplanation(false);
        }}
        className="inline-flex w-fit items-center justify-center rounded-lg bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
      >
        緊急製造指示書
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-order-modal-title"
        >
          <div className="w-full max-w-sm rounded-lg border border-base-border bg-base-elevated p-5 shadow-lg">
            <div className="flex items-center gap-1.5">
              <h2 id="emergency-order-modal-title" className="text-lg font-medium text-text-primary">
                緊急製造指示書
              </h2>
              <button
                type="button"
                onClick={() => setShowExplanation((v) => !v)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-base-border text-text-muted text-sm font-bold hover:bg-base-border/80 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-base-border focus:ring-offset-2 focus:ring-offset-base-elevated"
                aria-label="説明を表示"
                title="説明を表示"
              >
                !
              </button>
            </div>
            {showExplanation && (
              <p className="mt-2 text-sm text-text-muted">全設備を2時間加速します。</p>
            )}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">所持枚数</dt>
                <dd className="tabular-nums font-medium text-text-primary">
                  {emergencyProductionOrderCount} 枚
                </dd>
              </div>
            </dl>
            {emergencyProductionOrderCount < 1 && (
              <p className="mt-3 text-sm text-text-muted">
                黒市で黒市後援契約を購入すると支給されます。{" "}
                <Link
                  href="/dashboard/underground-market"
                  className="text-brass hover:text-brass-hover underline"
                >
                  闇市へ
                </Link>
              </p>
            )}
            {resultMessage && (
              <p className={`mt-3 text-sm ${resultMessage.includes("進みました") ? "text-success" : "text-destructive"}`}>
                {resultMessage}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setResultMessage(null);
                }}
                className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border/50"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleUseClick}
                disabled={!canUse || pending}
                className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? "処理中…" : "使う"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
