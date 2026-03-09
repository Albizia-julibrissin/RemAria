"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { advanceExplorationStep, startExploration } from "@/server/actions/exploration";
import type { StackableItem } from "@/server/actions/inventory";
import { ExplorationAbortClient } from "./exploration-abort-client";

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
    description: string | null;
    areas: { areaId: string; name: string; description: string | null; recommendedLevel: number }[];
  }[];
  /** プリセット一覧（id と name のみ。ダッシュボード用の軽量データ） */
  partyPresets: { id: string; name: string | null }[];
  consumableStacks: StackableItem[];
  /** 進行中の探索があるか（ダッシュボード側から渡す） */
  hasOngoingExpedition?: boolean;
};

export function ExplorationStartClient({
  themes,
  partyPresets,
  consumableStacks,
  hasOngoingExpedition = false,
}: Props) {
  const router = useRouter();
  const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>(
    themes[0]?.themeId
  );

  /** 持ち込む消耗品の種類（一種類のみ選択。未選択は ''） */
  const [selectedConsumableItemId, setSelectedConsumableItemId] = useState<string>("");
  /** 選択した種類の持ち込み個数（0 ～ その種類の上限） */
  const [carryQuantity, setCarryQuantity] = useState<number>(0);

  const areaOptions: (AreaOption & { recommendedLevel: number; description: string | null })[] = useMemo(() => {
    const theme = themes.find((t) => t.themeId === selectedThemeId) ?? themes[0];
    if (!theme) return [];
    return theme.areas.map((a) => ({
      id: a.areaId,
      name: a.name,
      themeName: theme.name,
      recommendedLevel: a.recommendedLevel,
      description: a.description ?? null,
    }));
  }, [themes, selectedThemeId]);

  const selectedTheme = selectedThemeId
    ? themes.find((t) => t.themeId === selectedThemeId)
    : null;

  const presetOptions: PartyPresetOption[] = useMemo(
    () =>
      partyPresets.map((p) => ({
        id: p.id,
        label: p.name != null && p.name !== "" ? p.name : "名称未設定プリセット",
      })),
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
      // 探索開始直後に 1 ステップだけ進行させる（advanceExplorationStep）。
      // runExplorationBattle / skill_check の結果は explorationState.lastBattle / pendingSkillEvent に書き込まれるため、
      // /battle/exploration 側では read-only にそれを表示する。
      const step = await advanceExplorationStep();
      if (!step.success) {
        alert(`探索開始直後のイベント実行に失敗しました: ${step.message}`);
        return;
      }
      router.push("/battle/exploration");
    });
  };

  const selectedArea = selectedAreaId
    ? areaOptions.find((a) => a.id === selectedAreaId)
    : null;

  return (
    <div className="rounded-lg border border-base-border bg-base-elevated p-5 shadow-sm">
      <div className="space-y-3 text-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <label
              htmlFor="exploration-theme"
              className="w-16 text-xs text-text-muted"
            >
              Theme
            </label>
            <select
              id="exploration-theme"
              className="flex-1 rounded-md border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
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
          {selectedTheme?.description && (
            <p className="mt-0.5 text-xs text-text-muted">{selectedTheme.description}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <label
              htmlFor="exploration-area"
              className="w-16 text-xs text-text-muted"
            >
              Area
            </label>
            <select
              id="exploration-area"
              className="flex-1 rounded-md border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
              value={selectedAreaId ?? ""}
              onChange={(e) => setSelectedAreaId(e.target.value || undefined)}
              disabled={areaOptions.length === 0 || isPending}
            >
              {areaOptions.length === 0 ? (
                <option value="">エリアがありません</option>
              ) : (
                areaOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))
              )}
            </select>
          </div>
          {selectedArea?.description && (
            <p className="mt-0.5 text-xs text-text-muted">{selectedArea.description}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <label
              htmlFor="exploration-preset"
              className="w-16 text-xs text-text-muted"
            >
              Preset
            </label>
            <select
              id="exploration-preset"
              className="flex-1 rounded-md border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
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
            <Link
              href="/dashboard/tactics"
              className="flex-shrink-0 rounded-md border border-base-border bg-base-elevated px-3 py-1.5 text-sm text-text-primary hover:border-brass hover:bg-base-elevated/90"
            >
              作戦室
            </Link>
          </div>
        </div>

        {consumablesWithLimit.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor="exploration-consumable"
                className="w-16 text-xs text-text-muted"
              >
                Item
              </label>
              <select
                id="exploration-consumable"
                className="flex-1 rounded-md border border-base-border bg-base px-2 py-1.5 text-sm text-text-primary"
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
            </div>
            {selectedConsumable && (
              <div className="flex items-center gap-2">
                <span className="w-16 text-xs text-text-muted">Qty</span>
                <input
                  type="number"
                  min={0}
                  max={selectedConsumable.maxCarry}
                  value={carryQuantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setCarryQuantity(Number.isNaN(v) ? 0 : Math.max(0, Math.min(selectedConsumable.maxCarry, v)));
                  }}
                  className="w-16 rounded border border-base-border bg-base px-2 py-1 text-right text-sm tabular-nums text-text-primary"
                  disabled={isPending}
                />
                <span className="text-xs text-text-muted">個（最大{selectedConsumable.maxCarry}個）</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {hasOngoingExpedition ? (
          <>
            <Link
              href="/battle/exploration"
              className="inline-flex flex-1 items-center justify-center rounded-md bg-brass px-4 py-2.5 text-sm font-medium text-base shadow-sm hover:bg-brass/90 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
            >
              探索を再開
            </Link>
            <ExplorationAbortClient />
          </>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="w-full rounded-md bg-brass px-4 py-2.5 text-sm font-medium text-base shadow-sm disabled:bg-base-border disabled:text-text-muted hover:bg-brass/90"
          >
            {isPending ? "探索を開始中..." : "探索を開始"}
          </button>
        )}
      </div>
    </div>
  );
}

