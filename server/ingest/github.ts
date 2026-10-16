import { UserError } from "../errors";
import { packSources, pickReadme, renderTree, selectFiles, type FileEntry } from "./rank";
import type { IngestResult } from "./types";

const GITHUB_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/\s]+)(?:\/([^\s?#]*))?)?\/?(?:[?#].*)?$/i;

export function parseGithubUrl(input: string) {
  const m = input.trim().match(GITHUB_URL);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3] as string | undefined, subpath: (m[4] ?? "").replace(/\/$/, "") };
}

function headers(raw = false): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": "explainer-app",
    Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function gh<T>(url: string, what: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new UserError("GitHub is not reachable.", "Check your internet connection and try again.", 502);
  }
  if (res.ok) return (await res.json()) as T;
  if (res.status === 404) {
    throw new UserError(
      `${what} not found.`,
      process.env.GITHUB_TOKEN
        ? "Check the URL – does your GITHUB_TOKEN have access to this repo?"
        : "Check the URL. Private repos need a GITHUB_TOKEN in .env.",
      404,
    );
  }
  if (res.status === 401) throw new UserError("GitHub rejected the token.", "Check GITHUB_TOKEN in .env.", 401);
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const when = reset ? ` (resets at ${new Date(reset * 1000).toLocaleTimeString("en-GB")})` : "";
    throw new UserError(
      `GitHub rate limit reached${when}.`,
      "Without a token GitHub allows 60 requests per hour. Set GITHUB_TOKEN in .env.",
      429,
    );
  }
  throw new UserError(`GitHub answered with error ${res.status}.`, "Try again later.", 502);
}

async function rawFile(owner: string, repo: string, ref: string, path: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  try {
    const res = await fetch(url, { headers: headers(true), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const text = await res.text();
    return text.includes("\u0000") ? null : text;
  } catch {
    return null;
  }
}

/** Runs promises with limited concurrency. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

interface RepoInfo {
  full_name: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  homepage: string | null;
  license: { name: string } | null;
}

interface TreeResponse {
  tree: { path: string; type: string; size?: number }[];
  truncated: boolean;
}

export async function ingestGithub(input: string, budget: number): Promise<IngestResult> {
  const parsed = parseGithubUrl(input);
  if (!parsed) throw new UserError("This is not a valid GitHub URL.", "Format: https://github.com/owner/repo");
  const { owner, repo, subpath } = parsed;
  const api = `https://api.github.com/repos/${owner}/${repo}`;

  const info = await gh<RepoInfo>(api, `Repo "${owner}/${repo}"`);
  const ref = parsed.ref ?? info.default_branch;
  const tree = await gh<TreeResponse>(`${api}/git/trees/${encodeURIComponent(ref)}?recursive=1`, `Branch "${ref}"`);

  const prefix = subpath ? subpath + "/" : "";
  const files: FileEntry[] = tree.tree
    .filter((t) => t.type === "blob" && t.path.startsWith(prefix))
    .map((t) => ({ path: t.path.slice(prefix.length), size: t.size ?? 0 }));
  if (!files.length) throw new UserError("No files found in this repo.", subpath ? `Check the path "${subpath}".` : undefined);

  const readmeEntry = pickReadme(files);
  const picked = selectFiles(files, 15);
  const [readmeText, ...texts] = await mapLimit([readmeEntry, ...picked], 6, (f) =>
    f ? rawFile(owner, repo, ref, prefix + f.path) : Promise.resolve(null),
  );

  const header = [
    `# Repository: ${info.full_name}${subpath ? ` (folder ${subpath})` : ""}`,
    info.description ? `Description: ${info.description}` : "",
    info.language ? `Primary language: ${info.language}` : "",
    info.topics?.length ? `Topics: ${info.topics.join(", ")}` : "",
    `Stars: ${info.stargazers_count}`,
    info.homepage ? `Homepage: ${info.homepage}` : "",
    info.license ? `License: ${info.license.name}` : "",
    tree.truncated ? "(File tree truncated by GitHub – very large repo)" : "",
  ]
    .filter(Boolean)
    .join("\n");

  const loaded = picked.map((f, i) => ({ path: f.path, text: texts[i] })).filter((f): f is { path: string; text: string } => !!f.text);
  const packed = packSources(
    header,
    readmeEntry && readmeText ? { path: readmeEntry.path, text: readmeText } : null,
    loaded,
    renderTree(files),
    budget,
  );
  return {
    kind: "github",
    label: `${info.full_name}${subpath ? "/" + subpath : ""}`,
    text: packed.text,
    truncated: packed.truncated,
    fileCount: loaded.length + (readmeText ? 1 : 0),
  };
}
