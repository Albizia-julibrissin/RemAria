"use server";

// spec/095: 管理画面「本番マスタ更新」。同期候補取得・同期実行・本番バックアップ取得。

import path from "path";
import { execSync } from "child_process";
import { prisma } from "@/lib/db/prisma";
import { PrismaClient } from "@prisma/client";
import { isAdminUser } from "@/server/lib/admin";
import {
  MASTER_DELEGATES_IN_ORDER,
  syncMasters,
  isMasterDelegate,
} from "@/server/lib/sync-masters";

const CONFIRMATION_PHRASE = "本番に反映する";

async function ensureAdmin(): Promise<boolean> {
  return isAdminUser();
}

function getSourceUrl(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url || typeof url !== "string") return null;
  return url.trim() || null;
}

/** 画面で入力された本番接続 URL を検証する。一過性でどこにも保存しない。 */
function validateTargetUrl(targetInput: string | null): { ok: true; url: string } | { ok: false; message: string } {
  const trimmed = (targetInput ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "本番 DB の接続 URL を入力してください。" };
  }
  if (!trimmed.startsWith("postgresql://") && !trimmed.startsWith("postgres://")) {
    return { ok: false, message: "接続 URL は postgresql:// で始まる形式で入力してください。" };
  }
  const source = getSourceUrl();
  if (!source) {
    return { ok: false, message: "DATABASE_URL が設定されていません。" };
  }
  if (source === trimmed) {
    return { ok: false, message: "本番の接続先は、このアプリの接続先（ソース）と異なる URL にしてください。" };
  }
  return { ok: true, url: trimmed };
}

export type MasterSyncCandidate = {
  delegateName: string;
  sourceCount: number;
};

export type GetMasterSyncCandidatesResult =
  | { available: true; candidates: MasterSyncCandidate[] }
  | { available: false; message: string };

/**
 * 同期対象マスタ一覧とソース DB の件数を返す。
 * targetDatabaseUrl: 画面で入力した本番の接続 URL（一過性。保存されない）。
 */
export async function getMasterSyncCandidates(
  targetDatabaseUrl: string | null
): Promise<GetMasterSyncCandidatesResult> {
  const allowed = await ensureAdmin();
  if (!allowed) {
    return { available: false, message: "管理用アカウントのみ利用できます。" };
  }
  const check = validateTargetUrl(targetDatabaseUrl);
  if (!check.ok) {
    return { available: false, message: check.message };
  }

  const candidates: MasterSyncCandidate[] = [];
  const prismaLike = prisma as unknown as Record<
    string,
    { findMany: () => Promise<unknown[]> } | undefined
  >;

  for (const delegateName of MASTER_DELEGATES_IN_ORDER) {
    const delegate = prismaLike[delegateName];
    let sourceCount = 0;
    if (delegate?.findMany) {
      try {
        const rows = await delegate.findMany();
        sourceCount = Array.isArray(rows) ? rows.length : 0;
      } catch {
        sourceCount = 0;
      }
    }
    candidates.push({ delegateName, sourceCount });
  }

  return { available: true, candidates };
}

export type SyncMastersToProductionResult =
  | { ok: true; results: Array<{ delegateName: string; upserted: number }> }
  | {
      ok: false;
      error: string;
      message: string;
      results?: Array<{ delegateName: string; upserted: number }>;
      failedAt?: string;
      failureMessage?: string;
    };

/**
 * 選択したマスタを本番 DB に upsert する。確認文言が一致しないと実行しない。
 * targetDatabaseUrl: 画面で入力した本番の接続 URL（一過性）。
 */
export async function syncMastersToProduction(
  selectedDelegates: string[],
  confirmationPhrase: string,
  targetDatabaseUrl: string
): Promise<SyncMastersToProductionResult> {
  const allowed = await ensureAdmin();
  if (!allowed) {
    return { ok: false, error: "FORBIDDEN", message: "管理用アカウントのみ利用できます。" };
  }

  const check = validateTargetUrl(targetDatabaseUrl);
  if (!check.ok) {
    return { ok: false, error: "UNAVAILABLE", message: check.message };
  }

  const trimmed = (confirmationPhrase ?? "").trim();
  if (trimmed !== CONFIRMATION_PHRASE) {
    return {
      ok: false,
      error: "CONFIRMATION_PHRASE_MISMATCH",
      message: "確認文言が一致しません。「本番に反映する」と入力してください。",
    };
  }

  if (selectedDelegates.length === 0) {
    return {
      ok: false,
      error: "NO_SELECTION",
      message: "同期するマスタを 1 つ以上選択してください。",
    };
  }

  const invalid = selectedDelegates.filter((d) => !isMasterDelegate(d));
  if (invalid.length > 0) {
    return {
      ok: false,
      error: "INVALID_DELEGATES",
      message: `不正なマスタ名が含まれています: ${invalid.join(", ")}`,
    };
  }

  const target = new PrismaClient({ datasourceUrl: check.url });

  try {
    await target.$connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: "TARGET_CONNECT_FAILED",
      message: `本番 DB に接続できません: ${msg}`,
    };
  }

  try {
    const result = await syncMasters(prisma, target, {
      onlyDelegates: selectedDelegates.length > 0 ? selectedDelegates : undefined,
    });

    if (result.failedAt != null) {
      return {
        ok: false,
        error: "SYNC_PARTIAL_FAILURE",
        message: `${result.failedAt} の処理中にエラーが発生しました: ${result.failureMessage ?? ""}`,
        results: result.results,
        failedAt: result.failedAt,
        failureMessage: result.failureMessage,
      };
    }

    return { ok: true, results: result.results };
  } finally {
    await target.$disconnect();
  }
}

export type CreateProductionBackupResult =
  | { ok: true; filename: string; path: string }
  | { ok: false; error: string; message: string };

/**
 * 本番 DB の pg_dump を実行し、manage/backups/ に保存する。
 * targetDatabaseUrl: 画面で入力した本番の接続 URL（一過性）。
 */
export async function createProductionBackup(
  targetDatabaseUrl: string
): Promise<CreateProductionBackupResult> {
  const allowed = await ensureAdmin();
  if (!allowed) {
    return { ok: false, error: "FORBIDDEN", message: "管理用アカウントのみ利用できます。" };
  }

  const check = validateTargetUrl(targetDatabaseUrl);
  if (!check.ok) {
    return { ok: false, error: "UNAVAILABLE", message: check.message };
  }

  const targetUrl = check.url;
  const backupsDir = path.join(process.cwd(), "manage", "backups");
  const { mkdirSync, existsSync } = await import("fs");
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  const filename = `remaria_production_${timestamp}.dump`;
  const outFile = path.join(backupsDir, filename);

  try {
    execSync(`pg_dump "${targetUrl}" -Fc -f "${outFile}"`, {
      stdio: "pipe",
      shell: true as const,
      maxBuffer: 1024 * 1024 * 100,
    } as unknown as import("child_process").ExecSyncOptions);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: "BACKUP_FAILED",
      message: `本番バックアップに失敗しました。pg_dump が利用可能か確認してください: ${msg}`,
    };
  }

  const downloadPath = `/api/admin/backup-download?file=${encodeURIComponent(filename)}`;
  return { ok: true, filename, path: downloadPath };
}
