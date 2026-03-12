/**
 * バックアップから DB を復元する。
 *
 * 実行例:
 *   npm run db:restore
 *   npm run db:restore -- manage/backups/remaria_20250101.dump
 *   npm run db:restore -- --target "postgresql://user:pass@localhost:5432/remaria_restore"
 *   npm run db:restore -- --target "postgresql://..." manage/backups/remaria_20250101.dump
 *
 * --target <URL> を指定すると、その URL の DB にだけ復元する（上書きしない）。
 * 対象 DB はあらかじめ作成しておくこと。
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

function parseArgs(): { dumpPath: string; targetUrl: string | null } {
  const args = process.argv.slice(2);
  let targetUrl: string | null = process.env.RESTORE_TARGET_URL ?? null;
  const fileArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target" && args[i + 1]) {
      targetUrl = args[i + 1];
      i++;
    } else if (args[i] && !args[i].startsWith("--")) {
      if (args[i].startsWith("postgresql://") || args[i].startsWith("postgres://")) {
        targetUrl = args[i];
      } else if (fs.existsSync(args[i])) {
        fileArgs.push(args[i]);
      } else {
        const resolved = path.resolve(args[i]);
        if (fs.existsSync(resolved)) fileArgs.push(resolved);
      }
    }
  }

  let dumpPath: string;
  if (fileArgs.length > 0) {
    dumpPath = path.resolve(fileArgs[0]);
  } else {
    const backupsDir = path.join(__dirname, "..", "manage", "backups");
    if (!fs.existsSync(backupsDir)) {
      console.error("manage/backups が存在しません。先にバックアップを取ってください。");
      process.exit(1);
    }
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.endsWith(".dump"))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) {
      console.error("manage/backups に .dump ファイルがありません。");
      process.exit(1);
    }
    dumpPath = path.join(backupsDir, files[0].name);
    console.log(`Using latest backup: ${files[0].name}`);
  }
  return { dumpPath, targetUrl };
}

function main(): void {
  loadEnv();
  const defaultUrl = process.env.DATABASE_URL;
  if (!defaultUrl) {
    console.error("DATABASE_URL が設定されていません。.env を確認してください。");
    process.exit(1);
  }

  const { dumpPath, targetUrl } = parseArgs();
  const restoreUrl = targetUrl ?? defaultUrl;
  const execOptsInherit = { stdio: "inherit" as const, shell: true } as unknown as ExecSyncOptions;
  const execOptsPipe = { stdio: "pipe" as const, shell: true } as unknown as ExecSyncOptions;

  const isLocalhost = (u: string): boolean => {
    try {
      const h = new URL(u).hostname;
      return h === "localhost" || h === "127.0.0.1";
    } catch {
      return false;
    }
  };

  const parsedRestore = ((): { user: string; dbName: string } | null => {
    try {
      const u = new URL(restoreUrl);
      return {
        user: u.username || "remaria",
        dbName: u.pathname?.replace(/^\//, "") || "remaria",
      };
    } catch {
      return null;
    }
  })();

  if (targetUrl) {
    console.log("別 DB に復元します（現在の DB は触りません）:", restoreUrl.replace(/:[^:@]+@/, ":****@"));
  } else {
    // DROP: localhost なら Docker を優先（バックアップ・復元で同じ Postgres に揃える）
    console.log("Dropping existing schema...");
    const dropViaDocker = (): boolean => {
      if (!isLocalhost(defaultUrl) || !parsedRestore) return false;
      try {
        execSync(
          `docker exec remaria-db psql -U ${parsedRestore.user} -d ${parsedRestore.dbName} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`,
          execOptsInherit
        );
        return true;
      } catch {
        return false;
      }
    };
    const dropViaHost = (): boolean => {
      try {
        execSync(`psql "${defaultUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`, execOptsInherit);
        return true;
      } catch {
        return false;
      }
    };
    if (!dropViaDocker() && !dropViaHost()) {
      console.error("psql での DROP に失敗しました。DB が存在するか、接続情報を確認してください。");
      process.exit(1);
    }
  }

  const tryDockerRestore = (): boolean => {
    if (!parsedRestore || !isLocalhost(restoreUrl)) return false;
    try {
      const dumpBasename = path.basename(dumpPath);
      const containerPath = `/tmp/${dumpBasename}`;
      execSync(`docker cp "${dumpPath}" remaria-db:${containerPath}`, execOptsInherit);
      execSync(
        `docker exec remaria-db pg_restore -U ${parsedRestore.user} -d ${parsedRestore.dbName} --no-owner --no-privileges ${containerPath}`,
        execOptsInherit
      );
      execSync(`docker exec remaria-db rm ${containerPath}`, execOptsPipe);
      return true;
    } catch {
      return false;
    }
  };

  const tryHostRestore = (): boolean => {
    try {
      execSync(`pg_restore -d "${restoreUrl}" --no-owner --no-privileges "${dumpPath}"`, execOptsInherit);
      return true;
    } catch {
      return false;
    }
  };

  // localhost のときはホストの pg_restore を先に試す（PC に 18 など新しいバージョンがあれば、18 形式のダンプを Docker 16 に復元できる）
  console.log("Restoring...");
  if (tryHostRestore()) {
    console.log("Restore completed.");
    return;
  }
  if (isLocalhost(restoreUrl) && tryDockerRestore()) {
    console.log("Restore completed (via Docker).");
    return;
  }
  if (tryDockerRestore()) {
    console.log("Restore completed (via Docker).");
    return;
  }
  console.error(
    "pg_restore に失敗しました。PostgreSQL クライアントをインストールするか、Docker で remaria-db が起動しているか確認してください。"
  );
  process.exit(1);
}

main();
