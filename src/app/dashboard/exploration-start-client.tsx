"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startExploration } from "@/server/actions/exploration";
import type { StackableItem } from "@/server/actions/inventory";

type AreaOption = {
  id: string;
  name: string;
  themeName: string;
};

type PartyPresetOption = {
  id: string;
  label: string;
};

type Props = {
  themes: {
    themeId: string;
    name: string;
    areas: { areaId: string; name: string }[];
  }[];
  partyPresets: {
    id: string;
    name: string | null;
    slot1?: { displayName: string } | null;
    slot2?: { displayName: string } | null;
    slot3?: { displayName: string } | null;
  }[];
  consumableStacks: StackableItem[];
};

export function ExplorationStartClient({ themes, partyPresets, consumableStacks }: Props) {
  const router = useRouter();
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>(
    themes[0]?.themeId
  );

  /** 持ち込む消耗品の種類（一種類のみ選択。未選択は ''） */
  const [selectedConsumableItemId, setSelectedConsumableItemId] = useState<string>("");
  /** 選択した種類の持ち込み個数（0 ～ その種類の上限） */
  const [carryQuantity, setCarryQuantity] = useState<number>(0);

  const areaOptions: AreaOption[] = useMemo(() => {
    const theme = themes.find((t) => t.themeId === selectedThemeId) ?? themes[0];
    if (!theme) return [];
    return theme.areas.map((a) => ({
      id: a.areaId,
      name: a.name,
      themeName: theme.name,
    }));
  }, [themes, selectedThemeId]);

  const presetOptions: PartyPresetOption[] = useMemo(
    () =>
      partyPresets.map((p) => {
        const names = [p.slot1?.displayName, p.slot2?.displayName, p.slot3?.displayName]
          .filter(Boolean)
          .join(" / ");
        return {
          id: p.id,
          // Null 合体演算子と論理 OR の混在はパースエラーになるため、三項演算子で明示する
          label: p.name != null && p.name !== "" ? p.name : names || "名称未設定プリセット",
        };
      }),
    [partyPresets]
  );

  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>();
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedAreaId && areaOptions.length > 0) {
      setSelectedAreaId(areaOptions[0].id);
    } else if (selectedAreaId && !areaOptions.some((a) => a.id === selectedAreaId)) {
      // テーマ変更などで現在のエリアが候補から外れた場合、先頭に差し替える
      setSelectedAreaId(areaOptions[0]?.id);
    }
  }, [areaOptions, selectedAreaId]);

  useEffect(() => {
    if (!selectedPresetId && presetOptions.length > 0) {
      setSelectedPresetId(presetOptions[0].id);
    }
  }, [presetOptions, selectedPresetId]);

  const canStart =
    !isPending && selectedAreaId && selectedPresetId && areaOptions.length > 0 && presetOptions.length > 0;

  /** 所持ありかつ持ち込み可能な消耗品のみ。上限 = min(所持数, maxCarryPerExpedition) */
  const consumablesWithLimit = useMemo(
    () =>
      consumableStacks
        .filter((s) => s.quantity > 0 && (s.maxCarryPerExpedition ?? 0) > 0)
        .map((s) => ({
          ...s,
          maxCarry: Math.min(s.quantity, s.maxCarryPerExpedition ?? 0),
        })),
    [consumableStacks]
  );

  const selectedConsumable = useMemo(
    () => (selectedConsumableItemId ? consumablesWithLimit.find((s) => s.itemId === selectedConsumableItemId) : null),
    [consumablesWithLimit, selectedConsumableItemId]
  );

  const handleStart = () => {
    if (!canStart || !selectedAreaId || !selectedPresetId) return;
    const consumables =
      selectedConsumableItemId && carryQuantity > 0 && selectedConsumable
        ? [{ itemId: selectedConsumableItemId, quantity: carryQuantity }]
        : [];
    startTransition(async () => {
      const result = await startExploration({
        areaId: selectedAreaId,
        partyPresetId: selectedPresetId,
        consumables,
      });
      if (!result.success) {
        // TODO: エラー表示用のトーストや UI を後で用意する
        alert(`探索開始に失敗しました: ${result.message}`);
        return;
      }
      router.push("/battle/exploration?step=next");
    });
  };

  return (
    <div className="rounded-lg border border-dashed border-base-border bg-base-elevated/60 p-4">
      <h3 className="text-sm font-medium text-text-muted">探索開始</h3>
      <p className="mt-2 text-sm text-text-muted">
        テーマ・エリアとパーティプリセットを選び、持ち込む消耗品の個数を指定して探索を開始します。
      </p>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">テーマ</label>
          <select
            className="rounded-md border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
            value={selectedThemeId ?? ""}
            onChange={(e) => setSelectedThemeId(e.target.value || undefined)}
            disabled={themes.length === 0 || isPending}
          >
            {themes.length === 0 ? (
              <option value="">テーマがありません</option>
            ) : (
              themes.map((t) => (
                <option key={t.themeId} value={t.themeId}>
                  {t.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">エリア</label>
          <select
            className="rounded-md border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
            value={selectedAreaId ?? ""}
            onChange={(e) => setSelectedAreaId(e.target.value || undefined)}
            disabled={areaOptions.length === 0 || isPending}
          >
            {areaOptions.length === 0 ? (
              <option value="">エリアがありません</option>
            ) : (
              areaOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.themeName} / {opt.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">パーティプリセット</label>
          <select
            className="rounded-md border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
            value={selectedPresetId ?? ""}
            onChange={(e) => setSelectedPresetId(e.target.value || undefined)}
            disabled={presetOptions.length === 0 || isPending}
          >
            {presetOptions.length === 0 ? (
              <option value="">プリセットがありません</option>
            ) : (
              presetOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))
            )}
          </select>
        </div>

        {consumablesWithLimit.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-xs text-text-muted">持ち込む消耗品（一種類まで）</label>
            <select
              className="rounded-md border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
              value={selectedConsumableItemId}
              onChange={(e) => {
                const id = e.target.value || "";
                setSelectedConsumableItemId(id);
                setCarryQuantity(0);
              }}
              disabled={isPending}
            >
              <option value="">持たない</option>
              {consumablesWithLimit.map((s) => (
                <option key={s.itemId} value={s.itemId}>
                  {s.name}（所持: {s.quantity}、上限: {s.maxCarry}個）
                </option>
              ))}
            </select>
            {selectedConsumable && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-muted">個数</label>
                <input
                  type="number"
                  min={0}
                  max={selectedConsumable.maxCarry}
                  value={carryQuantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setCarryQuantity(Number.isNaN(v) ? 0 : Math.max(0, Math.min(selectedConsumable.maxCarry, v)));
                  }}
                  className="w-14 rounded border border-base-border bg-base px-2 py-1 text-right text-sm tabular-nums text-text-primary"
                  disabled={isPending}
                />
                <span className="text-xs text-text-muted">個（最大{selectedConsumable.maxCarry}個）</span>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleStart}
        disabled={!canStart}
        className="mt-3 inline-flex items-center rounded-md bg-brass px-4 py-2 text-sm font-medium text-base shadow-sm disabled:bg-base-border disabled:text-text-muted"
      >
        {isPending ? "探索を開始中..." : "探索を開始"}
      </button>
    </div>
  );
}

