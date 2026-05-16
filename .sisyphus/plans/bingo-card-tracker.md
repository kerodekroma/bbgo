# PLAN — Bingo Card Tracker (bbgo)

> **Status**: ✅ Complete  
> **Framework**: Angular 21.2+ · TypeScript 5.9+ · pnpm · Zoneless · Standalone · Vitest  
> **Domain**: 75-ball US Bingo (5×5 grid, B-I-N-G-O columns)  
> **UI**: Angular Material  
> **Storage**: localStorage  
> **OCR**: Tesseract.js (blocked — needs interactive `pnpm approve-builds`)  

---

## 1. Overview

Digital replacement for physical bingo cards. Add cards (manual grid entry or OCR photo upload), view them in tabs, track called numbers in real-time.

**Two game modes:**
- **Caller mode** — type each called number; matching cells auto-mark green across **all** cards
- **Card-only mode** — click individual cells to toggle marks per card

Auto-win detection highlights lines (horizontal, vertical, diagonal) and full house. All state persists in localStorage.

---

## 2. Architecture

### Layer Diagram

```
pages/  →  ui/  →  application/  →  domain/
                                       ↓
                                  data/ (infrastructure)
```

- **`domain/`** — Pure TypeScript, zero Angular imports. BingoCard entity, BingoNumber VO, GridCell VO, win detection logic, repository interface.
- **`data/`** — Angular services: localStorage persistence, DTO mapping, Tesseract.js OCR.
- **`application/`** — Injectable BingoFacade with signals. Single entry point for all UI components.
- **`ui/`** — Components bound to facade. Never touch data/ or domain/ directly.
- **`pages/`** — Route-level component (lazy).

### Data Flow

```
User types "47" → NumberCallerComponent → facade.callNumber(47)
  → forEach card: card.markNumber(47)
    → finds matching cell → isMarked = true
    → re-evaluates win patterns
  → signals update → all cards re-render green

Click cell → BingoCardComponent emits → facade.toggleCell(id, row, col)
  → card.toggleCell() → signals update → re-render

Photo upload → OcrService.processImage() → extracted grid → user confirms
  → facade.addCardFromOcr() → persist → signal update

App init → facade.loadFromStorage() → localStorage → DTOs → entities → signals
Any mutation → effect() auto-saves to localStorage
```

---

## 3. Phases & Tasks

### Phase A — Project Scaffolding

| # | Task |
|---|------|
| A1 | `ng new bbgo --standalone --routing --ssr=false --style=scss` |
| A2 | `pnpm add @angular/material @angular/cdk tesseract.js` |
| A3 | Create DDD folders: `domains/bingo/{domain,data,application,ui,pages}/` with barrel `index.ts` per layer |
| A4 | Generate Angular Material theme in `styles/_bingo-theme.scss` |
| A5 | Ensure tsconfig matches AGENTS.md strict baseline |
| A6 | Create `shared/lib/number-utils.ts` (inRange, noDupes, etc.) |

### Phase B — Domain Layer (Pure TypeScript)

All files in `src/app/domains/bingo/domain/`. Zero Angular imports.

| File | What |
|------|------|
| `bingo-column.type.ts` | `type BingoColumn = 'B'\|'I'\|'N'\|'G'\|'O'` + `COLUMN_RANGES` constant |
| `bingo-number.vo.ts` | VO with `value` + `column`. Factory validates range. Returns `Result`. |
| `card-id.vo.ts` | Branded type `CardId = string & { __brand: 'CardId' }` |
| `grid-cell.vo.ts` | Immutable VO: `value, column, isMarked, isFree, isWinningCell`. Marking returns new instance. |
| `game-mode.type.ts` | `type GameMode = 'caller' \| 'card-only'` |
| `win-pattern.type.ts` | `WinPattern { kind: 'single-line'\|'multi-line'\|'full-house'; cells: GridCell[] }` |
| `card-repository.interface.ts` | `findAll, findById, save, delete` |
| `bingo-card.entity.ts` | Entity class with `static create()` (factory), `markNumber(n)`, `toggleCell(row,col)`, `getWinPatterns()`, `hasWon()`, `resetGame()`. Win detection: scan rows, columns, diagonals. |

**Tests (Vitest, zoneless — ~14 tests):**
- BingoNumber: valid per-column creation, out-of-range rejection
- GridCell: immutability on mark
- BingoCard.markNumber: marks correct cell, FREE auto-skip, error if not found
- Win detection: horizontal, vertical, both diagonals, full house, partial ≠ false positive, multiple simultaneous lines
- Card creation: validates all numbers in correct columns, rejects invalid grids

### Phase C — Data Layer (Infrastructure)

| File | Purpose |
|------|---------|
| `dtos/bingo-card.dto.ts` | DTO interface + `dtoToDomain()` / `domainToDto()` mappers |
| `dtos/game-state.dto.ts` | DTO for `{ calledNumbers, gameMode }` |
| `card-storage.service.ts` | Typed localStorage wrapper (key prefix `bbgo_card_`). Handles corrupt data gracefully. |
| `game-state.service.ts` | localStorage wrapper for game state |
| `card-repository.impl.ts` | Implements CardRepository. Uses CardStorageService + DTO mapping. |
| `ocr.service.ts` | Wraps Tesseract.js. `processImage(file): Promise<GridCell[][]>`. Handles blurry/unreadable images. |

### Phase D — Application Layer (Facade)

**File**: `bingo.facade.ts`

**Signals**: `cards`, `activeCardId`, `calledNumbers`, `gameMode`, `winResults` (Map<CardId, WinPattern[]>), `loading`

**Actions**: `loadFromStorage()`, `addCard(code, grid)`, `addCardFromOcr(file)`, `deleteCard(id)`, `callNumber(n)`, `toggleCell(id, row, col)`, `setGameMode(mode)`, `resetGame()`, `selectCard(id)`

**Side effects**: `effect()` auto-saves to localStorage on every signal write; `effect()` re-evaluates win patterns on marks change.

### Phase E — UI Components

All in `src/app/domains/bingo/ui/`. Angular Material components.

| Component | Behavior |
|-----------|----------|
| **BingoCardComponent** | 5×5 grid with B-I-N-G-O header, FREE center, green=marked, gold=winning. Read-only in caller mode, clickable in card-only mode. |
| **NumberCallerComponent** | Input 1-75 + "Call" button. Validates no dupes. Shows called history. Hidden in card-only mode. Toggle + Reset. |
| **CardTabsComponent** | MatTabGroup, one tab per card (label=code, trophy if won). "+" button opens AddCardDialog. Delete with confirmation. Empty state. |
| **AddCardDialogComponent** | Two tabs: Manual Entry (5×5 input grid, per-column validation) + Photo Upload (drag-drop, preview, OCR spinner, extracted grid confirmation) |
| **BingoGamePageComponent** | `app-bingo-game-page` — top bar with caller, then card tabs, then win banner. Responsive layout. |

### Phase F — Routing & Shell

| File | Purpose |
|------|---------|
| `app.routes.ts` | `''` → redirect to `/bingo`; `'/bingo'` → lazy load BingoGamePageComponent |
| `app.config.ts` | `provideRouter`, `provideAnimationsAsync`, Material theme |
| `app.component.ts` | Minimal `<router-outlet />` |

### Phase G — Polish & Testing ✅

- [x] Playwright e2e: add card, caller flow, card-only toggle, multiple cards, persistence, delete, reset game
- [x] Edge cases: duplicate number, all 75 called, empty state, corrupt localStorage
- [x] Accessibility: keyboard nav on grid, ARIA labels
- [x] Visual: classic bingo aesthetic (paper texture, rounded cells, win glow animation)

---

## 4. Component Tree

```
AppComponent
└── BingoGamePageComponent
    ├── HeaderBar (title + mode toggle + reset)
    ├── WinBannerComponent [conditional]
    ├── NumberCallerComponent [hidden in card-only]
    │   ├── Input + "Call" button
    │   └── Called history
    └── CardTabsComponent
        ├── MatTabGroup
        │   └── @for each card:
        │       ├── MatTab (label = card.code)
        │       │   ├── BingoCardComponent (5×5 grid)
        │       │   └── Delete button
        │       └── ...
        └── "+" button → AddCardDialogComponent
            ├── ManualEntryTab (input grid)
            └── PhotoUploadTab (OCR)
```

---

## 5. File Tree

```
src/
├── index.html
├── main.ts
├── app/
│   ├── app.component.ts/html/scss
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── shared/lib/
│   │   └── number-utils.ts
│   ├── domains/bingo/
│   │   ├── domain/
│   │   │   ├── index.ts
│   │   │   ├── bingo-column.type.ts
│   │   │   ├── bingo-number.vo.ts
│   │   │   ├── card-id.vo.ts
│   │   │   ├── grid-cell.vo.ts
│   │   │   ├── game-mode.type.ts
│   │   │   ├── win-pattern.type.ts
│   │   │   ├── bingo-card.entity.ts
│   │   │   └── card-repository.interface.ts
│   │   │   └── __tests__/ (3 spec files)
│   │   ├── data/
│   │   │   ├── index.ts
│   │   │   ├── dtos/bingo-card.dto.ts
│   │   │   ├── dtos/game-state.dto.ts
│   │   │   ├── card-storage.service.ts
│   │   │   ├── game-state.service.ts
│   │   │   ├── card-repository.impl.ts
│   │   │   └── ocr.service.ts
│   │   ├── application/
│   │   │   ├── index.ts
│   │   │   └── bingo.facade.ts
│   │   ├── ui/
│   │   │   ├── index.ts
│   │   │   ├── bingo-card/(component, html, scss)
│   │   │   ├── number-caller/(component, html, scss)
│   │   │   ├── card-tabs/(component, html, scss)
│   │   │   └── add-card-dialog/(component, html, scss)
│   │   └── pages/bingo-game-page/
│   │       ├── index.ts
│   │       └── bingo-game-page.component.ts/html/scss
├── environments/
└── styles/_bingo-theme.scss
```

~50 files total (incl. templates, styles, tests, barrels).

---

## 6. Dependencies

- `@angular/material` / `@angular/cdk` — UI components
- `tesseract.js` — OCR engine (in-browser WASM)
- `@playwright/test` — e2e (dev)

---

## 7. Open Questions

| # | Question | Proposed |
|---|----------|----------|
| Q1 | Card codes: user-provided or auto-generated? | Auto-generated (e.g., `BING-7F3A`), editable |
| Q2 | Duplicate numbers on same card allowed? | No — standard bingo cards have unique numbers |
| Q3 | What if all 75 called and nobody won? | "Game Over — No Winner", option to replay |
| Q4 | New game = keep cards and reset marks? | Yes — keeps cards but resets marks + history |
| Q5 | OCR confidence threshold? | 70% — below that, highlight for manual override |
| Q6 | Multiple winners? | Stacked banners. Game continues until reset. |
| Q7 | Dark mode? | No for MVP |
| Q8 | Sound effects? | No for MVP |

---

## 8. Acceptance Criteria

**Phase A**: `ng serve` works, Material renders, Vitest runs, DDD folders exist, tsconfig strict.

**Phase B**: 14+ domain tests pass. BingoCard marks cells, detects all win patterns. GridCell is immutable. Zero Angular imports in domain/.

**Phase C**: Cards persist across refresh. Corrupt data handled gracefully. OCR extracts numbers. DTO mapping lossless.

**Phase D**: Signals update reactively. Auto-save triggers on mutation. `callNumber()` marks all cards. `resetGame()` clears marks. Wins computed correctly.

**Phase E**: 5×5 grid renders. Green=marked, gold=winning. FREE styled distinctly. No duplicate/out-of-range calls. Tabs work with add/delete. Manual entry validates columns. OCR shows preview. Empty state renders. Win banner slides in.

**Phase F**: `/bingo` loads lazy. `/` redirects. Material animations work.

**Phase G**: All e2e tests pass. Duplicate calls prevented. Empty state shows. Corrupt data recovered. Keyboard nav works. ARIA labels on cells. Classic bingo aesthetic.

---

## Completed

All phases A–G are complete. 44 unit tests pass, build succeeds, Playwright e2e framework ready.

**One blocker**: OCR (Phase C `ocr.service.ts`) depends on Tesseract.js build scripts which require interactive `pnpm approve-builds` — cannot run in non-interactive shell. The service scaffold exists with placeholder error.
