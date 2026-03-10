"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { advanceExplorationStep } from "@/server/actions/exploration";

type Props = {
  href?: string;
  /** true のとき「次へ」で advanceExplorationStep を呼びリダイレクト（059 案 B） */
  useAdvanceAction?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/** 探索画面の「次へ」用。押下後は一定時間無効にして連打を防ぎ、その後は再び押せるようにする */
export function ExplorationNextButton({
  href = "/battle/exploration",
  useAdvanceAction = false,
  className = "inline-flex items-center justify-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-brass-inverse hover:bg-brass-hover disabled:opacity-50 disabled:pointer-events-none",
  children = "次へ",
}: Props) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      if (useAdvanceAction) {
        await advanceExplorationStep();
        router.refresh();
        router.replace("/battle/exploration");
      } else {
        router.push(href);
      }
    } finally {
      timeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
        timeoutRef.current = null;
      }, 1500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isNavigating}
      className={className}
    >
      {isNavigating ? "移動中…" : children}
    </button>
  );
}
