// メンテナンス中表示。環境変数 MAINTENANCE=1 のとき middleware が /dashboard, /character, /battle をここへリダイレクトする。

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-base flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-text-primary">メンテナンス中</h1>
        <p className="text-text-muted">
          只今、メンテナンスのため一時的にお休みしています。しばらくしてから再度お試しください。
        </p>
      </div>
    </main>
  );
}
