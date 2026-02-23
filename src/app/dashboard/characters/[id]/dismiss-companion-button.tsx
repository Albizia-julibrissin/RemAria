"use client";

// spec/030: 仲間解雇（表示名入力で確認）

import { useState, useTransition } from "react";
import { dismissCompanionAction } from "@/server/actions/recruit";

type Props = {
  characterId: string;
  displayName: string;
};

export function DismissCompanionButton({ characterId, displayName }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDismiss() {
    if (confirmName.trim() !== displayName.trim()) {
      setError("表示名が一致しません。削除できませんでした。");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await dismissCompanionAction(characterId, confirmName.trim());
      if (!result.success) setError(result.message);
    });
  }

  if (!showConfirm) {
    return (
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="mt-4 rounded border border-error bg-transparent text-error hover:bg-error/10 font-medium py-2 px-4 transition-colors text-sm"
      >
        解雇する
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg border border-base-border bg-base-elevated">
      <p className="text-sm text-text-muted mb-2">
        解雇するには、このキャラの表示名「<strong className="text-text-primary">{displayName}</strong>」を入力してください。
      </p>
      <input
        type="text"
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        placeholder="表示名を入力"
        className="w-full bg-base border border-base-border rounded px-3 py-2 text-text-primary text-sm mb-2"
        aria-label="確認用表示名"
      />
      {error && <p className="text-error text-sm mb-2" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          className="rounded border border-error bg-error/20 text-error hover:bg-error/30 font-medium py-2 px-4 text-sm disabled:opacity-50 transition-colors"
        >
          {isPending ? "処理中…" : "解雇する"}
        </button>
        <button
          type="button"
          onClick={() => { setShowConfirm(false); setConfirmName(""); setError(null); }}
          disabled={isPending}
          className="rounded border border-base-border bg-base-elevated text-text-primary font-medium py-2 px-4 text-sm disabled:opacity-50 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
