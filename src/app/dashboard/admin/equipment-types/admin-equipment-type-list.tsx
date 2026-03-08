"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AdminEquipmentTypeRow } from "@/server/actions/admin";
import {
  updateAdminEquipmentTypeName,
  deleteAdminEquipmentType,
} from "@/server/actions/admin";

type Props = {
  equipmentTypes: AdminEquipmentTypeRow[];
};

export function AdminEquipmentTypeList({ equipmentTypes }: Props) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const handleDelete = async (id: string, code: string, name: string) => {
    if (!confirm(`装備型「${code}」（${name}）を削除しますか？\n装備個体は削除され、クラフトレシピの出力は未設定になります。`)) {
      return;
    }
    setDeletingId(id);
    setMessage(null);
    const result = await deleteAdminEquipmentType(id);
    setDeletingId(null);
    setMessage(
      result.success
        ? { type: "ok", text: "削除しました。" }
        : { type: "error", text: result.error ?? "削除に失敗しました。" }
    );
    if (result.success) router.refresh();
  };

  if (equipmentTypes.length === 0) {
    return (
      <p className="mt-4 text-sm text-text-muted">
        装備型が登録されていません。クラフトレシピで装備を出力すると作成されます。
      </p>
    );
  }

  return (
    <div className="mt-6">
      {message && (
        <p className={`mb-3 text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
          {message.text}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-sm border-collapse border border-base-border">
          <thead>
            <tr className="bg-base-elevated">
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                code
              </th>
              <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                name（編集可）
              </th>
              <th className="border border-base-border px-2 py-1.5 w-24 text-center text-text-muted font-medium">
                操作
              </th>
              <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                削除
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
                <td className="border border-base-border px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => handleDelete(et.id, et.code, et.name)}
                    disabled={deletingId === et.id}
                    className="text-error hover:underline text-sm disabled:opacity-50"
                  >
                    {deletingId === et.id ? "削除中…" : "削除"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-text-muted">計 {equipmentTypes.length} 件</p>
    </div>
  );
}
