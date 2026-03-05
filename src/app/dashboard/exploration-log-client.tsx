"use client";

import { useState, useTransition } from "react";
import { continueExploration } from "@/server/actions/exploration";

type Props = {
  initialLogs: string[];
};

export function ExplorationLogClient({ initialLogs }: Props) {
  const [logs, setLogs] = useState<string[]>(initialLogs);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleNext = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await continueExploration();
      if (!result.success) {
        setMessage(`進行に失敗しました: ${result.message}`);
        return;
      }
      setLogs(result.logs);
    });
  };

  return (
    <div className="mt-4 rounded-lg border border-base-border bg-base-elevated p-4">
      <h3 className="text-sm font-medium text-text-muted">探索ログ（仮）</h3>
      <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-base-border bg-base px-2 py-2 text-xs text-text-muted space-y-1">
        {logs.length === 0 ? (
          <p className="text-xs text-text-muted">まだログはありません。</p>
        ) : (
          logs.map((line, idx) => (
            <p key={idx} className="whitespace-pre-wrap">
              {line}
            </p>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={handleNext}
        disabled={isPending}
        className="mt-3 inline-flex items-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-base shadow-sm disabled:bg-base-border disabled:text-text-muted"
      >
        {isPending ? "次のイベント処理中..." : "次へ"}
      </button>
      {message && <p className="mt-2 text-xs text-text-muted">{message}</p>}
    </div>
  );
}

