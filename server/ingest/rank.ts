/* ------------------------------------------------------------------ *
 * Picks the most relevant files of a repo or folder.
 * Same logic for GitHub and local folders.
 * ------------------------------------------------------------------ */

export const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
  ".idea",
  ".vscode",
  "vendor",
  "Pods",
  ".gradle",
  ".context",
]);

const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
  "Cargo.lock",
  "poetry.lock",
  "Pipfile.lock",
  "composer.lock",
  "Gemfile.lock",
  "go.sum",
  "uv.lock",
  "flake.lock",
  "mix.lock",
  "pubspec.lock",
  "Podfile.lock",
]);

const BINARY_EXT = new Set(
  (
    "png jpg jpeg gif webp bmp ico icns tiff psd ai sketch fig svgz pdf zip gz tgz bz2 xz 7z rar jar war " +
    "class so dylib dll exe bin o a lib wasm mp3 mp4 mov avi mkv webm wav flac ogg ttf otf woff woff2 eot " +
    "db sqlite sqlite3 pyc pyo pkl npy npz h5 onnx pt ckpt safetensors parquet arrow avro xlsx xls docx doc pptx key numbers"
  ).split(" "),
);

const TEXT_EXT = new Set(
  (
    "md mdx txt rst adoc ts tsx js jsx mjs cjs py rb go rs java kt kts scala swift m mm c h cc cpp hpp cs php " +
    "ex exs erl hs ml clj lua r jl dart vue svelte astro html css scss sass less json jsonc yaml yml toml ini cfg conf " +
    "xml gradle sh bash zsh fish ps1 sql graphql proto tf hcl nix dockerfile makefile cmake env.example"
  ).split(" "),
);

export interface FileEntry {
  path: string;
  size: number;
}

const ext = (p: string) => {
  const base = p.split("/").pop()!.toLowerCase();
  if (base === "dockerfile" || base === "makefile") return base;
  const i = base.lastIndexOf(".");
  return i < 0 ? "" : base.slice(i + 1);
};

export function isIgnoredPath(p: string): boolean {
  const parts = p.split("/");
  if (parts.some((seg) => IGNORED_DIRS.has(seg))) return true;
  const base = parts[parts.length - 1];
  if (LOCKFILES.has(base)) return true;
  if (/\.min\.(js|css)$/.test(base) || /\.map$/.test(base)) return true;
  if (BINARY_EXT.has(ext(p))) return true;
  return false;
}

export function isProbablyText(p: string): boolean {
  const e = ext(p);
  if (TEXT_EXT.has(e)) return true;
  const base = p.split("/").pop()!.toLowerCase();
  return ["license", "readme", "changelog", "contributing", "procfile", "gemfile", "rakefile"].includes(base);
}

const README = /^readme(\.[a-z]+)?$/i;

/** Higher = more relevant. Files below MIN_SCORE are never picked. */
export const MIN_SCORE = -30;

export function scorePath(p: string, size: number): number {
  const lower = p.toLowerCase();
  const parts = lower.split("/");
  const base = parts[parts.length - 1];
  const depth = parts.length - 1;
  let score = 0;

  // Config & manifests: describe purpose, dependencies, scripts
  const manifests = [
    "package.json",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "requirements.txt",
    "cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "gemfile",
    "composer.json",
    "mix.exs",
    "pubspec.yaml",
    "deno.json",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "makefile",
  ];
  if (manifests.includes(base)) score += depth === 0 ? 90 : 35;

  // Entry points
  const entry = /^(index|main|app|server|cli|cmd|lib|mod|__init__|__main__|program|application)\.(ts|tsx|js|mjs|cjs|jsx|py|go|rs|rb|java|kt|swift|cs|php|ex|dart|c|cc|cpp)$/;
  if (entry.test(base)) score += depth <= 1 ? 70 : depth === 2 ? 50 : 25;
  if (/(^|\/)cmd\/[^/]+\/main\.go$/.test(lower)) score += 60;
  if (base === "lib.rs" || base === "main.rs") score += 20;

  // Documentation
  if (README.test(base) && depth > 0) score += 30;
  if (/^docs?\//.test(lower) && /\.(md|mdx|rst|txt|adoc)$/.test(base)) {
    score += 45;
    if (/(overview|intro|getting|quick|start|architecture|design|concept|usage|guide|tutorial)/.test(base)) score += 25;
  }
  if (/^(architecture|design|overview|usage|guide|faq|tutorial|concepts?)\.(md|rst)$/.test(base)) score += depth === 0 ? 80 : 60;
  else if (depth === 0 && /\.(md|rst)$/.test(base)) score += 30;
  if (/^(contributing|changelog|history|code_of_conduct|security)\.md$/.test(base)) score -= 30;

  // Examples
  if (/(^|\/)(examples?|samples?|demo)\//.test(lower)) score += 30;

  // Source code in general
  if (/(^|\/)(src|lib|pkg|internal|app|core)\//.test(lower)) score += 15;
  if (/\.(ts|tsx|js|py|go|rs|java|kt|rb|swift|cs|cpp|c)$/.test(base)) score += 10;
  if (/(config|settings|routes?|schema|types|api|model)s?\.[a-z]+$/.test(base)) score += 15;

  // Penalties: tests, generated code, fixtures, CI
  if (/(^|\/)(tests?|__tests__|spec|e2e|fixtures?|mocks?|testdata|benchmarks?)\//.test(lower)) score -= 90;
  if (parts.some((seg) => seg.startsWith(".") && seg.length > 1)) score -= 45; // .github, .eslintrc, .devcontainer …
  if (/\.(test|spec)\.[a-z]+$/.test(base) || /_test\.(go|py)$/.test(base) || /^(test|tests|spec)\.[a-z]+$/.test(base)) score -= 45;
  if (/(^|\/)(\.github|\.circleci|\.husky|scripts?)\//.test(lower)) score -= 25;
  if (/(generated|\.pb\.|_pb2|\.d\.ts$)/.test(lower)) score -= 40;
  if (base === "license" || base.startsWith("license.")) score -= 60;

  // Depth and size
  score -= depth * 6;
  if (size > 60_000) score -= 30;
  if (size > 200_000) score -= 100;
  if (size < 40) score -= 30;

  return score;
}

export function pickReadme(files: FileEntry[]): FileEntry | undefined {
  return files
    .filter((f) => !f.path.includes("/") && README.test(f.path))
    .sort((a, b) => (a.path.toLowerCase().endsWith(".md") ? -1 : 0) - (b.path.toLowerCase().endsWith(".md") ? -1 : 0))[0];
}

const isExample = (p: string) => /(^|\/)(examples?|samples?|demo)\//i.test(p);
const group = (p: string) => p.split("/").slice(0, -1).slice(0, 2).join("/") || ".";

/**
 * Picks up to `max` files by relevance (README is handled separately).
 * Greedy with a diversity penalty: every further file from the same folder
 * counts less, and at most three examples – so we get a cross-section.
 */
export function selectFiles(files: FileEntry[], max = 15): FileEntry[] {
  const readme = pickReadme(files);
  const pool = files
    .filter((f) => f !== readme && !isIgnoredPath(f.path) && isProbablyText(f.path))
    .map((f) => ({ f, s: scorePath(f.path, f.size) }))
    .filter((x) => x.s > MIN_SCORE);
  const picked: FileEntry[] = [];
  const count = new Map<string, number>();
  const bump = (k: string) => count.set(k, (count.get(k) ?? 0) + 1);
  const top = (p: string) => (p.includes("/") ? p.split("/")[0] : ".");
  let examples = 0;
  while (picked.length < max && pool.length) {
    let best = -1;
    let bestScore = -Infinity;
    pool.forEach((x, i) => {
      if (isExample(x.f.path) && examples >= 3) return;
      // The penalty only affects the order – the base filter stays MIN_SCORE
      const score = x.s - (count.get(`g:${group(x.f.path)}`) ?? 0) * 18 - (count.get(`t:${top(x.f.path)}`) ?? 0) * 6;
      if (score > bestScore || (score === bestScore && x.f.path < pool[best].f.path)) {
        best = i;
        bestScore = score;
      }
    });
    if (best < 0) break;
    const [{ f }] = pool.splice(best, 1);
    picked.push(f);
    bump(`g:${group(f.path)}`);
    bump(`t:${top(f.path)}`);
    if (isExample(f.path)) examples++;
  }
  return picked;
}

/** Compact file tree: folders with file counts, top-level files listed. */
export function renderTree(files: FileEntry[], maxLines = 120): string {
  const visible = files.filter((f) => !isIgnoredPath(f.path)).map((f) => f.path).sort();
  const lines: string[] = [];
  const dirCounts = new Map<string, number>();
  for (const p of visible) {
    const parts = p.split("/");
    if (parts.length === 1) lines.push(p);
    // count two levels of folders
    for (let d = 1; d <= Math.min(2, parts.length - 1); d++) {
      const dir = parts.slice(0, d).join("/") + "/";
      dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
    }
  }
  const dirs = [...dirCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, n]) => `${d} (${n} files)`);
  const all = [...dirs, ...lines];
  const out = all.slice(0, maxLines);
  if (all.length > maxLines) out.push(`… (${all.length - maxLines} more entries)`);
  return out.join("\n");
}

/**
 * Splits a character budget across README + files ("water filling"):
 * small files go in whole, the rest is shared fairly among the big ones.
 */
export function packSources(
  header: string,
  readme: { path: string; text: string } | null,
  files: { path: string; text: string }[],
  tree: string,
  budget: number,
): { text: string; truncated: boolean } {
  let truncated = false;
  const cut = (t: string, n: number) => {
    if (t.length <= n) return t;
    truncated = true;
    return t.slice(0, Math.max(0, n)) + "\n[… truncated]";
  };
  const treeBlock = `## File tree\n${cut(tree, Math.floor(Math.min(6000, budget * 0.08)))}`;
  const overhead = (p: string) => p.length + 20;
  let avail = budget - header.length - treeBlock.length - files.reduce((n, f) => n + overhead(f.path), 0);

  let readmeBlock = "";
  if (readme) {
    const cap = Math.floor(avail * (files.length ? 0.4 : 0.95));
    readmeBlock = `## ${readme.path}\n${cut(readme.text, cap)}`;
    avail -= readmeBlock.length;
  }

  const alloc = new Map<string, number>();
  const bySize = [...files].sort((a, b) => a.text.length - b.text.length);
  let left = Math.max(0, avail);
  bySize.forEach((f, i) => {
    const fair = Math.floor(left / (bySize.length - i));
    const give = Math.min(f.text.length, fair);
    alloc.set(f.path, give);
    left -= give;
  });

  const parts = [header, readmeBlock, treeBlock].filter(Boolean);
  for (const f of files) parts.push(`## ${f.path}\n\`\`\`\n${cut(f.text, alloc.get(f.path) ?? 0)}\n\`\`\``);
  let text = parts.join("\n\n");
  if (text.length > budget) {
    text = text.slice(0, budget) + "\n[… truncated]";
    truncated = true;
  }
  return { text, truncated };
}
