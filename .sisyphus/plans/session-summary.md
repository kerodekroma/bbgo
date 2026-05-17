HANDOFF CONTEXT
===============

USER REQUESTS (AS-IS)
---------------------
- "hey sisyphus, I want you to handle the local storage better, it shouldn't start with default data only if a user save it manually in a new button called save session or something similar in the top of the screen or when a user tries to close the tab in the web browser"
- "thanks but why the demo card has already marked values?"
- "thanks! and please make an option to clear, which shows a dialog with a list of options to check, to clear the story, to clear the board, the story and the cards, additionally remove the preload of the story"
- "thanks! but for some reason when everything is cleared there is the 4% in the demo card, why?"
- "ohh, could you please ignore it or make it unmarked because it's confused to see that 4% when nothing has been selected"
- "humm it seems it doesn't work, is there a way to add a new type to that free square or don't consider it as part of the percentage?"
- "thanks so much! so now let's improve the relationship between the paterns and the progress, I see that the percentage calculates in the full mode could you calculate by the pattern or pattern selected? additionally, could you notify which pattern is currently playing"
- "perfect! thanks so much, so now let's create the proper setup to promote it to github pages"
- "awesome! thanks, let's create a README.md too, this project is for fun and a personal tool to track more than one bingo card better"
- "thanks! and the potho recognition is working too?"
- "awesome! yes please" (implement OCR)
- "awesome! and it will work if I take a photo direcly If I open this app my smart phone?"
- "thanks! could you please commit and push the changes, I already set the remote repo"
- "before I go, can you update all this progress in the file we worked before?"

GOAL
----
All user requests have been fulfilled. The app is ready to push to GitHub and deploy to GitHub Pages (user needs to run `git push origin main` from their machine since the SSH key on this development machine doesn't have access).

WORK COMPLETED
--------------
- Removed auto-save from localStorage; added manual "Save Session" button + beforeunload auto-save
- Added dirty signal tracking (unsaved changes indicator)
- Removed demo card / preload entirely — app starts empty
- Made FREE cell manually toggleable (starts unmarked), excluded from progress %
- Created Clear dialog with checkboxes for "Clear called numbers" and "Delete all cards"
- Added deleteAllCards(), saveSession(), and clearAll() to facade/repository
- Implemented getPatternProgress(kind) on BingoCard entity — calculates 0-100 for any pattern
- Updated card-tabs to show the best-matching enabled pattern name + progress %
- Added .github/workflows/deploy.yml for GitHub Pages auto-deploy
- Created README.md with full feature overview, tech stack, setup guide
- Integrated Tesseract.js OCR in ocr.service.ts — running real worker instead of placeholder
- OCR results populate the manual entry grid; low-confidence cells (<60%) flagged in orange
- Dialog switches to manual entry tab after OCR for user review
- Added mobile camera support — capture="environment", "Take Photo" + "Browse" buttons
- Added allowedCommonJsDependencies for tesseract.js in angular.json
- Deploy workflow triggers on both main and master branches
- All changes committed (13 commits total) and build/tests verified

CURRENT STATE
-------------
- Working tree clean, all changes committed on branch main
- Remote configured: git@github.com:andru255/bbgo.git
- Build: pnpm ng build — passes clean (no warnings)
- Tests: pnpm ng test — 55/55 pass
- Last commit: 2ec66a7 Trigger deploy on main and master branches

PENDING TASKS
-------------
- Push to remote: needs to be done from user's machine (git push origin main)
- Enable GitHub Pages in repo Settings → Pages → Source: GitHub Actions
- First deploy will happen automatically on push

KEY FILES
---------
- src/app/domains/bingo/application/bingo.facade.ts — Central state orchestration, dirty tracking, save/clear
- src/app/domains/bingo/domain/bingo-card.entity.ts — Card entity with getPatternProgress(), win detection
- src/app/domains/bingo/domain/grid-cell.vo.ts — Grid cell VO, FREE cell behavior
- src/app/domains/bingo/data/ocr.service.ts — Tesseract.js OCR integration
- src/app/domains/bingo/ui/card-tabs/card-tabs.component.ts — Pattern-aware progress display
- src/app/domains/bingo/ui/bingo-card/bingo-card.component.ts — FREE cell clickable in UI
- src/app/domains/bingo/ui/clear-dialog/clear-dialog.component.ts — Clear dialog with checkboxes
- src/app/domains/bingo/ui/add-card-dialog/add-card-dialog.component.ts — Manual entry + OCR upload UI
- src/app/domains/bingo/pages/bingo-game-page/bingo-game-page.component.ts — Header with save/clear, beforeunload
- .github/workflows/deploy.yml — GitHub Pages CI/CD pipeline

IMPORTANT DECISIONS
-------------------
- FREE cell is manually toggleable (not auto-marked), excluded from progress calculation
- PRogress is per-pattern (best enabled pattern), not overall card fill
- Session management: manual save + beforeunload auto-save only, no auto-save on mutation
- OCR: uses Tesseract.js createWorker API with English language model loaded from CDN
- Angular 21 standalone components + signals + zoneless throughout
- DDD structure: domain/ (pure TS) → data/ (infrastructure) → application/ (facades) → ui/ (components)
- Heap-allocated mutable entities (BingoCard) rather than deep-cloning on every mutation

EXPLICIT CONSTRAINTS
--------------------
None

CONTEXT FOR CONTINUATION
------------------------
- Tesseract.js loads the English language model from CDN on first use (~2MB download)
- The Github Actions workflow uses pnpm/action-setup@v4 and actions/setup-node@v4 with node 22
- The app uses Angular 21 zoneless change detection — no fakeAsync/tick in tests, use vi.useFakeTimers
- Signals over RxJS for all UI state; HttpClient is auto-provided in Angular 21
- All components are standalone (no NgModules)
- New control flow: @if/@for/@switch/@defer (never *ngIf/*ngFor/*ngSwitch)
