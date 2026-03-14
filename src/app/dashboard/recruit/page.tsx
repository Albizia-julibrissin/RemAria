// 人材局廃止。居住区で推薦紹介状を使って仲間追加。spec/030

import { redirect } from "next/navigation";

export default function RecruitPage() {
  redirect("/dashboard/characters");
}
