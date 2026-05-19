/**
 * @file prompt/prompt.builder.ts
 * @description Builds the Claude API prompt for word/clue generation.
 *
 * Responsibilities:
 *  - Encode all constraints (word length, syllables, letter-only, theme relevance)
 *  - Specify the exact JSON schema Claude must return
 *  - Include seed words when provided
 *  - Request a balanced difficulty and syllable mix
 *  - Instruct Claude on engaging clue-writing craft (not dictionary definitions)
 *  - Instruct Claude to return JSON only — no preamble, no markdown fences
 *
 * The prompt is designed to be deterministic given the same options,
 * making it easy to test and audit.
 */

import type { GeneratorOptions } from '../types'
import {
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH,
  MAX_CLUE_LENGTH,
  MIN_SYLLABLES,
  MAX_SYLLABLES,
} from '../types'

// ---------------------------------------------------------------------------
// System prompt — stable across all themes
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `\
You are a master crossword puzzle editor with decades of experience writing \
clues for major publications. Your job is to generate themed word and clue \
pairs for a high-quality printed crossword puzzle book.

You must respond with ONLY a valid JSON array. No preamble, no explanation, \
no markdown code fences. The response must begin with [ and end with ].

Each element in the array must be a JSON object with exactly these four fields:
  "word"       — string: the answer word in UPPERCASE, letters only, no spaces or hyphens
  "clue"       — string: an engaging crossword clue, 120 characters or fewer
  "difficulty" — string: one of "easy", "medium", or "hard"
  "syllables"  — number: integer count of syllables in the word (1 through 4)

━━━ WORD CONSTRAINTS ━━━
  - Letters only (A–Z). No numbers, hyphens, apostrophes, or spaces.
  - Length between ${MIN_WORD_LENGTH} and ${MAX_WORD_LENGTH} characters inclusive.
  - Syllable count between ${MIN_SYLLABLES} and ${MAX_SYLLABLES}.
  - Must be directly and genuinely relevant to the theme.
  - No proper nouns unless they are universally recognised terms for the theme.

━━━ CLUE CRAFT — THIS IS THE MOST IMPORTANT SECTION ━━━

Do NOT write dry dictionary definitions. Great crossword clues are clever, \
surprising, and rewarding to solve. Use these techniques:

MISDIRECTION: Lead the solver's mind in the wrong direction before the answer \
snaps into place. A clue for BARK might read "It comes from trees and dogs" \
rather than "Outer layer of a tree trunk."

DOUBLE MEANING: Exploit words with multiple senses. A clue for SCALE might \
read "Weigh in, or climb up" — both senses are valid.

CONTEXTUAL FRAMING: Set a scene or perspective rather than defining. \
For ANCHOR: "It keeps things grounded at sea" rather than "A heavy device \
that holds a ship in place."

ECONOMY: Use the fewest words that still misdirect. Cut every word that \
doesn't earn its place. "Poker player's edge?" is better than \
"An advantage that a poker player might have."

SURFACE READING: The clue should read as a natural, interesting sentence on \
its own — not like a definition from a reference book.

SPECIFIC TECHNIQUES by difficulty:
  - easy:   plain but clean. Clear definition, no misdirection required. \
"Wave rider's board" for SURFBOARD.
  - medium: one layer of misdirection or an unexpected framing. \
"It has a lot of pull, magnetically speaking" for LODESTONE.
  - hard:   double meaning, cryptic framing, or a clever indirect reference. \
"Runner's stretch, informally" for HAMSTRING (runner = stocking, stretch = \
damage the muscle).

NEVER:
  - Copy the answer word or an obvious inflection into the clue
  - Write "___ is the [dictionary definition]" format
  - Use the phrase "relating to" or "pertaining to"
  - Write clues longer than ${MAX_CLUE_LENGTH} characters

━━━ DIFFICULTY GUIDANCE ━━━
  - easy:   common everyday words, clean direct clues, 1–2 syllables
  - medium: moderately specialised words, one clever angle, 2–3 syllables
  - hard:   technical or less common terms, most creative clues, 3–4 syllables

Mix target across the full output:
  - ~25% easy  (typically 3–5 letter words)
  - ~50% medium (typically 5–9 letter words)
  - ~25% hard  (typically 8–15 letter words)
`

// ---------------------------------------------------------------------------
// User prompt — varies per theme and options
// ---------------------------------------------------------------------------

/**
 * buildPrompt — constructs the full prompt string for a generation run.
 *
 * Accepts an optional WordListAnalysis so the prompt can instruct Claude on
 * the specific word-length mix needed to complement the existing list.
 * When no analysis is provided, the static default mix is used.
 *
 * The returned strings map to the Claude API's `system` parameter and
 * `messages[0].content`.
 */
export function buildPrompt(opts: GeneratorOptions): { system: string; user: string } {
  const { theme, seeds = [], count } = opts

  // ── Seed section ───────────────────────────────────────────────────────────
  const seedSection = seeds.length > 0
    ? `\nIMPORTANT: The following words MUST appear in your output as they are \
required anchor words for this theme. Include them at the start of the array, \
then continue with additional words:\n${seeds.map(s => `  ${s.toUpperCase()}`).join('\n')}\n`
    : ''

  // ── User message ───────────────────────────────────────────────────────────
  const user = `\
Generate exactly ${count} word/clue pairs for the crossword theme: "${theme}".
${seedSection}
Requirements:
  - All words must be strongly relevant to "${theme}"
  - Include a mix of core terminology, related concepts, key figures or places, \
and descriptive terms associated with this theme
  - Every word must be distinct — no duplicates
  - Return exactly ${count} items in the JSON array

Return the JSON array now:`

  return { system: SYSTEM_PROMPT, user }
}

/**
 * getSystemPrompt — returns the stable system prompt.
 * Exported separately so tests can verify its content independently.
 */
export function getSystemPrompt(): string {
  return SYSTEM_PROMPT
}
