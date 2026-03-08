"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  href: string;
  className?: string;
  children?: React.ReactNode;
};

/** 探索画面の「次へ」用。押下後に無効化して連打を防ぐ */
export function ExplorationNextButton({
  href,
  className = "inline-flex items-center justify-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-brass-inverse hover:bg-brass-hover disabled:opacity-50 disabled:pointer-events-none",
  children = "次へ",
}: Props) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(href);
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
