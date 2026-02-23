// spec/030_companion_employment.md - 雇用斡旋所

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getProtagonist } from "@/server/actions/protagonist";
import { getCompanionHireState } from "@/server/actions/recruit";
import { RecruitPurchaseButtons } from "./recruit-purchase-buttons";

export default async function RecruitPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const protagonist = await getProtagonist();
  if (!protagonist) redirect("/character/create");

  const state = await getCompanionHireState();
  if (!state) redirect("/login");

  const canCreate = state.companionHireCount >= 1 && state.companionCount < state.companionMaxCount;

  return (
    <main className="min-h-screen bg-base p-8">
      <h1 className="text-2xl font-bold text-text-primary">雇用斡旋所</h1>
      <p className="mt-2 text-text-muted">仲間を雇用するには「雇用可能回数」を購入し、名前・アイコンを決めて仲間を作成します。</p>

      <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">現在の状態</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-text-muted">雇用可能回数</dt>
            <dd className="font-medium text-text-primary">{state.companionHireCount}</dd>
          </div>
          <div>
            <dt className="text-text-muted">仲間の数</dt>
            <dd className="font-medium text-text-primary">{state.companionCount} / {state.companionMaxCount}</dd>
          </div>
          <div>
            <dt className="text-text-muted">ゲーム通貨</dt>
            <dd className="font-medium text-text-primary">{state.gameCurrencyBalance}</dd>
          </div>
          <div>
            <dt className="text-text-muted">課金通貨（無償+有償）</dt>
            <dd className="font-medium text-text-primary">{state.premiumFreeBalance + state.premiumPaidBalance}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">雇用可能回数を購入</h2>
        <RecruitPurchaseButtons
          gameCurrencyBalance={state.gameCurrencyBalance}
          premiumFreeBalance={state.premiumFreeBalance}
          premiumPaidBalance={state.premiumPaidBalance}
          priceGame={state.priceGame}
          pricePremium={state.pricePremium}
        />
      </div>

      <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
        <h2 className="text-lg font-medium text-text-primary mb-2">仲間を雇う</h2>
        <p className="text-sm text-text-muted mb-4">
          雇用可能回数が 1 以上あるとき、名前・アイコンを決めて仲間を 1 体作成できます。工業スキルはランダムで 1 つ付与されます。
        </p>
        {canCreate ? (
          <Link
            href="/dashboard/recruit/create"
            className="inline-flex items-center justify-center rounded bg-brass hover:bg-brass-hover text-white font-medium py-2 px-4 transition-colors"
          >
            仲間を雇う（名前・アイコンを設定）
          </Link>
        ) : (
          <p className="text-sm text-text-muted">
            {state.companionHireCount < 1 && "雇用可能回数がありません。上記から購入してください。"}
            {state.companionHireCount >= 1 && state.companionCount >= state.companionMaxCount && `仲間は最大 ${state.companionMaxCount} 体までです。`}
          </p>
        )}
      </div>

      <p className="mt-8">
        <Link href="/dashboard" className="text-sm text-brass hover:text-brass-hover">
          ← ダッシュボードへ
        </Link>
      </p>
    </main>
  );
}
