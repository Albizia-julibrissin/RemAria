"use client";

// 戦闘スキル / 工業スキルをタブで切り替えて表示。作戦室のスキル一覧の見た目に寄せる（横長・カード並び）
// spec/052 - 習得ボタンで物資庫へ、レベルアップボタンで分析書消費モーダル

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BATTLE_SKILL_TYPE_LABELS } from "@/app/dashboard/tactics/tactics-constants";
import {
  getSkillBookLevelUpInfo,
  consumeSkillBook,
} from "@/server/actions/inventory";
import { SKILL_LEVEL_CAP } from "@/lib/battle/battle-constants";

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

type LevelUpModalInfo = {
  itemId: string;
  itemName: string;
  currentLevel: number;
  booksRequiredForNextLevel: number;
  userQuantity: number;
  isMaxLevel: boolean;
};

export function CharacterSkillTabs({
  characterId,
  battleSkills,
  industrialSkills,
}: {
  characterId: string;
  battleSkills: SkillForDisplay[];
  industrialSkills: SkillForDisplay[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"battle" | "industrial">("battle");
  const [levelUpModal, setLevelUpModal] = useState<{
    skillId: string;
    skillName: string;
  } | null>(null);
  const [modalInfo, setModalInfo] = useState<LevelUpModalInfo | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [using, setUsing] = useState(false);

  useEffect(() => {
    if (!levelUpModal) {
      setModalInfo(null);
      setModalError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setModalError(null);
    getSkillBookLevelUpInfo(characterId, levelUpModal.skillId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success) {
        setModalInfo(res);
        setModalQuantity(res.booksRequiredForNextLevel);
      } else {
        setModalError(res.error);
        setModalInfo(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [characterId, levelUpModal?.skillId, levelUpModal?.skillName]);

  const handleLevelUpSubmit = async () => {
    if (!modalInfo || !levelUpModal) return;
    if (modalQuantity < modalInfo.booksRequiredForNextLevel) {
      setModalError(
        `次のレベルまでに${modalInfo.booksRequiredForNextLevel}冊必要です。`
      );
      return;
    }
    if (modalQuantity > modalInfo.userQuantity) {
      setModalError(`所持数は${modalInfo.userQuantity}冊です。`);
      return;
    }
    setUsing(true);
    setModalError(null);
    const result = await consumeSkillBook(modalInfo.itemId, characterId);
    setUsing(false);
    if (result.success) {
      setLevelUpModal(null);
      router.refresh();
    } else {
      setModalError(result.error);
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-border pb-2">
        <div className="flex gap-2">
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
        <Link
          href="/dashboard/bag?tab=skill_book"
          className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base-elevated"
        >
          習得
        </Link>
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
                        <span className="inline-flex items-center rounded-full border border-base-border/60 bg-base px-2 py-0.5 text-2xs">
                          <span className="text-text-muted">Lv</span>
                          <span className="text-success">{s.level}</span>
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
                    {displayTagsToArray(s.displayTags).length > 0 && (
                      <p className="mt-1 break-words text-[11px] text-text-muted">
                        {displayTagsToArray(s.displayTags).join(" ")}
                      </p>
                    )}
                    {s.description && (
                      <p className="mt-1 break-words text-xs text-text-muted">{s.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {s.level != null && s.level >= SKILL_LEVEL_CAP ? (
                      <span className="rounded border border-base-border bg-base px-2 py-1 text-xs text-text-muted">
                        最大レベル
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setLevelUpModal({ skillId: s.id, skillName: s.name })
                        }
                        className="rounded border border-brass bg-brass/20 px-2 py-1 text-xs font-medium text-brass hover:bg-brass/30 focus:outline-none focus:ring-2 focus:ring-brass"
                      >
                        レベルアップ
                      </button>
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
                        <span className="inline-flex items-center rounded-full border border-base-border/60 bg-base px-2 py-0.5 text-2xs">
                          <span className="text-text-muted">Lv</span>
                          <span className="text-success">{s.level}</span>
                        </span>
                      )}
                      {s.effectType != null && s.effectValue != null && (
                        <span className="inline-flex items-center rounded-full border border-base-border bg-base px-2 py-0.5 text-2xs text-text-muted">
                          {formatIndustrialEffect(s.effectType, s.effectValue)}
                        </span>
                      )}
                    </div>
                    {displayTagsToArray(s.displayTags).length > 0 && (
                      <p className="mt-1 break-words text-[11px] text-text-muted">
                        {displayTagsToArray(s.displayTags).join(" ")}
                      </p>
                    )}
                    {s.description && (
                      <p className="mt-1 break-words text-xs text-text-muted">{s.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {s.level != null && s.level >= SKILL_LEVEL_CAP ? (
                      <span className="rounded border border-base-border bg-base px-2 py-1 text-xs text-text-muted">
                        最大レベル
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setLevelUpModal({ skillId: s.id, skillName: s.name })
                        }
                        className="rounded border border-brass bg-brass/20 px-2 py-1 text-xs font-medium text-brass hover:bg-brass/30 focus:outline-none focus:ring-2 focus:ring-brass"
                      >
                        レベルアップ
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {levelUpModal && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skill-levelup-dialog-title"
          onClick={() => {
            setLevelUpModal(null);
            setModalError(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-base-border bg-base-elevated p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="skill-levelup-dialog-title"
              className="text-lg font-semibold text-text-primary"
            >
              {levelUpModal.skillName}の分析
            </h2>
            {loading ? (
              <p className="mt-4 text-sm text-text-muted">読込中…</p>
            ) : modalError && !modalInfo ? (
              <p className="mt-4 text-sm text-red-500" role="alert">
                {modalError}
              </p>
            ) : modalInfo ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-text-primary">
                  現在Lv<span className="text-success">{modalInfo.currentLevel}</span>
                </p>
                {modalInfo.isMaxLevel ? (
                  <p className="text-sm text-text-muted">最大レベルです。これ以上は上げられません。</p>
                ) : (
                  <>
                    <p className="text-sm text-text-muted">
                      次のLvまでの必要数: {modalInfo.booksRequiredForNextLevel}冊
                      　所持: {modalInfo.userQuantity}冊
                    </p>
                    <div>
                      <label htmlFor="skill-book-quantity" className="block text-sm text-text-muted">
                        使用する冊数
                      </label>
                      <input
                        id="skill-book-quantity"
                        type="number"
                        min={1}
                        max={modalInfo.userQuantity}
                        value={modalQuantity}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setModalQuantity(Number.isNaN(v) ? 0 : Math.max(0, v));
                        }}
                        className="mt-1 w-24 rounded border border-base-border bg-base px-2 py-1.5 text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
                      />
                    </div>
                    {modalError && (
                      <p className="text-sm text-red-500" role="alert">
                        {modalError}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={using}
                      onClick={handleLevelUpSubmit}
                      className="w-full rounded bg-brass px-3 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
                    >
                      {using ? "使用中…" : "分析"}
                    </button>
                  </>
                )}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setLevelUpModal(null);
                setModalError(null);
              }}
              className="mt-4 w-full rounded border border-base-border bg-base py-2 text-sm text-text-muted hover:bg-base-border"
            >
              中止
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
