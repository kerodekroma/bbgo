# BBGO — Digital Bingo Card Tracker

## Project Vision
Replace physical bingo cards with a digital tracker that supports both caller mode (central number input that auto-marks all cards) and card-only mode (per-card click toggles). Built with Angular 21, DDD architecture, signal-driven state, and a polished Material UI.

---

## Tech Stack
- **Framework:** Angular 21.2+ (Standalone, Zoneless, Signal-driven)
- **Language:** TypeScript 5.9+ (strict mode)
- **Package Manager:** pnpm
- **Testing:** Vitest (unit) + Playwright (e2e)
- **UI:** Angular Material
- **Build:** esbuild/Vite via `@angular/build`

---

## Architecture (DDD)

```
src/app/domains/bingo/
├── domain/          # Pure TS — entities, VOs, win patterns, types
├── data/            # Angular services — repository impl, localStorage, DTO mapping
├── application/     # Injectable facade — orchestrates use cases
├── ui/              # Presentation components — card, caller, board, settings
└── pages/           # Route-level lazy component
```

### Key Files
| Layer | File | Responsibility |
|-------|------|----------------|
| Domain | `bingo-card.entity.ts` | Card entity: mark/void cells, win detection, patterns, rename, edit numbers |
| Domain | `bingo-number.vo.ts` | Value object for bingo numbers with validation |
| Domain | `grid-cell.vo.ts` | Cell state (marked, winning, number) |
| Domain | `win-pattern.type.ts` | Win pattern definitions (Line, Four Corners, X, etc.) |
| Data | `bingo.repository.ts` | localStorage persistence, save/load/seed |
| Application | `bingo.facade.ts` | Central state: cards, called numbers, game mode, settings |
| UI | `bingo-card.component.ts` | 5×5 grid with caller/card mode rendering, edit mode |
| UI | `number-caller.component.ts` | Caller input + recent 15 chips with undo |
| UI | `number-board.component.ts` | 75-cell master board (click to call/void) |
| UI | `card-tabs.component.ts` | MatAccordion with progress bars, inline rename, edit toggle |
| UI | `settings-dialog.component.ts` | Win pattern toggle dialog |
| Pages | `bingo-game-page.component.ts` | Main page layout, caller/board view toggle |

---

## Completed Features

### Core Gameplay
- [x] **75-ball US Bingo** — B(1-15), I(16-30), N(31-45), G(46-60), O(61-75)
- [x] **5×5 grid** with FREE center cell (auto-marked)
- [x] **Dual game modes:**
  - **Caller mode:** Central number input auto-marks all cards
  - **Card-only mode:** Click cells on individual cards to toggle
- [x] **Win detection** — checks after every mark against active patterns
- [x] **Winning cell highlight** — gold gradient + pulse animation
- [x] **Game-over banner** — shows when any card wins

### Win Patterns (configurable via Settings)
- [x] Single Line (horizontal, vertical, diagonal)
- [x] Double Line
- [x] Four Corners
- [x] Postage Stamp (2×2 top-right corner)
- [x] Letter X
- [x] Letter L
- [x] Letter T
- [x] Frame (outer border)
- [x] Blackout (all 25 cells)

### Number Calling & History
- [x] **Caller input** — type number, press Enter to call
- [x] **Recent 15 chips** — shows last called numbers with gold pulse on latest
- [x] **Undo button** — voids the most recently called number
- [x] **Master Board** — 75-cell grid (B-I-N-G-O columns)
  - Click gray cell → calls number (turns green)
  - Click green cell → voids number (turns gray)
  - Hover shows red tint hint on called numbers
  - Fully keyboard navigable (Tab + Enter/Space)
- [x] **All-75-called detection** — blocks further calls, shows message
- [x] **Auto-clear error messages** — 3-second timeout

### Card Management
- [x] **Add cards** — generates valid random 75-ball cards
- [x] **Remove cards** — with active card auto-switching
- [x] **Rename cards** — click title in accordion header to edit inline
- [x] **Reset card** — clears all marks on a specific card (keeps numbers)
- [x] **Edit mode** — toggle per card to edit individual cell numbers via inputs
  - Validates column ranges (B:1-15, I:16-30, etc.)
  - Commits on blur or Enter, reverts on Escape
  - Blocks edit mode while game is in progress
- [x] **Demo card** — auto-created on first launch with pre-marked cells

### UI/UX
- [x] **MatAccordion** — replaces tabs, shows card code + progress % in headers
- [x] **Progress bars** — color-coded per completion:
  - <25%: red
  - 25-49%: orange
  - 50-79%: green
  - 80-99%: dark red
  - 100%: green (all marked)
- [x] **View toggle** — switch between Caller view and Master Board view
- [x] **Paper card aesthetic** — subtle texture, rounded corners, shadows
- [x] **Light background** — `#f5f7fa` app background
- [x] **Responsive design** — mobile-friendly grid and layout
- [x] **Accessibility** — keyboard navigation, ARIA labels, focus management

### Persistence & State
- [x] **localStorage** — cards, called numbers, game mode, settings, active card persisted
- [x] **Signal-driven state** — all state via Angular signals
- [x] **OnPush change detection** — with explicit CD triggers for entity mutations

### Quality
- [x] **55 unit tests** passing (Vitest)
- [x] **Playwright e2e** setup ready
- [x] **Clean build** — no warnings, no type errors

---

## Known Limitations
- [ ] **Tesseract.js OCR** — `pnpm approve-builds` requires interactive terminal input (blocked)
- [ ] **OnPush workaround** — card component uses `effect` + `markForCheck()` on `calledNumbers` change (entity mutation in place)

---

## Future Features (Roadmap)

### Priority 1 — Usability
- [ ] **Per-card pattern settings** — each card can target different win patterns
- [ ] **Custom pattern builder** — draw your own pattern on a 5×5 grid
- [ ] **Sound effects** — call announcement, win celebration, error buzz
- [ ] **Number history timeline** — scrollable list of all called numbers in order
- [ ] **Export/Import cards** — share card configurations via JSON

### Priority 2 — Multiplayer & Sync
- [ ] **WebSocket sync** — real-time caller-to-player synchronization
- [ ] **Room system** — create/join game rooms with shared called numbers
- [ ] **Player count** — show how many active cards in the game
- [ ] **Score tracking** — track wins per player/card across multiple games

### Priority 3 — Advanced Features
- [ ] **Tesseract.js OCR** — scan physical cards via camera/image upload
- [ ] **Multiple card layouts** — support 3×3, 4×4, or custom grid sizes
- [ ] **90-ball UK Bingo** — support Housie/Tambola rules
- [ ] **Game statistics** — average calls to win, most common winning patterns
- [ ] **Dark mode** — toggle between light and dark themes
- [ ] **Print cards** — generate printable PDF of cards for physical backup

### Priority 4 — Polish
- [ ] **Animations** — smooth transitions for marking, winning, accordion expand
- [ ] **PWA support** — offline-first, installable on mobile
- [ ] **Haptic feedback** — vibration on mobile when marking cells
- [ ] **Undo history** — full undo/redo stack, not just last action
- [ ] **Card templates** — save and reuse card number configurations

---

## Commands

```bash
pnpm install              # Install dependencies
pnpm ng serve             # Dev server (Vite + esbuild, HMR)
pnpm ng build             # Production build
pnpm ng test              # Vitest (zoneless, fast)
pnpm ng e2e               # Playwright e2e
pnpm approve-builds       # Approve Tesseract.js native builds (interactive)
```

---

## How to Add a New Feature

1. **Domain first** — add entities, VOs, types in `domain/` (pure TS, zero Angular)
2. **Data layer** — implement repository interfaces or extend existing in `data/`
3. **Facade** — add use case methods in `application/bingo.facade.ts`
4. **UI** — create or update components in `ui/` (signals, OnPush, `@if`/`@for`)
5. **Page** — wire into `pages/bingo-game-page.component.ts` if route-level
6. **Tests** — unit tests for domain + UI, e2e for critical flows
7. **Verify** — `npx ng build` + `npx ng test --no-watch` must pass

---

*Last updated: 2026-05-16*
