// spec/020_test_battle.md - 仮戦闘テスト画面

import { redirect } from "next/navigation";
import { getProtagonist } from "@/server/actions/protagonist";
import { BattleTestClient } from "./battle-test-client";

export default async function BattleTestPage() {
  const protagonist = await getProtagonist();
  if (!protagonist) {
    redirect("/character/create");
  }

  return (
    <main className="min-h-screen bg-base p-8">
      <h1 className="text-2xl font-bold text-text-primary">仮戦闘</h1>
      <p className="mt-2 text-text-muted">
        主人公 vs スライム3体（1v3・通常攻撃のみ）。敵は中列・後列に配置。ターゲットは列ウェイト（前列1.5/中列1.0/後列0.5）で抽選。3x3マスは味方左・敵右。戦闘開始でグリッドとログが表示されます。
      </p>
      <div className="mt-6">
        <BattleTestClient />
      </div>
    </main>
  );
}
