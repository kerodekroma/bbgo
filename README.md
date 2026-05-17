# 🎰 BBGO — Bingo Card Tracker

A personal web app for tracking multiple bingo cards simultaneously. Built for fun — because keeping up with more than one card by hand is chaos.

**Built with:** Angular 21, TypeScript 5.9, Signals, Zoneless, Angular Material, Vitest

## Features

### Multiple Cards
Add as many cards as you want — manually enter the grid or scan with your camera (OCR). Each card has its own tab with a progress bar showing how close it is to the nearest enabled win pattern.

### Two Game Modes
- **Caller** — Numbers are called one at a time (1–75). The app auto-marks them on every card and checks for wins.
- **Card‑Only** — No caller. Tap cells directly on individual cards to track progress however you want.

### Win Pattern Detection
The app checks your cards against these patterns and shows a trophy banner when you hit one:

| Pattern | What it needs |
|---------|---------------|
| Single Line | Any row, column, or diagonal |
| Four Corners | All 4 corner cells |
| Postage Stamp | A full 2×2 block in any corner |
| Letter X | Both diagonals (9 cells) |
| Letter L | Any full row + full column |
| Letter T | Any full row + center column |
| Frame | All 16 outer border cells |
| Full House | All 25 cells |
| Multi-Line | 2+ lines at once |

You can toggle which patterns to track in the settings dialog.

### Progress Bars
Each card's tab shows progress toward the best-matching enabled pattern — so you always know which card is closest.

### Session Management
- **Manual save** — "Save Session" button in the header (only enabled when there are unsaved changes).
- **Auto‑save** — Saves automatically when you close the tab or browser.
- **Clear dialog** — Checkboxes to clear called numbers, delete all cards, or both.

### Number Board
Visual 5×15 grid of all numbers 1–75. Called numbers are highlighted. Tap any number to call or void it.

### OCR Import
Snap a photo of a physical bingo card and the app will extract the numbers using [Tesseract.js](https://github.com/naptha/tesseract.js/). Review and confirm before adding.

## Tech Stack

| Layer | What |
|-------|------|
| Framework | Angular 21 (standalone, signals, zoneless) |
| Language | TypeScript 5.9 (strict mode) |
| UI | Angular Material 21 |
| Testing | Vitest (zoneless, no Karma/Jasmine) |
| Build | @angular/build (esbuild/Vite) |
| E2E | Playwright |
| Package | pnpm |
| OCR | Tesseract.js |
| Deploy | GitHub Actions → GitHub Pages |

## Getting Started

```bash
pnpm install
pnpm start        # dev server at http://localhost:4200
pnpm test         # run unit tests
pnpm build        # production build
```

## Project Structure (DDD)

```
src/app/domains/bingo/
├── domain/         # Pure TS — entities, value objects, no Angular imports
├── data/           # Infrastructure — localStorage, OCR, DTOs
├── application/    # Facade — use cases, signals, orchestration
├── ui/             # Components — dialog, card, caller, board
├── pages/          # Route-level lazy page component
└── routes.ts       # Lazy-loaded route config
```

## Deployment

The app is pre-configured for GitHub Pages via GitHub Actions. Push to `master` and it auto-deploys:

```bash
git remote add origin https://github.com/<your-user>/bbgo.git
git push -u origin master
```

Then enable **Settings → Pages → Source: GitHub Actions** in your repo.

Your site will be at `https://<your-user>.github.io/bbgo/`.

## License

MIT — do whatever, it's a bingo app.
