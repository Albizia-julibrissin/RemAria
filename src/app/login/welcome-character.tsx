"use client";

interface WelcomeCharacterProps {
  /** サーバーで選んだ1枚のアイコン（SSR/クライアントで同じになるようサーバーで決定） */
  iconFilename: string | null;
}

export function WelcomeCharacter({ iconFilename }: WelcomeCharacterProps) {
  if (!iconFilename) return null;
  return (
    <div className="flex justify-center mb-6">
      <img src={`/icons/${iconFilename}`} alt="" className="max-h-32 w-auto" />
    </div>
  );
}
