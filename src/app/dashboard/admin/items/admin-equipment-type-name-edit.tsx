"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AdminEquipmentTypeRow } from "@/server/actions/admin";
import { updateAdminEquipmentTypeName } from "@/server/actions/admin";

type Props = {
  equipmentTypes: AdminEquipmentTypeRow[];
};

export function AdminEquipmentTypeNameEdit({ equipmentTypes }: Props) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [localNames, setLocalNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(equipmentTypes.map((et) => [et.id, et.name]))
  );
  useEffect(() => {
    setLocalNames(Object.fromEntries(equipmentTypes.map((et) => [et.id, et.name])));
  }, [equipmentTypes]);

  const handleSave = async (id: string) => {
    const name = localNames[id]?.trim();
    if (name == null || name === "") {
      setMessage({ type: "error", text: "name は必須です。" });
      return;
    }
    setSavingId(id);
    setMessage(null);
    const result = await updateAdminEquipmentTypeName(id, name);
    setSavingId(null);
    setMessage(
      result.success
        ? { type: "ok", text: "保存しました。" }
        : { type: "error", text: result.error ?? "保存に失敗しました。" }
    );
    if (result.success) router.refresh();
  };

  if (equipmentTypes.length === 0) {
    return (
      <p className="mt-2 text-sm text-text-muted">
        装備型が登録されていません。クラフトレシピで装備を出力すると作成されます。
      </p>
    );
  }

  return (
    <div className="mt-3">
      {message && (
        <p className={`mb-2 text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                code
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                name（編集可）
              </th>
              <th className="border border-base-border px-2 py-1.5 w-20 text-center text-text-muted font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {equipmentTypes.map((et) => (
              <tr key={et.id} className="text-text-primary">
                <td className="border border-base-border px-2 py-1.5 font-mono text-xs">
                  {et.code}
                </td>
                <td className="border border-base-border px-2 py-1.5">
                  <input
                    type="text"
                    value={localNames[et.id] ?? et.name}
                    onChange={(e) =>
                      setLocalNames((prev) => ({ ...prev, [et.id]: e.target.value }))
                    }
                    className="w-full max-w-[200px] rounded border border-base-border bg-base px-2 py-1 text-text-primary"
                  />
                </td>
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => handleSave(et.id)}
                    disabled={savingId === et.id}
                    className="text-brass hover:text-brass-hover text-sm disabled:opacity-50"
                  >
                    {savingId === et.id ? "保存中…" : "保存"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-text-muted">計 {equipmentTypes.length} 件</p>
    </div>
  );
}
