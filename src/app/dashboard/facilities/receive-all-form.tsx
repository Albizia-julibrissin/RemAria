"use client";

// spec/036, docs/019 - 全設備一括受け取りボタン

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { receiveProduction } from "@/server/actions/receive-production";

type Props = { hasReceivable: boolean };

export function ReceiveAllForm({ hasReceivable }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await receiveProduction();
      if (result.success) {
        router.refresh();
        const msg = result.received.map((r) => `${r.itemName} ${r.amount}個`).join("、");
        alert(`受け取りました: ${msg}`);
      } else {
        alert(result.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending || !hasReceivable}
      className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
    >
      {isPending ? "受け取り中…" : "全設備の生産を受け取る"}
    </button>
  );
}
