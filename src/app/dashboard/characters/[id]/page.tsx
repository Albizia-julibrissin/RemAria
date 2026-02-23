// spec/025_character_list.md - キャラ詳細（基礎ステータスのみ）

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getProtagonist } from "@/server/actions/protagonist";
import { characterRepository } from "@/server/repositories/character-repository";

const CATEGORY_LABEL: Record<string, string> = {
  protagonist: "主人公",
  companion: "仲間",
  mech: "メカ",
};

const STAT_LABELS: Record<string, string> = {
  STR: "筋力",
  INT: "知力",
  DEX: "敏捷",
  VIT: "体力",
  SPD: "速度",
  LUK: "運",
  CAP: "CAP",
};

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const protagonist = await getProtagonist();
  if (!protagonist) redirect("/character/create");

  const { id } = await params;
  const character = await characterRepository.getCharacterByIdForUser(id, session.userId);
  if (!character) notFound();

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-text-primary">{character.displayName}</h1>
        <p className="mt-1 text-sm text-text-muted">{CATEGORY_LABEL[character.category] ?? character.category}</p>

        <div className="mt-6 flex items-start gap-6 rounded-lg border border-base-border bg-base-elevated p-6">
          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded border border-base-border bg-base">
            {character.iconFilename ? (
              <img
                src={`/icons/${character.iconFilename}`}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="h-full w-full bg-base-border" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium text-text-primary">基礎ステータス</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {(["STR", "INT", "DEX", "VIT", "SPD", "LUK", "CAP"] as const).map((key) => (
                <div key={key} className="flex justify-between gap-2">
                  <dt className="text-text-muted">{STAT_LABELS[key]}</dt>
                  <dd className="font-medium text-text-primary tabular-nums">{character[key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <p className="mt-8">
          <Link href="/dashboard/characters" className="text-brass hover:text-brass-hover text-sm">
            ← キャラ一覧へ
          </Link>
        </p>
      </div>
    </main>
  );
}
