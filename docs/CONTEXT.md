# puzzle-book-generator — Compressed Project Context
**Generated:** 2026-05-16  **Version:** v0.3.9  **Status:** Active development

---

## 1. Project Identity

**Product:** *The Observatory* — a 32-puzzle crossword book for KDP print-on-demand (6×9")  
**Publisher:** WORD Games · A Syntax Press Production · A Rhizo Labs Expedition  
**Theme:** "All knowledge is an act of looking — from the right position, with the right instrument."  
Each puzzle is a different field of knowledge. The book is designed around the Observatory metaphor.

---

## 2. Repository Structure

```
puzzle-book-generator/
├── packages/
│   ├── shared/src/                    TypeScript types (Puzzle, Grid, Cell, Clue, Book, etc.)
│   ├── puzzle-generator/src/          CrosswordGenerator + pure grid functions
│   ├── book-generator/src/            PDF rendering, assembler, templates, covers
│   └── content-db/src/                Prisma/Supabase (not yet active)
├── apps/
│   ├── cli/src/commands/              generate-book.ts (manifest + single-input modes)
│   └── web/                           Fastify + Vite/React (not yet active)
├── observatory-book.manifest.json     32-puzzle book manifest
└── sample-words.csv
```

**Module system:** CommonJS  
**Build order:** shared → puzzle-generator → book-generator → content-db → cli → web  
**tsconfig paths** point to `dist/` (not `src/`) — shared must build first

---

## 3. Key Files & What They Do

| File | Purpose |
|------|---------|
| `packages/puzzle-generator/src/crossword/crossword.generator.ts` | Orchestrates layout: normalizes words, calls layout library (or future custom engine), trims/compacts grid |
| `packages/puzzle-generator/src/crossword/crossword.functions.ts` | Pure functions: normalizeCandidates, buildBlankCellMap, openWordCells, assignClueNumbers, buildGrid, trimGrid, compactGrid |
| `packages/book-generator/src/templates/crossword/crossword.template.ts` | PDFKit rendering: cover, intro, puzzle pages, answer key |
| `packages/book-generator/src/templates/crossword/covers/` | ICoverTemplate interface + 3 covers (observatory-scene, silhouette, crossword-title) |
| `packages/book-generator/src/renderers/pdf-book.renderer.ts` | Drives template, manages pages |
| `apps/cli/src/commands/generate-book.ts` | CLI: --manifest (themed, per-puzzle word lists) or --input (single pool) |

---

## 4. Data Flow

```
manifest.json
  → CLI reads each puzzle entry { title, wordlist, graphic, lens }
  → loadWordList(csvPath) → WordListEntry[]
  → shuffle → normalizeCandidates (filter, uppercase, dedup, sort longest-first)
  → runLayoutGenerator (crossword-layout-generator lib, 6 retries, density scoring)
  → buildCrosswordGridAndClues → trimGrid → compactGrid
  → Puzzle { metadata: { title, graphic, lens, wordCount }, grid, clues }
  → bookAssembler.assemble(puzzles, options)
  → PrintRenderer / ScreenRenderer → PDFKit document
  → CrosswordTemplate.renderPuzzlePage(puzzle, pageNumber, options)
  → ZIP output
```

---

## 5. Puzzle Metadata Schema

```typescript
interface PuzzleMetadata {
  title: string
  theme: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  author: string | null
  createdAt: string
  wordCount: number
  gridWidth: number
  gridHeight: number
  graphic?: string | null   // e.g. "The Magnifying Glass"
  lens?: string | null      // e.g. "magnifier" | "compass" | "iris" etc.
}
```

---

## 6. Current Layout Algorithm (TO BE REPLACED)

**Library:** `crossword-layout-generator` (npm)  
**Problem:** Greedy placement — places words one at a time, doesn't optimize intersections. Produces sparse grids with large dead zones even after compaction.

**Current wrapper in `crossword.generator.ts`:**
- Runs 6 retry attempts with different word orderings (longest-first, shortest-first, seeded shuffles)
- Scores each result: `intersections × 50 + placed × 100 - (rows × cols)`
- Picks best score

**Post-processing in `crossword.functions.ts`:**
- `trimGrid`: removes empty border rows/cols (bounding box)
- `compactGrid` (MAX_GAP=1): removes interior dead rows/cols where nearest active row is >1 step away

**Result:** Still shows excessive black space. Words connect but spread across a large canvas with poor density.

---

## 7. Page Layout (crossword.template.ts)

**Puzzle page structure:**
- Header: page number (outside corner) + title centred on same line, rule below — 12pt total
- Clue zone: 4 columns, min 42% of content height, font 7.5pt
- Grid zone: max 50% of content height, cell size = min(GRID_CELL_SIZE=15, cellByW, cellByH)
- Grid: bottom-centred, organic ink smudge for blocked cells

**Answer key:**
- 2 columns, 6pt mini cells, 14pt margins, pre-flight overflow check
- `rowH = Math.max(leftH, itemH)` — tracks taller column to prevent overlap

**Fonts (built-in PDFKit, swap when licensed files arrive):**
| Role | Current | Target |
|------|---------|--------|
| Title/headers | Helvetica-Bold | Bebas Neue |
| Puzzle title | Helvetica-Bold | Instrument Serif |
| Clue numbers | Courier | IBM Plex Mono |
| Clue text | Helvetica | Space Grotesk |
| Page numbers | Times-Italic | Instrument Serif Italic |
| Publisher | Courier | Courier Prime |

---

## 8. The 32 Puzzles (Observatory manifest)

| # | Theme | Graphic | Lens |
|---|-------|---------|------|
| 1 | Filmmaking & Film Production | The Magnifying Glass | magnifier |
| 2 | Nature | The Compass & Chart | compass |
| 3 | Rules of Football | The Rule Book | telescope |
| 4 | Sports of the Summer Olympics | The Podium | porthole |
| 5 | Rules of Basketball | The Rule Book | telescope |
| 6 | Sports of the Winter Olympics | The Podium | porthole |
| 7 | Weightlifting Workouts | The Anatomical Study | microscope |
| 8 | Kung Fu Martial Art | The Anatomical Study | microscope |
| 9 | Rules of Baseball | The Rule Book | telescope |
| 10 | Chess | The Magnifying Glass | magnifier |
| 11 | Cooking Techniques | The Mortar & Flame | loupe |
| 12 | Astronomy | The Crystal Prism | periscope |
| 13 | Ancient Civilizations | The Manuscript | viewfinder |
| 14 | Jazz & Blues | The Open Eye | iris |
| 15 | Architecture & Structures | The Manuscript | viewfinder |
| 16 | The Human Body | The Anatomical Study | microscope |
| 17 | Gemstones & Minerals | The Crystal Prism | periscope |
| 18 | Sailing & the Sea | The Compass & Chart | compass |
| 19 | Literary Devices | The Open Eye | iris |
| 20 | World Mythology | The Open Eye | iris |
| 21 | Photography & Cinematography | The Magnifying Glass | magnifier |
| 22 | The Animal Kingdom | The Scales | camera |
| 23 | Woodworking & Carpentry | The Mortar & Flame | loupe |
| 24 | Chemistry & the Periodic Table | The Crystal Prism | periscope |
| 25 | Classical Music & Orchestras | The Open Eye | iris |
| 26 | Surfing & Ocean Sports | The Compass & Chart | compass |
| 27 | World Economics | The Scales | camera |
| 28 | Hiking & Mountaineering | The Compass & Chart | compass |
| 29 | Forensic Science & Criminology | The Magnifying Glass | magnifier |
| 30 | The Renaissance | The Manuscript | viewfinder |
| 31 | Yoga & Meditation | The Open Eye | iris |
| 32 | Cartography & Geography | The Compass & Chart | compass |

**Word lists location:** manifest paths are relative to `observatory-book.manifest.json` (project root)
```
puzzle-book-generator/
├── observatory-book.manifest.json
├── filmmaking-75words-upto4Syllables.csv
├── nature-75words-upto4Syllables.csv
├── wordlists/   (01-football-rules.csv … 10-astronomy.csv)
└── wordlists2/  (01-ancient-civilizations.csv … 20-cartography.csv)
```

---

## 9. Cover: Observatory Scene

**File:** `covers/observatory-scene.cover.ts`  
**Design:** Dark navy `#1C1C2E`, double gold border `#C9A84C`, star field (seeded, 180 stars), Milky Way band, cliff silhouette, observatory dome, lone figure with dotted gaze-line toward a bright star. Title in Helvetica-Bold (→ Bebas Neue), publisher in Courier (→ Courier Prime).

---

## 10. CLI Usage

```bash
npm run build

# Themed 32-puzzle book (correct approach)
node apps/cli/dist/index.js generate-book \
  --manifest observatory-book.manifest.json \
  --author "Author Name" \
  --output ./output

# Single word pool (testing)
node apps/cli/dist/index.js generate-book \
  --input sample-words.csv \
  --title "Test Book" --count 5 --output ./output
```

---

## 11. Known Issues & Open Items

| Issue | Status |
|-------|--------|
| Grid density — too much black space | **ACTIVE — replacing layout library** |
| Font licenses | Waiting on publisher to supply files |
| Lens frame graphics | Removed pending real illustrations; `lens-frames.ts` kept in repo but not called |
| Graphic motif illustrations | 10 illustrations needed (placeholder emblem currently shown at 8% opacity) |
| Author name in manifest | Empty string — needs filling before publication |
| Back cover copy | Not yet written |
| ISBN / barcode placement | Not yet designed |
| Supabase / content-db | Not yet connected |

---

## 12. Phase Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Design & decisions | ✅ | Complete |
| 1 — MVP Foundation | ✅ | Complete |
| 2 — Layout & rendering | 🔄 | Grid density fix in progress |
| 3 — Design quality (fonts, graphics, AI clues) | ⬜ | After Phase 2 |
| 4 — EPUB / interactive PDF | ⬜ | |
| 5 — SaaS / web UI | ⬜ | |
| 6 — Additional puzzle types | ⬜ | |

---

## 13. NEXT: Custom Layout Algorithm (planned)

**Goal:** Replace `crossword-layout-generator` with a backtracking algorithm that places words to maximise intersection count and minimise bounding-box area.

**Entry point:** `runLayoutGenerator()` in `crossword.generator.ts` — a single function returning `LibLayoutResult`. Swap the internals, nothing else changes.

**Planning notes captured below.**
