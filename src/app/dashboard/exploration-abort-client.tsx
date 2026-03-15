"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { abortCurrentExpedition } from "@/server/actions/exploration";

export function ExplorationAbortClient() {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleAbort = () => {
    startTransition(async () => {
      const result = await abortCurrentExpedition();
      if (!result.success) {
        alert("探索からの撤退に失敗しました。");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md border border-red-700/60 px-4 py-2 text-xs sm:text-sm font-medium text-red-200 bg-red-900/40 hover:bg-red-900/60 transition-colors disabled:opacity-60"
      >
        {isPending ? "撤退処理中…" : "探索から撤退"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-base-border bg-base-elevated p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-text-primary">本当に撤退しますか？</h2>
            <p className="mt-2 text-xs text-text-muted">
              撤退すると報酬は一切得られません。
            </p>
            <p className="mt-1 text-xs text-text-muted">
              消費した資源は戻りません。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-md border border-base-border px-3 py-1.5 text-xs sm:text-sm text-text-primary hover:bg-base"
              >
                中止
              </button>
              <button
                type="button"
                onClick={handleAbort}
                disabled={isPending}
                className="rounded-md bg-red-700 px-3 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
              >
                {isPending ? "撤退中…" : "撤退する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

