"use client";

// spec/030: 仲間作成フォーム（名前・アイコン）。雇用可能回数を 1 消費し、工業スキルをランダム 1 つ付与

import { useActionState } from "react";
import { createCompanion, type CreateCompanionResult } from "@/server/actions/recruit";

async function submitAction(
  _prev: CreateCompanionResult | null,
  formData: FormData
): Promise<CreateCompanionResult | null> {
  return createCompanion(formData);
}

interface CreateCompanionFormProps {
  iconFilenames: string[];
}

export function CreateCompanionForm({ iconFilenames }: CreateCompanionFormProps) {
  const [state, formAction] = useActionState(submitAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.success === false && (
        <p className="text-error text-sm" role="alert">
          {state.message}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="displayName" className="text-sm text-text-muted">
          表示名（必須）
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          maxLength={50}
          autoComplete="name"
          className="w-full bg-base border border-base-border rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          placeholder="仲間の名前"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-text-muted">アイコン（必須）</span>
        {iconFilenames.length === 0 ? (
          <p className="text-sm text-text-muted">アイコンがありません。</p>
        ) : (
          <div className="flex flex-wrap gap-3" role="group" aria-label="アイコン選択">
            {iconFilenames.map((filename) => (
              <label
                key={filename}
                className="flex flex-col items-center gap-1 cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-brass rounded p-2"
              >
                <input type="radio" name="iconFilename" value={filename} required className="sr-only" />
                <img src={`/icons/${filename}`} alt="" className="w-12 h-12 object-contain" width={48} height={48} />
                <span className="text-xs text-text-muted">{filename}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={iconFilenames.length === 0}
        className="w-full bg-brass hover:bg-brass-hover text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        雇う（雇用可能回数を 1 消費）
      </button>
    </form>
  );
}
