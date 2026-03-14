// spec/025_character_list.md - キャラ一覧

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getProtagonist } from "@/server/actions/protagonist";
import { characterRepository } from "@/server/repositories/character-repository";
import { getRequiredExpForLevel } from "@/lib/level";
import { MenuPageHeaderClient } from "../menu-page-header-client";

const CATEGORY_ORDER = { protagonist: 0, companion: 1, mech: 2 } as const;
const CATEGORY_LABEL: Record<string, string> = {
  protagonist: "主人公",
  companion: "仲間",
  mech: "メカ",
};

function getCardClass(category: string): string {
  const base = "border border-base-border bg-base-elevated";
  if (category === "protagonist") return `${base} border-l-4 border-l-brass`;
  if (category === "companion") return `${base} border-l-4 border-l-success`;
  return `${base} border-l-4 border-l-base-border`;
}

export default async function CharactersListPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const protagonist = await getProtagonist();
  if (!protagonist) redirect("/character/create");

  const characters = await characterRepository.getCharactersByUserId(session.userId);
  const sorted = [...characters].sort(
    (a, b) =>
      (CATEGORY_ORDER[a.category as keyof typeof CATEGORY_ORDER] ?? 99) -
      (CATEGORY_ORDER[b.category as keyof typeof CATEGORY_ORDER] ?? 99)
  );

  const footerLinkClass =
    "inline-flex items-center justify-center rounded-lg border border-base-border bg-base-elevated px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-brass hover:bg-base focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base";

  return (
    <main className="min-h-screen bg-base p-8">
      <MenuPageHeaderClient
        title="居住区"
        description="キャラクター一覧・詳細"
        currentPath="/dashboard/characters"
      />
      {sorted.length === 0 ? (
        <p className="text-text-muted">キャラがいません。</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/characters/${c.id}`}
                className={`block rounded-lg p-4 transition-colors hover:border-brass focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${getCardClass(c.category)}`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded border border-base-border bg-base">
                    {c.iconFilename ? (
                      <img
                        src={`/icons/${c.iconFilename}`}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="h-full w-full bg-base-border" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">
                      {c.category === "protagonist" && protagonist ? protagonist.displayName : c.displayName}
                    </p>
                    <p className="text-sm text-text-muted">{CATEGORY_LABEL[c.category] ?? c.category}</p>
                  </div>
                  <div className="flex-shrink-0 text-right text-xs text-text-muted tabular-nums">
                    {c.category === "mech" ? (
                      <>Lv {c.level ?? 1}<br />経験値 — / —</>
                    ) : (
                      (() => {
                        const lv = c.level ?? 1;
                        const totalExp = c.experiencePoints ?? 0;
                        const currentLevelExp = getRequiredExpForLevel(lv);
                        const nextLevelExp = getRequiredExpForLevel(lv + 1);
                        const gainedInLevel = Math.max(0, totalExp - currentLevelExp);
                        const neededThisLevel = Math.max(1, nextLevelExp - currentLevelExp);
                        return (
                          <>Lv {lv}<br />経験値 {gainedInLevel.toLocaleString()} / {neededThisLevel.toLocaleString()}</>
                        );
                      })()
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <footer className="mt-8 border-t border-base-border pt-4">
        <Link href="/dashboard" className={footerLinkClass}>
          ← 開拓拠点に戻る
        </Link>
      </footer>
    </main>
  );
}
