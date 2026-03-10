"use client";

// spec/039: 新規プリセット作成。上限時はボタン無効・メッセージ表示。失敗時にメッセージを表示する。

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createPartyPreset, type CreatePartyPresetResult } from "@/server/actions/tactics";

type CreatePresetFormProps = {
  presetCount: number;
  presetLimit: number;
};

// useActionState の action は (prevState, formData) を受け取るが本アクションでは未使用
async function submitAction(
  _prev: CreatePartyPresetResult | null,
  _formData: FormData
): Promise<CreatePartyPresetResult | null> {
  return createPartyPreset();
}

export function CreatePresetForm({ presetCount, presetLimit }: CreatePresetFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitAction, null);

  const atLimit = presetCount >= presetLimit;

  if (state?.success === true) {
    router.push(`/dashboard/tactics?presetId=${state.presetId}`);
    return null;
  }

  return (
    <form action={formAction} className="mt-4">
      <button
        type="submit"
        disabled={isPending || atLimit}
        className="rounded bg-brass px-4 py-2 text-white font-medium hover:bg-brass-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
      >
        {isPending ? "作成中…" : "新規プリセット作成"}
      </button>
      {atLimit && (
        <p className="mt-3 text-text-muted text-sm" role="status">
          プリセットは{presetLimit}件までです。
        </p>
      )}
      {state?.success === false && (
        <p className="mt-3 text-error text-sm" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
