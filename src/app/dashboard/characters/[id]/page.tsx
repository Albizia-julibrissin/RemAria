// spec/025, 030: キャラ詳細（基礎ステータス・工業スキル・仲間は解雇）

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getProtagonist } from "@/server/actions/protagonist";
import { characterRepository } from "@/server/repositories/character-repository";
import { DismissCompanionButton } from "./dismiss-companion-button";

const CATEGORY_LABEL: Record<string, string> = {
  protagonist: "主人公",
  companion: "仲間",
  mech: "メカ",
};

const BASE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK", "CAP"] as const;

function formatSkillEffect(effectType: string | null, effectValue: number | null): string {
  if (!effectType || effectValue == null) return "";
  if (effectType === "time_reduction") return `作業時間 ${effectValue}% 短縮`;
  if (effectType === "production_bonus") return `生産量 ${effectValue}% アップ`;
  return "";
}

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
  const character = await characterRepository.getCharacterWithSkillsForUser(id, session.userId);
  if (!character) notFound();

  const industrialSkills = character.characterSkills?.map((cs) => cs.skill).filter(Boolean) ?? [];

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-text-primary">
          {character.category === "protagonist" && protagonist ? protagonist.displayName : character.displayName}
        </h1>
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
              {BASE_STAT_KEYS.map((key) => (
                <div key={key} className="flex justify-between gap-2">
                  <dt className="text-text-muted">{key}</dt>
                  <dd className="font-medium text-text-primary tabular-nums">{character[key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {industrialSkills.length > 0 && (
          <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
            <h2 className="text-lg font-medium text-text-primary">工業スキル</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {industrialSkills.map((skill) => (
                <li key={skill.id} className="text-text-primary">
                  <span className="font-medium">{skill.name}</span>
                  {skill.description && <span className="text-text-muted"> — {skill.description}</span>}
                  {skill.effectType && skill.effectValue != null && (
                    <span className="text-text-muted">（{formatSkillEffect(skill.effectType, skill.effectValue)}）</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {character.category === "companion" && (
          <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
            <h2 className="text-lg font-medium text-text-primary">解雇</h2>
            <p className="mt-1 text-sm text-text-muted">仲間を解雇すると、このキャラと習得スキルは削除されます。</p>
            <DismissCompanionButton characterId={character.id} displayName={character.displayName} />
          </div>
        )}

        <p className="mt-8">
          <Link href="/dashboard/characters" className="text-brass hover:text-brass-hover text-sm">
            ← キャラ一覧へ
          </Link>
        </p>
      </div>
    </main>
  );
}
