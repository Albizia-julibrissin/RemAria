// spec/094: 設定ページ。チャット表示設定など。

import Link from "next/link";
import { ChatSettingsForm } from "./chat-settings-form";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-base p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-text-muted hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass"
          >
            ← 開拓拠点
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-2">設定</h1>
        <p className="text-sm text-text-muted mb-8">
          チャットの表示や起動時の動作を変更できます。
        </p>

        <section id="chat" className="border border-base-border rounded-lg bg-base-elevated p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">チャット</h2>
          <ChatSettingsForm />
        </section>
      </div>
    </main>
  );
}
