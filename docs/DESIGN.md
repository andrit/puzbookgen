# Puzzle Book Generator — Project Structure & Development Plan

> **Status:** Living Document  
> **Last Updated:** 2026-03-16  
> **Project Phase:** Pre-development / Design

---

## Monorepo Structure

```
puzzle-book-generator/
│
├── packages/
│   ├── puzzle-generator/          # PUZZLE DOMAIN
│   │   ├── src/
│   │   │   ├── crossword/         # Crossword-specific implementation
│   │   │   │   ├── grid.ts        # Grid construction and validation
│   │   │   │   ├── placer.ts      # Word placement algorithm
│   │   │   │   ├── validator.ts   # Puzzle validation rules
│   │   │   │   └── index.ts
│   │   │   ├── interfaces/        # Shared interfaces for puzzle types
│   │   │   │   └── IPuzzleGenerator.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── book-generator/            # BOOK DOMAIN + PUBLISHING DOMAIN
│   │   ├── src/
│   │   │   ├── assembler/         # Book assembly logic
│   │   │   │   ├── book.ts        # Book aggregate
│   │   │   │   ├── chapter.ts
│   │   │   │   └── answer-key.ts
│   │   │   ├── renderers/         # PUBLISHING DOMAIN
│   │   │   │   ├── print/         # Print PDF renderer (PDFKit)
│   │   │   │   ├── screen/        # Screen PDF renderer (PDFKit)
│   │   │   │   └── interfaces/    # IRenderer interface
│   │   │   ├── templates/         # Book layout templates
│   │   │   │   ├── crossword/     # Crossword-specific templates
│   │   │   │   └── shared/        # Shared template utilities
│   │   │   ├── targets/           # RenderTarget definitions
│   │   │   │   ├── kdp-6x9-bw.json
│   │   │   │   └── screen-tablet.json
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── content-db/                # CONTENT DOMAIN
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Database schema
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── seed/              # CSV/JSON import scripts
│   │   │   ├── repositories/      # Data access layer
│   │   │   │   ├── WordRepository.ts
│   │   │   │   ├── ClueRepository.ts
│   │   │   │   └── WordListRepository.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                    # Cross-cutting concerns
│       ├── src/
│       │   ├── schemas/           # JSON schemas (Puzzle, Book)
│       │   │   ├── puzzle.schema.ts
│       │   │   └── book.schema.ts
│       │   ├── types/             # Shared TypeScript types
│       │   └── utils/
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── web/                       # CREATOR DOMAIN — Web UI
│   │   ├── server/                # Fastify backend
│   │   │   ├── routes/
│   │   │   ├── plugins/
│   │   │   └── index.ts
│   │   ├── client/                # Vite + React frontend
│   │   │   ├── src/
│   │   │   │   ├── components/
│   │   │   │   ├── pages/
│   │   │   │   └── App.tsx
│   │   │   └── vite.config.ts
│   │   └── package.json
│   │
│   └── cli/                       # CREATOR DOMAIN — CLI
│       ├── src/
│       │   ├── commands/
│       │   │   ├── generate-puzzle.ts
│       │   │   ├── generate-book.ts
│       │   │   ├── import-words.ts
│       │   │   └── index.ts
│       │   └── index.ts
│       └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md            # This document's companion
│   ├── DESIGN.md                  # This document
│   └── SCHEMAS.md                 # Detailed schema documentation
│
├── package.json                   # Monorepo root (npm workspaces)
├── tsconfig.base.json
└── turbo.json                     # (if using Turborepo)
```

---

## Development Sequence

### Step 1 — Foundation
- [ ] Initialize monorepo (npm workspaces + TypeScript)
- [ ] Create `packages/shared` with Puzzle and Book JSON schema types
- [ ] Set up `packages/content-db` with Prisma schema
- [ ] Run first database migration (local PostgreSQL / Docker)
- [ ] Build CSV import script for seeding initial word/clue data

### Step 2 — Puzzle Generator
- [ ] Implement `IPuzzleGenerator` interface
- [ ] Build crossword grid data structure
- [ ] Implement word placement algorithm (greedy first pass)
- [ ] Implement puzzle validator
- [ ] Output valid Puzzle JSON

### Step 3 — Book Generator (Core)
- [ ] Implement Book assembler (takes N puzzles → Book structure)
- [ ] Define first RenderTarget: `kdp-6x9-bw`
- [ ] Implement Print PDF renderer (PDFKit)
  - [ ] Cover page
  - [ ] Intro page
  - [ ] Puzzle pages (grid + clues)
  - [ ] Answer key
- [ ] Implement Screen PDF renderer (PDFKit, different params)

### Step 4 — CLI
- [ ] `generate-puzzle` command (input: word list file, output: puzzle JSON)
- [ ] `generate-book` command (input: puzzle JSONs + book config, output: ZIP)
- [ ] `import-words` command (input: CSV, output: DB records)

### Step 5 — Web UI (Basic)
- [ ] Fastify server setup
- [ ] React app scaffold
- [ ] Word/clue input page (CSV upload or manual entry)
- [ ] Book configuration page (title, author, puzzle count)
- [ ] Generate & download trigger
- [ ] Basic puzzle preview

---

## RenderTarget Specification Format

Each render target is a JSON config file that the renderers consume:

```json
{
  "id": "kdp-6x9-bw",
  "name": "Amazon KDP 6x9 Black & White",
  "outputType": "print",
  "dimensions": {
    "width": 6,
    "height": 9,
    "unit": "inches",
    "bleed": 0.125
  },
  "margins": {
    "top": 0.75,
    "bottom": 0.75,
    "inside": 0.875,
    "outside": 0.625,
    "unit": "inches"
  },
  "color": "bw",
  "resolution": 300,
  "cropMarks": true,
  "fonts": {
    "embed": true
  }
}
```

---

## Key Interface Contracts

### IPuzzleGenerator
```typescript
interface GeneratorOptions {
  gridWidth?: number;      // default: 15
  gridHeight?: number;     // default: 15
  minWords?: number;       // default: 12
  maxWords?: number;       // default: 30
  difficulty?: 'easy' | 'medium' | 'hard';
  theme?: string | null;
}

interface IPuzzleGenerator {
  readonly puzzleType: string;
  generate(wordList: WordListEntry[], options?: GeneratorOptions): Promise<Puzzle>;
  validate(puzzle: Puzzle): ValidationResult;
}
```

### IRenderer
```typescript
interface RenderOptions {
  target: RenderTarget;
  template: string;
}

interface IRenderer {
  readonly outputType: 'print' | 'screen' | 'epub' | 'web';
  render(book: Book, options: RenderOptions): Promise<Buffer>;
}
```

### IBookTemplate
```typescript
interface IBookTemplate {
  readonly puzzleType: string;
  readonly templateName: string;
  renderCover(book: Book, options: RenderOptions): PDFPage;
  renderIntro(book: Book, options: RenderOptions): PDFPage;
  renderPuzzlePage(puzzle: Puzzle, pageNumber: number, options: RenderOptions): PDFPage;
  renderAnswerKey(puzzles: Puzzle[], options: RenderOptions): PDFPage[];
}
```
