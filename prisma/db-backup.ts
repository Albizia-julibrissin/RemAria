/**
 * 現在の DB をバックアップする。
 * 実行: npm run db:backup
 * 出力: manage/backups/remaria_YYYYMMDD_HHmmss.dump
 *
 * 接続先が localhost のときは Docker (remaria-db) の pg_dump を優先する。
 * 復元時も同じく localhost なら Docker を優先するため、バックアップ・復元で Postgres バージョンが揃う。
 * それ以外はホストの pg_dump を試し、失敗時のみ Docker にフォールバックする。
 */
import * as fs from "fs";
import * as path from "path";
import { execSync, type ExecSyncOptions } from "child_process";

function loadEnv(): void {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function parseDatabaseUrl(url: string): { user: string; db: string } | null {
  try {
    const u = new URL(url);
    const user = u.username || "remaria";
    const db = u.pathname?.replace(/^\//, "") || "remaria";
    return { user, db };
  } catch {
    return null;
  }
}

function main(): void {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL が設定されていません。.env を確認してください。");
    process.exit(1);
  }

  const backupsDir = path.join(__dirname, "..", "manage", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  const outFile = path.join(backupsDir, `remaria_${timestamp}.dump`);

  const parsed = parseDatabaseUrl(url);
  if (!parsed) {
    console.error("DATABASE_URL の形式が不正です。");
    process.exit(1);
  }
  const { user, db } = parsed;
  const rootDir = path.join(__dirname, "..");
  const execOptsPipe = { stdio: "pipe" as const, shell: true } as unknown as ExecSyncOptions;
  const execOptsInherit = { stdio: "inherit" as const, shell: true } as unknown as ExecSyncOptions;

  // 接続先が localhost のときは Docker を先に使う（バックアップ・復元で同じ Postgres バージョンに揃えるため）
  const isLocalhost = (u: string): boolean => {
    try {
      const h = new URL(u).hostname;
      return h === "localhost" || h === "127.0.0.1";
    } catch {
      return false;
    }
  };

  const tryDockerBackup = (): boolean => {
    try {
      const runInDocker = (composeCmd: string): boolean => {
        try {
          execSync(
            `${composeCmd} -T db pg_dump -U ${user} -Fc ${db} > "${outFile}"`,
            { ...execOptsInherit, cwd: rootDir }
          );
          return true;
        } catch {
          return false;
        }
      };
      if (runInDocker("docker compose exec") || runInDocker("docker-compose exec")) return true;
      execSync(
        `docker exec remaria-db pg_dump -U ${user} -Fc ${db} -f /tmp/remaria_backup.dump`,
        execOptsInherit
      );
      execSync(`docker cp remaria-db:/tmp/remaria_backup.dump "${outFile}"`, execOptsInherit);
      execSync("docker exec remaria-db rm /tmp/remaria_backup.dump", execOptsPipe);
      return true;
    } catch {
      return false;
    }
  };

  const tryHostBackup = (): boolean => {
    try {
      execSync(`pg_dump "${url}" -Fc -f "${outFile}"`, execOptsPipe);
      return true;
    } catch {
      return false;
    }
  };

  if (isLocalhost(url) && tryDockerBackup()) {
    console.log(`Backup written: ${outFile} (via Docker)`);
    return;
  }
  if (tryHostBackup()) {
    console.log(`Backup written: ${outFile}`);
    return;
  }
  if (!isLocalhost(url) && tryDockerBackup()) {
    console.log(`Backup written: ${outFile} (via Docker)`);
    return;
  }
  console.error(
    "バックアップに失敗しました。PostgreSQL クライアント (pg_dump) をインストールするか、Docker で db コンテナ (remaria-db) が起動しているか確認してください。"
  );
  process.exit(1);
}

main();
