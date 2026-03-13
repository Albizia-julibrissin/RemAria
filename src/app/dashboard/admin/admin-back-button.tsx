"use client";

import { useRouter } from "next/navigation";

/**
 * 管理画面用。「一個前の画面」に戻るボタン。
 * ダッシュボード直リンクをやめ、履歴の戻るで誤操作を防ぐ。
 */
export function AdminBackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
    >
      ← 戻る
    </button>
  );
}
