# Harshal Joshi · Cartridge

My personal website, built as my NOBE capstone. It is styled with the **"Cartridge"**
theme: a retro handheld-game screen with a fixed HUD, stage selection list, and an
explorer progress gamification system.

**Live site:** https://hj-c0ding.github.io/Harshal-Nobe-Personal-Website/

## Design: "Cartridge" Theme

The site draws inspiration from retro handheld monochrome screens, executed with restraint
so it feels designed and crisp rather than gimmicky:

- **Palette**: Deepest `#0F380F`, Dark `#306230`, Light `#8BAC0F`, and Lightest `#C4D68A`
  (page background). For alerts and achievements, an accent of `#A8231C` is used.
  _(Note: adjusted from #B3261E to #A8231C to achieve 4.56:1 contrast against #C4D68A,
  ensuring every text/background pair strictly meets WCAG AA ≥ 4.5:1)._
- **Shapes**: Square corners only, stepped pixel borders, and non-blurred drop shadows
  built with CSS `box-shadow`. No rounded corners, no gradients, and no glass effects.
- **Typography**: Self-hosted via `@fontsource` with zero third-party network requests.
  `Silkscreen` is used strictly for headings, stage labels, and HUD metrics;
  `Atkinson Hyperlegible` is used for all readable body copy.
- **Layout**: A fixed HUD bar at the top displaying player name, LV title, animated XP
  bar, achievements tally, and a "New Game" reset trigger. The masthead features a title
  screen with a blinking "PRESS START" button that jumps to stage select (respects
  `prefers-reduced-motion`).
- **Stage Select**: Each work entry is numbered as a stage (1-1, 1-2, etc.) and can be
  interactively expanded or collapsed via native `<button aria-expanded="...">` controls.

## Explorer Progress (Gamification)

Gamification logic lives completely pure in `src/lib/progress.ts` (independent of DOM),
while presentation lives in `src/ui/hud.ts`:

- **XP Rules**:
  - +10 XP for the **first** time a stage is expanded (7 stages × 10 = 70 XP).
  - +5 XP for the **first** time each class lens is used (4 lenses × 5 = 20 XP).
  - +5 XP for the **first** time the search box is used (5 XP).
  - +5 XP for opening the contact section (5 XP).
  - Total XP available in the system is exactly **100 XP** (70 + 20 + 5 + 5). Repeated actions grant 0 XP (no farming).
- **Levels**:
  - 0 XP: **Rookie**
  - 20 XP: **Scout**
  - 45 XP: **Builder**
  - 75 XP: **Engineer**
  - 100 XP: **Maxed Out**
- **Achievements**:
  - _First Steps_: Open any stage.
  - _Full-Stack Curious_: Use the Full-stack class lens.
  - _Data Nerd_: Use the Data & ML class lens.
  - _Leader of the Pack_: Use the Leadership class lens.
  - _Cloud Watcher_: Use the Cloud class lens.
  - _Completionist_: Open every stage.
  - _Secret Handshake_: Konami code Easter egg (`↑ ↑ ↓ ↓ ← → ← → B A`).
- **Persistence & Safety**:
  - Automatically persisted in `localStorage` under key `cartridge-progress-v1`.
  - Corrupt or invalid JSON, unknown achievement IDs, and quota/security errors fall back
    cleanly to initial state without throwing. The game remains fully operational in-memory.
- **Accessibility**:
  - Feedback toasts are dispatched to an `aria-live="polite"` region.
  - The XP progress bar uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin`,
    and `aria-valuemax`.
  - "New Game" uses a native, keyboard-accessible `<dialog>` with focus trapping and ESC support.
  - **Zero content gating**: all content, stages, notes, and skills are 100% accessible
    and readable without earning any XP.

## Interactive Feature: "Choose your class" Lenses

Entries are tagged and filterable:

- Chips for **All**, **Data & ML**, **Full-stack**, **Leadership**, and **Cloud**.
  Multiple lenses combine with **OR**. **All** clears the lens filter.
- A search box narrows results in real time.
- Matching stages are highlighted; non-matches are dimmed and marked `inert` with
  `aria-hidden="true"`.
- State syncs to URL hash (e.g. `#lens=data,leadership&q=django`) for link sharing.

## Setup

Requires **Node 20** (see `.nvmrc`) and npm.

```bash
git clone https://github.com/Hj-c0ding/Harshal-Nobe-Personal-Website.git
cd Harshal-Nobe-Personal-Website
npm ci
npm run dev        # http://localhost:5173
```

| Script                 | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Vite dev server                                                 |
| `npm run build`        | Production build into `dist/`                                   |
| `npm run preview`      | Serve the built `dist/` locally                                 |
| `npm run lint`         | ESLint (typescript-eslint strict)                               |
| `npm run format:check` | Prettier check (`npm run format` to fix)                        |
| `npm run typecheck`    | `tsc --noEmit` in strict mode                                   |
| `npm test`             | Vitest (unit + happy-dom DOM tests)                             |
| `npm run verify`       | All of the above in order: lint → format → types → test → build |

## Testing

```bash
npm test           # run once
npx vitest         # watch mode
```

- `tests/progress.test.ts`: pure engine unit tests (XP calculation, boundary thresholds,
  no-farming rule, Konami code sequence validation, storage error recovery).
- `tests/progress.dom.test.ts`: DOM tests in happy-dom (stage expand updating XP and
  `aria-valuenow`, toast rendering into `aria-live`, New Game dialog cancellation and
  resetting, reload persistence, and storage throwing resilience).
- `tests/lenses.test.ts`: unit tests for pure lens filtering and URL hash sync.
- `tests/lenses.dom.test.ts`: DOM tests for lens chips, search, and keyboard interaction.
- `tests/contrast.test.ts`: automated WCAG AA (≥ 4.5:1) token verification against `src/styles/main.css`.

## Architecture and decisions

```
src/
  lib/
    lenses.ts       pure filtering and hash logic
    progress.ts     pure gamification engine (XP, levels, achievements, storage)
  data/
    entries.ts      content as typed data
  ui/
    hud.ts          fixed HUD, progress bar, toast notifications, reset dialog
    lenses.ts       stage select accordion rendering and class controls
  styles/
    main.css        Cartridge theme custom properties, pixel borders, responsive layout
  main.ts           entry point
tests/              unit, DOM, and contrast test suites
```

## AI use and limitations

**Claude Opus via Google Antigravity generated the initial scaffold and code**, and
**Claude Opus via Antigravity generated the gamification and restyle**. I reviewed the
output. Limitations to be honest about:

- **Accessibility**: Screen reader behavior was tested through ARIA roles, polite live
  regions, and automated contrast testing. **No dedicated manual screen-reader pass has
  been completed yet.**
- **Persistence Scope**: Explorer progress is saved to the browser's `localStorage` and is
  therefore per-browser and local to that device.
- Filtered-out entries are dimmed and marked with `inert` and `aria-hidden`. Sighted low-vision
  users may find dimmed entries hard to read when a filter is applied (cleared via Reset or All).
