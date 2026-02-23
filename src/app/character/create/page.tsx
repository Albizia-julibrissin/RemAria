// spec/015_protagonist_creation.md - 主人公作成画面

import { redirect } from "next/navigation";
import { getProtagonist } from "@/server/actions/protagonist";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";
import { CreateProtagonistForm } from "./create-protagonist-form";

export default async function CreateProtagonistPage() {
  const protagonist = await getProtagonist();
  if (protagonist) {
    redirect("/dashboard");
  }

  const iconFilenames = getProtagonistIconFilenames();

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-base-elevated border border-base-border rounded-lg p-6">
        <h1 className="text-xl font-semibold text-text-primary mb-6">主人公を作成</h1>
        <p className="text-sm text-text-muted mb-6">
          表示名とアイコンを選んで、主人公を作成してください。
        </p>
        <CreateProtagonistForm iconFilenames={iconFilenames} />
      </div>
    </main>
  );
}
