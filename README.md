# 🧩 Puzzle Book Generator

A Node.js platform for generating crossword puzzle books for print-on-demand (Amazon KDP) and screen distribution.

---

## Architecture

```
packages/
  shared/           — TypeScript types and interfaces (the JSON schema contract)
  puzzle-generator/ — Crossword layout and generation
  book-generator/   — PDF rendering (print + screen)
  content-db/       — PostgreSQL word/clue database (Prisma + Supabase)

apps/
  cli/              — Command-line interface (yargs)
  web/              — Web UI (Fastify + Vite/React)
```

See `docs/ARCHITECTURE.md` for full design documentation.

---

## Prerequisites

- Node.js >= 20
- npm >= 10
- A [Supabase](https://supabase.com) account (free tier) for the word/clue database

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase connection string. Find it in:
**Supabase Dashboard → Project Settings → Database → Connection string (URI)**

### 3. Run database migrations

```bash
npm run db:migrate
```

This creates all tables in your Supabase database.

### 4. (Optional) Generate Prisma client

```bash
npm run db:generate
```

---

## Quick Start — CLI

Generate a book from the included sample word list:

```bash
# Build all packages first
npm run build

# Generate a 10-puzzle crossword book
node apps/cli/dist/index.js generate-book \
  --input sample-words.csv \
  --title "My First Crossword Book" \
  --author "Your Name" \
  --count 10 \
  --output ./output
```

Output: `./output/my-first-crossword-book.zip` containing:
- `my-first-crossword-book-print.pdf` — KDP 6×9" press-ready
- `my-first-crossword-book-screen.pdf` — Tablet/Kindle Scribe optimized

### Import words to database

```bash
node apps/cli/dist/index.js import-words \
  --file sample-words.csv \
  --word-list "General Knowledge"
```

### CLI help

```bash
node apps/cli/dist/index.js --help
node apps/cli/dist/index.js generate-book --help
```

---

## Quick Start — Web UI

```bash
npm run dev:web
```

- Web UI: http://localhost:5173
- API server: http://localhost:3000
- API health: http://localhost:3000/api/health

---

## CSV Format

Word lists are CSV files with a header row:

```csv
word,clue,difficulty
APPLE,"A fruit that keeps the doctor away",easy
ENIGMA,"A puzzling mystery",hard
CASTLE,"A large fortified medieval building",medium
```

- `word` — required, the answer word (letters only, will be uppercased)
- `clue` — required, the clue text
- `difficulty` — optional, one of: `easy`, `medium`, `hard` (defaults to `medium`)

A minimum of 8 valid entries is required per puzzle. More variety = better placement.

---

## Output Formats

| Target ID | Description | Use case |
|---|---|---|
| `kdp-6x9-bw` | Amazon KDP 6×9" B&W | Standard KDP paperback |
| `kdp-8x10-bw` | Amazon KDP 8×10" B&W | Large print KDP paperback |
| `screen-pdf-tablet` | 8.5×11" screen PDF | Tablet reading, Kindle Scribe annotation |

---

## Development

```bash
# Build all packages
npm run build

# Watch mode (one package at a time)
npm run dev --workspace=packages/shared
npm run dev --workspace=packages/puzzle-generator

# Run web app in dev mode (server + client with hot reload)
npm run dev:web
```

---

## Project Status

**Current phase: MVP Foundation** — See `docs/ARCHITECTURE.md` for the full roadmap.

- [x] Monorepo scaffolding (npm workspaces + TypeScript)
- [x] Shared type system and JSON schema contract
- [x] PostgreSQL schema (Prisma + Supabase)
- [x] Word/clue repository and CSV import
- [x] Crossword puzzle generator
- [x] Book assembler
- [x] Print PDF renderer (KDP-ready)
- [x] Screen PDF renderer (tablet/Scribe)
- [x] ZIP output packaging
- [x] CLI (yargs) — `generate-book`, `import-words`
- [x] Web UI scaffold (Fastify + Vite/React)
- [ ] Web UI puzzle preview
- [ ] Visual design customization
- [ ] AI-assisted clue generation (Phase 2)
- [ ] EPUB3 output (Phase 2)
