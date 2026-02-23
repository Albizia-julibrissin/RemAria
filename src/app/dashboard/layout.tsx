// spec/015_protagonist_creation.md - 主人公未作成なら作成画面へ強制遷移

import { redirect } from "next/navigation";
import { getProtagonist } from "@/server/actions/protagonist";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const protagonist = await getProtagonist();
  if (!protagonist) {
    redirect("/character/create");
  }
  return <>{children}</>;
}
