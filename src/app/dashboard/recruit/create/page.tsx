// spec/030_companion_employment.md - 仲間作成（名前・アイコン）

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getProtagonist } from "@/server/actions/protagonist";
import { getCompanionHireState } from "@/server/actions/recruit";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";
import { CreateCompanionForm } from "./create-companion-form";

export default async function RecruitCreatePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const protagonist = await getProtagonist();
  if (!protagonist) redirect("/character/create");

  const state = await getCompanionHireState();
  if (!state) redirect("/login");
  if (state.companionHireCount < 1) redirect("/dashboard/recruit");
  if (state.companionCount >= state.companionMaxCount) redirect("/dashboard/recruit");

  const iconFilenames = getProtagonistIconFilenames();

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-text-primary">仲間を雇う</h1>
        <p className="mt-2 text-text-muted text-sm">
          表示名とアイコンを選んでください。雇用後、工業スキルが 1 つランダムで付与されます。
        </p>
        <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
          <CreateCompanionForm iconFilenames={iconFilenames} />
        </div>
        <p className="mt-6">
          <Link href="/dashboard/recruit" className="text-sm text-brass hover:text-brass-hover">
            ← 雇用斡旋所へ
          </Link>
        </p>
      </div>
    </main>
  );
}
