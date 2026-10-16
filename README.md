# Harshal Joshi · Cartridge

My personal website, built as my NOBE capstone. It features a playable top-down retro pixel campus game paired with an accessible reader mode, styled with the **"Cartridge"** theme: a retro handheld-game aesthetic with a fixed HUD, stage selection list, and an explorer progress gamification system.

**Live site:** https://hj-c0ding.github.io/Harshal-Nobe-Personal-Website/

## The game

- **Premise**: Walk an interactive top-down pixel campus where each building represents one of my professional experiences or technical projects. Stand outside any facility door and enter to read about the project, select class specializations at the campus class board, and open the campus mailbox to get in touch. Exploring every corner of campus unlocks achievements and opens the final gate at 100 XP.
- **Controls**:
  - **Move**: Arrow keys or WASD (also touch D-pad on mobile).
  - **Interact / Enter**: `E` or `Enter` (or Action `A` button on touch).
  - **Close Dialog**: `Escape` (or Action `B` button on touch).
  - **Inputs**: Arrow keys, WASD, and Space are default-prevented during gameplay when focused on the game, but native tab navigation and form inputs remain fully functional.
- **XP Table**:
  - 7 buildings × 10 XP = 70 XP (first visit per building).
  - 4 classes × 5 XP = 20 XP (first selection per class on the Class Board signpost or lens).
  - 1 mailbox × 10 XP = 10 XP (first mailbox or contact interaction).
  - **Total**: Exactly **100 XP**. Repeated interactions grant 0 XP (no farming).
- **Levels**:
  - 0 XP: **Rookie**
  - 20 XP: **Scout**
  - 45 XP: **Builder**
  - 75 XP: **Engineer**
  - 100 XP: **Maxed Out** (Final gate opens)
- **Trophies (Achievements)**:
  - _First Steps_: Enter any building.
  - _Full-Stack Curious_: Choose the Full-stack class.
  - _Data Nerd_: Choose the Data & ML class.
  - _Leader of the Pack_: Choose the Leadership class.
  - _Cloud Watcher_: Choose the Cloud class.
  - _Completionist_: Explore all 7 buildings.
  - _Secret Handshake_: Konami code entered (`↑ ↑ ↓ ↓ ← → ← → B A`).
- **Reader Mode**:
  - "Skip the game: read everything" is the very first tab stop on the page.
  - Toggles a plain, semantic reader view (semantic stage list with expandable stage accordions, class filter lenses, live trophies list, contact) and back to the game.
  - Actions in reader mode award XP through the exact same progress store: expanding a stage = `visitBuilding` (+10 once), choosing a lens = `chooseClass` (+5 once), and opening contact = `openMailbox` (+10 once).
  - **Zero content gating**: everything is 100% accessible and readable without playing the game or earning XP.

## Design

The site uses the **"Cartridge"** theme, inspired by retro handheld monochrome green screens, executed with design discipline so it feels sharp, intentional, and readable rather than gimmicky:

- **Palette**: Deepest `#0F380F`, Dark `#306230`, Light `#8BAC0F`, and Lightest `#C4D68A` (page background). The CSS custom property `--color-accent` is `#A8231C` (adjusted from `#B3261E` for 4.56:1 contrast against `#C4D68A`), and it is used for text, outlines and buttons in the stylesheet. Canvas highlights are drawn shapes (not text) and still use the original `#B3261E`, so the text-contrast requirement does not apply to them.
- **Shapes**: Square corners only (`border-radius: 0`), stepped pixel borders, and non-blurred drop shadows using pure CSS `box-shadow`. No gradients, no glassmorphism, no blurs.
- **Typography**: Self-hosted via `@fontsource` with zero third-party network requests. `Silkscreen` is used strictly for headings, stage labels, and HUD metrics; `Atkinson Hyperlegible` provides clear, accessible body typography.
- **Accessibility & Motion**:
  - `aria-live="polite"` region announces interactable proximity ("Near <building name>. Press E to enter."), XP gains, level-ups, and trophy unlocks.
  - Game canvas has `role="img"` and a descriptive `aria-label`.
  - Native `<dialog>` elements manage focus trapping, close on `Escape`, and return focus to the trigger element on close.
  - Full `prefers-reduced-motion` support: disables walking interpolation, disables blinking animations, and removes toast transitions.
  - Canvas scales responsively to fit both width and height within `calc(100dvh - var(--hud-height) - margin)` with `image-rendering: pixelated`, keeping the full map visible on short viewports and touch controls visible on narrow screens.

## Architecture and decisions

```
src/
  lib/
    lenses.ts       pure filtering and hash logic
    progress.ts     pure gamification engine (XP, levels, achievements, storage)
    store.ts        single source of truth progress store
    world.ts        pure grid world math, collision, reachability, movement
  data/
    entries.ts      portfolio stage entries as typed data
    world.ts        ASCII map layout, building coordinates, doors, spawn
  ui/
    game.ts         canvas game loop, input handling, modals, touch controls
    hud.ts          fixed HUD, progress bar, toast notifications, reset dialog
    lenses.ts       stage select accordion rendering and class controls
  styles/
    main.css        Cartridge theme custom properties, pixel borders, responsive layout
  main.ts           application bootstrap & view toggling
tests/              unit, DOM, and contrast test suites
```

Key architectural decisions:

- **Pure logic in `src/lib/`**: All map collision, pathing, coordinates, progress rules, level calculations, and filter logic are pure functions decoupled from DOM and canvas rendering.
- **Single progress store (`src/lib/store.ts`)**: There is exactly one state container for progress on the page. The canvas game, HUD, and reader mode all read and write through this single store; no duplicate or out-of-sync state exists.
- **Derived XP from objective flags**: Stored XP is never trusted blindly from `localStorage`. XP is recomputed directly from objective flags (`visitedBuildings`, `chosenClasses`, `mailboxOpened`). This guarantees saves can heal automatically from any past state discrepancies.
- **Map ASCII as single source of truth**: The map layout in `src/data/world.ts` defines all walkable tiles (`.`, `=`), obstacles (`#`, `T`, `~`), and building bounds, verified by automated reachability tests.

## Testing

The project has comprehensive test suites with unit, DOM, and accessibility tests:

- **World logic & reachability**: `src/lib/world.test.ts` verifies map ASCII dimensions, boundary walls, door placements, interactable adjacency, collision bounds, and breadth-first search (BFS) reachability for all buildings and special tiles.
- **Progress & store**: `tests/progress.test.ts` tests XP calculation pure functions, level thresholds, achievement unlocking, storage recovery, and healing of stale saves.
- **Lenses & filtering**: `tests/lenses.test.ts` and `tests/lenses.dom.test.ts` test lens filters, search queries, keyboard accessibility, and URL hash serialization.
- **DOM integration**:
  - `tests/progress.dom.test.ts`: tests HUD progress rendering, polite aria-live toasts, and reset dialog.
  - `tests/board.dom.test.ts`: tests Class Board signpost interaction, facility highlights, and 100 XP gate opening.
  - `tests/world.dom.test.ts`: verifies skip link focusability and toggling, reader mode XP awards (+10 on stage expand, +5 on lens, +10 on contact), two-component HUD/game sync on reset and visit, key movement and dialog-aware default prevention, Escape dialog dismissal with focus return, storage throwing resilience, and final gate locking behavior.
- **Contrast verification**: `tests/contrast.test.ts` computes luminance ratios for all theme color pairs directly against WCAG AA standards (≥ 4.5:1).

Tests live in both `tests/` and `src/lib/` (colocated unit tests).

## Setup and running

Requires Node 20 (see `.nvmrc`) and npm:

- `npm ci`: install exact dependencies
- `npm run dev`: start Vite development server
- `npm run build`: compile production build into `dist/`
- `npm run preview`: serve production build locally

## Tests and CI/CD

- `npm test` runs Vitest; `npm run verify` runs lint, format:check, typecheck, tests and build in order.
- `ci.yml` runs the `verify` job on every pull request to main; the ruleset requires a PR and the passing `verify` check.
- `deploy.yml` re-runs verification on push to main, then deploys to GitHub Pages with Actions (Settings, Pages, Source: GitHub Actions).

## AI use and limitations

- **Initial scaffold**: Generated by Claude Opus via Google Antigravity.
- **Cartridge restyle, game world, store refactor, and tests**: Implemented by Gemini via Google Antigravity.
- **XP sync bugfix pass**: Refined by Claude Opus via Google Antigravity.
- **Review**: All generated code, architecture decisions, and test suites were reviewed and verified by me.
- **Limitations**:
  - Screen reader behavior is audited through ARIA attributes, native semantic markup, and polite live regions; no dedicated manual screen-reader device test pass has been completed yet.
  - Explorer progress is stored per-browser in local device `localStorage`.
  - Canvas drawing pixels themselves are not unit tested (test suites verify pure game logic, coordinate math, and DOM wiring).
  - No phone numbers or private personal data are published.
