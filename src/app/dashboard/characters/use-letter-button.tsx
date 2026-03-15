"use client";

// spec/030: 推薦紹介状を使うボタン。押したらモーダルで所持枚数・仲間数表示、雇用ボタンで作成画面へ

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type RecruitState = {
  companionCount: number;
  companionMaxCount: number;
  letterOfRecommendationCount: number;
};

type Props = {
  recruitState: RecruitState;
};

export function UseLetterButton({ recruitState }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const canCreate =
    recruitState.letterOfRecommendationCount >= 1 &&
    recruitState.companionCount < recruitState.companionMaxCount;

  const goToCreate = () => {
    setOpen(false);
    router.push("/dashboard/characters/create");
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center justify-center rounded-lg bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
      >
        推薦紹介状
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="use-letter-modal-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-base-border bg-base-elevated p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="use-letter-modal-title" className="text-lg font-medium text-text-primary">
              推薦紹介状
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">所持枚数</dt>
                <dd className="tabular-nums font-medium text-text-primary">
                  {recruitState.letterOfRecommendationCount} 枚
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">仲間の雇用数</dt>
                <dd className="tabular-nums font-medium text-text-primary">
                  {recruitState.companionCount} / {recruitState.companionMaxCount}
                </dd>
              </div>
            </dl>
            {recruitState.letterOfRecommendationCount < 1 && (
              <p className="mt-3 text-sm text-text-muted">
                闇市で購入できます。{" "}
                <Link
                  href="/dashboard/underground-market"
                  className="text-brass hover:text-brass-hover underline"
                >
                  闇市へ
                </Link>
              </p>
            )}
            {recruitState.companionCount >= recruitState.companionMaxCount && (
              <p className="mt-3 text-sm text-text-muted">
                仲間は最大{recruitState.companionMaxCount}体までです。
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border/50"
              >
                中止
              </button>
              <button
                type="button"
                onClick={goToCreate}
                disabled={!canCreate}
                className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                雇用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
