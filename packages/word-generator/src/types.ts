/**
 * @file types.ts
 * @description Shared types for the word-generator package.
 *
 * These types flow through the entire pipeline:
 *   GeneratorOptions → buildPrompt
 *   GeneratedWord[]  → parseResponse → deduplicate → writeWordsCsv
 *   GeneratorResult  → CLI output
 */

// ---------------------------------------------------------------------------
// Core word type
// ---------------------------------------------------------------------------

/**
 * A single generated word/clue pair, validated and ready for the crossword
 * pipeline. Compatible with WordListEntry from @puzzle-book/shared — the
 * csv.writer outputs this shape as `word,clue,difficulty`.
 */
export interface GeneratedWord {
  /** Uppercase letters only, 3–15 characters */
  word:       string
  /** One complete sentence, 120 characters or fewer */
  clue:       string
  difficulty: 'easy' | 'medium' | 'hard'
  /** Number of syllables, 1–4 */
  syllables:  number
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for a single word-generation run (one theme, one API session).
 */
export interface GeneratorOptions {
  /** Human-readable theme name, e.g. "Ancient Civilizations" */
  theme:       string
  /**
   * Optional anchor words to include in the output.
   * These are passed to the prompt so Claude includes them first,
   * and they are guaranteed to appear in the merged result via the deduplicator.
   */
  seeds?:      string[]
  /**
   * Target number of unique words in the final output.
   * The generator may make multiple API calls to reach this count.
   * Default: 150
   */
  count:       number
  /**
   * Maximum number of API call attempts before giving up.
   * Each attempt generates a fresh batch of words.
   * Default: 3
   */
  maxRetries:  number
  /**
   * Anthropic API key. Falls back to `process.env.ANTHROPIC_API_KEY` if omitted.
   */
  apiKey?:     string
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/**
 * The result of a complete generation run, including diagnostics.
 */
export interface GeneratorResult {
  /** Final merged, deduplicated word list */
  words:             GeneratedWord[]
  /** Number of words dropped because they already existed in the source CSV */
  duplicatesRemoved: number
  /** Total number of API calls made during this run */
  apiCallCount:      number
}


// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown by `claude.client` when the API returns a non-2xx response.
 */
export class ApiError extends Error {
  constructor(
    message:         string,
    public status:   number,
    public body:     string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Words shorter than this are excluded from output */
export const MIN_WORD_LENGTH = 3

/** Words longer than this are excluded from output */
export const MAX_WORD_LENGTH = 15

/** Clues longer than this are excluded from output */
export const MAX_CLUE_LENGTH = 120

/** Minimum syllable count */
export const MIN_SYLLABLES = 1

/** Maximum syllable count */
export const MAX_SYLLABLES = 4

/** If a parse round yields fewer than this fraction of requested words, retry */
export const MIN_YIELD_FRACTION = 0.6

/** Default target word count per theme */
export const DEFAULT_COUNT = 150

/** Default maximum API retry attempts */
export const DEFAULT_MAX_RETRIES = 3
