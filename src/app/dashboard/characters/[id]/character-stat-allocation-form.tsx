"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { allocateCharacterStats } from "@/server/actions/character-stats";

const ALLOCATABLE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

type Props = {
  characterId: string;
  initialValues: Record<(typeof ALLOCATABLE_STAT_KEYS)[number], number>;
};

export function CharacterStatAllocationForm({ characterId, initialValues }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setIsPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(
      ALLOCATABLE_STAT_KEYS.map((key) => [key, Number(formData.get(key)) || 0])
    ) as Record<(typeof ALLOCATABLE_STAT_KEYS)[number], number>;

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
        合計が CAP と一致し、各ステータスが CAP の 10〜30% の範囲になるように入力してください。
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
        {ALLOCATABLE_STAT_KEYS.map((key) => (
          <label key={key} className="flex items-center justify-between gap-2">
            <span className="text-text-muted">{key}</span>
            <input
              type="number"
              name={key}
              defaultValue={initialValues[key]}
              className="w-20 rounded border border-base-border bg-base px-2 py-1 text-right text-sm text-text-primary"
              disabled={isPending}
            />
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 inline-flex items-center rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
      >
        {isPending ? "送信中…" : "この配分で確定"}
      </button>
    </form>
  );
}
