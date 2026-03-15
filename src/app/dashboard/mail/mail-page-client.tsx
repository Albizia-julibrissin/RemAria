"use client";

// spec/090: 郵便画面。左リスト・右詳細・受取。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getMailDetail,
  markMailRead,
  receiveMail,
  type MailListItem,
  type MailDetail,
} from "@/server/actions/mail";
import { GameIcon } from "@/components/icons/game-icon";

type Props = {
  items: MailListItem[];
};

function formatDate(d: Date) {
  return new Date(d).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MailPageClient({ items: initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [receivePending, startReceiveTransition] = useTransition();

  const loadDetail = async (userMailId: string) => {
    setSelectedId(userMailId);
    setLoadingDetail(true);
    setDetail(null);
    const res = await getMailDetail(userMailId);
    setLoadingDetail(false);
    if (res.success) {
      setDetail(res.mail);
      if (!res.mail.readAt) {
        await markMailRead(userMailId);
        router.refresh();
      }
    }
  };

  const handleReceive = () => {
    if (!selectedId || !detail?.canReceive) return;
    startReceiveTransition(async () => {
      const res = await receiveMail(selectedId);
      if (res.success) {
        setItems((prev) =>
          prev.map((m) =>
            m.id === selectedId ? { ...m, receivedAt: new Date(), hasReward: false } : m
          )
        );
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                receivedAt: new Date(),
                canReceive: false,
              }
            : null
        );
        router.refresh();
      }
    });
  };

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
      {/* 左: 郵便リスト */}
      <section
        className="rounded-lg border border-base-border bg-base-elevated md:col-span-1"
        aria-label="郵便一覧"
      >
        <div className="max-h-[70vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-text-muted">郵便はありません</p>
          ) : (
            <ul className="space-y-1">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => loadDetail(m.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === m.id
                        ? "bg-brass/20 text-brass border border-brass/40"
                        : "border border-transparent hover:bg-base text-text-primary"
                    } ${!m.readAt ? "font-semibold" : ""}`}
                  >
                    <span className="line-clamp-1">{m.title}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {formatDate(m.createdAt)}
                      {m.hasReward && !m.receivedAt && (
                        <span className="ml-1 text-brass">（付与あり）</span>
                      )}
                      {m.receivedAt && (
                        <span className="ml-1 text-text-muted">受取済み</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 右: 選択した郵便の内容 */}
      <section
        className="rounded-lg border border-base-border bg-base-elevated p-4 md:col-span-2"
        aria-label="郵便内容"
      >
        {!selectedId ? (
          <p className="text-text-muted">郵便を選択してください</p>
        ) : loadingDetail ? (
          <p className="text-text-muted">読み込み中…</p>
        ) : detail ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{detail.title}</h2>
              <p className="mt-1 text-xs text-text-muted">
                {formatDate(detail.createdAt)}
                {detail.expiresAt && (
                  <span className="ml-2">
                    受取期限: {formatDate(detail.expiresAt)}
                  </span>
                )}
              </p>
            </div>
            {detail.body && (
              <div className="whitespace-pre-wrap rounded border border-base-border bg-base p-3 text-sm text-text-primary">
                {detail.body}
              </div>
            )}

            {/* 添付（付与物） */}
            {(detail.reward.graFree > 0 ||
              detail.reward.graPaid > 0 ||
              detail.reward.researchPoint > 0 ||
              detail.reward.items.length > 0 ||
              detail.reward.titles.length > 0) && (
              <div className="rounded border border-base-border bg-base p-3">
                <h3 className="mb-2 text-sm font-medium text-text-muted">添付</h3>
                <ul className="space-y-1 text-sm">
                  {detail.reward.graFree > 0 && (
                    <li className="flex items-center gap-2">
                      <GameIcon name="coins" className="h-4 w-4 text-brass" />
                      無償 GRA × {detail.reward.graFree}
                    </li>
                  )}
                  {detail.reward.graPaid > 0 && (
                    <li className="flex items-center gap-2">
                      <GameIcon name="gem" className="h-4 w-4 text-brass" />
                      有償 GRA × {detail.reward.graPaid}
                    </li>
                  )}
                  {detail.reward.researchPoint > 0 && (
                    <li className="flex items-center gap-2">
                      <GameIcon name="book-cover" className="h-4 w-4" />
                      研究記録書 × {detail.reward.researchPoint}
                    </li>
                  )}
                  {detail.reward.items.map((it) => (
                    <li key={it.itemId} className="flex items-center gap-2">
                      <GameIcon name="backpack" className="h-4 w-4" />
                      {it.name} × {it.amount}
                    </li>
                  ))}
                  {detail.reward.titles.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <GameIcon name="medal" className="h-4 w-4" />
                      称号: {t.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.isExpired && (
              <p className="text-sm text-text-muted">受取期限を過ぎています</p>
            )}
            {detail.canReceive && (
              <button
                type="button"
                onClick={handleReceive}
                disabled={receivePending}
                className="inline-flex items-center gap-2 rounded-lg border border-brass bg-brass/20 px-4 py-2 text-sm font-medium text-brass hover:bg-brass/30 disabled:opacity-50"
              >
                <GameIcon name="gift" className="h-4 w-4" />
                {receivePending ? "受け取り中…" : "受け取る"}
              </button>
            )}
            {detail.receivedAt && !detail.canReceive && (
              <p className="text-sm text-text-muted">受取済みです</p>
            )}
          </div>
        ) : (
          <p className="text-text-muted">読み込みに失敗しました</p>
        )}
      </section>
    </div>
  );
}
