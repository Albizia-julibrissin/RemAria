"use client";

// docs/066: 通知一覧ドロップダウン。開いたときに一覧取得、クリックで既読＋任意でリンク遷移。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getNotificationList,
  markNotificationAsRead,
  type NotificationRow,
} from "@/server/actions/notification";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function NotificationDropdown({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getNotificationList()
      .then((res) => {
        if (res.success) setItems(res.items);
        else setItems([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleClick = async (n: NotificationRow) => {
    await markNotificationAsRead(n.id);
    onClose();
    router.refresh();
    if (n.linkUrl) {
      router.push(n.linkUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed left-4 right-4 top-14 z-50 max-h-[70vh] overflow-auto rounded-md border border-base-border bg-base-elevated shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-h-[70vh]"
      aria-label="通知一覧"
    >
      <div className="p-2 border-b border-base-border text-xs text-text-muted">
        通知
      </div>
      <div className="max-h-[60vh] overflow-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-text-muted">読み込み中…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-sm text-text-muted">通知はありません</div>
        ) : (
          <ul className="divide-y divide-base-border">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-base transition-colors rounded-none"
                >
                  <span className={n.readAt ? "text-text-muted" : "text-text-primary font-medium"}>
                    {n.title}
                  </span>
                  {n.body && (
                    <p className="mt-0.5 text-xs text-text-muted line-clamp-2">{n.body}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
