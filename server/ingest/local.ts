import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { UserError } from "../errors";
import { IGNORED_DIRS, isIgnoredPath, packSources, pickReadme, renderTree, selectFiles, type FileEntry } from "./rank";
import type { IngestResult } from "./types";

const MAX_FILES = 5000;

export function looksLikePath(input: string): boolean {
  const s = input.trim();
  if (s.includes("\n") || s.length > 1024) return false;
  return /^(~|\/|\.{1,2}\/|[A-Za-z]:[\\/])/.test(s);
}

export function expandPath(input: string): string {
  const s = input.trim().replace(/^["']|["']$/g, "");
  return path.resolve(s.startsWith("~") ? path.join(os.homedir(), s.slice(1)) : s);
}

async function walk(root: string): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  const queue = [""];
  while (queue.length && out.length < MAX_FILES) {
    const rel = queue.shift()!;
    let entries;
    try {
      entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      // Symlinks are not followed (loops, paths outside the folder)
      if (e.isDirectory()) {
        if (!IGNORED_DIRS.has(e.name)) queue.push(p);
      } else if (e.isFile() && !isIgnoredPath(p)) {
        try {
          const st = await fs.stat(path.join(root, p));
          out.push({ path: p, size: st.size });
        } catch {
          /* unreadable – skip */
        }
      }
      if (out.length >= MAX_FILES) break;
    }
  }
  return out;
}

async function readText(file: string, maxBytes = 400_000): Promise<string | null> {
  try {
    const handle = await fs.open(file, "r");
    try {
      const buf = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buf, 0, maxBytes, 0);
      const slice = buf.subarray(0, bytesRead);
      if (slice.subarray(0, 8000).includes(0)) return null; // binary
      return slice.toString("utf8");
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

export async function ingestLocal(input: string, budget: number): Promise<IngestResult> {
  const root = expandPath(input);
  let st;
  try {
    st = await fs.stat(root);
  } catch {
    throw new UserError(`Path "${root}" not found.`, "Enter the absolute path of a folder on this computer.", 404);
  }

  if (st.isFile()) {
    const text = await readText(root, budget * 2);
    if (text === null) throw new UserError("This file is not a text file.", "Pick a Markdown or text file.");
    const truncated = text.length > budget;
    return {
      kind: "local",
      label: path.basename(root),
      text: truncated ? text.slice(0, budget) + "\n[… truncated]" : text,
      truncated,
      fileCount: 1,
    };
  }
  if (!st.isDirectory()) throw new UserError(`"${root}" is not a folder.`);

  const files = await walk(root);
  if (!files.length) throw new UserError("No readable files found in this folder.");

  const readmeEntry = pickReadme(files);
  const picked = selectFiles(files, 15);
  const readmeText = readmeEntry ? await readText(path.join(root, readmeEntry.path)) : null;
  const loaded: { path: string; text: string }[] = [];
  for (const f of picked) {
    const text = await readText(path.join(root, f.path));
    if (text) loaded.push({ path: f.path, text });
  }

  let pkgName = "";
  try {
    pkgName = JSON.parse((await readText(path.join(root, "package.json"))) ?? "{}").name ?? "";
  } catch {
    /* no package.json */
  }
  const name = pkgName || path.basename(root);
  const header = [`# Local project: ${name}`, `Files: ${files.length}${files.length >= MAX_FILES ? "+" : ""}`].join("\n");
  const packed = packSources(
    header,
    readmeEntry && readmeText ? { path: readmeEntry.path, text: readmeText } : null,
    loaded,
    renderTree(files),
    budget,
  );
  return {
    kind: "local",
    label: name,
    text: packed.text,
    truncated: packed.truncated,
    fileCount: loaded.length + (readmeText ? 1 : 0),
  };
}
