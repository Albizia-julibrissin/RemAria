"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CreateAdminExplorationAreaInput } from "@/server/actions/admin";
import { createAdminExplorationArea } from "@/server/actions/admin";

type Theme = { id: string; code: string; name: string };
type Enemy = { id: string; code: string; name: string };

type Props = {
  themes: Theme[];
  initialThemeId: string | null;
  enemyGroupCodes: string[];
  enemies: Enemy[];
};

export function AdminExplorationAreaCreateForm({
  themes,
  initialThemeId,
  enemyGroupCodes,
  enemies,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [themeId, setThemeId] = useState(initialThemeId ?? (themes[0]?.id ?? ""));
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficultyRank, setDifficultyRank] = useState("1");
  const [recommendedLevel, setRecommendedLevel] = useState("1");
  const [baseDropMin, setBaseDropMin] = useState("3");
  const [baseDropMax, setBaseDropMax] = useState("5");
  const [baseSkillEventRate, setBaseSkillEventRate] = useState("25");
  const [skillCheckRequiredValue, setSkillCheckRequiredValue] = useState("80");
  const [normalBattleCount, setNormalBattleCount] = useState("5");
  const [normalEnemyGroupCode, setNormalEnemyGroupCode] = useState("");
  const [enemyCount1Rate, setEnemyCount1Rate] = useState("34");
  const [enemyCount2Rate, setEnemyCount2Rate] = useState("33");
  const [enemyCount3Rate, setEnemyCount3Rate] = useState("33");
  const [strongEnemyEnemyId, setStrongEnemyEnemyId] = useState("");
  const [areaLordEnemyId, setAreaLordEnemyId] = useState("");
  const [areaLordAppearanceRate, setAreaLordAppearanceRate] = useState("50");

  const num = (v: string, def: number) =>
    v.trim() !== "" && /^\d+$/.test(v.trim()) ? parseInt(v.trim(), 10) : def;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeId.trim()) {
      setMessage({ type: "error", text: "テーマを選択してください。" });
      return;
    }
    const input: CreateAdminExplorationAreaInput = {
      themeId: themeId.trim(),
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      difficultyRank: num(difficultyRank, 1),
      recommendedLevel: num(recommendedLevel, 1),
      baseDropMin: num(baseDropMin, 3),
      baseDropMax: num(baseDropMax, 5),
      baseSkillEventRate: num(baseSkillEventRate, 25),
      skillCheckRequiredValue: num(skillCheckRequiredValue, 80),
      normalBattleCount: num(normalBattleCount, 5),
      normalEnemyGroupCode: normalEnemyGroupCode.trim() || null,
      enemyCount1Rate: num(enemyCount1Rate, 34),
      enemyCount2Rate: num(enemyCount2Rate, 33),
      enemyCount3Rate: num(enemyCount3Rate, 33),
      strongEnemyEnemyId: strongEnemyEnemyId.trim() || null,
      areaLordEnemyId: areaLordEnemyId.trim() || null,
      areaLordAppearanceRate: num(areaLordAppearanceRate, 50),
    };
    startTransition(async () => {
      const result = await createAdminExplorationArea(input);
      if (result.success && result.areaId) {
        router.push(`/dashboard/admin/exploration-areas/${result.areaId}`);
        return;
      }
      setMessage({
        type: "error",
        text: result.error ?? "作成に失敗しました。",
      });
    });
  };

  if (themes.length === 0) {
    return (
      <p className="mt-6 text-sm text-text-muted">
        テーマがありません。先に探索テーマを作成してください。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-3xl space-y-6">
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">テーマ</h2>
        <div className="mt-3">
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            required
            className="rounded border border-base-border bg-base px-3 py-2 text-text-primary min-w-[200px]"
          >
            <option value="">— 選択 —</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}（{t.code}）
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">基本</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-muted">code（ユニーク）</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-text-muted">description（任意）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">難易度・ドロップ・技能</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-text-muted">difficultyRank</label>
            <input
              type="number"
              min={1}
              value={difficultyRank}
              onChange={(e) => setDifficultyRank(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">recommendedLevel</label>
            <input
              type="number"
              min={1}
              value={recommendedLevel}
              onChange={(e) => setRecommendedLevel(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">baseDropMin</label>
            <input
              type="number"
              min={0}
              value={baseDropMin}
              onChange={(e) => setBaseDropMin(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">baseDropMax</label>
            <input
              type="number"
              min={0}
              value={baseDropMax}
              onChange={(e) => setBaseDropMax(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">baseSkillEventRate（%）</label>
            <input
              type="number"
              min={0}
              max={100}
              value={baseSkillEventRate}
              onChange={(e) => setBaseSkillEventRate(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">skillCheckRequiredValue</label>
            <input
              type="number"
              min={1}
              value={skillCheckRequiredValue}
              onChange={(e) => setSkillCheckRequiredValue(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">normalBattleCount</label>
            <input
              type="number"
              min={1}
              value={normalBattleCount}
              onChange={(e) => setNormalBattleCount(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
        </div>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">敵</h2>
        <div className="mt-3 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted">通常戦 雑魚グループ（code）</label>
            <select
              value={normalEnemyGroupCode}
              onChange={(e) => setNormalEnemyGroupCode(e.target.value)}
              className="mt-1 rounded border border-base-border bg-base px-3 py-2 text-text-primary min-w-[200px]"
            >
              <option value="">— 未設定 —</option>
              {enemyGroupCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">体数 1/2/3 の出現率</label>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={enemyCount1Rate}
                onChange={(e) => setEnemyCount1Rate(e.target.value)}
                className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={enemyCount2Rate}
                onChange={(e) => setEnemyCount2Rate(e.target.value)}
                className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={enemyCount3Rate}
                onChange={(e) => setEnemyCount3Rate(e.target.value)}
                className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">強敵（Enemy）</label>
            <select
              value={strongEnemyEnemyId}
              onChange={(e) => setStrongEnemyEnemyId(e.target.value)}
              className="mt-1 rounded border border-base-border bg-base px-3 py-2 text-text-primary min-w-[200px]"
            >
              <option value="">— 未設定 —</option>
              {enemies.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">領域主（Enemy）</label>
            <select
              value={areaLordEnemyId}
              onChange={(e) => setAreaLordEnemyId(e.target.value)}
              className="mt-1 rounded border border-base-border bg-base px-3 py-2 text-text-primary min-w-[200px]"
            >
              <option value="">— 未設定 —</option>
              {enemies.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted">領域主出現率（%）</label>
            <p className="mt-0.5 text-xs text-text-muted">強敵勝利後に領域主が出現する確率。0～100。</p>
            <input
              type="number"
              min={0}
              max={100}
              value={areaLordAppearanceRate}
              onChange={(e) => setAreaLordAppearanceRate(e.target.value)}
              className="mt-1 w-20 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
        >
          {isPending ? "作成中…" : "作成"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-base-border px-4 py-2 text-sm text-text-primary hover:bg-base-elevated"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
