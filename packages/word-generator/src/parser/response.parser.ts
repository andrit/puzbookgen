/**
 * @file parser/response.parser.ts
 * @description Parses and validates the raw text response from the Claude API.
 *
 * Responsibilities:
 *  - Strip any markdown fences Claude adds despite JSON-only instructions
 *  - Parse the JSON array
 *  - Validate each entry against the GeneratedWord schema
 *  - Filter out invalid entries silently (never throw on bad data)
 *  - Normalise words to uppercase
 *  - Warn when yield is unexpectedly low
 *
 * Design principle: this module is the defensive boundary between the
 * untrusted API response and the rest of the pipeline. It never throws —
 * bad data is dropped, good data flows through. The caller decides what
 * to do with a low yield (retry logic lives in word.generator.ts).
 */

import type { GeneratedWord } from '../types'
import {
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH,
  MAX_CLUE_LENGTH,
  MIN_SYLLABLES,
  MAX_SYLLABLES,
  MIN_YIELD_FRACTION,
} from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Diagnostic information returned alongside the parsed words */
export interface ParseResult {
  words:        GeneratedWord[]
  /** Total entries found in the JSON before validation */
  totalFound:   number
  /** Entries dropped due to validation failures */
  totalDropped: number
  /** Reasons entries were dropped, for debugging */
  dropReasons:  DropReason[]
}

export interface DropReason {
  word:   string   // raw value from JSON, may be invalid
  reason: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DIFFICULTIES = new Set<string>(['easy', 'medium', 'hard'])

/** Regex: only uppercase A–Z after normalisation */
const LETTERS_ONLY = /^[A-Z]+$/

/** Markdown fence patterns to strip before JSON parsing */
const FENCE_PATTERNS = [
  /^```json\s*/i,
  /^```\s*/,
  /\s*```$/,
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * parseResponse — converts raw Claude API text into validated GeneratedWord[].
 *
 * @param raw          Raw string from Claude API response
 * @param expectedCount Expected number of words (used for yield warning)
 * @returns ParseResult with validated words and diagnostics
 */
export function parseResponse(raw: string, expectedCount?: number): ParseResult {
  const dropReasons: DropReason[] = []

  // ── Step 1: Strip markdown fences ────────────────────────────────────────
  const cleaned = stripFences(raw.trim())

  // ── Step 2: Extract JSON array ────────────────────────────────────────────
  const extracted = extractJsonArray(cleaned)
  if (extracted === null) {
    console.warn('[parseResponse] Could not locate a JSON array in the response.')
    return { words: [], totalFound: 0, totalDropped: 0, dropReasons: [] }
  }

  // ── Step 3: Parse JSON ────────────────────────────────────────────────────
  let raw_entries: unknown[]
  try {
    raw_entries = JSON.parse(extracted)
  } catch {
    console.warn('[parseResponse] JSON.parse failed on extracted content.')
    return { words: [], totalFound: 0, totalDropped: 0, dropReasons: [] }
  }

  if (!Array.isArray(raw_entries)) {
    console.warn('[parseResponse] Parsed JSON is not an array.')
    return { words: [], totalFound: 0, totalDropped: 0, dropReasons: [] }
  }

  const totalFound = raw_entries.length

  // ── Step 4: Validate each entry ───────────────────────────────────────────
  const words: GeneratedWord[] = []

  for (const entry of raw_entries) {
    const result = validateEntry(entry)
    if (result.valid) {
      words.push(result.word!)
    } else {
      dropReasons.push({
        word:   typeof (entry as any)?.word === 'string' ? String((entry as any).word) : '(missing)',
        reason: result.reason!,
      })
    }
  }

  const totalDropped = totalFound - words.length

  // ── Step 5: Yield warning ─────────────────────────────────────────────────
  if (expectedCount !== undefined) {
    const yield_fraction = words.length / expectedCount
    if (yield_fraction < MIN_YIELD_FRACTION) {
      console.warn(
        `[parseResponse] Low yield: got ${words.length} valid words, ` +
        `expected ~${expectedCount} (${Math.round(yield_fraction * 100)}%). ` +
        `${totalDropped} entries dropped. Consider retrying.`
      )
    }
  }

  return { words, totalFound, totalDropped, dropReasons }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip markdown code fences from start and end of string */
function stripFences(text: string): string {
  let result = text
  for (const pattern of FENCE_PATTERNS) {
    result = result.replace(pattern, '')
  }
  return result.trim()
}

/**
 * Extract the first complete JSON array from the text.
 * Handles cases where Claude adds a sentence before or after the array.
 */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[')
  const end   = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

// ---------------------------------------------------------------------------
// Entry validation
// ---------------------------------------------------------------------------

type ValidationResult =
  | { valid: true;  word: GeneratedWord }
  | { valid: false; reason: string }

function validateEntry(entry: unknown): ValidationResult {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return { valid: false, reason: 'entry is not an object' }
  }

  const e = entry as Record<string, unknown>

  // ── word ──────────────────────────────────────────────────────────────────
  if (typeof e.word !== 'string' || e.word.trim() === '') {
    return { valid: false, reason: 'missing or empty word field' }
  }

  // Reject words that contain internal spaces (multi-word entries)
  // Trim first so leading/trailing whitespace is not penalised
  if (/\s/.test(e.word.trim())) {
    return { valid: false, reason: `word "${e.word.trim()}" contains spaces` }
  }

  const word = e.word.trim().toUpperCase()

  if (!LETTERS_ONLY.test(word)) {
    return { valid: false, reason: `word "${word}" contains non-letter characters` }
  }

  if (word.length < MIN_WORD_LENGTH) {
    return { valid: false, reason: `word "${word}" is too short (${word.length} < ${MIN_WORD_LENGTH})` }
  }

  if (word.length > MAX_WORD_LENGTH) {
    return { valid: false, reason: `word "${word}" is too long (${word.length} > ${MAX_WORD_LENGTH})` }
  }

  // ── clue ──────────────────────────────────────────────────────────────────
  if (typeof e.clue !== 'string' || e.clue.trim() === '') {
    return { valid: false, reason: `word "${word}": missing or empty clue` }
  }

  const clue = e.clue.trim()

  if (clue.length > MAX_CLUE_LENGTH) {
    return { valid: false, reason: `word "${word}": clue too long (${clue.length} > ${MAX_CLUE_LENGTH} chars)` }
  }

  // ── difficulty ────────────────────────────────────────────────────────────
  if (typeof e.difficulty !== 'string' || !VALID_DIFFICULTIES.has(e.difficulty)) {
    return {
      valid: false,
      reason: `word "${word}": invalid difficulty "${e.difficulty}" (must be easy/medium/hard)`,
    }
  }

  const difficulty = e.difficulty as 'easy' | 'medium' | 'hard'

  // ── syllables ─────────────────────────────────────────────────────────────
  const syllables = Number(e.syllables)

  if (!Number.isInteger(syllables)) {
    return { valid: false, reason: `word "${word}": syllables must be an integer, got "${e.syllables}"` }
  }

  if (syllables < MIN_SYLLABLES || syllables > MAX_SYLLABLES) {
    return {
      valid: false,
      reason: `word "${word}": syllables ${syllables} out of range (${MIN_SYLLABLES}–${MAX_SYLLABLES})`,
    }
  }

  return { valid: true, word: { word, clue, difficulty, syllables } }
}
