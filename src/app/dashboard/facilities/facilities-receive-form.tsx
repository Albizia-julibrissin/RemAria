"use client";

// docs/019 - 受け取りボタンと結果表示

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ReceiveProductionResult } from "@/server/actions/receive-production";

type ReceiveProductionAction = (formData: FormData) => Promise<ReceiveProductionResult>;

type Props = {
  facilityInstanceId: string;
  facilityName: string;
  receivableCycles: number;
  receivableOutputAmount: number;
  outputItemName: string | undefined;
  receiveAction: ReceiveProductionAction;
};

export function FacilitiesReceiveForm({
  facilityInstanceId,
  facilityName,
  receivableCycles,
  receivableOutputAmount,
  outputItemName,
  receiveAction,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("facilityInstanceId", facilityInstanceId);
    startTransition(async () => {
      const result = await receiveAction(formData);
      if (result.success) {
        router.refresh();
        alert(`${facilityName}: ${result.outputItemName} ${result.outputAmount}個 を受け取りました。`);
      } else {
        alert(result.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex-shrink-0">
      <input type="hidden" name="facilityInstanceId" value={facilityInstanceId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
      >
        {isPending ? "受け取り中…" : "受け取り"}
      </button>
    </form>
  );
}
