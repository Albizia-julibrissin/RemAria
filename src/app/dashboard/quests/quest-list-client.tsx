"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeQuestReport } from "@/server/actions/quest";
import type { QuestListItem } from "@/server/actions/quest";
import { GameIcon } from "@/components/icons/game-icon";

type Props = {
  quests: QuestListItem[];
};

export function QuestListClient({ quests }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reportModal, setReportModal] = useState<{
    questId: string;
    questName: string;
    message: string | null;
  } | null>(null);

  const handleReportClick = (q: QuestListItem) => {
    if (q.state !== "completed" || q.reportAcknowledgedAt) return;
    setReportModal({
      questId: q.questId,
      questName: q.name,
      message: q.clearReportMessage,
    });
  };

  const handleConfirmReport = () => {
    if (!reportModal) return;
    startTransition(async () => {
      const res = await acknowledgeQuestReport(reportModal.questId);
      if (res.success) {
        setReportModal(null);
        router.refresh();
      }
    });
  };

  return (
    <>
      <ul className="space-y-4">
        {quests.map((q) => (
          <li
            key={q.questId}
            className="rounded-lg border border-base-border bg-base-elevated p-4"
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">
                {q.questType === "story" && (
                  <GameIcon name="book-cover" className="h-5 w-5 text-brass" />
                )}
                {q.questType === "research" && (
                  <GameIcon name="flask" className="h-5 w-5 text-brass" />
                )}
                {q.questType !== "story" && q.questType !== "research" && (
                  <GameIcon name="scroll-quill" className="h-5 w-5 text-text-muted" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-text-primary">{q.name}</h2>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      q.state === "completed"
                        ? q.reportAcknowledgedAt
                          ? "bg-green-900/40 text-green-200"
                          : "bg-amber-900/40 text-amber-200"
                        : "bg-base-border/50 text-text-muted"
                    }`}
                  >
                    {q.state === "completed"
                      ? q.reportAcknowledgedAt
                        ? "クリア済み"
                        : "報告待ち"
                      : "進行中"}
                  </span>
                </div>
                {q.description && (
                  <p className="mt-2 text-sm text-text-muted whitespace-pre-wrap">
                    {q.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="h-2 rounded-full bg-base-border overflow-hidden">
                      <div
                        className="h-full bg-brass transition-all"
                        style={{
                          width: `${q.targetCount > 0 ? Math.min(100, (q.progress / q.targetCount) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {q.progress} / {q.targetCount}
                    </p>
                  </div>
                  {q.state === "completed" && !q.reportAcknowledgedAt && (
                    <button
                      type="button"
                      onClick={() => handleReportClick(q)}
                      className="shrink-0 rounded bg-brass px-3 py-1.5 text-sm font-medium text-base hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
                    >
                      クリア報告
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* クリア報告モーダル */}
      {reportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
        >
          <div className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-xl">
            <h2 id="report-modal-title" className="text-lg font-semibold text-text-primary">
              クリア報告 — {reportModal.questName}
            </h2>
            <div className="mt-4 min-h-[4rem] rounded border border-base-border bg-base p-4">
              {reportModal.message ? (
                <p className="text-sm text-text-primary whitespace-pre-wrap">
                  {reportModal.message}
                </p>
              ) : (
                <p className="text-sm text-text-muted">クエストをクリアしました。</p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleConfirmReport}
                disabled={isPending}
                className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
              >
                {isPending ? "反映中…" : "確認"}
              </button>
              <button
                type="button"
                onClick={() => setReportModal(null)}
                disabled={isPending}
                className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border/50 focus:outline-none focus:ring-2 focus:ring-brass disabled:opacity-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
