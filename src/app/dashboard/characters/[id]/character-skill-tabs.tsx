"use client";

// 戦闘スキル / 工業スキルをタブで切り替えて表示

import { useState } from "react";

type SkillForDisplay = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  effectType?: string | null;
  effectValue?: number | null;
};

function formatIndustrialEffect(effectType: string | null, effectValue: number | null): string {
  if (!effectType || effectValue == null) return "";
  if (effectType === "time_reduction") return `作業時間 ${effectValue}% 短縮`;
  if (effectType === "production_bonus") return `生産量 ${effectValue}% アップ`;
  return "";
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
            <ul className="space-y-2 text-sm">
              {battleSkills.map((skill) => (
                <li key={skill.id} className="text-text-primary">
                  <span className="font-medium">{skill.name}</span>
                  {skill.description && (
                    <span className="text-text-muted"> — {skill.description}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "industrial" && (
        <div className="mt-3">
          <h2 className="sr-only">工業スキル</h2>
          {industrialSkills.length === 0 ? (
            <p className="text-sm text-text-muted">習得している工業スキルはありません。</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {industrialSkills.map((skill) => (
                <li key={skill.id} className="text-text-primary">
                  <span className="font-medium">{skill.name}</span>
                  {skill.description && (
                    <span className="text-text-muted"> — {skill.description}</span>
                  )}
                  {skill.effectType != null && skill.effectValue != null && (
                    <span className="text-text-muted">
                      （{formatIndustrialEffect(skill.effectType, skill.effectValue)}）
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
