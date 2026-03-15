"use client";

import { useState } from "react";
import { AdminBackButton } from "../admin-back-button";
import {
  getMasterSyncCandidates,
  syncMastersToProduction,
  createProductionBackup,
  type GetMasterSyncCandidatesResult,
  type MasterSyncCandidate,
} from "@/server/actions/master-production-sync";

export function MasterProductionSyncClient() {
  const [targetUrl, setTargetUrl] = useState("");
  const [data, setData] = useState<GetMasterSyncCandidatesResult | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [syncPending, setSyncPending] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [backupPending, setBackupPending] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);

  const CONFIRMATION_PHRASE = "本番に反映する";
  const phraseOk = confirmPhrase.trim() === CONFIRMATION_PHRASE;

  const fetchCandidates = async () => {
    setListLoading(true);
    setData(null);
    setSyncResult(null);
    setBackupResult(null);
    try {
      const res = await getMasterSyncCandidates(targetUrl.trim() || null);
      setData(res);
    } finally {
      setListLoading(false);
    }
  };

  const candidates = data?.available ? data.candidates : [];
  const selectAll = () => setSelected(new Set(candidates.map((c) => c.delegateName)));
  const clearAll = () => setSelected(new Set());
  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleBackup = async () => {
    const url = targetUrl.trim();
    if (!url) return;
    setBackupResult(null);
    setBackupPending(true);
    try {
      const res = await createProductionBackup(url);
      if (res.ok) {
        setBackupResult(`バックアップを作成しました: ${res.filename}`);
        window.open(res.path, "_blank", "noopener,noreferrer");
      } else {
        setBackupResult(`エラー: ${res.message}`);
      }
    } finally {
      setBackupPending(false);
    }
  };

  const handleSyncSubmit = async () => {
    if (!phraseOk || selected.size === 0) return;
    const url = targetUrl.trim();
    if (!url) return;
    setSyncResult(null);
    setSyncPending(true);
    try {
      const res = await syncMastersToProduction(Array.from(selected), confirmPhrase, url);
      if (res.ok) {
        setSyncResult(
          `同期完了: ${res.results.map((r) => `${r.delegateName} ${r.upserted}件`).join(", ")}`
        );
        setSyncModalOpen(false);
        setConfirmPhrase("");
      } else {
        setSyncResult(`エラー: ${res.message}`);
      }
    } finally {
      setSyncPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="mb-6">
        <AdminBackButton />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">本番マスタ更新</h1>
      <p className="mt-2 text-sm text-text-muted">
        ローカルで編集したマスタを本番 DB に反映します。本番の接続先は画面で入力し、この操作でのみ使用します（保存されません）。
      </p>

      {/* 本番接続 URL 入力（一過性） */}
      <section className="mt-6 rounded-lg border border-base-border bg-base-elevated p-4">
        <h2 className="text-lg font-semibold text-text-primary">本番 DB の接続先</h2>
        <p className="mt-1 text-sm text-text-muted">
          本番の PostgreSQL 接続 URL を入力してください。どこにも保存されず、この画面を開いている間のみメモリに保持されます。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label htmlFor="target-url" className="sr-only">
            本番 DB 接続 URL
          </label>
          <input
            id="target-url"
            type="password"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="postgresql://user:pass@host:5432/dbname"
            className="min-w-[280px] flex-1 rounded border border-base-border bg-base px-3 py-2 text-text-primary placeholder:text-text-muted"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={fetchCandidates}
            disabled={listLoading || !targetUrl.trim()}
            className="rounded border border-brass bg-brass/20 px-4 py-2 text-sm font-medium text-text-primary hover:bg-brass/30 disabled:opacity-50"
          >
            {listLoading ? "確認中…" : "一覧を取得"}
          </button>
        </div>
        {data && !data.available && (
          <p className="mt-2 text-sm text-amber-400">{data.message}</p>
        )}
      </section>

      {!data?.available && !listLoading && (
        <p className="mt-6 text-sm text-text-muted">
          上で本番の接続 URL を入力し「一覧を取得」を押すと、バックアップ取得・マスタ同期の操作が表示されます。
        </p>
      )}

      {data?.available && (
        <>
          <div className="mt-6 rounded-lg border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-text-primary">
            <strong>注意:</strong> 本番 DB に直接書き込みます。対象マスタは上書きされます。
          </div>

          {/* 本番バックアップ取得 */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-text-primary">本番のバックアップを取得</h2>
            <p className="mt-1 text-sm text-text-muted">
              本番 DB の現在の状態を .dump で保存し、ダウンロードします。
            </p>
            <button
              type="button"
              onClick={handleBackup}
              disabled={backupPending}
              className="mt-3 rounded-lg border border-base-border bg-base-elevated px-4 py-2 text-text-primary hover:border-brass disabled:opacity-50"
            >
              {backupPending ? "取得中…" : "本番のバックアップを取得"}
            </button>
            {backupResult && (
              <p className={`mt-2 text-sm ${backupResult.startsWith("エラー") ? "text-red-400" : "text-text-muted"}`}>
                {backupResult}
              </p>
            )}
          </section>

          {/* マスタ同期 */}
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-text-primary">マスタを本番に同期</h2>
            <p className="mt-1 text-sm text-text-muted">
              同期するマスタを選択し、確認文言を入力してから実行してください。
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="rounded border border-base-border bg-base-elevated px-3 py-1.5 text-sm text-text-primary hover:border-brass"
              >
                全選択
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded border border-base-border bg-base-elevated px-3 py-1.5 text-sm text-text-primary hover:border-brass"
              >
                全解除
              </button>
              <button
                type="button"
                onClick={() => {
                  setSyncResult(null);
                  setSyncModalOpen(true);
                }}
                disabled={selected.size === 0}
                className="rounded border border-brass bg-brass/20 px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-brass/30 disabled:opacity-50"
              >
                実行
              </button>
            </div>

            <ul className="mt-4 grid max-h-80 list-none gap-1 overflow-y-auto rounded border border-base-border bg-base-elevated p-3 sm:grid-cols-2 md:grid-cols-3">
              {candidates.map((c) => (
                <li key={c.delegateName} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`chk-${c.delegateName}`}
                    checked={selected.has(c.delegateName)}
                    onChange={() => toggle(c.delegateName)}
                    className="h-4 w-4 rounded border-base-border"
                  />
                  <label htmlFor={`chk-${c.delegateName}`} className="cursor-pointer text-sm text-text-primary">
                    {c.delegateName} <span className="text-text-muted">({c.sourceCount}件)</span>
                  </label>
                </li>
              ))}
            </ul>

            {syncResult && (
              <p className={`mt-3 text-sm ${syncResult.startsWith("エラー") ? "text-red-400" : "text-text-muted"}`}>
                {syncResult}
              </p>
            )}
          </section>

          {/* 確認モーダル */}
          {syncModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sync-modal-title"
            >
              <div className="w-full max-w-md rounded-lg border border-base-border bg-base p-6 shadow-lg">
                <h2 id="sync-modal-title" className="text-lg font-semibold text-text-primary">
                  本番に反映する
                </h2>
                <p className="mt-2 text-sm text-text-muted">
                  以下の文言をそのまま入力してください: <strong>{CONFIRMATION_PHRASE}</strong>
                </p>
                <input
                  type="text"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder={CONFIRMATION_PHRASE}
                  className="mt-3 w-full rounded border border-base-border bg-base-elevated px-3 py-2 text-text-primary placeholder:text-text-muted"
                  autoFocus
                />
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSyncModalOpen(false);
                      setConfirmPhrase("");
                    }}
                    className="rounded border border-base-border px-4 py-2 text-text-primary hover:border-brass"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncSubmit}
                    disabled={!phraseOk || syncPending}
                    className="rounded border border-brass bg-brass/20 px-4 py-2 font-medium text-text-primary hover:bg-brass/30 disabled:opacity-50"
                  >
                    {syncPending ? "実行中…" : "本番に反映する"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
