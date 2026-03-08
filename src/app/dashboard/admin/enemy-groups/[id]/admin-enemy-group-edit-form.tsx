"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminEnemyGroupEditData,
  AdminEnemyGroupEntryRow,
} from "@/server/actions/admin";
import { updateAdminEnemyGroup, saveEnemyGroupEntries } from "@/server/actions/admin";

type GroupEntryEdit = {
  tempId: string;
  enemyId: string;
  enemyCode: string;
  enemyName: string;
  weight: number;
};

function toEditEntry(e: AdminEnemyGroupEntryRow): GroupEntryEdit {
  return {
    tempId: e.id,
    enemyId: e.enemyId,
    enemyCode: e.enemyCode,
    enemyName: e.enemyName,
    weight: e.weight,
  };
}

type Props = {
  data: AdminEnemyGroupEditData;
};

export function AdminEnemyGroupEditForm({ data }: Props) {
  const router = useRouter();
  const { group, entries, enemies } = data;
  const [code, setCode] = useState(group.code);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [groupEntries, setGroupEntries] = useState<GroupEntryEdit[]>(() =>
    entries.map(toEditEntry)
  );
  const [groupSaveMessage, setGroupSaveMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [groupSavePending, setGroupSavePending] = useState(false);

  const entriesSig = useMemo(
    () => entries.map((e) => e.id).sort().join(","),
    [entries]
  );
  useEffect(() => {
    setGroupEntries(entries.map(toEditEntry));
  }, [group.id, entriesSig]);

  const handleSaveCode = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateAdminEnemyGroup(group.id, { code: code.trim() });
      setMessage(
        result.success
          ? { type: "ok", text: "code を保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const handleSaveGroupEntries = () => {
    setGroupSavePending(true);
    setGroupSaveMessage(null);
    saveEnemyGroupEntries(
      group.id,
      groupEntries.map((e) => ({ enemyId: e.enemyId, weight: e.weight }))
    ).then((result) => {
      setGroupSavePending(false);
      setGroupSaveMessage(
        result.success
          ? { type: "ok", text: "メンバーを保存しました。" }
          : { type: "error", text: result.error ?? "保存に失敗しました。" }
      );
      if (result.success) router.refresh();
    });
  };

  const addGroupEntry = () => {
    const first = enemies[0];
    if (!first) return;
    setGroupEntries((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}`,
        enemyId: first.id,
        enemyCode: first.code,
        enemyName: first.name,
        weight: 1,
      },
    ]);
  };

  const removeGroupEntry = (tempId: string) => {
    setGroupEntries((prev) => prev.filter((e) => e.tempId !== tempId));
  };

  const updateGroupEntry = (tempId: string, patch: Partial<GroupEntryEdit>) => {
    setGroupEntries((prev) =>
      prev.map((e) => (e.tempId === tempId ? { ...e, ...patch } : e))
    );
  };

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">code</h2>
        {message && (
          <p className={`mt-2 text-sm ${message.type === "ok" ? "text-success" : "text-error"}`}>
            {message.text}
          </p>
        )}
        <form onSubmit={handleSaveCode} className="mt-3 flex items-end gap-2">
          <div>
            <label className="block text-sm font-medium text-text-muted">code（ユニーク）</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="mt-1 w-48 rounded border border-base-border bg-base px-3 py-2 text-text-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
          >
            {isPending ? "保存中…" : "保存"}
          </button>
        </form>
      </section>

      <section className="rounded border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-medium text-text-primary">メンバー（通常戦で抽選される敵）</h2>
        <p className="mt-1 text-sm text-text-muted">
          このグループに含める敵と重みを設定します。探索エリアで「通常戦 雑魚グループ」にこのグループの code を選ぶと、ここで設定した敵から抽選されます。
        </p>
        {groupSaveMessage && (
          <p
            className={`mt-2 text-sm ${groupSaveMessage.type === "ok" ? "text-success" : "text-error"}`}
          >
            {groupSaveMessage.text}
          </p>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm border-collapse border border-base-border">
            <thead>
              <tr className="bg-base">
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium">
                  敵
                </th>
                <th className="border border-base-border px-2 py-1.5 text-left text-text-muted font-medium w-20">
                  重み
                </th>
                <th className="border border-base-border px-2 py-1.5 w-16 text-center text-text-muted font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {groupEntries.map((row) => (
                <tr key={row.tempId} className="text-text-primary">
                  <td className="border border-base-border px-2 py-1.5">
                    <select
                      value={row.enemyId}
                      onChange={(e) => {
                        const en = enemies.find((x) => x.id === e.target.value);
                        if (en)
                          updateGroupEntry(row.tempId, {
                            enemyId: en.id,
                            enemyCode: en.code,
                            enemyName: en.name,
                          });
                      }}
                      className="w-full max-w-[200px] rounded border border-base-border bg-base px-2 py-1 text-text-primary"
                    >
                      {enemies.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.code} — {e.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-base-border px-2 py-1.5">
                    <input
                      type="number"
                      min={1}
                      value={row.weight}
                      onChange={(e) =>
                        updateGroupEntry(row.tempId, {
                          weight: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className="w-16 rounded border border-base-border bg-base px-2 py-1 text-text-primary"
                    />
                  </td>
                  <td className="border border-base-border px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeGroupEntry(row.tempId)}
                      className="text-error hover:underline text-xs"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addGroupEntry}
            disabled={enemies.length === 0}
            className="rounded border border-base-border bg-base-elevated px-3 py-1.5 text-sm text-text-primary hover:bg-base disabled:opacity-50"
          >
            ＋ 敵を追加
          </button>
          <button
            type="button"
            onClick={handleSaveGroupEntries}
            disabled={groupSavePending}
            className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50"
          >
            {groupSavePending ? "保存中…" : "メンバーを保存"}
          </button>
        </div>
      </section>
    </div>
  );
}
