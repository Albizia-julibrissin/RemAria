// spec/095: 本番バックアップのダウンロード。管理者のみ。remaria_production_*.dump に限定。

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { isAdminUser } from "@/server/lib/admin";

const ALLOWED_PREFIX = "remaria_production_";
const ALLOWED_SUFFIX = ".dump";

function isAllowedFilename(file: string | null): boolean {
  if (!file || typeof file !== "string") return false;
  if (file.includes("..") || path.isAbsolute(file)) return false;
  if (!file.startsWith(ALLOWED_PREFIX) || !file.endsWith(ALLOWED_SUFFIX))
    return false;
  return /^remaria_production_\d{8}_\d{6}\.dump$/.test(file);
}

export async function GET(request: NextRequest) {
  const allowed = await isAdminUser();
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const file = request.nextUrl.searchParams.get("file");
  if (!isAllowedFilename(file)) {
    return NextResponse.json(
      { error: "Invalid or missing file parameter" },
      { status: 400 }
    );
  }

  const backupsDir = path.join(process.cwd(), "manage", "backups");
  const fullPath = path.join(backupsDir, file!);
  const resolved = path.resolve(fullPath);
  const backupsResolved = path.resolve(backupsDir);

  if (!resolved.startsWith(backupsResolved)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const nodeStream = fs.createReadStream(resolved);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}
