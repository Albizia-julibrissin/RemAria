"use client";

// spec/047 - 設備解体ボタン（確認はモーダル表示）

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dismantleFacility } from "@/server/actions/facilities-placement";

type Props = {
  facilityInstanceId: string;
  facilityName: string;
};

export function DismantleFacilityButton({ facilityInstanceId, facilityName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);

  function handleConfirm() {
    setModalOpen(false);
    startTransition(async () => {
      const result = await dismantleFacility(facilityInstanceId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={isPending}
        className="rounded border border-red-500/50 bg-transparent px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-red-500"
      >
        {isPending ? "解体中…" : "解体"}
      </button>
      {modalOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dismantle-modal-title"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg">
            <h3 id="dismantle-modal-title" className="text-lg font-medium text-text-primary">
              設備の解体
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              「{facilityName}」を解体しますか？ 消費した資源は返却されません。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded border border-base-border bg-base px-3 py-2 text-sm text-text-primary hover:bg-base-elevated focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-base"
              >
                {isPending ? "解体中…" : "解体する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
