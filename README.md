# Explainer

A local web app that turns text, Markdown, a GitHub repo or a local folder into a series of simple, hand-drawn explainer slides: 12–25 slides in 16:9, each with exactly **one** key message, a short title, a small sketch and a closing line.

- Storyboard overview of all slides and a full-screen presentation mode
- Drawing animation (lines appear one after another, then the text fades in)
- Edit text directly on the slide, regenerate single slides, reorder by drag & drop
- Export a slide as PNG, the deck as PDF, and save/open decks as JSON

## Setup

Requirements: **Node.js 22** or newer.

```bash
npm install
npm run dev
```

Then open <http://127.0.0.1:5173>. `npm run dev` starts the frontend (Vite, port 5173) and the backend (Express, port 8787); Vite forwards `/api` to the backend.

### Connecting to Claude – no API key needed

Explainer runs locally; only the model calls go to Claude. There are two ways to make them:

| Way | What you need | Billing |
|---|---|---|
| **Claude subscription** (default if no key is set) | [Claude Code](https://claude.com/claude-code) installed and logged in once (`claude`, then log in with your Claude account) | Counts towards your Pro/Max plan's usage limits |
| **API key** | `ANTHROPIC_API_KEY` in `.env` | Pay per token on the Anthropic API |

With the subscription, the server runs `claude -p` in headless mode for each step (no tools, no settings, no saved sessions) and uses your Claude Code login. If your plan's usage limit is reached, the app tells you when it resets. Use this for yourself on your own machine – if you ever host Explainer for other people, they need an API key.

The input page shows which way is active (green dot = ready).

### .env (optional)

Copy `.env.example` to `.env` if you want to change anything:

```ini
LLM_PROVIDER=auto            # auto | subscription | api | mock
ANTHROPIC_API_KEY=           # only for the API
ANTHROPIC_MODEL=claude-sonnet-5-5
ANTHROPIC_EFFORT=low         # low is fast enough for a deck in < 90 s
CLAUDE_CLI_PATH=             # if `claude` is not on your PATH
GITHUB_TOKEN=                # higher GitHub limits, private repos
PORT=8787
MAX_INPUT_CHARS=60000        # max characters of the source sent to the model
```

`.env` is in `.gitignore`. Keys are only read by the backend and never reach the browser bundle (Vite only exposes variables prefixed with `VITE_`).

`LLM_PROVIDER=mock` starts a demo mode that builds a deck from snippets of the source without any model calls – handy for trying the UI and exports.

### Production build

```bash
npm run build   # typecheck + frontend build into dist/
npm start       # one process on http://127.0.0.1:8787 (API + built frontend)
```

## Using it

| Input | Detected as |
|---|---|
| Free text / Markdown | anything that is not a URL or a path |
| `https://github.com/owner/repo` | also `…/tree/branch/subfolder` |
| `/Users/you/project`, `~/project`, `./project` | local folder (or a single text file) |

**Use sample text** loads `examples/sample.md` (about 1,000 words on heat pumps).

**Presenting:** `→` `↓` `Space` `Enter` = next · `←` `↑` `Backspace` = back · `Home` / `End` · `Esc` ends. On touch devices swipe; with a mouse click right/left.

**Editor** (click a slide): click any text on the slide to change it (Enter saves, Esc cancels). Word counters show the limits. **Regenerate this slide** writes a fresh version, optionally with another template and a wish ("simpler", "add an example").

The current deck stays in the browser (localStorage). **Save JSON** stores it as a file, **Open** loads it again.

## How it works

```
input ──▶ 1. read ──▶ 2. outline ──▶ 3. slides ──▶ check / repair ──▶ 4. render
         (text/repo/folder) (model call 1)  (model call 2)  (Zod + rules)      (React + rough.js)
```

1. **Read** (`server/ingest/`): text is used as is. For GitHub the server loads the repo info, file tree, README and up to 15 relevant files via the GitHub API – manifests and config, entry points, docs and a few examples. A per-folder penalty gives a cross-section instead of 15 similar files. Local folders use the same logic. `node_modules`, `.git`, build folders, binaries and lock files are skipped. Everything is cut to `MAX_INPUT_CHARS`: small files go in whole, big ones share the rest. The progress view says when something was cut.
2. **Outline**: a storyline of *What is it? → Why does it matter? → How does it work? → Examples → Limits → Conclusion*, with one core message, a template and facts from the source per slide.
3. **Slides**: one slide per outline entry as JSON `{ id, title, takeaway, template, data }`. Both calls use structured outputs (JSON schema generated from Zod) and stream, so progress is counted live.
   - The result is validated with Zod. On invalid data it is requested **once** more, with the problem as a hint.
   - Content rules are checked next (`shared/lint.ts`: word limits, item counts). Slides that break a rule go back to the model in **one** targeted repair call; anything still too long is trimmed mechanically.
4. **Render**: every template is a React component in `src/templates/`. rough.js computes the sketches as paths, React renders them as SVG. Text is HTML on top and adapts to its box: the font shrinks first, then long words break, and finally the text is cut with "…". Nothing overflows.

All slide text is English, whatever language the source is in. System prompt and source are identical for every call and marked for prompt caching, so the second call reads them from the cache.

### Templates

| Template | Content |
|---|---|
| `title` | big title, subtitle, sparkle |
| `flow` | 3–5 pastel boxes with arrows and small notes |
| `bars` | bar chart + big key figure with a tag (only real numbers from the source) |
| `cards-grid` | 4–6 cards with icon, label and a grey note |
| `before-after` | two columns with a divider |
| `compare` | two app-window sketches, A vs. B |
| `checklist` | 3–5 items with a check mark or warning sign |
| `prompt-list` | 3–5 speech bubbles with example prompts or commands |
| `stat` | one big number, label and tag |
| `hub` | central element with 3–5 connected parts |

Icons: 30 small sketches in `src/sketch/icons.ts`; the model may only use these names.

### Design and themes

The look follows a simple sketchnote style: white slides, thin dark lines, flat pastel fills with matching outlines, centered titles with a thin colored underline, small grey annotations and lots of white space. Colors, font (Kalam, served locally via `@fontsource/kalam`), rough.js settings and animation timing all live in `src/theme/themes.ts`; templates only use these values.

Besides the default **Paper** theme there is **Chalkboard** as an example (switch at the top right). For your own style, add another `Theme` object and list it in `THEMES`.

## Project structure

```
├─ examples/sample.md          sample text (~1,000 words)
├─ shared/
│  ├─ schema.ts                Zod schemas: deck, slide, 10 templates, API contracts
│  └─ lint.ts                  content rules and trimming
├─ server/
│  ├─ index.ts                 Express: /api/health, /api/generate (SSE), /api/regenerate
│  ├─ pipeline.ts              read → outline → slides → repair
│  ├─ llm.ts                   the model tasks: validation and the one retry
│  ├─ providers/               anthropicApi.ts (API key), claudeCode.ts (subscription), index.ts (selection)
│  ├─ prompts.ts               system prompt and tasks
│  ├─ jsonSchema.ts            Zod → JSON schema for structured outputs
│  ├─ mock.ts                  demo mode
│  └─ ingest/                  text, github, local, rank (relevance + budget)
└─ src/
   ├─ theme/themes.ts          theme variables
   ├─ sketch/                  rough.js → paths, icons
   ├─ templates/               10 template components, Scene (frame, animation)
   ├─ components/              input, progress, storyboard, editor, presenter, TextBox
   └─ lib/                     API client, deck state, export (PNG/PDF/JSON)
```

## Security

- API keys only exist in the backend process.
- The server listens on `127.0.0.1` only and answers only requests with a local `Host` header (guards against DNS rebinding) – important because it can read local folders.
- Local folders are only read; symlinks are not followed.

## Troubleshooting

| Message | Fix |
|---|---|
| "No way to reach Claude is set up" | run `claude` once and log in, or set `ANTHROPIC_API_KEY` in `.env` |
| "Claude Code is not logged in" | run `claude` in a terminal and log in |
| "Your Claude plan's usage limit is reached" | wait for the reset time shown, or use an API key |
| "Model … not found" | check `ANTHROPIC_MODEL` |
| "GitHub rate limit reached" | set `GITHUB_TOKEN` (without it: 60 requests/hour) |
| "Server not reachable" | is `npm run dev` running? Is port 8787 free? |
