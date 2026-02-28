"use client";

import { useState } from "react";
import { runTestBattle, type RunTestBattleResult } from "@/server/actions/test-battle";
import { BattleFullView } from "./battle-full-view";
import type { PartyPresetWithCharacters } from "@/server/actions/tactics";

interface BattleTestClientProps {
  presets: PartyPresetWithCharacters[];
}

export function BattleTestClient({ presets }: BattleTestClientProps) {
  const [selectedPresetId, setSelectedPresetId] = useState(presets[0]?.id ?? "");
  const [result, setResult] = useState<RunTestBattleResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (!selectedPresetId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await runTestBattle(selectedPresetId);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="preset-select" className="block text-sm text-text-muted mb-1">
          使用するプリセット
        </label>
        <select
          id="preset-select"
          value={selectedPresetId}
          onChange={(e) => setSelectedPresetId(e.target.value)}
          className="bg-base border border-base-border rounded px-3 py-2 text-text-primary min-w-[200px]"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? `プリセット（${p.id.slice(0, 8)}）`} — {p.slot1?.displayName ?? "—"}
              {p.slot2 ? ` / ${p.slot2.displayName}` : ""}
              {p.slot3 ? ` / ${p.slot3.displayName}` : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={handleStart}
        disabled={loading || !selectedPresetId}
        className="rounded bg-brass hover:bg-brass-hover text-white font-medium py-2 px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
      >
        {loading ? "実行中…" : "戦闘開始"}
      </button>

      {result?.success === false && (
        <p className="text-error text-sm" role="alert">
          {result.message}
        </p>
      )}

      {result?.success === true && <BattleFullView data={result} />}
    </div>
  );
}
