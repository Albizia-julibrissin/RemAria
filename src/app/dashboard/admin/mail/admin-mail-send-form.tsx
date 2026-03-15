"use client";

// spec/090: 郵便送信フォーム（管理）

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendMail, type SendMailInput } from "@/server/actions/mail";

type ItemRow = { id: string; code: string; name: string };
type TitleRow = { id: string; code: string; name: string };

type Props = {
  itemList: ItemRow[];
  titleList: TitleRow[];
};

export function AdminMailSendForm({ itemList, titleList }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rewardGraFree, setRewardGraFree] = useState("0");
  const [rewardGraPaid, setRewardGraPaid] = useState("0");
  const [rewardResearchPoint, setRewardResearchPoint] = useState("0");
  const [rewardItems, setRewardItems] = useState<{ itemId: string; amount: number }[]>([
    { itemId: "", amount: 1 },
  ]);
  const [rewardTitleIds, setRewardTitleIds] = useState<string[]>([]);
  const [expiresAtInput, setExpiresAtInput] = useState(""); // datetime-local 用 "" = 無期限
  const [targetType, setTargetType] = useState<"all" | "users">("all");
  const [userIdsText, setUserIdsText] = useState("");

  const handleAddItemRow = () => {
    setRewardItems((prev) => [...prev, { itemId: "", amount: 1 }]);
  };
  const handleItemChange = (index: number, field: "itemId" | "amount", value: string | number) => {
    setRewardItems((prev) => {
      const next = [...prev];
      if (field === "itemId") next[index] = { ...next[index], itemId: String(value) };
      else next[index] = { ...next[index], amount: typeof value === "number" ? value : parseInt(String(value), 10) || 0 };
      return next;
    });
  };
  const handleRemoveItemRow = (index: number) => {
    setRewardItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTitleToggle = (titleId: string) => {
    setRewardTitleIds((prev) =>
      prev.includes(titleId) ? prev.filter((id) => id !== titleId) : [...prev, titleId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const titleTrim = title.trim();
    if (!titleTrim) {
      setError("タイトルを入力してください");
      return;
    }
    const userIds =
      targetType === "users"
        ? userIdsText
            .split(/\n/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    if (targetType === "users" && (!userIds || userIds.length === 0)) {
      setError("指定ユーザーのときはユーザーIDを1行1件で入力してください");
      return;
    }
    const expiresAt = expiresAtInput ? new Date(expiresAtInput) : null;
    const input: SendMailInput = {
      title: titleTrim,
      body: body.trim() || null,
      rewardGraFree: parseInt(rewardGraFree, 10) || 0,
      rewardGraPaid: parseInt(rewardGraPaid, 10) || 0,
      rewardResearchPoint: parseInt(rewardResearchPoint, 10) || 0,
      rewardItems: rewardItems.filter((r) => r.itemId && r.amount > 0),
      rewardTitleIds,
      expiresAt,
      targetType,
      userIds,
    };
    startTransition(async () => {
      const res = await sendMail(input);
      if (res.success) {
        router.push("/dashboard/admin/mail");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
      {error && (
        <div className="rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="mail-title" className="block text-sm font-medium text-text-muted">
          タイトル *
        </label>
        <input
          id="mail-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
          required
        />
      </div>

      <div>
        <label htmlFor="mail-body" className="block text-sm font-medium text-text-muted">
          本文（任意）
        </label>
        <textarea
          id="mail-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded border border-base-border bg-base px-3 py-2 text-text-primary"
        />
      </div>

      <fieldset className="rounded border border-base-border p-4">
        <legend className="text-sm font-medium text-text-muted">付与</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="gra-free" className="block text-xs text-text-muted">
              無償 GRA
            </label>
            <input
              id="gra-free"
              type="number"
              min={0}
              value={rewardGraFree}
              onChange={(e) => setRewardGraFree(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label htmlFor="gra-paid" className="block text-xs text-text-muted">
              有償 GRA
            </label>
            <input
              id="gra-paid"
              type="number"
              min={0}
              value={rewardGraPaid}
              onChange={(e) => setRewardGraPaid(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
          <div>
            <label htmlFor="research-pt" className="block text-xs text-text-muted">
              研究記録書
            </label>
            <input
              id="research-pt"
              type="number"
              min={0}
              value={rewardResearchPoint}
              onChange={(e) => setRewardResearchPoint(e.target.value)}
              className="mt-1 w-full rounded border border-base-border bg-base px-2 py-1 text-text-primary"
            />
          </div>
        </div>
        <div className="mt-4">
          <span className="text-xs text-text-muted">報酬アイテム</span>
          {rewardItems.map((row, i) => (
            <div key={i} className="mt-1 flex gap-2">
              <select
                value={row.itemId}
                onChange={(e) => handleItemChange(i, "itemId", e.target.value)}
                className="flex-1 rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
              >
                <option value="">—</option>
                {itemList.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.code})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={row.amount}
                onChange={(e) => handleItemChange(i, "amount", parseInt(e.target.value, 10) || 0)}
                className="w-20 rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary"
              />
              <button
                type="button"
                onClick={() => handleRemoveItemRow(i)}
                className="text-text-muted hover:text-red-400"
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddItemRow}
            className="mt-2 text-sm text-brass hover:underline"
          >
            + アイテム行を追加
          </button>
        </div>
        <div className="mt-4">
          <span className="text-xs text-text-muted">報酬称号（複数選択可）</span>
          <ul className="mt-1 flex flex-wrap gap-2">
            {titleList.map((t) => (
              <li key={t.id}>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-base-border px-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={rewardTitleIds.includes(t.id)}
                    onChange={() => handleTitleToggle(t.id)}
                  />
                  {t.name}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </fieldset>

      <div>
        <label htmlFor="expires-at" className="block text-sm font-medium text-text-muted">
          有効期限（空欄で無期限）
        </label>
        <input
          id="expires-at"
          type="datetime-local"
          value={expiresAtInput}
          onChange={(e) => setExpiresAtInput(e.target.value)}
          className="mt-1 rounded border border-base-border bg-base px-3 py-2 text-text-primary"
        />
      </div>

      <fieldset className="rounded border border-base-border p-4">
        <legend className="text-sm font-medium text-text-muted">送信先</legend>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="targetType"
              checked={targetType === "all"}
              onChange={() => setTargetType("all")}
            />
            全員（accountStatus=active）
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="targetType"
              checked={targetType === "users"}
              onChange={() => setTargetType("users")}
            />
            指定ユーザー（ユーザーIDを1行1件）
          </label>
        </div>
        {targetType === "users" && (
          <div className="mt-3">
            <textarea
              value={userIdsText}
              onChange={(e) => setUserIdsText(e.target.value)}
              placeholder="userId を1行1件で入力"
              rows={4}
              className="w-full rounded border border-base-border bg-base px-3 py-2 font-mono text-sm text-text-primary"
            />
            <p className="mt-1 text-xs text-text-muted">
              <Link href="/dashboard/admin/users" className="text-brass hover:underline">
                ユーザ一覧
              </Link>
              でユーザーIDを確認できます。
            </p>
          </div>
        )}
      </fieldset>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass-hover disabled:opacity-50"
        >
          {isPending ? "送信中…" : "送信する"}
        </button>
        <Link
          href="/dashboard/admin/mail"
          className="rounded border border-base-border px-4 py-2 text-sm text-text-primary hover:bg-base-elevated"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
