"use client";

// spec/045, 051 - 倉庫の種別タブ・遺物
// spec/052 - スキル分析書の習得・未習得キャラのみ選択

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  StackableItem,
  EquipmentInstanceSummary,
  MechaPartInstanceSummary,
} from "@/server/actions/inventory";
import { consumeSkillBook, getCharactersForSkillBook } from "@/server/actions/inventory";
import type { RelicInstanceSummary } from "@/server/actions/relic";
import { BATTLE_SKILL_TYPE_LABELS } from "@/app/dashboard/tactics/tactics-constants";

type CharacterForSkillBook = { id: string; displayName: string; category: string };

type Props = {
  stackable: StackableItem[];
  equipmentInstances: EquipmentInstanceSummary[];
  mechaPartInstances: MechaPartInstanceSummary[];
  relicInstances: RelicInstanceSummary[];
  relicTokenQuantity: number;
  allTabIds: string[];
  /** URL の ?tab= で指定されたタブ（例: キャラ詳細の習得ボタンから ?tab=skill_book で遷移） */
  initialTab?: string;
};

/** 鑑定は工房の鑑定タブで行う。物資庫では所持一覧のみ表示。 */
const TAB_LABELS: Record<string, string> = {
  material: "資源",
  consumable: "消耗品",
  blueprint: "設計図",
  skill_book: "スキル分析書",
  special: "特別",
  equipment: "装備",
  mecha_parts: "メカパーツ",
  relic: "遺物",
};

function formatRelicEffect(r: RelicInstanceSummary): string {
  const parts: string[] = [];
  if (r.relicPassiveEffectName) parts.push(r.relicPassiveEffectName);
  if (r.statBonus1) parts.push(`${r.statBonus1.stat}+${r.statBonus1.percent}%`);
  if (r.statBonus2) parts.push(`${r.statBonus2.stat}+${r.statBonus2.percent}%`);
  if (r.attributeResistances && Object.keys(r.attributeResistances).length > 0) {
    const attrNames: Record<string, string> = {
      crush: "打撃", slash: "斬撃", pierce: "刺突", burn: "炎", freeze: "氷", corrode: "腐蝕", polarity: "極",
    };
    for (const [k, v] of Object.entries(r.attributeResistances)) {
      if (typeof v === "number" && v !== 1) {
        const pct = v < 1 ? `${Math.round((1 - v) * 100)}%軽減` : `${Math.round((v - 1) * 100)}%弱体`;
        parts.push(`${attrNames[k] ?? k}${pct}`);
      }
    }
  }
  return parts.join(" / ") || "—";
}

function skillDisplayTagsToArray(displayTags: unknown): string[] {
  if (Array.isArray(displayTags)) return displayTags.filter((t): t is string => typeof t === "string");
  return [];
}

export function BagTabs({
  stackable,
  equipmentInstances,
  mechaPartInstances,
  relicInstances,
  relicTokenQuantity: _relicTokenQuantity,
  allTabIds,
  initialTab,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(
    initialTab && allTabIds.includes(initialTab) ? initialTab : allTabIds[0] ?? "material"
  );
  const [skillBookUseItem, setSkillBookUseItem] = useState<StackableItem | null>(null);
  const [charactersToSelect, setCharactersToSelect] = useState<CharacterForSkillBook[] | null>(null);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [consuming, setConsuming] = useState(false);
  const [consumeError, setConsumeError] = useState<string | null>(null);
  const [expandedSkillBookItemId, setExpandedSkillBookItemId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!skillBookUseItem?.skillId) {
      setCharactersToSelect(null);
      return;
    }
    let cancelled = false;
    setLoadingCharacters(true);
    setCharactersToSelect(null);
    getCharactersForSkillBook(skillBookUseItem.skillId).then((list) => {
      if (!cancelled) {
        setCharactersToSelect(list ?? []);
        setLoadingCharacters(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [skillBookUseItem?.itemId, skillBookUseItem?.skillId]);

  const filteredStackable =
    activeTab === "equipment" || activeTab === "mecha_parts" || activeTab === "relic"
      ? []
      : stackable.filter((s) => s.category === activeTab);

  return (
    <section className="mt-8 rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
      <div className="flex flex-wrap gap-2 border-b border-base-border pb-3">
        {allTabIds.map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${
              activeTab === tabId
                ? "bg-brass text-base border border-brass"
                : "bg-base text-text-muted hover:bg-base-border hover:text-text-primary border border-base-border"
            }`}
          >
            {TAB_LABELS[tabId] ?? tabId}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-[120px]">
        {activeTab === "equipment" && (
          <ul className="space-y-3">
            {equipmentInstances.length === 0 ? (
              <li className="text-sm text-text-muted">装備を所持していません。</li>
            ) : (
              equipmentInstances.map((ei) => (
                <li
                  key={ei.id}
                  className="flex justify-between items-center rounded border border-base-border bg-base px-4 py-3"
                >
                  <span className="font-medium text-text-primary">
                    {ei.equipmentTypeName}
                  </span>
                  <span className="text-sm text-text-muted">{ei.slot}</span>
                </li>
              ))
            )}
          </ul>
        )}

        {activeTab === "mecha_parts" && (
          <ul className="space-y-3">
            {mechaPartInstances.length === 0 ? (
              <li className="text-sm text-text-muted">
                メカパーツを所持していません。
              </li>
            ) : (
              mechaPartInstances.map((mp) => (
                <li
                  key={mp.id}
                  className="flex justify-between items-center rounded border border-base-border bg-base px-4 py-3"
                >
                  <span className="font-medium text-text-primary">
                    {mp.mechaPartTypeName}
                  </span>
                  <span className="text-sm text-text-muted">{mp.slot}</span>
                </li>
              ))
            )}
          </ul>
        )}

        {activeTab === "relic" && (
          <ul className="space-y-3">
            {relicInstances.length === 0 ? (
              <li className="text-sm text-text-muted">
                遺物を所持していません。探索で原石を入手し、工房で鑑定してください。
              </li>
            ) : (
                relicInstances.map((r) => (
                  <li
                    key={r.id}
                    className="rounded border border-base-border bg-base px-4 py-3"
                  >
                    <div className="font-medium text-text-primary">{r.relicTypeName}</div>
                    <div className="mt-1 text-sm text-text-muted">{formatRelicEffect(r)}</div>
                    {r.equippedCharacterId && (
                      <div className="mt-1 text-xs text-cyan-400 dark:text-cyan-300">装着中</div>
                    )}
                  </li>
                ))
            )}
          </ul>
        )}

        {activeTab !== "equipment" && activeTab !== "mecha_parts" && activeTab !== "relic" && (
          <ul className="space-y-3">
            {filteredStackable.length === 0 ? (
              <li className="text-sm text-text-muted">
                この種別のアイテムはありません。
              </li>
            ) : (
              filteredStackable.map((row) => (
                <li
                  key={row.itemId}
                  className="rounded border border-base-border bg-base px-4 py-3"
                >
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-text-primary">{row.name}</span>
                      {activeTab === "skill_book" && row.skillId && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSkillBookItemId((prev) =>
                              prev === row.itemId ? null : row.itemId
                            )
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-base-border bg-base-elevated text-sm text-text-muted transition-colors hover:border-brass hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                          aria-label="スキルの説明を表示"
                          title="説明"
                        >
                          !
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-text-primary">
                        {row.quantity}
                      </span>
                      {activeTab === "skill_book" && row.skillId && (
                        <button
                          type="button"
                          onClick={() => {
                            setConsumeError(null);
                            setSkillBookUseItem(row);
                          }}
                          className="rounded bg-brass px-2 py-1 text-xs font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass"
                        >
                          習得
                        </button>
                      )}
                    </div>
                  </div>
                  {activeTab === "skill_book" &&
                    expandedSkillBookItemId === row.itemId && (
                      <div className="mt-2 border-t border-base-border pt-2 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {row.skillBattleSkillType && (
                            <span className="inline-flex items-center rounded-full border border-base-border bg-base px-2 py-0.5 text-2xs text-text-muted">
                              {BATTLE_SKILL_TYPE_LABELS[row.skillBattleSkillType] ?? row.skillBattleSkillType}
                            </span>
                          )}
                          {row.skillChargeCycles != null && (
                            <span className="inline-flex items-center rounded-full border border-base-border/60 bg-base px-2 py-0.5 text-2xs text-text-muted">
                              CT{row.skillChargeCycles}
                            </span>
                          )}
                          {row.skillCooldownCycles != null && (
                            <span className="inline-flex items-center rounded-full border border-base-border/60 bg-base px-2 py-0.5 text-2xs text-text-muted">
                              CD{row.skillCooldownCycles}
                            </span>
                          )}
                        </div>
                        {skillDisplayTagsToArray(row.skillDisplayTags).length > 0 && (
                          <p className="break-words text-[11px] text-text-muted">
                            {skillDisplayTagsToArray(row.skillDisplayTags).join(" ")}
                          </p>
                        )}
                        {row.skillDescription ? (
                          <p className="break-words text-xs text-text-muted">
                            {row.skillDescription}
                          </p>
                        ) : (
                          <p className="text-xs text-text-muted">説明はありません。</p>
                        )}
                      </div>
                    )}
                </li>
              ))
            )}
          </ul>
        )}

        {skillBookUseItem && (
          <div
            className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="skill-book-dialog-title"
            onClick={() => {
              setSkillBookUseItem(null);
              setConsumeError(null);
            }}
          >
            <div
              className="w-full max-w-sm rounded-lg border border-base-border bg-base-elevated p-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="skill-book-dialog-title" className="text-lg font-semibold text-text-primary">
                習得するキャラを選んでください
              </h2>
              <p className="mt-1 text-sm text-text-muted">{skillBookUseItem.name}</p>
              {consumeError && (
                <p className="mt-2 text-sm text-red-500" role="alert">
                  {consumeError}
                </p>
              )}
              {loadingCharacters ? (
                <p className="mt-4 text-sm text-text-muted">読込中…</p>
              ) : charactersToSelect && charactersToSelect.length === 0 ? (
                <p className="mt-4 text-sm text-text-muted">
                  このスキルを習得していないキャラはいません（全員習得済みです）。
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {(charactersToSelect ?? []).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={consuming}
                        onClick={async () => {
                          if (!skillBookUseItem) return;
                          setConsuming(true);
                          setConsumeError(null);
                          const result = await consumeSkillBook(
                            skillBookUseItem.itemId,
                            c.id
                          );
                          setConsuming(false);
                          if (result.success) {
                            setSkillBookUseItem(null);
                            router.refresh();
                          } else {
                            setConsumeError(result.error);
                          }
                        }}
                        className="w-full rounded border border-base-border bg-base px-4 py-2 text-left text-text-primary hover:bg-base-border disabled:opacity-50"
                      >
                        {c.displayName}
                        {c.category === "protagonist" && (
                          <span className="ml-2 text-xs text-text-muted">（主人公）</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => {
                  setSkillBookUseItem(null);
                  setConsumeError(null);
                }}
                className="mt-4 w-full rounded border border-base-border bg-base py-2 text-sm text-text-muted hover:bg-base-border"
              >
                中止
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
