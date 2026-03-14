"use client";

// spec/046 - 製造タブ / spec/084 - 鍛錬・継承タブ

import { useState, useMemo } from "react";
import type {
  CraftRecipeRow,
  TemperableEquipmentRow,
  InheritTargetRow,
  InheritConsumeOptionRow,
} from "@/server/actions/craft";
import { EQUIPMENT_SLOT_LABELS, EQUIPMENT_SLOTS } from "@/lib/constants/equipment-slots";
import { EQUIPMENT_STAT_KEYS, EQUIPMENT_STAT_LABELS } from "@/lib/craft/equipment-stat-gen";
import { CraftPrepareModal } from "./craft-prepare-modal";
import { TemperPrepareModal } from "./temper-prepare-modal";
import { InheritPrepareModal } from "./inherit-prepare-modal";

type TabId = "craft" | "temper" | "inherit";

const TAB_IDS: { id: TabId; label: string }[] = [
  { id: "craft", label: "製造" },
  { id: "temper", label: "鍛錬" },
  { id: "inherit", label: "継承" },
];

const TAB_HELP: Record<TabId, string> = {
  craft:
    "製造の時は素材を消費して各種アイテムを製造します。",
  temper:
    "鍛錬の時は未装着の装備の能力をリロール出来ます。リロール範囲は個体の合計能力値～個体の上限となります。ステータスの按分も再度行われます。",
  inherit:
    "継承の時は上限まで鍛えられた装備を対象に、より高い上限の装備を消費して消費装備の上限まで引き上げます。成功率は10％で、失敗するたびに10％ずつ上昇します。",
};

function slotLabel(slot: string): string {
  return EQUIPMENT_SLOT_LABELS[slot as keyof typeof EQUIPMENT_SLOT_LABELS] ?? slot;
}

function recipeOutputLabel(r: CraftRecipeRow): string {
  const o = r.output;
  if (o.kind === "equipment" && o.equipmentTypeName) {
    return o.equipmentSlot ? `${o.equipmentTypeName}（${slotLabel(o.equipmentSlot)}）` : o.equipmentTypeName;
  }
  if (o.kind === "mecha_part" && o.mechaPartTypeName) return o.mechaPartTypeName;
  if (o.kind === "item" && o.itemName) return o.itemName;
  return r.name;
}

function temperEquipmentLabel(eq: TemperableEquipmentRow): string {
  return eq.equipmentTypeName;
}

function inheritTargetLabel(t: InheritTargetRow): string {
  return t.equipmentTypeName;
}

type InheritCandidates = {
  targets: InheritTargetRow[];
  consumeOptions: InheritConsumeOptionRow[];
};

type Props = {
  recipes: CraftRecipeRow[];
  temperableEquipment: TemperableEquipmentRow[];
  inheritCandidates: InheritCandidates;
};

type OutputKindFilter = "all" | "equipment" | "item";

export function CraftTabs({ recipes, temperableEquipment, inheritCandidates }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("craft");
  const [outputKindFilter, setOutputKindFilter] = useState<OutputKindFilter>("all");
  const [slotFilter, setSlotFilter] = useState<string>("");
  const [prepareModalRecipe, setPrepareModalRecipe] = useState<CraftRecipeRow | null>(null);
  const [temperSlotFilter, setTemperSlotFilter] = useState<string>("");
  const [temperSortKey, setTemperSortKey] = useState<string>("sum");
  const [temperSortDir, setTemperSortDir] = useState<"asc" | "desc">("desc");
  const [prepareModalTemper, setPrepareModalTemper] = useState<TemperableEquipmentRow | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [inheritSlotFilter, setInheritSlotFilter] = useState<string>("");
  const [prepareModalInheritTarget, setPrepareModalInheritTarget] = useState<InheritTargetRow | null>(null);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      if (outputKindFilter === "item") return r.output.kind === "item";
      if (outputKindFilter === "equipment") {
        if (r.output.kind !== "equipment") return false;
        if (slotFilter === "") return true;
        return r.output.equipmentSlot === slotFilter;
      }
      return true;
    });
  }, [recipes, outputKindFilter, slotFilter]);

  const filteredTemperableEquipment = useMemo(() => {
    const withRecipe = temperableEquipment.filter((eq) => eq.recipeId != null);
    if (temperSlotFilter === "") return withRecipe;
    return withRecipe.filter((eq) => eq.slot === temperSlotFilter);
  }, [temperableEquipment, temperSlotFilter]);

  const sortedTemperableEquipment = useMemo(() => {
    const list = [...filteredTemperableEquipment];
    const dir = temperSortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (temperSortKey === "name") {
        va = a.equipmentTypeName;
        vb = b.equipmentTypeName;
      } else if (temperSortKey === "sum") {
        va = a.statsSum;
        vb = b.statsSum;
      } else if (temperSortKey === "cap") {
        va = a.capCeiling;
        vb = b.capCeiling;
      } else {
        va = a.stats?.[temperSortKey] ?? 0;
        vb = b.stats?.[temperSortKey] ?? 0;
      }
      if (typeof va === "string" && typeof vb === "string") {
        return dir * va.localeCompare(vb);
      }
      return dir * ((va as number) - (vb as number));
    });
    return list;
  }, [filteredTemperableEquipment, temperSortKey, temperSortDir]);

  function handleTemperSort(key: string) {
    if (temperSortKey === key) {
      setTemperSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setTemperSortKey(key);
      setTemperSortDir("desc");
    }
  }

  const filteredInheritTargets = useMemo(() => {
    const list = inheritCandidates.targets;
    if (inheritSlotFilter === "") return list;
    return list.filter((t) => t.slot === inheritSlotFilter);
  }, [inheritCandidates.targets, inheritSlotFilter]);

  return (
    <section className="mt-8 rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-base-border pb-3">
        {TAB_IDS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${
              activeTab === id
                ? "bg-brass text-base border border-brass"
                : "bg-base text-text-muted hover:bg-base-border hover:text-text-primary border border-base-border"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-base-border bg-base-elevated text-sm text-text-muted transition-colors hover:border-brass hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          aria-label="このタブの説明を表示"
          title="説明"
        >
          !
        </button>
      </div>
      {showHelp && (
        <div className="mt-3 rounded-lg border border-base-border bg-base-elevated p-4 text-sm text-text-primary">
          {TAB_HELP[activeTab]}
        </div>
      )}

      <div className="mt-4 min-h-[120px]">
        {activeTab === "craft" && (
          <>
            <h2 className="text-lg font-medium text-text-primary">レシピ一覧</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {(["all", "equipment", "item"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setOutputKindFilter(k);
                    if (k !== "equipment") setSlotFilter("");
                  }}
                  className={`rounded px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base ${
                    outputKindFilter === k
                      ? "bg-brass text-base"
                      : "bg-base-border text-text-muted hover:bg-base hover:text-text-primary"
                  }`}
                >
                  {k === "all" ? "すべて" : k === "equipment" ? "装備" : "消耗品"}
                </button>
              ))}
              {outputKindFilter === "equipment" && (
                <>
                  <span className="ml-2 text-sm text-text-muted">部位:</span>
                  <select
                    value={slotFilter}
                    onChange={(e) => setSlotFilter(e.target.value)}
                    className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
                  >
                    <option value="">すべて</option>
                    {EQUIPMENT_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slotLabel(slot)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            {filteredRecipes.length === 0 ? (
              <p className="mt-4 text-text-muted">
                {recipes.length === 0 ? "レシピがありません。" : "条件に合うレシピがありません。"}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {filteredRecipes.map((r) => (
                  <li
                    key={r.id}
                    className="rounded border border-base-border bg-base px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-text-primary">{recipeOutputLabel(r)}</span>
                    <button
                      type="button"
                      onClick={() => setPrepareModalRecipe(r)}
                      className="shrink-0 rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                    >
                      製造準備
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {activeTab === "temper" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-text-muted">部位:</span>
              <select
                value={temperSlotFilter}
                onChange={(e) => setTemperSlotFilter(e.target.value)}
                className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
              >
                <option value="">すべて</option>
                {EQUIPMENT_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slotLabel(slot)}
                  </option>
                ))}
              </select>
            </div>
            {filteredTemperableEquipment.length === 0 ? (
              <p className="text-sm text-text-muted">
                {temperableEquipment.length === 0
                  ? "鍛錬可能な装備がありません。（未装着で、ステータスが設定された装備のみ表示）"
                  : "条件に合う装備がありません。"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-base-border text-left text-text-muted">
                      <th
                        className="cursor-pointer select-none py-2 pr-2 font-medium hover:text-text-primary"
                        onClick={() => handleTemperSort("name")}
                      >
                        名前{temperSortKey === "name" ? (temperSortDir === "asc" ? " ↑" : " ↓") : ""}
                      </th>
                      {EQUIPMENT_STAT_KEYS.map((key) => (
                        <th
                          key={key}
                          className="cursor-pointer select-none py-2 px-0.5 text-center font-medium hover:text-text-primary"
                          onClick={() => handleTemperSort(key)}
                        >
                          {EQUIPMENT_STAT_LABELS[key]}
                          {temperSortKey === key ? (temperSortDir === "asc" ? " ↑" : " ↓") : ""}
                        </th>
                      ))}
                      <th
                        className="cursor-pointer select-none py-2 px-1 text-center font-medium hover:text-text-primary"
                        onClick={() => handleTemperSort("sum")}
                      >
                        合計{temperSortKey === "sum" ? (temperSortDir === "asc" ? " ↑" : " ↓") : ""}
                      </th>
                      <th
                        className="cursor-pointer select-none py-2 px-1 text-center font-medium hover:text-text-primary"
                        onClick={() => handleTemperSort("cap")}
                      >
                        上限{temperSortKey === "cap" ? (temperSortDir === "asc" ? " ↑" : " ↓") : ""}
                      </th>
                      <th className="w-24 py-2 pl-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTemperableEquipment.map((eq) => (
                      <tr
                        key={eq.id}
                        className="border-b border-base-border/70 text-text-primary hover:bg-base-border/30"
                      >
                        <td className="py-2 pr-2 font-medium">{temperEquipmentLabel(eq)}</td>
                        {EQUIPMENT_STAT_KEYS.map((key) => {
                          const val = eq.stats?.[key];
                          return (
                            <td key={key} className="py-2 px-0.5 text-center tabular-nums">
                              {val != null && val !== 0 ? (
                                <span className={val > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                  {val > 0 ? "+" : ""}{val}
                                </span>
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-1 text-center tabular-nums text-text-primary">{eq.statsSum}</td>
                        <td className="py-2 px-1 text-center tabular-nums text-brass">
                          {eq.capCeiling}
                        </td>
                        <td className="py-2 pl-2">
                          <button
                            type="button"
                            onClick={() => setPrepareModalTemper(eq)}
                            className="rounded bg-brass px-3 py-1.5 text-xs font-medium text-base hover:bg-brass/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                          >
                            鍛錬準備
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "inherit" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-text-muted">部位:</span>
              <select
                value={inheritSlotFilter}
                onChange={(e) => setInheritSlotFilter(e.target.value)}
                className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
              >
                <option value="">すべて</option>
                {EQUIPMENT_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slotLabel(slot)}
                  </option>
                ))}
              </select>
            </div>
            {filteredInheritTargets.length === 0 ? (
              <p className="text-sm text-text-muted">
                {inheritCandidates.targets.length === 0
                  ? "継承の対象になる装備がありません。（未装着で、現在値が上限CAPに達した装備のみ対象）"
                  : "条件に合う装備がありません。"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-base-border text-left text-text-muted">
                      <th className="py-2 pr-2 font-medium">名前</th>
                      {EQUIPMENT_STAT_KEYS.map((key) => (
                        <th key={key} className="py-2 px-0.5 text-center font-medium">
                          {EQUIPMENT_STAT_LABELS[key]}
                        </th>
                      ))}
                      <th className="py-2 px-1 text-center font-medium">合計</th>
                      <th className="py-2 px-1 text-center font-medium">上限</th>
                      <th className="py-2 px-1 text-center font-medium">成功率</th>
                      <th className="w-24 py-2 pl-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInheritTargets.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-base-border/70 text-text-primary hover:bg-base-border/30"
                      >
                        <td className="py-2 pr-2 font-medium">{inheritTargetLabel(t)}</td>
                        {EQUIPMENT_STAT_KEYS.map((key) => {
                          const val = t.stats?.[key];
                          return (
                            <td key={key} className="py-2 px-0.5 text-center tabular-nums">
                              {val != null && val !== 0 ? (
                                <span className={val > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                  {val > 0 ? "+" : ""}{val}
                                </span>
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-1 text-center tabular-nums text-text-primary">{t.statsSum}</td>
                        <td className="py-2 px-1 text-center tabular-nums text-brass">{t.capCeiling}</td>
                        <td className="py-2 px-1 text-center tabular-nums text-text-muted">{t.nextSuccessRatePercent}％</td>
                        <td className="py-2 pl-2">
                          <button
                            type="button"
                            onClick={() => setPrepareModalInheritTarget(t)}
                            className="rounded bg-brass px-3 py-1.5 text-xs font-medium text-base hover:bg-brass/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                          >
                            継承準備
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {prepareModalRecipe != null && (
        <CraftPrepareModal
          recipe={prepareModalRecipe}
          outputLabel={recipeOutputLabel(prepareModalRecipe)}
          onClose={() => setPrepareModalRecipe(null)}
        />
      )}
      {prepareModalTemper != null && (
        <TemperPrepareModal
          equipment={prepareModalTemper}
          equipmentLabel={temperEquipmentLabel(prepareModalTemper)}
          onClose={() => setPrepareModalTemper(null)}
        />
      )}
      {prepareModalInheritTarget != null && (
        <InheritPrepareModal
          target={prepareModalInheritTarget}
          targetLabel={inheritTargetLabel(prepareModalInheritTarget)}
          consumeOptions={inheritCandidates.consumeOptions.filter(
            (c) => c.id !== prepareModalInheritTarget.id && c.capCeiling > prepareModalInheritTarget.capCeiling
          )}
          onClose={() => setPrepareModalInheritTarget(null)}
        />
      )}
    </section>
  );
}
