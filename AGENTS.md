# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

DLMQAM 2.0 ("Das lustige Mittwochsquiz am Mittwoch") — a real-time, Jeopardy-style
quiz game. React 19 + TypeScript frontend, a single Express + Socket.IO backend
process, JSON-file persistence (no database).

## Stack

- **Frontend:** React 19, React Router 7, Vite 6, Tailwind CSS 4, `motion` (framer-motion successor), `lucide-react`
- **Backend:** Express 4 + Socket.IO 4.8, all game logic lives in `server.ts` (one file, ~1000+ lines)
- **Persistence:** flat JSON files under `data/` (created at runtime, gitignored) — no database
- **Build:** Vite bundles the frontend; `esbuild` bundles `server.ts` for production

## Setup

```bash
npm install
```

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs `server.ts` directly via `tsx` (dev mode, Vite middleware-mode HMR for the frontend) |
| `npm run build` | `vite build` (frontend) + `esbuild` bundle of `server.ts` → `dist/` |
| `npm start` | Runs the built server from `dist/server.js` (production) |
| `npm run lint` | `tsc --noEmit` — type-check only, no bundler-level errors |
| `npm run clean` | Removes `dist/` |

Run `npm run dev` **from the repository root** (where `package.json` lives) — a common
"Could not read package.json" error just means the shell's `cwd` is wrong.

## Verifying changes before considering a task done

There is no automated test suite. Verify changes by building:

```bash
npx vite build                                                                  # frontend
npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=/dev/null   # server syntax/type sanity
```

Both should complete without errors. `npm run lint` (`tsc --noEmit`) will report
pre-existing errors on `server.ts` and some frontend files because the project's
`tsconfig.json` is frontend-oriented (missing `@types/node` types, etc.) — these
are expected and unrelated to your change; only new errors introduced by your
edit matter.

If you change gameplay logic, prefer a quick manual sanity pass with the `run` skill
(start the app, open `/host` and `/player`, exercise the flow) when the change is
non-trivial.

## Repository layout

```
server.ts                    All backend logic: Express routes, Socket.IO handlers, game state
starterCategories.ts         Seed data for the category-name pool (data/categories.json)
src/
  App.tsx                    Router setup (/, /host, /player, /board-editor)
  main.tsx                   React entry point
  lib/socket.ts               Shared Socket.IO client instance
  pages/
    RoleSelection.tsx         Landing page (host vs. player entry)
    HostView.tsx              Host control panel (~big file: board control, scoring, screws, teams, season)
    PlayerView.tsx            Player screen (buzzer, question modes, screw effects, profile)
    BoardEditor.tsx           Jeopardy board editor + category-name database UI
    JeopardyBoard.tsx         The shared board grid component
    ProfilesManagement.tsx    Host-side player profile list/management
    GlobalGameHistory.tsx     Past-games browser
  components/
    ProfileEditor.tsx         Profile edit modal (avatar, name, achievements, history)
data/                         Runtime JSON persistence (gitignored, created on first run):
    profiles.json              Player profiles: stats, achievements, per-game history
    scoreboard.json             name → running point total (persists across server restarts)
    games.json                  Completed-game records (leaderboard, categories, date)
    categories.json             Pool of category *names* (not full question sets) for the Random-category picker
```

## Data model compatibility — read before touching persistence

`data/*.json` are written and read directly by `server.ts`; there is no migration
tooling. When changing what gets written to these files:

- **Never rename or remove existing fields** in `profiles.json`, `scoreboard.json`,
  or `games.json` without a backward-compatible read path — these files persist
  across sessions and existing installs will have the old shape.
- **New fields must be additive** and tolerate being `undefined`/missing on read
  (existing data won't have them).
- `categories.json` is a plain `string[]` of category-name ideas (topics only, no
  questions) — `server.ts` also tolerates the older `{name, tiles}[]` object shape
  on read for back-compat; don't reintroduce that shape when writing.
- `nameToScore` (in `scoreboard.json`) is keyed by player **name**, not socket id
  — scores are restored across reconnects/restarts by name.

## Server state conventions (`server.ts`)

- All live game state lives in one in-memory `gameState` object inside `startServer()`.
  There's no per-room state — this app is built for a single concurrent game.
- `gameState.questionPointReceivers` is a `Set`; it does **not** serialize over
  Socket.IO directly. Always send state to clients through `serializeGameState()`,
  which converts it to an array and strips non-serializable fields
  (`countdownInterval`, `pendingEulaPlayers`). Never `io.emit("game_state", gameState)` directly.
- When checking a possibly-zero numeric value (e.g. a score), compare with
  `=== undefined`, not falsy checks — `0` is a valid, common value here.
- Question modes: `buzzer`, `guess`, `choice`, `text`, `thisorthat`. Adding a new
  mode touches: `BoardEditor.tsx` (tile editor UI), `server.ts` (`board_reveal_answer`
  scoring branch), `PlayerView.tsx` (`renderQuestionUI` switch + question-intro
  color/label maps), and `HostView.tsx` if the host needs mode-specific display.
- "Screw" effects (host-assignable player handicaps: forced buzz, EULA trap, flip,
  rename) are defined in the `SCREW_TYPES` array in `server.ts` — add new types
  there and the effect handling in the `use_screw` socket handler; the type list
  is fetched by the frontend from `GET /api/screw-types`, so new types show up in
  the UI automatically.

## Frontend conventions

- Brutalist design system: black/yellow/white palette, thick borders via the
  `.brutal-border`, `.brutal-shadow`, `.brutal-shadow-sm` utility classes (see
  `src/index.css`), Space Grotesk font, aggressive uppercase/italic headings.
  Match this style for new UI rather than introducing a different visual language.
- `HostView.tsx` and `PlayerView.tsx` are both large, single-file components with
  many `socket.on(...)` listeners registered in one `useEffect`. When adding a new
  server → client event, add the listener alongside the existing ones in that
  same effect rather than creating a new effect.
- Sound effects are generated inline via the Web Audio API (see the `play*Sound`
  helpers near the top of `PlayerView.tsx` / `HostView.tsx`) — there are no audio
  asset files for these.

## Git workflow

- Feature work happens on branches (this repo's active development branch is
  `claude/serene-pascal-euftbf`); do not commit directly to the default branch
  unless asked.
- Commit messages should describe *what* changed and *why* in the body when the
  change isn't self-evident from the diff — this project's history uses that
  style consistently.
- Do not open a pull request unless explicitly asked to.
