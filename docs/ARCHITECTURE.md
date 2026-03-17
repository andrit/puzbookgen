# Puzzle Book Generator — Architecture & Design Decisions

> **Status:** Living Document — Updated as decisions are made  
> **Last Updated:** 2026-03-16  
> **Project Phase:** Pre-development / Design

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Guiding Principles](#2-guiding-principles)
3. [Domain Model (DDD)](#3-domain-model-ddd)
4. [System Architecture](#4-system-architecture)
5. [Technology Decisions](#5-technology-decisions)
6. [Output Formats](#6-output-formats)
7. [Data Architecture](#7-data-architecture)
8. [Extensibility Strategy](#8-extensibility-strategy)
9. [MVP Scope](#9-mvp-scope)
10. [Phase Roadmap](#10-phase-roadmap)
11. [Open Questions](#11-open-questions)

---

## 1. Project Vision

A **Node.js-based puzzle book publishing platform** that:

- Generates puzzle books (starting with crossword puzzles) for print-on-demand (Amazon KDP) and screen/interactive distribution
- Exposes both a **web UI** (for creators) and a **CLI** (for batch/headless operation)
- Is designed from the ground up to support **multiple puzzle types** and eventually operate as a **SaaS product**
- Prioritizes **visual design quality and creative control** as a market differentiator in a saturated self-publishing space

---

## 2. Guiding Principles

| Principle | Description |
|---|---|
| **MVP First** | Ship the simplest viable thing that produces real books. Complexity is added in phases. |
| **Separation of Concerns** | Puzzle generation and book assembly are distinct systems with a clean contract (JSON schema) between them. |
| **Extensibility by Design** | Every domain model and interface is designed with future puzzle types in mind, not just crosswords. |
| **Data as an Asset** | The word/clue database is a proprietary long-term asset. Build and seed it early. |
| **Design Quality** | Visual design controls are first-class, not an afterthought. The system should support creative differentiation. |
| **SaaS-Ready** | Architecture choices should not lock the system to single-user/local-only operation. |
| **Domain-Driven Design** | Components are organized around business domains, not technical layers. |

---

## 3. Domain Model (DDD)

### Bounded Contexts

```
┌─────────────────────────────────────────────────────────────────┐
│                        PUZZLE DOMAIN                            │
│  Core logic for generating valid puzzle grids                   │
│  Entities: Puzzle, Grid, Cell, Word, Clue, PlacedWord           │
│  Aggregates: Puzzle (root), Grid                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        CONTENT DOMAIN                           │
│  Words, clues, themes — the raw creative material               │
│  Entities: Word, Clue, Theme, WordList                          │
│  Aggregates: WordList (root)                                    │
│  Persistence: PostgreSQL (long-term proprietary asset)          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         BOOK DOMAIN                             │
│  Assembling puzzles into a structured, publishable book         │
│  Entities: Book, Chapter, Page, Cover, AnswerKey                │
│  Aggregates: Book (root)                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      PUBLISHING DOMAIN                          │
│  Rendering books into target output formats                     │
│  Entities: RenderTarget, PrintSpec, ScreenSpec, OutputFile      │
│  Aggregates: RenderJob (root)                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       CREATOR DOMAIN                            │
│  The interface layer — web UI and CLI for creators              │
│  Not a persistence domain; orchestrates the above               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Domain Relationships

- A **WordList** (Content Domain) is the input to the **Puzzle Generator** (Puzzle Domain)
- A **Puzzle** (Puzzle Domain) is the core unit assembled by the **Book Generator** (Book Domain)
- A **Book** (Book Domain) is consumed by the **Publishing Pipeline** (Publishing Domain)
- The **Creator Interface** (Creator Domain) orchestrates all of the above

### Ubiquitous Language

| Term | Definition |
|---|---|
| **Puzzle** | A single, complete crossword grid with all clues and solutions |
| **Grid** | The 2D cell matrix of a puzzle |
| **Cell** | A single square in the grid — either a letter cell or a blocked cell |
| **Word** | A word placed in the grid, with direction (across/down) and position |
| **Clue** | The hint paired with a placed Word |
| **WordList** | A curated set of word/clue pairs used as input to the Puzzle Generator |
| **Book** | A collection of Puzzles assembled with layout and metadata into a publishable artifact |
| **Chapter** | An optional grouping of Puzzles within a Book |
| **Template** | A named layout/style definition for a Book or puzzle type |
| **RenderTarget** | A specific output specification (e.g., KDP 6x9 Print, Screen PDF, EPUB3) |
| **Answer Key** | The section of a Book containing puzzle solutions |

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      CREATOR INTERFACE                           │
│                                                                  │
│   Web UI (Fastify + Vite/React)    CLI (Node.js / commander)    │
│   - Book configuration             - Headless/batch operation   │
│   - Word/clue input                - Scriptable pipeline        │
│   - Preview                        - CI/CD friendly             │
└──────────────┬───────────────────────────────┬───────────────────┘
               │                               │
    ┌──────────▼──────────┐         ┌──────────▼──────────┐
    │   PUZZLE GENERATOR  │         │   BOOK GENERATOR    │
    │   (npm package /    │──JSON──▶│   (npm package /    │
    │    internal module) │         │    internal module)  │
    │                     │         │                      │
    │ • Grid layout algo  │         │ • Cover page         │
    │ • Word placement    │         │ • Intro page         │
    │ • Clue assignment   │         │ • Puzzle pages       │
    │ • Validation        │         │ • Chapter dividers   │
    │ • JSON output       │         │ • Answer key         │
    └──────────┬──────────┘         └──────────┬──────────┘
               │                               │
    ┌──────────▼──────────┐         ┌──────────▼──────────────────┐
    │   CONTENT DOMAIN    │         │     PUBLISHING PIPELINE      │
    │                     │         │                              │
    │ • PostgreSQL DB      │         │  Print Renderer (PDFKit)    │
    │ • Word/clue store   │         │  → KDP-ready PDF + bleed    │
    │ • Themes            │         │  → Crop marks, 300dpi-safe  │
    │ • CSV/JSON import   │         │                              │
    └─────────────────────┘         │  Screen Renderer (PDFKit)   │
                                    │  → Optimized for tablet/PDF  │
                                    │  → Kindle Scribe-friendly   │
                                    │                              │
                                    │  [Future] EPUB3 Renderer    │
                                    │  [Future] Web App Renderer  │
                                    └──────────────┬──────────────┘
                                                   │
                                            ┌──────▼──────┐
                                            │  ZIP OUTPUT  │
                                            │             │
                                            │ print.pdf   │
                                            │ screen.pdf  │
                                            │ metadata/   │
                                            └─────────────┘
```

---

## 5. Technology Decisions

### Core Runtime
| Decision | Choice | Rationale |
|---|---|---|
| Runtime | Node.js | Specified requirement; strong PDF/file tooling ecosystem |
| Language | TypeScript | Type safety is valuable for domain model; catches schema contract violations at compile time |
| Package structure | Monorepo (npm workspaces) | Puzzle Generator and Book Generator are separate packages but co-located. Migration to Turborepo is purely additive (install package + add turbo.json) — no structural rework needed when SaaS path begins. |

### Web Interface
| Decision | Choice | Rationale |
|---|---|---|
| Server framework | Fastify | Lightweight, fast, good TypeScript support |
| Frontend | Vite + React | Specified preference; component reuse potential |
| API style | REST (MVP), GraphQL (future) | REST is simpler to start; GraphQL suits SaaS multi-tenant queries |

### CLI
| Decision | Choice | Rationale |
|---|---|---|
| CLI framework | `commander` or `yargs` | Mature, well-documented Node.js CLI libraries |

### PDF Generation
| Decision | Choice | Rationale |
|---|---|---|
| Print PDF | PDFKit | Precise layout control, press-ready output, no headless browser dependency |
| Screen PDF (MVP) | PDFKit | Same library, different parameter set; reduces dependencies for MVP |
| Interactive PDF (future) | PDFKit form fields | Fillable cells, works on Kindle Scribe via annotation |
| EPUB3 (Phase 2+) | Custom / `epub-gen` | Fixed-layout EPUB3 for interactive crossword cells on Apple Books / Kobo |

### Database
| Decision | Choice | Rationale |
|---|---|---|
| Word/clue store | PostgreSQL via Supabase (free tier) | Robust, scalable, managed hosting. Free tier is sufficient for solo creator use through MVP and beyond. |
| ORM | Prisma | TypeScript-native, good migration tooling |
| MVP fallback | CSV/JSON file import | No DB dependency required for first book output |
| SaaS upgrade trigger | Supabase Pro ($25/month) | Upgrade when real end-users are added. Free tier is not suitable for multi-user production. |

### Supabase Free Tier Limits (Current as of 2026)
| Resource | Free Limit | Risk Level for This Project |
|---|---|---|
| Database storage | 500MB | Very Low — word/clue text is tiny; hundreds of thousands of pairs fit easily |
| Database egress | 2GB/month | Very Low — creator tool with one user, no public traffic |
| Monthly Active Users | 50,000 | Not applicable — solo creator tool, no end-user auth |
| Projects | 2 max | Low — need 1 for dev, 1 for staging/prod. Sufficient. |
| File storage | 1GB | Not applicable — we store files locally, not in Supabase |
| **Inactivity pause** | **7 days** | **Medium — project goes offline after 7 days of no API requests. Data is retained; one-click resume. Not a problem during active development.** |
| Backups | None on free tier | Low for MVP — maintain local DB dumps as backup practice |

### Infrastructure (Future/SaaS)
| Decision | Consideration | Notes |
|---|---|---|
| Hosting | TBD | Fastify server is deployable to any Node.js host (Render, Railway, Fly.io, AWS) |
| Auth | TBD | Design web UI to be auth-ready from the start (placeholder hooks) |
| Multi-tenancy | TBD | Schema and domain models should not bake in single-user assumptions |
| Monorepo scaling | Turborepo | Migration from npm workspaces is additive-only: `npm install turbo` + `turbo.json`. No structural changes required. Schedule for SaaS phase. |
| DB upgrade path | Supabase Pro ($25/mo) | Trigger: first paying SaaS users. Removes inactivity pause, adds backups, higher limits. |

---

## 6. Output Formats

### Print — Amazon KDP (MVP Target)
- **Format:** PDF
- **Trim sizes:** 6x9" (standard), 8.5x11" (large print) — parameterized by RenderTarget
- **Bleed:** 0.125" on all sides
- **Margins:** KDP-compliant (inside/outside/top/bottom specified per trim size)
- **Resolution:** 300 DPI-safe vector graphics
- **Color:** Black & white for MVP (color adds KDP cost)
- **Crop marks:** Yes
- **Embedded fonts:** Yes (no system font dependencies)

### Screen / Tablet (MVP Target)
- **Format:** PDF (screen-optimized)
- **No bleed, no crop marks**
- **Kindle Scribe:** Clean grid layout optimized for stylus annotation — no interactive fields needed in MVP; the Scribe's native PDF annotation handles this
- **Margins:** Generous for readability

### Future Formats
| Format | Target Platform | Phase |
|---|---|---|
| Fixed-Layout EPUB3 | Apple Books, Kobo | Phase 2 |
| AZW3/KFX | Kindle store | Phase 3 (complex toolchain) |
| HTML5 Web App | Hosted subscription product | Phase 3+ |

---

## 7. Data Architecture

### Puzzle JSON Schema (Contract Between Puzzle Generator and Book Generator)

```json
{
  "schemaVersion": "1.0.0",
  "id": "uuid-v4",
  "puzzleType": "crossword",
  "metadata": {
    "title": "Puzzle #1",
    "theme": null,
    "difficulty": "medium",
    "author": null,
    "createdAt": "ISO-8601",
    "wordCount": 28,
    "gridWidth": 15,
    "gridHeight": 15
  },
  "grid": {
    "width": 15,
    "height": 15,
    "cells": [
      {
        "row": 0,
        "col": 0,
        "type": "letter",
        "number": 1,
        "solution": "A"
      },
      {
        "row": 0,
        "col": 1,
        "type": "blocked",
        "number": null,
        "solution": null
      }
    ]
  },
  "clues": {
    "across": [
      {
        "number": 1,
        "clue": "Clue text here",
        "answer": "WORD",
        "startRow": 0,
        "startCol": 0,
        "length": 4
      }
    ],
    "down": [
      {
        "number": 1,
        "clue": "Clue text here",
        "answer": "WORD",
        "startRow": 0,
        "startCol": 0,
        "length": 4
      }
    ]
  }
}
```

### Book JSON Schema

```json
{
  "schemaVersion": "1.0.0",
  "id": "uuid-v4",
  "bookType": "crossword-collection",
  "metadata": {
    "title": "My Crossword Book",
    "subtitle": "",
    "author": "",
    "edition": 1,
    "theme": null,
    "createdAt": "ISO-8601"
  },
  "renderTargets": {
    "print": "kdp-6x9-bw",
    "screen": "screen-pdf-tablet"
  },
  "layout": {
    "template": "standard",
    "typography": {},
    "gridStyle": {},
    "pageDecorations": {}
  },
  "content": {
    "cover": {
      "title": "My Crossword Book",
      "subtitle": "",
      "author": "",
      "designTemplate": "standard"
    },
    "intro": {
      "text": "",
      "enabled": true
    },
    "chapters": [
      {
        "id": "uuid-v4",
        "title": null,
        "intro": null,
        "puzzleIds": ["uuid-v4", "uuid-v4"]
      }
    ],
    "answerKey": {
      "enabled": true,
      "position": "back"
    }
  }
}
```

### PostgreSQL Schema (Word/Clue Database)

```sql
-- Words table
CREATE TABLE words (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word        TEXT NOT NULL,
  length      INTEGER GENERATED ALWAYS AS (LENGTH(word)) STORED,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Clues table (many clues can exist for one word)
CREATE TABLE clues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id     UUID REFERENCES words(id),
  clue_text   TEXT NOT NULL,
  difficulty  TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  source      TEXT,  -- 'manual', 'ai-generated', 'imported'
  vetted      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Themes table
CREATE TABLE themes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Word/Theme junction (many-to-many)
CREATE TABLE word_themes (
  word_id   UUID REFERENCES words(id),
  theme_id  UUID REFERENCES themes(id),
  PRIMARY KEY (word_id, theme_id)
);

-- Word lists (curated sets used as puzzle input)
CREATE TABLE word_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  theme_id    UUID REFERENCES themes(id),
  description TEXT,
  puzzle_type TEXT DEFAULT 'crossword',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Word list membership
CREATE TABLE word_list_entries (
  word_list_id  UUID REFERENCES word_lists(id),
  clue_id       UUID REFERENCES clues(id),
  PRIMARY KEY (word_list_id, clue_id)
);
```

---

## 8. Extensibility Strategy

### Adding New Puzzle Types

The system is designed so that adding a new puzzle type (word search, sudoku, hangman, cryptogram, logic grid, maze) requires:

1. **A new `puzzleType` value** in the Puzzle JSON schema — the `puzzleType` field is the discriminator
2. **A new Puzzle Generator module** implementing a shared `IPuzzleGenerator` interface
3. **A new Book Generator template** implementing a shared `IBookTemplate` interface
4. **New RenderTarget specs** if the puzzle type has unique layout requirements

Nothing in the core pipeline needs to change. The Creator Interface discovers available puzzle types dynamically.

### IPuzzleGenerator Interface (Conceptual)

```typescript
interface IPuzzleGenerator {
  puzzleType: string;
  generate(wordList: WordList, options: GeneratorOptions): Promise<Puzzle>;
  validate(puzzle: Puzzle): ValidationResult;
}
```

### IBookTemplate Interface (Conceptual)

```typescript
interface IBookTemplate {
  puzzleType: string;
  templateName: string;
  renderPage(puzzle: Puzzle, options: RenderOptions): PDFPage;
  renderAnswerKey(puzzles: Puzzle[], options: RenderOptions): PDFPage[];
}
```

---

## 9. MVP Scope

### In Scope for MVP

- [ ] Crossword Puzzle Generator (grid layout, word placement, JSON output)
- [ ] Word/clue input via CSV or JSON file
- [ ] Book Generator (cover, intro, puzzle pages, answer key)
- [ ] Print PDF output (KDP 6x9 black & white)
- [ ] Screen PDF output (tablet-optimized, Kindle Scribe-friendly)
- [ ] ZIP packaging of output files
- [ ] CLI interface for full pipeline
- [ ] Basic web UI (Fastify + React) for puzzle/book configuration
- [ ] PostgreSQL schema created and seeded from CSV import
- [ ] Monorepo project structure established

### Out of Scope for MVP

- AI-generated word/clue content
- Themed puzzle generation
- EPUB3 output
- Fillable/interactive PDF form fields
- Visual design customization beyond template selection
- Authentication / multi-user
- SaaS infrastructure
- Additional puzzle types
- Chapter dividers with creative writing

---

## 10. Phase Roadmap

| Phase | Focus | Key Deliverables |
|---|---|---|
| **MVP** | Crossword book to market | Print PDF, Screen PDF, CLI + basic web UI, CSV word input, Postgres schema |
| **Phase 2** | Content & quality | AI word/clue generation, manual review UI, themed puzzles, DB curation tools |
| **Phase 3** | Design & polish | Visual design controls, custom typography, cover templates, EPUB3 output |
| **Phase 4** | SaaS foundations | Auth, multi-tenancy, hosted deployment, subscription model |
| **Phase 5** | Puzzle type expansion | Word search, sudoku, hangman — reusing the pipeline architecture |

---

## 11. Open Questions & Decision Log

### Resolved Decisions
| Question | Decision | Notes |
|---|---|---|
| Word/clue sourcing for MVP | Manual CSV/JSON import | Lowest friction; full creative control for first books |
| Monorepo tooling | npm workspaces (MVP) → Turborepo (SaaS phase) | Migration is additive-only, no structural rework |
| Crossword layout algorithm | Use existing npm library for MVP | Evaluate `crossword-layout-generator`; plan custom implementation for Phase 3+ when design differentiation matters |
| Database hosting | Supabase free tier | Sufficient for solo creator tool indefinitely; upgrade to Pro ($25/mo) when SaaS users are added |
| PDF generation (print) | PDFKit | Precise layout, press-ready, no headless browser |
| PDF generation (screen) | PDFKit (same library, different RenderTarget params) | Reduces MVP dependencies |
| Development sequence | Foundation → Puzzle Gen → Book Gen → CLI → Web UI | Gets to real book output before UI work |
| Kindle Scribe format | Screen-optimized PDF | Device is designed for stylus annotation on PDFs; no interactive format needed for MVP |

### Open Questions
| Question | Status | Notes |
|---|---|---|
| Web UI preview: server-side render vs. client-side canvas? | Open | Client-side faster for iteration; server-side more accurate |
| Custom crossword layout algorithm: when to build? | Open | Revisit at Phase 3; triggers: quality complaints or design constraints the library can't satisfy |

### Recently Resolved
| Question | Decision | Notes |
|---|---|---|
| CLI framework | `yargs` | Developer preference |
| RenderTarget config format | JSON | Consistent with rest of stack |

---

## 12. Phase Tracker

> Updated each session. ✅ = merged to main. 🔄 = in progress. 🔲 = upcoming.

### Phase 0 — Design & Decisions ✅ Complete
| Task | Status |
|---|---|
| Domain model (DDD bounded contexts) | ✅ |
| Technology stack decisions | ✅ |
| JSON schema contract (Puzzle + Book) | ✅ |
| PostgreSQL schema design | ✅ |
| RenderTarget spec format | ✅ |
| Extensibility interfaces (IPuzzleGenerator, IRenderer, IBookTemplate) | ✅ |
| Output format strategy (print PDF, screen PDF, future EPUB3) | ✅ |

### Phase 1 — MVP Foundation ✅ Complete (v0.1.0)
| Task | Status | Notes |
|---|---|---|
| Monorepo scaffold (npm workspaces + TypeScript) | ✅ | |
| `packages/shared` — all types, interfaces, JSDoc | ✅ | |
| `packages/content-db` — Prisma schema, repositories, CSV import | ✅ | |
| `packages/puzzle-generator` — CrosswordGenerator + pure grid functions | ✅ | FP decomposition done |
| `packages/book-generator` — assembler, unified PDF renderer, crossword template | ✅ | DRY: two renderers → one class |
| RenderTarget JSON configs | ✅ | kdp-6x9-bw, kdp-8x10-bw, screen-pdf-tablet |
| Multi-page answer key (column layout + requestNewPage callback) | ✅ | |
| `apps/cli` — yargs CLI (generate-book, import-words) | ✅ | |
| `apps/web` — Fastify server + React UI scaffold | ✅ | |
| GitHub Actions CI workflow | ✅ | |
| Repo setup shell script (`scripts/setup-repo.sh`) | ✅ | |
| Vitest configuration | ✅ | Config only — test files written in Phase 2 |
| Sample word list CSV (50 words) | ✅ | |
| Living design docs | ✅ | ARCHITECTURE.md, DESIGN.md |
| Code standards: SOLID, DRY, FP, JSDoc | ✅ | Applied in v0.1.0 refactor |

### Phase 2 — Test Suite & First Real Output 🔄 In Progress
| Task | Status | Notes |
|---|---|---|
| Unit tests — `crossword.functions.ts` pure functions | ✅ | 40+ assertions across all 7 pure functions |
| Unit tests — `CrosswordGenerator.validate()` | ✅ | Errors and warnings covered |
| Unit tests — `BookAssembler` | ✅ | Schema, chapters, targets, content defaults |
| Unit tests — CSV parser | ✅ | Valid input, quoted fields, filtering, errors |
| Unit tests — `shared` schema types | ✅ | SCHEMA_VERSION, Puzzle, Cell, Clue shapes |
| Vitest path alias resolution for monorepo | ✅ | All packages resolvable without building |
| Integration test — generate pipeline (word list → book) | ✅ | Tagged @integration, skipped in fast runs |
| All 100 unit tests passing | ✅ | v0.2.2 |
| First real book generated and visually reviewed | 🔲 | **Next: run the CLI pipeline** |
| Fix layout/rendering issues found in review | 🔲 | |
| README quick-start verified end-to-end | 🔲 | |

### Phase 3 — Design & Content Quality
| Task | Status | Notes |
|---|---|---|
| Visual design controls (typography, grid style, decorations) | 🔲 | Slots reserved in schema |
| Cover template system | 🔲 | |
| Chapter dividers with intro text | 🔲 | |
| AI-assisted clue generation (Anthropic API) | 🔲 | |
| Manual clue review UI | 🔲 | |
| Themed puzzle support | 🔲 | |
| Custom crossword layout algorithm | 🔲 | Replaces library — only crossword.generator.ts changes |

### Phase 4 — Additional Output Formats
| Task | Status | Notes |
|---|---|---|
| Fixed-layout EPUB3 renderer | 🔲 | Apple Books, Kobo |
| Interactive PDF (fillable form fields) | 🔲 | |
| Web app puzzle preview (client-side canvas) | 🔲 | |

### Phase 5 — SaaS Foundation
| Task | Status | Notes |
|---|---|---|
| Authentication | 🔲 | |
| Multi-tenancy — user-scoped data | 🔲 | |
| Hosted deployment | 🔲 | Fly.io / Railway / Render |
| Turborepo migration | 🔲 | Additive — one config file |
| Supabase Pro upgrade | 🔲 | Trigger: first paying users |
| Subscription billing (Stripe) | 🔲 | |

### Phase 6 — Additional Puzzle Types
| Task | Status | Notes |
|---|---|---|
| Word Search | 🔲 | Reuses full pipeline — new IPuzzleGenerator + IBookTemplate |
| Sudoku | 🔲 | |
| Hangman | 🔲 | |
| Cryptogram | 🔲 | |
