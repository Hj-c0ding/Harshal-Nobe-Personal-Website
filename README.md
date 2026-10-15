# Harshal Joshi · Field Notebook

My personal website, built as my NOBE capstone. It is styled like a field notebook:
ruled paper, a red margin rule, mono dates in the margin, and a few handwritten red
notes. It lists my internships, projects, leadership roles, and certification.

**Live site:** https://hj-c0ding.github.io/Harshal-Nobe-Personal-Website/

## The interactive feature: Lenses

Entries are tagged, and visitors filter them with "lenses":

- Chips for **All**, **Data & ML**, **Full-stack**, **Leadership**, and **Cloud**.
  Multiple lenses combine with **OR**. **All** clears the lens filter.
- A search box narrows the results (case-insensitive over title, role, summary,
  and tags). Whitespace-only searches are ignored.
- Matching entries get a red-pen underline and bracket. Non-matches fade to 35%,
  get `aria-hidden="true"` and `inert` (removed from the accessibility tree and tab
  order).
- A polite live region announces the count, e.g. "3 of 7 entries".
- If nothing matches, a handwritten message and a **Clear lenses** button appear.
- **Reset** restores defaults and clears the search and URL hash.
- State syncs to the URL hash, e.g. `#lens=data,leadership&q=django`, so filtered
  views can be shared. Unknown or malformed values are ignored, never thrown.

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

- `tests/lenses.test.ts`: unit tests for the pure functions in `src/lib/lenses.ts`.
  Covers a single lens, multi-lens OR, search + lens combined, "All", no-match → `[]`,
  case-insensitivity, whitespace-only queries, hash round-trip, invalid hash values,
  and deduping.
- `tests/lenses.dom.test.ts`: DOM tests in happy-dom. Covers chip click (aria-pressed,
  visible entries, live count, hash), impossible search → empty state → "Clear
  lenses", Reset clearing state and hash, invalid hash on load, and Enter/Space on
  chips.
- `tests/contrast.test.ts`: reads the color tokens from `src/styles/main.css` and
  checks every text color pair against WCAG AA (≥ 4.5:1).

## Deployment

Deployment is automatic through GitHub Actions:

- **`.github/workflows/ci.yml`** runs on every pull request to `main`. One job named
  `verify` has separate steps for lint, format check, typecheck, test, and build,
  then uploads `dist/` as an artifact. Branch protection requires this check to
  pass before merging.
- **`.github/workflows/deploy.yml`** runs on every push to `main` (and manually via
  _Run workflow_). Its `verify` job re-runs every check on `main`. The `deploy` job
  only runs if `verify` passes, and publishes to GitHub Pages with
  `actions/configure-pages`, `actions/upload-pages-artifact`, and
  `actions/deploy-pages`.

The Vite `base` path comes from the `BASE_PATH` env var, which the workflows set to
`/<repo-name>/`. Locally it defaults to `/`. One-time setup: **Settings → Pages →
Source: GitHub Actions**.

## Architecture and decisions

```
src/
  lib/lenses.ts     pure logic: filter, toggle, hash parse/serialize (no DOM)
  data/entries.ts   content as typed data
  ui/lenses.ts      DOM rendering + event wiring
  styles/main.css   hand-written CSS with custom properties
  main.ts           entry point: fonts, styles, mount
tests/              Vitest unit, DOM, and contrast tests
```

- **Why vanilla TypeScript, not a framework.** The site is one page with one
  interactive widget. A framework would add runtime weight and abstraction without
  solving a real problem here. Strict TypeScript catches the bugs I care about, and
  plain DOM code keeps the bundle small and easy to read.
- **Why pure functions in `src/lib`.** All the filtering and URL logic is plain
  input → output with no DOM. That makes it fast and simple to unit-test, covering
  edge cases like malformed hashes without a browser. The UI layer just renders
  whatever state the pure functions return.
- **Data separate from UI.** Content lives in `src/data/entries.ts`, so editing it
  never touches rendering code.
- **Explicit Enter/Space handling on chips.** Native buttons already do this. I
  handle it explicitly (and cancel the default) so activation fires exactly once
  and the behavior is testable in happy-dom.
- **Self-hosted fonts** (`@fontsource`: Newsreader, IBM Plex Mono, Caveat). No
  runtime network requests to third parties.
- **Static HTML shell.** The masthead, about, skills, and contact sections are plain
  HTML. Only the entries list is rendered by JavaScript.

## Accessibility

Semantic landmarks and a single `<h1>`, a skip link, visible `:focus-visible`
outlines, toggle chips using `aria-pressed`, a polite live region for the result
count, `inert` + `aria-hidden` on filtered-out entries, 44px minimum control height,
layout down to 360px, and the red-pen underline animation only plays when
`prefers-reduced-motion` is not set to reduce.

## AI use and limitations

**Claude Opus via Google Antigravity generated the initial scaffold and code** for
this repository: project configuration, the Lenses logic and UI, tests, CSS,
workflows, and documentation. I reviewed the output. Limitations to be honest about:

- **Content needs my review.** Text was written from facts I supplied, but wording,
  dates, and emphasis still need my own pass. Gaps are marked `TODO` (tagline, AWS
  certification date) instead of invented.
- **Accessibility was checked with automated tooling and manual keyboard testing
  only.** The automated tests cover ARIA state and color contrast, plus manual
  keyboard navigation. **No screen-reader pass has been done yet.**
- Filtered-out entries are intentionally dimmed below contrast requirements. They are
  `aria-hidden` and `inert`, but a sighted low-vision user may still find them hard
  to read.
- DOM tests run in happy-dom, not a real browser, so layout and visual behavior are
  not covered by automated tests.
- The visual design is a lean first pass; deeper polish is planned.
