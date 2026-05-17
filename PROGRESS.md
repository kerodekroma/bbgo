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
- **OCR:** Tesseract.js (browser-based WebAssembly)
- **Build:** esbuild/Vite via `@angular/build`
- **Deploy:** GitHub Actions → GitHub Pages

---

## Architecture (DDD)

```
src/app/domains/bingo/
├── domain/          # Pure TS — entities, VOs, win patterns, types
├── data/            # Angular services — repository impl, localStorage, OCR, DTOs
├── application/     # Injectable facade — orchestrates use cases
├── ui/              # Presentation components — card, caller, board, dialogs
└── pages/           # Route-level lazy component
```

### Key Files
| Layer | File | Responsibility |
|-------|------|----------------|
| Domain | `bingo-card.entity.ts` | Card entity: mark/void cells, win detection, pattern progress, rename, edit numbers |
| Domain | `bingo-number.vo.ts` | Value object for bingo numbers with validation |
| Domain | `grid-cell.vo.ts` | Cell state (marked, winning, number, FREE toggle) |
| Domain | `win-pattern.type.ts` | Win pattern definitions (Line, Four Corners, X, etc.) + settings |
| Data | `card-repository.impl.ts` | localStorage persistence for cards |
| Data | `game-state.service.ts` | localStorage persistence for game state (called numbers, mode, settings) |
| Data | `ocr.service.ts` | Tesseract.js OCR — extract numbers from photos |
| Application | `bingo.facade.ts` | Central state: cards, called numbers, game mode, settings, dirty tracking |
| UI | `bingo-card.component.ts` | 5×5 grid with caller/card mode rendering, edit mode, FREE click |
| UI | `number-caller.component.ts` | Caller input + recent 15 chips with undo |
| UI | `number-board.component.ts` | 75-cell master board (click to call/void) |
| UI | `card-tabs.component.ts` | MatAccordion with per-pattern progress bars, inline rename, edit toggle |
| UI | `clear-dialog.component.ts` | Clear dialog with checkboxes for numbers/cards |
| UI | `add-card-dialog.component.ts` | Manual entry grid + photo upload with OCR |
| UI | `settings-dialog.component.ts` | Win pattern toggle dialog |
| Pages | `bingo-game-page.component.ts` | Main page layout, caller/board toggle, save/clear header |

---

## Completed Features

### Core Gameplay
- [x] **75-ball US Bingo** — B(1-15), I(16-30), N(31-45), G(46-60), O(61-75)
- [x] **5×5 grid** with FREE center cell (manually toggleable, starts unmarked)
- [x] **Dual game modes:**
  - **Caller mode:** Central number input auto-marks all cards
  - **Card-only mode:** Click cells on individual cards to toggle
- [x] **Win detection** — checks after every mark against active patterns
- [x] **Winning cell highlight** — gold gradient + pulse animation
- [x] **Win banner** — trophy banner showing which card won and which pattern
- [x] **Game-over banner** — shows when all 75 numbers called with no winner

### Win Patterns (configurable via Settings)
- [x] Single Line (horizontal, vertical, diagonal)
- [x] Four Corners
- [x] Postage Stamp (2×2 block in any corner)
- [x] Letter X (both diagonals)
- [x] Letter L (any full row + full column)
- [x] Letter T (any full row + center column)
- [x] Frame (all 16 outer border cells)
- [x] Full House (all 25 cells)
- [x] Multi-Line (2+ lines simultaneously)

### Pattern-Aware Progress
- [x] Each card tab shows the best-matching enabled pattern name + percentage
- [x] Progress calculated per-pattern (not overall card fill)
- [x] FREE cell excluded from all progress calculations
- [x] Color-coded progress bar matching closeness to completion

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
- [x] **Add cards** — manual 5×5 grid entry with column validation
- [x] **Add cards via OCR** — take/upload photo, auto-extract numbers, review before saving
- [x] **Mobile camera support** — "Take Photo" button opens rear camera directly
- [x] **Low-confidence flags** — orange cells flagged when OCR confidence <60% for review
- [x] **Remove cards** — with active card auto-switching
- [x] **Rename cards** — click title in accordion header to edit inline
- [x] **Reset card** — clears all marks on a specific card (keeps numbers)
- [x] **Edit mode** — toggle per card to edit individual cell numbers via inputs
  - Validates column ranges (B:1-15, I:16-30, etc.)
  - Commits on blur or Enter, reverts on Escape
- [x] **Demo card on first launch** — app auto-creates a random valid card when localStorage is empty

### Session Management
- [x] **Manual save** — "Save Session" button in header (only active when dirty)
- [x] **Auto-save on tab close** — `beforeunload` handler saves if dirty
- [x] **Dirty tracking** — signal tracks unsaved changes after any mutation
- [x] **Clear dialog** — checkboxes for "Clear called numbers" and/or "Delete all cards"
- [x] **Immediate persist after clear** — empty state saved to localStorage

### UI/UX
- [x] **MatAccordion** — replaces tabs, shows card code + pattern name + progress % in headers
- [x] **Pattern-specific progress bars** — each card shows distance to closest enabled pattern
- [x] **View toggle** — switch between Caller view and Master Board view
- [x] **Paper card aesthetic** — subtle texture, rounded corners, shadows
- [x] **Light background** — `#f5f7fa` app background
- [x] **Responsive design** — mobile-friendly grid and layout
- [x] **Accessibility** — keyboard navigation, ARIA labels, focus management

### Persistence & State
- [x] **localStorage** — cards, called numbers, game mode, settings, active card persisted
- [x] **Manual persistence only** — no auto-save on mutation, only on explicit save or tab close
- [x] **Signal-driven state** — all state via Angular signals
- [x] **OnPush change detection** — default in Angular 21 (zoneless)

### OCR (Photo Recognition)
- [x] **Tesseract.js integration** — browser-based WebAssembly OCR
- [x] **Drag & drop upload** or click to browse
- [x] **Mobile capture** — `capture="environment"` opens rear camera
- [x] **Grid population** — OCR results auto-fill the manual entry grid
- [x] **Low-confidence review** — cells <60% confidence flagged in orange
- [x] **Self-clearing flags** — editing a cell removes its low-confidence flag

### CI/CD & Documentation
- [x] **GitHub Actions deploy workflow** — builds + deploys to GitHub Pages on push
- [x] **SPA routing fallback** — 404.html copies index.html
- [x] **README.md** — feature overview, tech stack, setup guide, DDD structure

### Quality
- [x] **55 unit tests** passing (Vitest)
- [x] **Playwright e2e** setup ready
- [x] **Clean build** — no warnings, no type errors

---

## Known Limitations
- [ ] **Tesseract.js first load** — downloads ~2MB language model from CDN on first use (cached after)
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
```

---

## How to Add a New Feature

1. **Domain first** — add entities, VOs, types in `domain/` (pure TS, zero Angular)
2. **Data layer** — implement repository interfaces or extend existing in `data/`
3. **Facade** — add use case methods in `application/bingo.facade.ts`
4. **UI** — create or update components in `ui/` (signals, OnPush, `@if`/`@for`)
5. **Page** — wire into `pages/bingo-game-page.component.ts` if route-level
6. **Tests** — unit tests for domain + UI, e2e for critical flows
7. **Verify** — `pnpm ng build` + `pnpm ng test --no-watch` must pass

---

*Last updated: 2026-05-16*
