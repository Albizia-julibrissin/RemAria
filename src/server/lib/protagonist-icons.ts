// spec/015 - 主人公アイコン一覧を public/icons から取得（アイコン追加はファイルを置くだけ）

import { readdirSync } from "fs";
import { join } from "path";

const ICONS_DIR = "public/icons";
const ALLOWED_EXT = ".gif";

/** 安全なファイル名か（パストラバーサル・制御文字なし） */
function isSafeFilename(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 200 &&
    !name.includes("..") &&
    !name.includes("/") &&
    !name.includes("\\") &&
    /^[a-zA-Z0-9_.-]+$/.test(name)
  );
}

/**
 * 主人公用アイコンのファイル名一覧を返す。
 * public/icons に置いた .gif がそのまま選べる。追加時はファイルを置くだけでよい。
 */
export function getProtagonistIconFilenames(): string[] {
  try {
    const dir = join(process.cwd(), ICONS_DIR);
    const files = readdirSync(dir);
    return files
      .filter((f) => f.endsWith(ALLOWED_EXT) && isSafeFilename(f))
      .sort((a, b) => a.localeCompare(b, "ja"));
  } catch {
    return [];
  }
}
