// spec/020_test_battle.md - 仮戦闘テスト画面。プリセットを選んで戦闘実行。

import { redirect } from "next/navigation";
import { getProtagonist } from "@/server/actions/protagonist";
import { getPartyPresets } from "@/server/actions/tactics";
import { BattleTestClient } from "./battle-test-client";
import Link from "next/link";

export default async function BattleTestPage() {
  const protagonist = await getProtagonist();
  if (!protagonist) {
    redirect("/character/create");
  }

  const { presets } = await getPartyPresets();
  if (presets.length === 0) {
    return (
      <main className="min-h-screen bg-base p-8">
        <h1 className="text-2xl font-bold text-text-primary">仮戦闘</h1>
        <p className="mt-2 text-text-muted">
          プリセットを選んで戦闘を実行します。まず作戦室でプリセットを作成してください。
        </p>
        <p className="mt-4">
          <Link href="/dashboard/tactics" className="text-brass hover:text-brass-hover">
            作戦室でプリセットを作成 →
          </Link>
        </p>
        <p className="mt-6">
          <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
            ← ダッシュボードへ
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <h1 className="text-2xl font-bold text-text-primary">仮戦闘</h1>
      <p className="mt-2 text-text-muted">
        使用するプリセットを選んで戦闘開始してください。主人公 vs スライム3体（1v3・通常攻撃のみ）。敵は中列・後列に配置。ターゲットは列ウェイトで抽選。
      </p>
      <div className="mt-6">
        <BattleTestClient presets={presets} />
      </div>
      <p className="mt-6">
        <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
          ← ダッシュボードへ
        </Link>
      </p>
    </main>
  );
}
