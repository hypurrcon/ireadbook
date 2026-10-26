# Ireadbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline-first, single-user PWA that helps people who struggle to read actually read their physical books regularly, track progress, and feel proud of it.

**Architecture:** Vite + React + TypeScript SPA (HashRouter so it works on any static host). All data in IndexedDB via Dexie; pure domain logic (streak, XP, speed, series, layout, prompts, backup) lives in `src/domain` and is unit-tested with Vitest. Rooms are self-contained react-three-fiber scenes registered in a room registry; each room also supplies UI theme tokens and an ambience recipe, so switching room re-skins the whole app.

**Tech Stack:** React 18, Vite 5, TypeScript, vite-plugin-pwa, Dexie + dexie-react-hooks, @react-three/fiber + @react-three/drei + three, framer-motion, i18next + react-i18next, @zxing/browser, tesseract.js (lazy), fflate, @fontsource fonts, Vitest + fake-indexeddb, Playwright.

**Spec:** `docs/specs/2026-10-26-ireadbook-design.md`

## Global Constraints

- Single user, no login, no network features except book lookup (Google Books, Open Library) and OCR language data download.
- Everything works offline after first load (service worker precache + runtime cache for tesseract data).
- Open app → start timer: ≤ 2 taps. "Continue reading" button is usable before the 3D room finishes loading.
- Two languages th/en; every UI string goes through i18next; default from `navigator.language`.
- Copy is plain and clear; no jokey/teasing tone.
- No purple-blue gradients, no frosted-glass card grids, no emoji-as-icons, no header→card grid→CTA→footer layouts. Colours come from the active room's tokens.
- Fonts: headings Noto Serif Thai; body IBM Plex Sans Thai; mono JetBrains Mono (bundled via @fontsource, no CDN).
- Sounds are synthesised with Web Audio (no audio files); categories ui / book / ambience / reward with separate volumes.
- Streak day = local calendar day where read minutes ≥ dailyGoalMin (default 5). Streak freezes: 2 per calendar month, applied automatically to fill single missed days.
- Forgotten-timer check: running session > 3 h prompts the user to correct the end time.
- Backup file: `.ireadbook` = zip containing `data.json` (with `formatVersion: 1`) + `images/<id>.jpg`. Import modes: replace / merge (newest `updatedAt` wins).
- Covers stored downscaled to max 1024px long edge JPEG q0.85; 3D textures use max 512px.
- Rooms (11): attic, cyberpunk, library, japanese, treehouse, space, wizard, train, underwater, cafe, minimal.

## Review Focus

1. Timer running while the tab is backgrounded/closed for hours → on return, elapsed is computed from `startedAt`, and >3 h triggers the correction dialog (tested in Task 6).
2. Importing a corrupted / foreign / newer-version file → import is rejected with a message and existing data is untouched (tested in Task 5).
3. Adding a book with no ISBN, no internet and garbage OCR → still saveable; empty title falls back to "Untitled"/"ไม่มีชื่อ" and `needsLookup=true` (tested in Task 8).
4. Sessions crossing midnight / on a day boundary → counted on the local start date; streak correct across month boundaries with freezes (tested in Task 3).
5. Large library (300 books) → shelf layout paginates into multiple bookcases and textures are shared per book; FPS stays usable (tested in Task 10 layout test with 300 books).

---

## File Structure

```
src/
  main.tsx, App.tsx, router.tsx
  db/types.ts          entity types (Book, Series, Session, Quote, Achievement, PromptTemplate, Settings)
  db/db.ts             Dexie database + default settings
  db/repo.ts           CRUD helpers used by screens
  domain/dates.ts      local day keys
  domain/streak.ts     streak + freeze logic
  domain/speed.ts      pages/min, ETA
  domain/xp.ts         xp & level
  domain/achievements.ts  ~20 achievement definitions + evaluator
  domain/stats.ts      monthly/yearly aggregates
  domain/series.ts     series guess from titles
  domain/isbn.ts       ISBN normalise/validate
  domain/layout.ts     sort/group books into shelves
  domain/prompts.ts    built-in templates + renderer
  domain/ics.ts        daily reminder calendar file
  domain/random.ts     weighted random pick
  backup/backup.ts     export/import zip
  lookup/books.ts      Google Books + Open Library
  lookup/ocr.ts        tesseract wrapper + title guess
  lookup/barcode.ts    zxing decode from image
  image/homography.ts  4-point perspective math
  image/process.ts     warp, downscale, auto-level, dominant colour, corner guess
  i18n/index.ts, i18n/th.json, i18n/en.json
  audio/sound.ts       synth sfx + ambience engine
  rooms/types.ts, rooms/registry.ts, rooms/common/*.tsx, rooms/<id>.tsx
  three/Book3D.tsx, three/Bookcase.tsx, three/RoomCanvas.tsx, three/textures.ts
  share/cards.ts       9:16 canvas renderers; share/collage.ts
  ui/*                 Button, Sheet, TabBar, Icon (inline SVG), Field, Toast
  screens/*            Onboarding, Shelf, BookDetail, AddBook, ReviewQueue, Read, Stats, Assistant, Settings
  state/timer.ts       active session store (persisted)
tests/                 vitest unit tests mirror src/domain, backup, image
e2e/                   playwright flow
```

---

### Task 1: Scaffold, tooling, i18n, design tokens

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/i18n/*`, `src/styles/*`, `tests/i18n.test.ts`

**Interfaces:**
- Produces: `t()` via `useTranslation()`, `setLanguage(lang: 'th'|'en'): void`; CSS variables `--bg --surface --ink --ink-soft --accent --accent-ink --line --glow` set on `:root` by `applyTokens(tokens: RoomTokens)`.

- [ ] Step 1: `npm create vite` (react-ts), add deps listed in Tech Stack, configure vite-plugin-pwa (autoUpdate, manifest name "Ireadbook", theme colour from attic), Vitest with jsdom.
- [ ] Step 2: Test `tests/i18n.test.ts`: every key path in th.json exists in en.json and vice versa; no empty strings.
- [ ] Step 3: Implement i18n init (language from localStorage `lang` else navigator).
- [ ] Step 4: `npm test` passes; `npm run build` succeeds. Commit.

### Task 2: Data layer

**Files:** `src/db/types.ts`, `src/db/db.ts`, `src/db/repo.ts`, `tests/repo.test.ts`

**Interfaces:**
- Produces types exactly as spec §6; `BookStatus = 'want'|'reading'|'paused'|'finished'|'dnf'`; `SessionMode = 'timer'|'5min'|'pomodoro'|'facedown'|'manual'`; `Format = 'paperback'|'hardcover'|'ebook'|'audiobook'`; `progressUnit: 'page'|'percent'` on Book.
- Images stored in table `images {id, blob}`; Book holds `coverFrontId`, `coverBackId`, `spineId`.
- `repo.addBook(partial): Promise<Book>`, `updateBook(id, patch)`, `deleteBook(id)` (cascade sessions/quotes/images), `addSession(s)`, `updateSession`, `deleteSession`, `getSettings()`, `saveSettings(patch)`.
- `addSession` updates book `currentPage`, sets `status='reading'` and `startedAt` if first session.

- [ ] Test with fake-indexeddb: addBook sets createdAt/updatedAt and title fallback; deleteBook cascades; addSession updates currentPage and status.
- [ ] Implement; tests pass; commit.

### Task 3: Dates, streak, speed, XP

**Files:** `src/domain/dates.ts`, `streak.ts`, `speed.ts`, `xp.ts`, tests for each.

**Interfaces:**
- `dayKey(ts: number): string` local `YYYY-MM-DD`.
- `minutesByDay(sessions): Map<string, number>` (session counted on start day).
- `computeStreak(sessions, goalMin, today: string): { current: number; best: number; frozenDays: string[]; todayDone: boolean }` — freezes: max 2 per month, only fill a single isolated missed day between read days (or yesterday when today not yet read); today not yet read does not break streak.
- `pagesPerMinute(sessions, bookId?): number|null` (needs ≥ 10 min of data); `etaMinutes(book, sessions): number|null`.
- `xpForSession(minutes): number` = 1 xp/min (cap 180/session); `XP_FINISH_BOOK = 50`; `levelFromXp(xp): { level, into, next }` with threshold `100 * level^1.5` cumulative.

- [ ] Tests: 5 consecutive days → 5; gap of one day mid-month → frozen and continues; two gaps of 1 day + third → third breaks; session 23:50→00:20 counts on start day; today unread keeps yesterday's streak; ETA uses remaining pages / speed.
- [ ] Implement; pass; commit.

### Task 4: ISBN, series guess, layout, random, ics

**Files:** `src/domain/isbn.ts`, `series.ts`, `layout.ts`, `random.ts`, `ics.ts` + tests.

**Interfaces:**
- `normalizeIsbn(raw): string|null` (ISBN-10→13, checksum validated).
- `parseVolume(title): { base: string; index: number|null }` handles `เล่ม 2`, `เล่ม ๒` (Thai digits), `Vol. 3`, `Volume 3`, `#4`, trailing ` 5`, `(5)`.
- `guessSeries(book, others): { baseTitle, index, matches: Book[] }|null` — same normalised base title, or same author + base similarity ≥ 0.8 (bigram Dice).
- `SortMode = 'genre'|'series'|'author'|'status'|'added'|'color'`; `layoutShelves(books, mode, perShelf: number, shelvesPerCase: number): Bookcase[]` where `Bookcase = { shelves: { label?: string; books: Book[] }[] }`; series grouped contiguous by index; colour sorts by hue of dominantColor.
- `pickRandom(books, rng=Math.random): Book|null` — only want/paused, weight 2 for paused.
- `buildDailyIcs(time: 'HH:MM', title, body): string` RRULE:FREQ=DAILY.

- [ ] Tests incl. 300-book layout produces ≥2 cases and preserves every book exactly once; Thai digits volume.
- [ ] Implement; pass; commit.

### Task 5: Backup export/import

**Files:** `src/backup/backup.ts`, `tests/backup.test.ts`

**Interfaces:** `exportBackup(): Promise<Blob>`; `importBackup(file: Blob, mode: 'replace'|'merge'): Promise<{books:number; sessions:number}>`; throws `BackupError(code: 'invalid'|'version')`.

- [ ] Tests: round trip with an image; merge keeps newer updatedAt; corrupt zip → BackupError('invalid') and DB unchanged; formatVersion 99 → BackupError('version').
- [ ] Implement with fflate, transaction for writes; commit.

### Task 6: Timer state

**Files:** `src/state/timer.ts`, `tests/timer.test.ts`

**Interfaces:** persisted (localStorage) store: `start(bookId, mode, targetMin?)`, `pause()`, `resume()`, `elapsedSec(now)`, `stop(now): Draft`, `discard()`, `needsCorrection(now): boolean` (>3h), `active: ActiveSession|null`. Pauses accumulate `pausedMs`.

- [ ] Tests: elapsed after simulated reload; pause excludes time; >3h flags correction.
- [ ] Implement with zustand persist; commit.

### Task 7: Image processing

**Files:** `src/image/homography.ts`, `src/image/process.ts`, `tests/homography.test.ts`

**Interfaces:** `solveHomography(src: Pt[4], dst: Pt[4]): number[9]`; `warpToRect(img, corners, w, h): HTMLCanvasElement`; `autoLevel(canvas)`; `dominantColor(canvas): string` hex; `guessCorners(canvas): Pt[4]` (edge projection, falls back to 6% inset); `downscale(blob, max): Promise<Blob>`.

- [ ] Test homography maps the 4 corners exactly and centre consistently. Implement; commit.

### Task 8: Lookup (barcode, Google Books, Open Library, OCR)

**Files:** `src/lookup/*`, `tests/lookup.test.ts`

**Interfaces:** `decodeIsbnFromImage(blob): Promise<string|null>` (BarcodeDetector if present else zxing); `lookupIsbn(isbn): Promise<BookMeta|null>`; `searchText(q): Promise<BookMeta[]>`; `ocrCover(blob): Promise<string>` (lazy tesseract, langs `tha+eng`); `guessFromOcr(front, back): Partial<BookMeta>` (largest-line heuristic → title; lines with "เขียน|ผู้เขียน|by" → author; "สำนักพิมพ์|Publishing" → publisher); `BookMeta = {title, subtitle?, authors[], publisher?, year?, pageCount?, language?, categories[], isbn?, seriesHint?}`.
- Map Google categories to app genre keys: fiction, fantasy, scifi, mystery, romance, horror, history, biography, selfhelp, business, psychology, philosophy, science, comics, poetry, children, other.

- [ ] Tests with mocked fetch: Google hit; Google miss → Open Library; offline (fetch throws) → null; guessFromOcr on sample Thai text; empty OCR → `{}`.
- [ ] Implement; commit.

### Task 9: Sound engine + UI kit + app shell

**Files:** `src/audio/sound.ts`, `src/ui/*`, `src/App.tsx`, `src/router.tsx`

**Interfaces:** `sfx(name: 'tap'|'open'|'close'|'bookOut'|'bookIn'|'pageFlip'|'reward'|'tick'|'start'|'stop')`; `ambience.play(recipe: AmbienceRecipe)`/`stop()`; `AmbienceRecipe = { layers: ('rain'|'hum'|'wind'|'crackle'|'chimes'|'birds'|'clock'|'ocean'|'train'|'cafe'|'synth')[] }`; volumes from settings. Tab bar: Shelf, Read, Add (centre), Stats, Assistant. Haptics via `navigator.vibrate` when available.

- [ ] Build, manual check in browser via Playwright screenshot; commit.

### Task 10: Rooms + 3D shelf

**Files:** `src/rooms/*`, `src/three/*`

**Interfaces:** `RoomDef = { id; nameKey; tokens: RoomTokens; ambience: AmbienceRecipe; Scene: FC<{quality; night: boolean; customization}>; bookcase: BookcaseStyle; camera }`; `registry: RoomDef[]` with all 11 rooms; `<RoomCanvas books sortMode onPick(book)>` renders room Scene + bookcases from `layoutShelves`; `Book3D` box with front/back/spine textures (spine texture generated on canvas from dominant colour + title text + volume number); picked book slides out and rotates; zone labels as real text (drei `Text` with bundled Thai font).
- Quality: low = no shadows, dpr 1, fewer particles; mid; high = shadows, dpr 2.
- Customization: shelfColor, shelfMaterial ('wood'|'metal'|'painted'), shelfCount, night, decor ids.

- [ ] Each room renders without console errors (Playwright loop over rooms, screenshot). Commit.

### Task 11: Screens — Onboarding, Shelf, BookDetail, 2D view

- Shelf: room full screen, front strip "กำลังอ่าน" with Continue button (rendered outside Canvas so usable immediately), today status chip, sort/filter/search sheet, 2D/3D toggle.
- BookDetail: all fields editable, status change, series confirm, sessions list (edit/delete), start reading.
- [ ] Playwright: onboarding → shelf; continue reading in 2 taps. Commit.

### Task 12: Add book flow + review queue

- Capture front → back (skip) → corner adjust (drag 4 handles, guessed) → process → lookup chain → editable form → save. Continuous mode queues captures and processes in background, Review queue lists `needsReview` books. Manual add + text search. Retry lookup for `needsLookup` when `online` event.
- [ ] Playwright with a fixture image and mocked network. Commit.

### Task 13: Read screen

- Suggested book, modes (timer, 5min, pomodoro 25/5, facedown with DeviceOrientation + Wake Lock + black screen, iOS permission request), last-session recap (page + note), ETA, end sheet (end page or %, note, mood), XP gain animation, achievement unlock toast, share card button. Manual entry form. Correction dialog.
- [ ] Playwright: start → stop → saved session shows in stats. Commit.

### Task 14: Stats, achievements, Wrapped

**Interfaces:** `monthlyStats(sessions, books, year, month)`, `yearlyStats(...)` → `{minutes, pages, booksFinished, daysRead, avgPpm, genres: Record<string,number>, hourHistogram: number[24], topBook}`; `ACHIEVEMENTS: {id, nameKey, descKey, test(ctx)}[]` (~20); `evaluateAchievements(ctx): string[]` newly unlocked.
- Calendar heatmap, level bar, yearly goal ring, month/year switcher, Wrapped slideshow.
- [ ] Unit tests for stats + achievements; commit.

### Task 15: Share cards + collage

**Interfaces:** `renderCard(kind: 'session'|'finished'|'quote'|'wrapped', data, tokens): Promise<Blob>` 1080×1920; `renderCollage(books): Promise<Blob>` numbered grid; `shareBlob(blob, filename)` Web Share with download fallback.
- [ ] Visual check via Playwright; commit.

### Task 16: Assistant (prompts), quotes, random pick

- Built-in templates: whatNext, finishPlan, quiz, summarizeNotes, similarBooks; custom templates CRUD; variables `{unreadBooks} {readBooks} {currentBook} {notes} {minutesPerDay} {mood} {deadline} {language}`; output language follows app language; copy button + collage.
- Quotes: photo page → OCR → select text → save; quote list per book; quote share card.
- Random pick with spin animation.
- [ ] Unit test `renderPrompt`; commit.

### Task 17: Settings + persistence warnings + reminders

- Language, room picker with previews, customization, quality, volumes, daily goal, yearly goal, reminder time → download .ics, export/import, storage persist request, backup reminder (14 days or 10 new books), iOS install hint.
- [ ] Commit.

### Task 18: End-to-end verification and delivery

- [ ] Playwright e2e: onboarding (th) → manual add 2 Thai books → read session → stats shows streak 1 → export → clear DB → import → data restored; switch to en; all rooms screenshot.
- [ ] `npm test`, `npm run build`, lighthouse-ish PWA check (manifest + SW registered).
- [ ] Write README (Thai) with run/deploy steps (Netlify drop / GitHub Pages).
- [ ] Copy project to user's folder.
