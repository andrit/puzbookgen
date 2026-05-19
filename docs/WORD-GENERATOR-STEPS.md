# Word Generator Module — Step Notes

**Package:** `packages/word-generator`  
**Version started:** v0.4.4  
**Phase:** 3-2  
**Status:** ✅ COMPLETE — all 7 steps done, 198/198 tests

**3-6a — Word length analysis added** (woven into 3-4, 3-1, 3-6):  
`analyzeWordList()` in csv.writer → `WordListAnalysis` type → `buildPrompt(opts, analysis)` → `word.generator` threads it through. 182/182 tests.

---

## Purpose

Generate 150+ themed word/clue pairs per puzzle using the Claude API.  
Each theme's word list is expanded from ~75 to 150+ entries, giving the  
crossword layout engine enough material to place 25–35 tightly interlocked  
words per puzzle — significantly improving grid density.

---

## Architecture

```
apps/cli/src/commands/
  generate-words.ts          ← CLI command (Step 8)

packages/word-generator/src/
  index.ts                   ← public exports
  types.ts                   ← shared types (Step 1)
  generator/
    word.generator.ts        ← orchestrator (Step 7)
    word.generator.test.ts
  api/
    claude.client.ts         ← Anthropic API wrapper (Step 6)
    claude.client.test.ts
  prompt/
    prompt.builder.ts        ← prompt construction (Step 1)
    prompt.builder.test.ts
  parser/
    response.parser.ts       ← JSON validation + parsing (Step 3)
    response.parser.test.ts
  dedup/
    deduplicator.ts          ← merge + deduplicate (Step 4)
    deduplicator.test.ts
  csv/
    csv.writer.ts            ← write WordListEntry[] to CSV (Step 5)
    csv.writer.test.ts
```

---

## Shared Types (`types.ts`)

```typescript
interface GeneratedWord {
  word:       string                        // uppercase, letters only
  clue:       string                        // one sentence, ≤120 chars
  difficulty: 'easy' | 'medium' | 'hard'
  syllables:  number                        // 1–4
}

interface GeneratorOptions {
  theme:      string        // e.g. "Ancient Civilizations"
  seeds?:     string[]      // optional anchor words to include first
  count:      number        // target output words (default 150)
  maxRetries: number        // API retry attempts on low yield (default 3)
  apiKey?:    string        // falls back to ANTHROPIC_API_KEY env var
}

interface GeneratorResult {
  words:             GeneratedWord[]
  duplicatesRemoved: number
  apiCallCount:      number
}
```

---

## Module Responsibilities

### `claude.client.ts` (Step 6)
- `callClaude(prompt, apiKey): Promise<string>`
- Calls `/v1/messages`, model `claude-sonnet-4-20250514`, `max_tokens: 4000`
- Returns raw text content only — no JSON parsing
- Throws typed `ApiError` on non-200 responses

### `prompt.builder.ts` (Step 1)
- `buildPrompt(opts: GeneratorOptions): string`
- Constructs system + user prompt
- Instructs Claude: JSON array only, no preamble, exact schema
- Specifies constraints: letters only, 3–15 chars, 1–4 syllables
- Syllable mix: ~25% easy (3–4 letters), ~50% medium (5–8), ~25% hard (9+)
- Seed words included first if provided

### `response.parser.ts` (Step 3)
- `parseResponse(raw: string): GeneratedWord[]`
- Strips markdown fences
- Validates each entry: letters-only word, clue ≤120 chars, valid difficulty
- Never throws — bad entries silently dropped
- Warns if yield < 50% of expected

### `deduplicator.ts` (Step 4)
- `deduplicate(incoming, existing): { merged, removed }`
- Key: `word.toUpperCase()`
- Existing words take priority (preserve hand-crafted clues)
- New words appended after existing

### `csv.writer.ts` (Step 5)
- `writeWordsCsv(words, outputPath): void`
- Writes `word,clue,difficulty` header + rows
- Compatible with existing `loadWordList()` in CLI
- Creates directory if missing

### `word.generator.ts` (Step 7)
- Orchestrates: `buildPrompt → callClaude → parseResponse → deduplicate → return`
- Retries if `parseResponse` yields < `count × 0.6` words
- Exported as `wordGenerator.generate(opts): Promise<GeneratorResult>`

---

## CLI Command (Step 8)

```bash
node apps/cli/dist/index.js generate-words \
  --theme "Ancient Civilizations" \
  --seeds "HIEROGLYPH,PHARAOH,NILE" \
  --count 150 \
  --existing wordlists/01-ancient-civilizations.csv \
  --output wordlists/01-ancient-civilizations.csv
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--theme` | yes | — | Theme name passed to prompt |
| `--seeds` | no | — | Comma-separated anchor words |
| `--count` | no | 150 | Target word count |
| `--existing` | no | — | Path to existing CSV (dedup source) |
| `--output` | yes | — | Output CSV path |
| `--api-key` | no | `ANTHROPIC_API_KEY` | API key override |
| `--dry-run` | no | false | Print words, don't write file |

---

## Build Order (matches test dependency graph)

| Step | File | Deps | Status |
|------|------|------|--------|
| 1 | `types.ts` | none | ✅ Complete — 25/25 tests |
| 1 | `prompt/prompt.builder.ts` | types | ✅ Complete — 25/25 tests |
| 1 | `prompt/prompt.builder.test.ts` | prompt.builder | ✅ Complete — 25/25 tests |
| 3 | `parser/response.parser.ts` | types | ✅ Complete — 38/38 tests |
| 3 | `parser/response.parser.test.ts` | response.parser | ✅ Complete — 38/38 tests |
| 4 | `dedup/deduplicator.ts` | types | ✅ Complete — 17/17 tests |
| 4 | `dedup/deduplicator.test.ts` | deduplicator | ✅ Complete — 17/17 tests |
| 5 | `csv/csv.writer.ts` | types | ✅ Complete — 22/22 tests |
| 5 | `csv/csv.writer.test.ts` | csv.writer | ✅ Complete — 22/22 tests |
| 6 | `api/claude.client.ts` | types | ✅ Complete — 26/26 tests |
| 6 | `api/claude.client.test.ts` | claude.client | ✅ Complete — 26/26 tests |
| 7 | `generator/word.generator.ts` | all above | ✅ Complete — 18/18 tests |
| 7 | `generator/word.generator.test.ts` | word.generator | ✅ Complete — 18/18 tests |
| 8 | `apps/cli/.../generate-words.ts` | word.generator | ✅ Complete — 16/16 tests |

---

## Test Plan

| File | Tests |
|------|-------|
| `prompt.builder.test.ts` | Contains theme name; contains seed words; instructs JSON-only output; word constraints present (3–15 chars, letters only); syllable mix instruction present; schema fields listed (word/clue/difficulty/syllables) |
| `claude.client.test.ts` | Passes correct model/tokens; returns text content block; throws ApiError on 4xx/5xx; uses ANTHROPIC_API_KEY env var when no key provided |
| `response.parser.test.ts` | Parses valid JSON array; strips markdown fences; drops entries with non-letter chars in word; drops entries with clue >120 chars; drops invalid difficulty; returns empty array for completely invalid input; case-normalises word to uppercase |
| `deduplicator.test.ts` | Deduplicates by uppercase key; existing words preserved with original clue; new words appended; reports correct removed count; case-insensitive matching (rose vs ROSE) |
| `csv.writer.test.ts` | Writes correct header row; writes all entries; handles commas in clues (CSV quoting); creates output directory if missing |
| `word.generator.test.ts` | Retries when yield < 60% of target; respects maxRetries limit; seed words present in output; returns correct apiCallCount; stops retrying immediately on success |

---

## Notes

- Claude API client is **mocked** in all unit tests
- Integration tests (real API calls) are in `word.generator.integration.test.ts`
  and skipped in CI with `SKIP_API_TESTS=true`
- Output CSV is format-compatible with existing `loadWordList()` — no pipeline changes needed
- `--existing` and `--output` can be the same path to expand a list in place
- The 32 Observatory themes are in `observatory-book.manifest.json` — the generate-words
  command can loop over all themes automatically with `--all-themes`

---

## The 32 Themes to Expand

| # | Theme | Existing File | Target Count |
|---|-------|--------------|-------------|
| 1 | Filmmaking & Film Production | filmmaking-75words-upto4Syllables.csv | 150 |
| 2 | Nature | nature-75words-upto4Syllables.csv | 150 |
| 3 | Rules of Football | 01-football-rules.csv | 150 |
| 4 | Sports of the Summer Olympics | 02-summer-olympics.csv | 150 |
| 5 | Rules of Basketball | 03-basketball-rules.csv | 150 |
| 6 | Sports of the Winter Olympics | 04-winter-olympics.csv | 150 |
| 7 | Weightlifting Workouts | 05-weightlifting.csv | 150 |
| 8 | Kung Fu Martial Art | 06-kung-fu.csv | 150 |
| 9 | Rules of Baseball | 07-baseball-rules.csv | 150 |
| 10 | Chess | 08-chess.csv | 150 |
| 11 | Cooking Techniques | 09-cooking-techniques.csv | 150 |
| 12 | Astronomy | 10-astronomy.csv | 150 |
| 13 | Ancient Civilizations | 01-ancient-civilizations.csv | 150 |
| 14 | Jazz & Blues | 02-jazz-and-blues.csv | 150 |
| 15 | Architecture & Structures | 03-architecture.csv | 150 |
| 16 | The Human Body | 04-human-body.csv | 150 |
| 17 | Gemstones & Minerals | 05-gemstones-minerals.csv | 150 |
| 18 | Sailing & the Sea | 06-sailing-sea.csv | 150 |
| 19 | Literary Devices | 07-literary-devices.csv | 150 |
| 20 | World Mythology | 08-world-mythology.csv | 150 |
| 21 | Photography & Cinematography | 09-photography.csv | 150 |
| 22 | The Animal Kingdom | 10-animal-kingdom.csv | 150 |
| 23 | Woodworking & Carpentry | 11-woodworking.csv | 150 |
| 24 | Chemistry & the Periodic Table | 12-chemistry.csv | 150 |
| 25 | Classical Music & Orchestras | 13-classical-music.csv | 150 |
| 26 | Surfing & Ocean Sports | 14-surfing.csv | 150 |
| 27 | World Economics | 15-economics.csv | 150 |
| 28 | Hiking & Mountaineering | 16-hiking-mountaineering.csv | 150 |
| 29 | Forensic Science & Criminology | 17-forensic-science.csv | 150 |
| 30 | The Renaissance | 18-renaissance.csv | 150 |
| 31 | Yoga & Meditation | 19-yoga-meditation.csv | 150 |
| 32 | Cartography & Geography | 20-cartography.csv | 150 |
