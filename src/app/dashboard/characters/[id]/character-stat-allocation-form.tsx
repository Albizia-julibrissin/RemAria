"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { allocateCharacterStats } from "@/server/actions/character-stats";

const ALLOCATABLE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

type Props = {
  characterId: string;
  cap: number;
  initialValues: Record<(typeof ALLOCATABLE_STAT_KEYS)[number], number>;
};

export function CharacterStatAllocationForm({ characterId, cap, initialValues }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const minPerStat = Math.floor(cap * 0.1);
  const maxPerStat = Math.floor(cap * 0.3);
  const total = ALLOCATABLE_STAT_KEYS.reduce((acc, key) => acc + values[key], 0);
  const canAddMore = total < cap;

  function handleIncrement(key: (typeof ALLOCATABLE_STAT_KEYS)[number]) {
    if (values[key] >= maxPerStat || total >= cap) return;
    setValues((prev) => ({ ...prev, [key]: prev[key] + 1 }));
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setIsPending(true);

    const result = await allocateCharacterStats({
      characterId,
      STR: values.STR,
      INT: values.INT,
      VIT: values.VIT,
      WIS: values.WIS,
      DEX: values.DEX,
      AGI: values.AGI,
      LUK: values.LUK,
    });

    setIsPending(false);
    if (result.success) {
      setMessage("保存しました。");
      setIsError(false);
      router.refresh();
    } else {
      setMessage(result.message);
      setIsError(true);
    }
  }

  return (
    <form
      className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6 space-y-4"
      onSubmit={handleSubmit}
    >
      <h2 className="text-lg font-medium text-text-primary">ステータス再配分（簡易版）</h2>
      <p className="mt-1 text-xs text-text-muted">
        各ステータスは「＋」で伸ばすだけです。合計が CAP を超えず、各ステは CAP の 30% まで。
      </p>

      <p className="text-sm font-medium text-text-primary tabular-nums" aria-live="polite">
        合計: {total} / {cap}
      </p>

      {message != null && (
        <p
          className={`text-sm ${isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
          role="alert"
        >
          {message}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {ALLOCATABLE_STAT_KEYS.map((key) => {
          const atMax = values[key] >= maxPerStat;
          const disabled = atMax || !canAddMore || isPending;
          return (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-text-muted">{key}</span>
              <div className="flex items-center gap-1">
                <span className="w-10 text-right font-medium tabular-nums text-text-primary">
                  {values[key]}
                </span>
                <button
                  type="button"
                  onClick={() => handleIncrement(key)}
                  disabled={disabled}
                  className="flex h-8 w-8 items-center justify-center rounded border border-base-border bg-base text-brass hover:border-brass hover:bg-base-elevated disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-base-border disabled:hover:bg-base"
                  aria-label={`${key}を1増やす`}
                >
                  <span className="text-lg font-bold leading-none">+</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={isPending || total !== cap}
        className="mt-4 inline-flex items-center rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
      >
        {isPending ? "送信中…" : "この配分で確定"}
      </button>
    </form>
  );
}
