"use client";

// 戦闘スキル / 工業スキルをタブで切り替えて表示。作戦室のスキル一覧の見た目に寄せる（横長・カード並び）

import { useState } from "react";
import { BATTLE_SKILL_TYPE_LABELS } from "@/app/dashboard/tactics/tactics-constants";

type SkillForDisplay = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  effectType?: string | null;
  effectValue?: number | null;
  /** spec/052: スキルレベル。0=習得直後。 */
  level?: number;
  /** 作戦室と同様の表示用 */
  displayTags?: unknown;
  battleSkillType?: string | null;
  chargeCycles?: number | null;
  cooldownCycles?: number | null;
};

function formatIndustrialEffect(effectType: string | null, effectValue: number | null): string {
  if (!effectType || effectValue == null) return "";
  if (effectType === "time_reduction") return `作業時間 ${effectValue}% 短縮`;
  if (effectType === "production_bonus") return `生産量 ${effectValue}% アップ`;
  return "";
}

function displayTagsToArray(displayTags: unknown): string[] {
  if (Array.isArray(displayTags)) return displayTags.filter((t): t is string => typeof t === "string");
  return [];
}

export function CharacterSkillTabs({
  battleSkills,
  industrialSkills,
}: {
  battleSkills: SkillForDisplay[];
  industrialSkills: SkillForDisplay[];
}) {
  const [activeTab, setActiveTab] = useState<"battle" | "industrial">("battle");

  return (
    <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
      <div className="flex gap-2 border-b border-base-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("battle")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "battle"
              ? "bg-brass text-white"
              : "bg-base text-text-muted hover:bg-base-border hover:text-text-primary"
          }`}
        >
          戦闘スキル {battleSkills.length > 0 && `(${battleSkills.length})`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("industrial")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "industrial"
              ? "bg-brass text-white"
              : "bg-base text-text-muted hover:bg-base-border hover:text-text-primary"
          }`}
        >
          工業スキル {industrialSkills.length > 0 && `(${industrialSkills.length})`}
        </button>
      </div>

      {activeTab === "battle" && (
        <div className="mt-3">
          <h2 className="sr-only">戦闘スキル</h2>
          {battleSkills.length === 0 ? (
            <p className="text-sm text-text-muted">習得している戦闘スキルはありません。</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {battleSkills.map((s) => (
                <div key={s.id} className="flex gap-3 rounded border border-base-border bg-base px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-primary">{s.name}</span>
                      {s.level != null && (
                        <span className="inline-flex items-center rounded-full border border-base-border/60 bg-base px-2 py-0.5 text-2xs text-text-muted">
                          Lv{s.level}
                        </span>
                      )}
                      {s.battleSkillType && (
                        <span className="inline-flex items-center rounded-full border border-base-border bg-base px-2 py-0.5 text-2xs text-text-muted">
                          {BATTLE_SKILL_TYPE_LABELS[s.battleSkillType] ?? s.battleSkillType}
                        </span>
                      )}
                      {s.chargeCycles != null && (
                        <span className="inline-flex items-center rounded-full border border-base-border/60 bg-base px-2 py-0.5 text-2xs text-text-muted">
                          CT{s.chargeCycles}
                        </span>
                      )}
                      {s.cooldownCycles != null && (
                        <span className="inline-flex items-center rounded-full border border-base-border/60 bg-base px-2 py-0.5 text-2xs text-text-muted">
                          CD{s.cooldownCycles}
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-1 break-words text-xs text-text-muted">{s.description}</p>
                    )}
                    {displayTagsToArray(s.displayTags).length > 0 && (
                      <p className="mt-1 break-words text-[11px] text-text-muted">
                        {displayTagsToArray(s.displayTags).join(" ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "industrial" && (
        <div className="mt-3">
          <h2 className="sr-only">工業スキル</h2>
          {industrialSkills.length === 0 ? (
            <p className="text-sm text-text-muted">習得している工業スキルはありません。</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {industrialSkills.map((s) => (
                <div key={s.id} className="flex gap-3 rounded border border-base-border bg-base px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-text-primary">{s.name}</span>
                      {s.level != null && (
                        <span className="inline-flex items-center rounded-full border border-base-border/60 bg-base px-2 py-0.5 text-2xs text-text-muted">
                          Lv{s.level}
                        </span>
                      )}
                      {s.effectType != null && s.effectValue != null && (
                        <span className="inline-flex items-center rounded-full border border-base-border bg-base px-2 py-0.5 text-2xs text-text-muted">
                          {formatIndustrialEffect(s.effectType, s.effectValue)}
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-1 break-words text-xs text-text-muted">{s.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
