"use client";

// spec/036, docs/019 - 全設備一括受け取りボタン

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { receiveProduction } from "@/server/actions/receive-production";
import { Toast } from "@/components/toast";

type Props = { hasReceivable: boolean };

export function ReceiveAllForm({ hasReceivable }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<React.ReactNode>("");

  function handleClick() {
    startTransition(async () => {
      const result = await receiveProduction();
      if (result.success) {
        router.refresh();
        const msg = result.received.map((r) => `${r.itemName} ${r.amount}個`).join("、");
        setToastMessage(
          <>
            <span className="font-medium text-brass">受け取りました</span>
            <span className="block mt-1 text-text-muted">{msg}</span>
          </>
        );
        setToastOpen(true);
      } else {
        setToastMessage(
          <span className="text-error">{result.message}</span>
        );
        setToastOpen(true);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || !hasReceivable}
        className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
      >
        {isPending ? "受取中…" : "生産受取"}
      </button>
      <Toast
        open={toastOpen}
        message={toastMessage}
        duration={4500}
        onClose={() => setToastOpen(false)}
      />
    </>
  );
}
