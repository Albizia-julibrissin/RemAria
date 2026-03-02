// spec/015_protagonist_creation.md - 主人公作成画面（表示名は登録時の User.name を使用）

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProtagonist } from "@/server/actions/protagonist";
import { userRepository } from "@/server/repositories/user-repository";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";
import { CreateProtagonistForm } from "./create-protagonist-form";

export default async function CreateProtagonistPage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const protagonist = await getProtagonist();
  if (protagonist) redirect("/dashboard");

  const user = await userRepository.findById(session.userId);
  if (!user) redirect("/login");

  const iconFilenames = getProtagonistIconFilenames();

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-base-elevated border border-base-border rounded-lg p-6">
        <h1 className="text-xl font-semibold text-text-primary mb-6">主人公を作成</h1>
        <p className="text-sm text-text-muted mb-6">
          アイコンを選んで、主人公を作成してください。名前は登録時の「{user.name}」が使われます。
        </p>
        <CreateProtagonistForm userName={user.name} iconFilenames={iconFilenames} />
      </div>
    </main>
  );
}
