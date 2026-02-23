"use client";

// 工業エリアのドロップダウンで設置エリアを切替

import { useRouter, usePathname } from "next/navigation";
import type { PlacementAreaOption } from "@/server/actions/initial-area";

type Props = {
  availableAreas: PlacementAreaOption[];
  currentCode: string;
};

export function AreaSelect({ availableAreas, currentCode }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    const url = code === "initial" ? pathname : `${pathname}?area=${encodeURIComponent(code)}`;
    router.push(url);
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-text-muted">設置エリア:</span>
      <select
        value={currentCode}
        onChange={handleChange}
        className="rounded border border-base-border bg-base px-3 py-1.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
      >
        {availableAreas.map((a) => (
          <option key={a.code} value={a.code}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
