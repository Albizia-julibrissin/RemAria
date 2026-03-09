"use client";

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getRequiredExpForLevel } from "@/lib/level";
import { GraDisplay } from "@/components/currency/gra-display";

type CharacterSummary = {
  id: string;
  category: "protagonist" | "companion";
  displayName: string;
  iconFilename: string | null;
  level: number | null;
  experiencePoints: number | null;
};

interface CharacterSummaryCardProps {
  characters: CharacterSummary[];
  balances?: { premiumFree: number; premiumPaid: number } | null;
}

export function CharacterSummaryCard({ characters, balances }: CharacterSummaryCardProps) {
  const options = useMemo(
    () =>
      characters.filter((c) => c.category === "protagonist" || c.category === "companion"),
    [characters]
  );

  const defaultId =
    options.find((c) => c.category === "protagonist")?.id ?? options[0]?.id ?? null;

  const [selectedId, setSelectedId] = useState<string | null>(defaultId);

  if (!options.length || !selectedId) return null;

  const selected = options.find((c) => c.id === selectedId) ?? options[0]!;

  const level = selected.level ?? 1;
  const totalExp = selected.experiencePoints ?? 0;
  const currentLevelExp = getRequiredExpForLevel(level);
  const nextLevelExp = getRequiredExpForLevel(level + 1);
  const gainedInLevel = Math.max(0, totalExp - currentLevelExp);
  const neededThisLevel = Math.max(1, nextLevelExp - currentLevelExp);
  const ratio = Math.max(0, Math.min(1, gainedInLevel / neededThisLevel));

  return (
    <section className="rounded-lg border border-base-border bg-base-elevated p-4 max-w-md">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded border border-base-border bg-base">
          {selected.iconFilename ? (
            <img
              src={`/icons/${selected.iconFilename}`}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="h-full w-full bg-base-border" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <select
              id="dashboard-character-summary-select"
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="w-full max-w-[9rem] rounded-md border border-base-border bg-base px-2 py-1 text-xs text-text-primary"
            >
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
            <div className="hidden sm:flex items-center gap-2">
              {balances && (
                <GraDisplay
                  free={balances.premiumFree}
                  paid={balances.premiumPaid}
                  compact
                  showLabel={false}
                />
              )}
              <Link
                href={`/dashboard/characters/${selected.id}`}
                title="このキャラの詳細を照会"
                className="inline-flex items-center justify-center rounded-md border border-base-border px-2 py-1 text-[11px] text-text-muted hover:border-brass hover:text-brass"
              >
                照会
              </Link>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-text-muted truncate">
            Lv {level}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>経験値</span>
          <span className="tabular-nums">
            {gainedInLevel.toLocaleString()} / {neededThisLevel.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-base-border overflow-hidden">
          <div
            className="h-full bg-brass transition-[width]"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>

    </section>
  );
}

