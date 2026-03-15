"use client";

// spec/046 - 製造タブ / spec/084 - 鍛錬・継承タブ / spec/051, docs/086 - 鑑定タブ

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  CraftRecipeRow,
  TemperableEquipmentRow,
  InheritTargetRow,
  InheritConsumeOptionRow,
  DismantlableEquipmentRow,
} from "@/server/actions/craft";
import { dismantleEquipment, dismantleEquipmentBulk } from "@/server/actions/craft";
import type { RelicInstanceSummary } from "@/server/actions/relic";
import { appraiseRelicToken, decomposeRelic } from "@/server/actions/relic";
import { EQUIPMENT_SLOT_LABELS, EQUIPMENT_SLOTS } from "@/lib/constants/equipment-slots";
import { EQUIPMENT_STAT_KEYS, EQUIPMENT_STAT_LABELS } from "@/lib/craft/equipment-stat-gen";
import { Toast } from "@/components/toast";
import { AppraisalResultModal } from "./appraisal-result-modal";
import { CraftPrepareModal } from "./craft-prepare-modal";
import { DecomposeConfirmModal } from "./decompose-confirm-modal";
import { RelicTemperPrepareModal } from "./relic-temper-prepare-modal";
import { TemperPrepareModal } from "./temper-prepare-modal";
import { InheritPrepareModal } from "./inherit-prepare-modal";

type TabId = "craft" | "dismantle" | "temper" | "inherit" | "appraisal" | "relic_temper";

const TAB_IDS: { id: TabId; label: string }[] = [
  { id: "craft", label: "製造" },
  { id: "dismantle", label: "解体" },
  { id: "temper", label: "鍛錬" },
  { id: "inherit", label: "継承" },
  { id: "appraisal", label: "鑑定" },
  { id: "relic_temper", label: "調律" },
];

const TAB_HELP: Record<TabId, string> = {
  craft:
    "製造の時は素材を消費して各種アイテムを製造します。",
  dismantle:
    "未装着の装備を解体すると、その装備の製造に使った素材の1/10が返却されます。一括解体モードで複数まとめて解体できます。",
  temper:
    "鍛錬の時は未装着の装備の能力をリロール出来ます。リロール範囲は個体の合計能力値～個体の上限となります。ステータスの按分も再度行われます。",
  inherit:
    "継承の時は上限まで鍛えられた装備を対象に、より高い上限の装備を消費して消費装備の上限まで引き上げます。成功率は10％で、失敗するたびに10％ずつ上昇します。",
  appraisal:
    "遺物の原石を鑑定して遺物個体を生成します。不要な遺物は分解すると遺物の欠片が1個手に入ります。装着中の遺物は分解できません。",
  relic_temper:
    "遺物の欠片77個で、遺物の基幹効果以外のステータス補正・属性耐性を調律（リロール）できます。調律準備から実行し、結果を確認して確定または取消を選びます。",
};

function formatRelicEffect(r: RelicInstanceSummary): string {
  const parts: string[] = [];
  if (r.relicPassiveEffectName) parts.push(r.relicPassiveEffectName);
  if (r.statBonus1) parts.push(`${r.statBonus1.stat}+${r.statBonus1.percent}%`);
  if (r.statBonus2) parts.push(`${r.statBonus2.stat}+${r.statBonus2.percent}%`);
  if (r.attributeResistances && Object.keys(r.attributeResistances).length > 0) {
    const attrNames: Record<string, string> = {
      crush: "圧縮", slash: "斬撃", pierce: "穿孔", burn: "焼損", freeze: "凍結", corrode: "浸蝕", polarity: "極星",
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

/** 解体タブのステータスフィルタ用キー（9種＋合計・上限） */
const DISMANTLE_STAT_FILTER_KEYS = [
  ...EQUIPMENT_STAT_KEYS,
  "sum",
  "cap",
] as const;
const DISMANTLE_STAT_FILTER_LABELS: Record<(typeof DISMANTLE_STAT_FILTER_KEYS)[number], string> = {
  ...EQUIPMENT_STAT_LABELS,
  sum: "合計",
  cap: "上限",
};

type Props = {
  recipes: CraftRecipeRow[];
  temperableEquipment: TemperableEquipmentRow[];
  inheritCandidates: InheritCandidates;
  dismantlableEquipment: DismantlableEquipmentRow[];
  relicInstances: RelicInstanceSummary[];
  relicTokenQuantity: number;
  relicShardQuantity: number;
};

type OutputKindFilter = "all" | "equipment" | "item";

export function CraftTabs({
  recipes,
  temperableEquipment,
  inheritCandidates,
  dismantlableEquipment,
  relicInstances,
  relicTokenQuantity,
  relicShardQuantity,
}: Props) {
  const router = useRouter();
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
  const [appraising, setAppraising] = useState(false);
  const [appraisalResultRelic, setAppraisalResultRelic] = useState<RelicInstanceSummary | null>(null);
  const [decomposeConfirmRelic, setDecomposeConfirmRelic] = useState<RelicInstanceSummary | null>(null);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<React.ReactNode>("");
  const [temperPrepareRelic, setTemperPrepareRelic] = useState<RelicInstanceSummary | null>(null);
  // 解体タブ
  const [dismantleSlotFilter, setDismantleSlotFilter] = useState<string>("");
  const [dismantleStatFilters, setDismantleStatFilters] = useState<
    { key: (typeof DISMANTLE_STAT_FILTER_KEYS)[number]; max: number }[]
  >([]);
  const [dismantleSortKey, setDismantleSortKey] = useState<string>("sum");
  const [dismantleSortDir, setDismantleSortDir] = useState<"asc" | "desc">("desc");
  const [bulkDismantleMode, setBulkDismantleMode] = useState(false);
  const [selectedDismantleIds, setSelectedDismantleIds] = useState<Set<string>>(new Set());
  const [confirmDismantleRow, setConfirmDismantleRow] = useState<DismantlableEquipmentRow | null>(null);
  const [confirmBulkDismantleIds, setConfirmBulkDismantleIds] = useState<string[] | null>(null);
  const [dismantlingId, setDismantlingId] = useState<string | null>(null);

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

  function getDismantleRowValue(eq: DismantlableEquipmentRow, key: string): number | string {
    if (key === "name") return eq.equipmentTypeName;
    if (key === "sum") return eq.statsSum;
    if (key === "cap") return eq.capCeiling;
    return eq.stats?.[key] ?? 0;
  }

  const filteredDismantlableEquipment = useMemo(() => {
    let list = dismantlableEquipment;
    if (dismantleSlotFilter !== "") {
      list = list.filter((eq) => eq.slot === dismantleSlotFilter);
    }
    for (const f of dismantleStatFilters) {
      if (f.max === undefined || f.key === undefined) continue;
      const key = f.key;
      list = list.filter((eq) => {
        const v = getDismantleRowValue(eq, key);
        return typeof v === "number" && v <= f.max;
      });
    }
    return list;
  }, [dismantlableEquipment, dismantleSlotFilter, dismantleStatFilters]);

  const sortedDismantlableEquipment = useMemo(() => {
    const list = [...filteredDismantlableEquipment];
    const dir = dismantleSortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const va = getDismantleRowValue(a, dismantleSortKey);
      const vb = getDismantleRowValue(b, dismantleSortKey);
      if (typeof va === "string" && typeof vb === "string") {
        return dir * va.localeCompare(vb);
      }
      return dir * ((va as number) - (vb as number));
    });
    return list;
  }, [filteredDismantlableEquipment, dismantleSortKey, dismantleSortDir]);

  function handleDismantleSort(key: string) {
    if (dismantleSortKey === key) {
      setDismantleSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setDismantleSortKey(key);
      setDismantleSortDir("desc");
    }
  }

  function addDismantleStatFilter(key: (typeof DISMANTLE_STAT_FILTER_KEYS)[number], max: number) {
    if (Number.isNaN(max)) return;
    setDismantleStatFilters((prev) => {
      const rest = prev.filter((f) => f.key !== key);
      return [...rest, { key, max }];
    });
  }

  function removeDismantleStatFilter(key: (typeof DISMANTLE_STAT_FILTER_KEYS)[number]) {
    setDismantleStatFilters((prev) => prev.filter((f) => f.key !== key));
  }

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
                ? "bg-brass text-white border border-brass"
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
                      ? "bg-brass text-white"
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
                      className="shrink-0 rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                    >
                      製造準備
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {activeTab === "dismantle" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-text-muted">部位:</span>
              <select
                value={dismantleSlotFilter}
                onChange={(e) => setDismantleSlotFilter(e.target.value)}
                className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
              >
                <option value="">すべて</option>
                {EQUIPMENT_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slotLabel(slot)}
                  </option>
                ))}
              </select>
              <span className="ml-2 text-sm text-text-muted">ステータス:</span>
              <select
                id="dismantle-stat-key"
                className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
                defaultValue=""
              >
                <option value="">選択</option>
                {DISMANTLE_STAT_FILTER_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {DISMANTLE_STAT_FILTER_LABELS[k]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                id="dismantle-stat-max"
                placeholder="以下"
                className="w-20 rounded border border-base-border bg-base px-2 py-1 text-sm tabular-nums text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
                min={0}
              />
              <button
                type="button"
                onClick={() => {
                  const sel = document.getElementById("dismantle-stat-key") as HTMLSelectElement;
                  const inp = document.getElementById("dismantle-stat-max") as HTMLInputElement;
                  const key = sel?.value as (typeof DISMANTLE_STAT_FILTER_KEYS)[number];
                  const max = inp?.value ? parseInt(inp.value, 10) : NaN;
                  if (key && DISMANTLE_STAT_FILTER_KEYS.includes(key)) addDismantleStatFilter(key, max);
                }}
                className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
              >
                条件追加
              </button>
              {dismantleStatFilters.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                  {dismantleStatFilters.map((f) => (
                    <span
                      key={f.key}
                      className="inline-flex items-center gap-1 rounded bg-base-border px-2 py-0.5 text-xs text-text-primary"
                    >
                      {DISMANTLE_STAT_FILTER_LABELS[f.key]} ≤ {f.max}
                      <button
                        type="button"
                        onClick={() => removeDismantleStatFilter(f.key)}
                        className="hover:text-brass focus:outline-none focus:ring-1 focus:ring-brass"
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </span>
              )}
            </div>
            {!bulkDismantleMode ? (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setBulkDismantleMode(true)}
                  className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                >
                  一括解体
                </button>
              </div>
            ) : (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDismantleIds(new Set(sortedDismantlableEquipment.map((eq) => eq.id)));
                  }}
                  className="rounded border border-base-border bg-base px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                >
                  一括選択
                </button>
                <button
                  type="button"
                  disabled={selectedDismantleIds.size === 0}
                  onClick={() => setConfirmBulkDismantleIds(selectedDismantleIds.size > 0 ? [...selectedDismantleIds] : null)}
                  className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                >
                  一括解体実行（{selectedDismantleIds.size}件）
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkDismantleMode(false);
                    setSelectedDismantleIds(new Set());
                  }}
                  className="rounded border border-base-border bg-base px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                >
                  キャンセル
                </button>
              </div>
            )}
            {sortedDismantlableEquipment.length === 0 ? (
              <p className="text-sm text-text-muted">
                {dismantlableEquipment.length === 0
                  ? "解体可能な装備がありません。（未装着で、レシピが存在する装備のみ表示）"
                  : "条件に合う装備がありません。"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-base-border text-left text-text-muted">
                      {bulkDismantleMode && (
                        <th className="w-10 py-2 pr-1 text-center font-medium">選択</th>
                      )}
                      <th
                        className="cursor-pointer select-none py-2 pr-2 font-medium hover:text-text-primary"
                        onClick={() => handleDismantleSort("name")}
                      >
                        名前{dismantleSortKey === "name" ? (dismantleSortDir === "asc" ? " ↑" : " ↓") : ""}
                      </th>
                      {EQUIPMENT_STAT_KEYS.map((key) => (
                        <th
                          key={key}
                          className="cursor-pointer select-none py-2 px-0.5 text-center font-medium hover:text-text-primary"
                          onClick={() => handleDismantleSort(key)}
                        >
                          {EQUIPMENT_STAT_LABELS[key]}
                          {dismantleSortKey === key ? (dismantleSortDir === "asc" ? " ↑" : " ↓") : ""}
                        </th>
                      ))}
                      <th
                        className="cursor-pointer select-none py-2 px-1 text-center font-medium hover:text-text-primary"
                        onClick={() => handleDismantleSort("sum")}
                      >
                        合計{dismantleSortKey === "sum" ? (dismantleSortDir === "asc" ? " ↑" : " ↓") : ""}
                      </th>
                      <th
                        className="cursor-pointer select-none py-2 px-1 text-center font-medium hover:text-text-primary"
                        onClick={() => handleDismantleSort("cap")}
                      >
                        上限{dismantleSortKey === "cap" ? (dismantleSortDir === "asc" ? " ↑" : " ↓") : ""}
                      </th>
                      <th className="w-24 py-2 pl-2">返却</th>
                      {!bulkDismantleMode && <th className="w-24 py-2 pl-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDismantlableEquipment.map((eq) => (
                      <tr
                        key={eq.id}
                        className="border-b border-base-border/70 text-text-primary hover:bg-base-border/30"
                      >
                        {bulkDismantleMode && (
                          <td className="py-2 pr-1 text-center">
                            <input
                              type="checkbox"
                              checked={selectedDismantleIds.has(eq.id)}
                              onChange={(e) => {
                                setSelectedDismantleIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(eq.id);
                                  else next.delete(eq.id);
                                  return next;
                                });
                              }}
                              className="rounded border-base-border text-brass focus:ring-brass"
                            />
                          </td>
                        )}
                        <td className="py-2 pr-2 font-medium">{eq.equipmentTypeName}</td>
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
                        <td className="py-2 px-1 text-center tabular-nums text-brass">{eq.capCeiling}</td>
                        <td className="py-2 pl-2 text-xs text-text-muted">
                          {eq.returnInputs.filter((r) => r.amount > 0).map((r) => `${r.itemName}×${r.amount}`).join(", ") || "—"}
                        </td>
                        {!bulkDismantleMode && (
                          <td className="py-2 pl-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDismantleRow(eq)}
                              className="rounded bg-brass px-3 py-1.5 text-xs font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                            >
                              解体
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
                            className="rounded bg-brass px-3 py-1.5 text-xs font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
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
                            className="rounded bg-brass px-3 py-1.5 text-xs font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
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

        {activeTab === "appraisal" && (
          <div className="space-y-4">
            {relicTokenQuantity > 0 && (
              <div className="flex items-center gap-3 rounded border border-brass/50 bg-brass/10 px-4 py-3">
                <span className="text-sm text-text-primary">
                  遺物の原石を {relicTokenQuantity} 個所持しています。
                </span>
                <button
                  type="button"
                  disabled={appraising}
                  onClick={async () => {
                    setAppraising(true);
                    const result = await appraiseRelicToken("relic_group_a_token");
                    setAppraising(false);
                    if (result.success) setAppraisalResultRelic(result.relic);
                    else {
                      alert(result.message ?? "鑑定に失敗しました");
                      router.refresh();
                    }
                  }}
                  className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                >
                  {appraising ? "鑑定中…" : "1個鑑定する"}
                </button>
              </div>
            )}
            <h2 className="text-lg font-medium text-text-primary">所持遺物一覧</h2>
            {relicInstances.length === 0 ? (
              <p className="text-sm text-text-muted">
                遺物を所持していません。探索で原石を入手し、鑑定してください。
              </p>
            ) : (
              <ul className="space-y-3">
                {relicInstances.map((r) => (
                  <li
                    key={r.id}
                    className="rounded border border-base-border bg-base px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium text-text-primary">{r.relicTypeName}</div>
                      <div className="mt-1 text-sm text-text-muted">{formatRelicEffect(r)}</div>
                      {r.equippedCharacterId && (
                        <div className="mt-1 text-xs text-cyan-400 dark:text-cyan-300">装着中</div>
                      )}
                    </div>
                    {!r.equippedCharacterId && (
                      <button
                        type="button"
                        disabled={decomposingId != null}
                        onClick={() => setDecomposeConfirmRelic(r)}
                        className="shrink-0 rounded bg-brass px-3 py-1.5 text-xs font-medium text-white hover:bg-brass-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                      >
                        分解
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "relic_temper" && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-text-primary">所持遺物一覧</h2>
            {relicInstances.length === 0 ? (
              <p className="text-sm text-text-muted">
                遺物を所持していません。鑑定タブで原石を鑑定するか、物資庫で確認してください。
              </p>
            ) : (
              <ul className="space-y-3">
                {relicInstances.map((r) => (
                  <li
                    key={r.id}
                    className="rounded border border-base-border bg-base px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium text-text-primary">{r.relicTypeName}</div>
                      <div className="mt-1 text-sm text-text-muted">{formatRelicEffect(r)}</div>
                      {r.equippedCharacterId && (
                        <div className="mt-1 text-xs text-cyan-400 dark:text-cyan-300">装着中</div>
                      )}
                    </div>
                    {!r.equippedCharacterId && (
                      <button
                        type="button"
                        onClick={() => setTemperPrepareRelic(r)}
                        className="shrink-0 rounded bg-brass px-3 py-1.5 text-xs font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
                      >
                        調律準備
                      </button>
                    )}
                  </li>
                ))}
              </ul>
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
      {appraisalResultRelic != null && (
        <AppraisalResultModal
          relic={appraisalResultRelic}
          onClose={() => {
            setAppraisalResultRelic(null);
            router.refresh();
          }}
        />
      )}
      {decomposeConfirmRelic && (
        <DecomposeConfirmModal
          relic={decomposeConfirmRelic}
          onClose={() => setDecomposeConfirmRelic(null)}
          onConfirm={async () => {
            setDecomposingId(decomposeConfirmRelic.id);
            const result = await decomposeRelic(decomposeConfirmRelic.id);
            setDecomposingId(null);
            setDecomposeConfirmRelic(null);
            if (result.success) {
              router.refresh();
              setToastMessage(
                <>
                  <span className="font-medium text-brass">分解しました</span>
                  <span className="mt-1 block text-text-muted">遺物の欠片 1個</span>
                </>
              );
              setToastOpen(true);
            }
          }}
          isPending={decomposingId === decomposeConfirmRelic.id}
        />
      )}
      {confirmDismantleRow != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dismantle-confirm-title"
          onClick={() => setConfirmDismantleRow(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dismantle-confirm-title" className="text-lg font-medium text-text-primary">
              装備を解体しますか？
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {confirmDismantleRow.equipmentTypeName} を解体すると、製造素材の1/10が返却されます。
            </p>
            {confirmDismantleRow.returnInputs.some((r) => r.amount > 0) && (
              <p className="mt-2 text-sm text-text-primary">
                返却: {confirmDismantleRow.returnInputs.filter((r) => r.amount > 0).map((r) => `${r.itemName}×${r.amount}`).join(", ")}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDismantleRow(null)}
                disabled={dismantlingId != null}
                className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
              >
                中止
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirmDismantleRow) return;
                  setDismantlingId(confirmDismantleRow.id);
                  const result = await dismantleEquipment(confirmDismantleRow.id);
                  setDismantlingId(null);
                  setConfirmDismantleRow(null);
                  if (result.success) {
                    router.refresh();
                    setToastMessage(
                      <>
                        <span className="font-medium text-brass">解体しました</span>
                        {result.returned.some((r) => r.amount > 0) && (
                          <span className="mt-1 block text-text-muted">
                            {result.returned.filter((r) => r.amount > 0).map((r) => `${r.itemName}×${r.amount}`).join(", ")}
                          </span>
                        )}
                      </>
                    );
                    setToastOpen(true);
                  } else {
                    alert(result.message ?? "解体に失敗しました");
                  }
                }}
                disabled={dismantlingId != null}
                className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
              >
                {dismantlingId != null ? "解体中…" : "解体"}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmBulkDismantleIds != null && confirmBulkDismantleIds.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dismantle-bulk-confirm-title"
          onClick={() => setConfirmBulkDismantleIds(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dismantle-bulk-confirm-title" className="text-lg font-medium text-text-primary">
              一括解体しますか？
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {confirmBulkDismantleIds.length} 件の装備を解体し、製造素材の1/10が返却されます。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBulkDismantleIds(null)}
                disabled={dismantlingId != null}
                className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDismantlingId("bulk");
                  const result = await dismantleEquipmentBulk(confirmBulkDismantleIds);
                  setDismantlingId(null);
                  setConfirmBulkDismantleIds(null);
                  if (result.success) {
                    setBulkDismantleMode(false);
                    setSelectedDismantleIds(new Set());
                    router.refresh();
                    setToastMessage(
                      <>
                        <span className="font-medium text-brass">一括解体しました</span>
                        <span className="mt-1 block text-text-muted">
                          {result.dismantledCount} 件
                          {result.returned.length > 0 &&
                            ` / ${result.returned.map((r) => `${r.itemName}×${r.totalAmount}`).join(", ")}`}
                        </span>
                      </>
                    );
                    setToastOpen(true);
                  } else {
                    alert(result.message ?? "一括解体に失敗しました");
                  }
                }}
                disabled={dismantlingId != null}
                className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
              >
                {dismantlingId != null ? "実行中…" : "実行"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast
        open={toastOpen}
        message={toastMessage}
        duration={4500}
        onClose={() => setToastOpen(false)}
      />
      {temperPrepareRelic != null && (
        <RelicTemperPrepareModal
          relic={temperPrepareRelic}
          relicShardQuantity={relicShardQuantity}
          onClose={() => setTemperPrepareRelic(null)}
        />
      )}
    </section>
  );
}
