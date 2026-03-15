// docs/090_terms_of_service.md - フッター（利用規約リンク）

import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-base-border bg-base-elevated/50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-text-muted">
        <Link href="/terms" className="hover:text-brass transition-colors">
          利用規約
        </Link>
      </div>
    </footer>
  );
}
