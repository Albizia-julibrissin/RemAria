"use client";

import { useActionState } from "react";
import { createProtagonistAndRedirect, type CreateProtagonistResult } from "@/server/actions/protagonist";

async function submitAction(
  _prev: CreateProtagonistResult | null,
  formData: FormData
): Promise<CreateProtagonistResult | null> {
  return createProtagonistAndRedirect(formData);
}

interface CreateProtagonistFormProps {
  /** 登録時の名前（主人公の表示名として使用。spec/015） */
  userName: string;
  /** public/icons から取得したアイコン一覧（.gif）。追加はファイルを置くだけ */
  iconFilenames: string[];
}

export function CreateProtagonistForm({ userName, iconFilenames }: CreateProtagonistFormProps) {
  const [state, formAction] = useActionState(submitAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.success === false && (
        <p className="text-error text-sm" role="alert">
          {state.message}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-sm text-text-muted">名前</span>
        <p className="py-2 text-text-primary font-medium" aria-label="主人公の名前">
          {userName}
        </p>
        <p className="text-xs text-text-muted">登録時の名前が主人公の表示名として使われます。</p>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-text-muted">アイコン（必須）</span>
        {iconFilenames.length === 0 ? (
          <p className="text-sm text-text-muted">アイコンがありません。public/icons に .gif を配置してください。</p>
        ) : (
        <div className="flex flex-wrap gap-3" role="group" aria-label="アイコン選択">
          {iconFilenames.map((filename) => (
            <label
              key={filename}
              className="flex flex-col items-center gap-1 cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-brass has-[:checked]:ring-offset-2 has-[:checked]:ring-offset-base rounded p-2"
            >
              <input
                type="radio"
                name="iconFilename"
                value={filename}
                required
                className="sr-only"
              />
              <img
                src={`/icons/${filename}`}
                alt=""
                className="w-12 h-12 object-contain"
                width={48}
                height={48}
              />
              <span className="text-xs text-text-muted">{filename}</span>
            </label>
          ))}
        </div>
        )}
      </div>
      <button
        type="submit"
        disabled={iconFilenames.length === 0}
        className="mt-2 w-full bg-brass hover:bg-brass-hover text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        主人公を作成
      </button>
    </form>
  );
}
