"use client";

// トースト通知：画面上に短時間表示して自動で消える（confirm/alert の代わりに使う）

import { useEffect } from "react";

type Props = {
  open: boolean;
  message: React.ReactNode;
  /** 自動で閉じるまでのミリ秒。0で自動クローズなし */
  duration?: number;
  onClose: () => void;
};

export function Toast({ open, message, duration = 4500, onClose }: Props) {
  useEffect(() => {
    if (!open || duration <= 0) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[200] w-[min(90vw,28rem)] -translate-x-1/2 overflow-hidden rounded-lg border border-base-border bg-base-elevated px-4 py-3 shadow-lg text-text-primary text-sm"
      role="status"
      aria-live="polite"
    >
      <style dangerouslySetInnerHTML={{ __html: `@keyframes toast-shrink { from { width: 100% } to { width: 0% } }` }} />
      {message}
      {duration > 0 && (
        <div
          className="absolute bottom-0 left-0 h-1 bg-brass"
          style={{ animation: `toast-shrink ${duration}ms linear forwards` }}
          aria-hidden
        />
      )}
    </div>
  );
}
