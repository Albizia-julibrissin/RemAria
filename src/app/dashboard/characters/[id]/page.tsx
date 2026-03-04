// spec/025, 030, 046: キャラ詳細（基礎ステータス・工業スキル・装備着脱・仲間は解雇）

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getProtagonist } from "@/server/actions/protagonist";
import { characterRepository } from "@/server/repositories/character-repository";
import {
  getCharacterEquipment,
  getEquipmentInstancesWithEquipped,
} from "@/server/actions/craft";
import {
  getMechaEquipment,
  getMechaPartInstancesWithEquipped,
} from "@/server/actions/mecha-equipment";
import { DismissCompanionButton } from "./dismiss-companion-button";
import { CharacterEquipmentSection } from "./character-equipment-section";
import { MechaEquipmentSection } from "./mecha-equipment-section";
import { allocateCharacterStats } from "@/server/actions/character-stats";

const CATEGORY_LABEL: Record<string, string> = {
  protagonist: "主人公",
  companion: "仲間",
  mech: "メカ",
};

const BASE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK", "CAP"] as const;
const ALLOCATABLE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

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

  const canEquip = character.category === "protagonist" || character.category === "companion";
  const isMech = character.category === "mech";
  const [characterEquipment, allEquipment, mechaEquipment, allMechaParts] = await Promise.all([
    canEquip ? getCharacterEquipment(character.id) : null,
    canEquip ? getEquipmentInstancesWithEquipped() : null,
    isMech ? getMechaEquipment(character.id) : null,
    isMech ? getMechaPartInstancesWithEquipped() : null,
  ]);

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

        {!isMech && (
          <form
            className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6 space-y-4"
            action={async (formData) => {
              "use server";
              const values: Record<string, number> = {};
              for (const key of ALLOCATABLE_STAT_KEYS) {
                const raw = formData.get(key);
                values[key] = raw != null ? Number(raw) || 0 : 0;
              }
              const result = await allocateCharacterStats({
                characterId: character.id,
                STR: values.STR,
                INT: values.INT,
                VIT: values.VIT,
                WIS: values.WIS,
                DEX: values.DEX,
                AGI: values.AGI,
                LUK: values.LUK,
              });
              if (!result.success) {
                // 暫定実装: サーバ側にだけエラーを出しておく（UI 表示は後で拡張）。
                // eslint-disable-next-line no-console
                console.error("allocateCharacterStats error", result);
              }
            }}
          >
            <h2 className="text-lg font-medium text-text-primary">ステータス再配分（簡易版）</h2>
            <p className="mt-1 text-xs text-text-muted">
              合計が CAP を超えない範囲で、各ステータスが CAP の 5〜30% の範囲になるように入力してください。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {ALLOCATABLE_STAT_KEYS.map((key) => (
                <label key={key} className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">{key}</span>
                  <input
                    type="number"
                    name={key}
                    defaultValue={character[key]}
                    className="w-20 rounded border border-base-border bg-base px-2 py-1 text-right text-sm text-text-primary"
                  />
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="mt-4 inline-flex items-center rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover"
            >
              この配分で確定
            </button>
          </form>
        )}

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

        {canEquip && characterEquipment && allEquipment && (
          <CharacterEquipmentSection
            characterId={character.id}
            slots={characterEquipment.slots}
            allEquipment={allEquipment}
          />
        )}

        {isMech && mechaEquipment && allMechaParts && (
          <MechaEquipmentSection
            characterId={character.id}
            slots={mechaEquipment.slots}
            allParts={allMechaParts}
          />
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
