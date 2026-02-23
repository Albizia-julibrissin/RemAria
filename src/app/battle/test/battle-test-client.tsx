"use client";

import { useState } from "react";
import { runTestBattle, type RunTestBattleResult } from "@/server/actions/test-battle";
import { BattleFullView } from "./battle-full-view";

export function BattleTestClient() {
  const [result, setResult] = useState<RunTestBattleResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    setResult(null);
    try {
      const res = await runTestBattle();
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        className="rounded bg-brass hover:bg-brass-hover text-white font-medium py-2 px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
      >
        {loading ? "実行中…" : "戦闘開始"}
      </button>

      {result?.success === false && (
        <p className="mt-4 text-error text-sm" role="alert">
          {result.message}
        </p>
      )}

      {result?.success === true && <BattleFullView data={result} />}
    </div>
  );
}
