"use client";

// キャラ詳細：アイコン表示と変更ボタン。押下でキャラ作成時と同様の選択モーダルを表示

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateCharacterIcon } from "@/server/actions/character-icon";

type Props = {
  characterId: string;
  currentIconFilename: string | null;
  iconFilenames: string[];
};

export function CharacterIconChange({
  characterId,
  currentIconFilename,
  iconFilenames,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const handleSelect = (filename: string) => {
    startTransition(async () => {
      const result = await updateCharacterIcon(characterId, filename);
      if (result.success) {
        setShowModal(false);
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) setShowModal(false);
  };

  return (
    <div className="flex flex-shrink-0 flex-col items-center gap-2">
      <div className="h-24 w-24 overflow-hidden rounded border border-base-border bg-base">
        {currentIconFilename ? (
          <img
            src={`/icons/${currentIconFilename}`}
            alt=""
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="h-full w-full bg-base-border" aria-hidden />
        )}
      </div>
      {iconFilenames.length > 0 && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={isPending}
          className="rounded border border-base-border bg-base px-2 py-1 text-xs text-text-muted hover:bg-base-border hover:text-text-primary disabled:opacity-50"
        >
          アイコン変更
        </button>
      )}

      {showModal && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="icon-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleOverlayClick}
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-lg border border-base-border bg-base-elevated shadow-lg flex flex-col">
            <div className="flex items-center justify-between border-b border-base-border px-4 py-3">
              <h2 id="icon-modal-title" className="text-lg font-medium text-text-primary">
                アイコンを選択
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded p-1 text-text-muted hover:bg-base-border hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {iconFilenames.length === 0 ? (
                <p className="text-sm text-text-muted">アイコンがありません。</p>
              ) : (
                <div className="flex flex-wrap gap-3" role="group" aria-label="アイコン選択">
                  {iconFilenames.map((filename) => (
                    <button
                      key={filename}
                      type="button"
                      onClick={() => handleSelect(filename)}
                      disabled={isPending}
                      className={`flex flex-col items-center gap-1 rounded p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50 ${
                        currentIconFilename === filename
                          ? "ring-2 ring-brass ring-offset-2 ring-offset-base bg-base-border/50"
                          : "hover:bg-base-border/50"
                      }`}
                    >
                      <img
                        src={`/icons/${filename}`}
                        alt=""
                        className="h-12 w-12 object-contain"
                        width={48}
                        height={48}
                      />
                      <span className="text-xs text-text-muted">{filename}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
