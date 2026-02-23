"use client";

import { useMemo } from "react";

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

interface WelcomeCharacterProps {
  /** public/icons から取得したアイコン一覧。増えた分も自動でランダムに含まれる */
  iconFilenames: string[];
}

export function WelcomeCharacter({ iconFilenames }: WelcomeCharacterProps) {
  const icon = useMemo(() => pickRandom(iconFilenames), [iconFilenames]);
  if (!icon) return null;
  return (
    <div className="flex justify-center mb-6">
      <img src={`/icons/${icon}`} alt="" className="max-h-32 w-auto" />
    </div>
  );
}
