/**
 * @file csv/csv.writer.ts
 * @description Read and write GeneratedWord[] as CSV files.
 *
 * Format: word,clue,difficulty  (three columns, one header row)
 * Compatible with loadWordList() in apps/cli/src/commands/generate-book.ts
 *
 * RFC 4180 quoting: clue fields are always double-quoted so internal
 * commas don't break parsing. Embedded double-quotes are escaped as "".
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname } from 'path'
import type { GeneratedWord } from '../types'

const HEADER = 'word,clue,difficulty'

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * writeWordsCsv — serialises words to a CSV file.
 * Creates the output directory if it doesn't exist.
 *
 * @param words       Validated GeneratedWord array
 * @param outputPath  Absolute or relative file path
 */
export function writeWordsCsv(words: GeneratedWord[], outputPath: string): void {
  const dir = dirname(outputPath)
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })

  const rows = words.map(w =>
    `${w.word},${quoteField(w.clue)},${w.difficulty}`
  )

  writeFileSync(outputPath, [HEADER, ...rows].join('\n'), 'utf-8')
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * readWordsCsv — parses a CSV file into GeneratedWord[].
 * Returns an empty array if the file does not exist.
 * Skips the header row, blank lines, and rows missing required fields.
 *
 * Assumes syllables are not stored in the CSV (the existing format is
 * word,clue,difficulty). Syllables default to 0 when absent so the
 * deduplicator can still use the words as an existing-list source.
 */
export function readWordsCsv(filePath: string): GeneratedWord[] {
  if (!existsSync(filePath)) return []

  const raw = readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

  if (lines.length === 0) return []

  // Skip header row (matches HEADER constant or starts with "word,")
  const dataLines = lines[0].toLowerCase().startsWith('word,')
    ? lines.slice(1)
    : lines

  const words: GeneratedWord[] = []

  for (const line of dataLines) {
    const parsed = parseLine(line)
    if (parsed) words.push(parsed)
  }

  return words
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * quoteField — wraps a string in double-quotes and escapes internal quotes.
 * Always quotes so commas inside clues don't break CSV parsing.
 */
function quoteField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * parseLine — parses one CSV line into a GeneratedWord.
 * Returns null if the line is malformed or missing required fields.
 *
 * Handles the two formats:
 *   WORD,"Clue text",difficulty
 *   WORD,Clue text,difficulty      (unquoted clue — legacy format)
 */
function parseLine(line: string): GeneratedWord | null {
  if (!line.trim()) return null

  let word: string
  let clue: string
  let difficulty: string

  // Check if clue is quoted
  const quotedMatch = line.match(/^([^,]+),"((?:[^"]|"")*)"\s*,\s*(\w+)\s*$/)
  if (quotedMatch) {
    word       = quotedMatch[1].trim()
    clue       = quotedMatch[2].replace(/""/g, '"')
    difficulty = quotedMatch[3].trim()
  } else {
    // Unquoted — split on comma, clue is everything between first and last comma
    const firstComma = line.indexOf(',')
    const lastComma  = line.lastIndexOf(',')
    if (firstComma === -1 || firstComma === lastComma) return null

    word       = line.slice(0, firstComma).trim()
    clue       = line.slice(firstComma + 1, lastComma).trim()
    difficulty = line.slice(lastComma + 1).trim()
  }

  if (!word || !clue || !difficulty) return null
  if (!['easy', 'medium', 'hard'].includes(difficulty.toLowerCase())) return null

  return {
    word:       word.toUpperCase(),
    clue,
    difficulty: difficulty.toLowerCase() as 'easy' | 'medium' | 'hard',
    syllables:  0,   // not stored in CSV — populated by generator or defaulted
  }
}

// ---------------------------------------------------------------------------
// Word list analysis
// ---------------------------------------------------------------------------

import type { WordListAnalysis, LengthBucket, BucketTarget } from '../types'
import { BUCKET_SHORT_MAX, BUCKET_MEDIUM_MAX } from '../types'

/**
 * analyzeWordList — examines an existing word list's length distribution
 * and returns recommended target fractions for the next generated batch.
 *
 * The goal is to complement what already exists:
 *  - If short words are underrepresented → request more short words
 *  - If long words dominate → heavily weight short/medium in the new batch
 *  - A perfectly balanced list → request the balanced default mix
 *
 * This is called by word.generator before buildPrompt so the prompt can
 * instruct Claude on exactly what lengths are needed.
 *
 * @param words  Existing word list (may be empty)
 */
export function analyzeWordList(words: GeneratedWord[]): WordListAnalysis {
  const total = words.length

  // ── Count per bucket ───────────────────────────────────────────────────────
  const counts: Record<LengthBucket, number> = { short: 0, medium: 0, long: 0 }

  for (const w of words) {
    counts[toBucket(w.word.length)]++
  }

  // ── Fractions ──────────────────────────────────────────────────────────────
  const fractions: Record<LengthBucket, number> = {
    short:  total > 0 ? counts.short  / total : 0,
    medium: total > 0 ? counts.medium / total : 0,
    long:   total > 0 ? counts.long   / total : 0,
  }

  // ── Recommended targets for new batch ─────────────────────────────────────
  // The ideal final distribution (existing + new combined) is:
  //   short 35%, medium 45%, long 20%
  // We compute what fraction of the *new* batch should be each bucket
  // to move the combined distribution toward that ideal.
  // When the list is empty, return the ideal as the default.
  const targets = computeTargets(fractions, total)

  // ── Human-readable summary ─────────────────────────────────────────────────
  const summary = buildSummary(counts, fractions, targets, total)

  return { total, counts, fractions, targets, summary }
}

/**
 * toBucket — classifies a word length into a LengthBucket.
 */
export function toBucket(length: number): LengthBucket {
  if (length <= BUCKET_SHORT_MAX)  return 'short'
  if (length <= BUCKET_MEDIUM_MAX) return 'medium'
  return 'long'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ideal combined distribution to move toward */
const IDEAL: BucketTarget = { short: 0.35, medium: 0.45, long: 0.20 }

/**
 * computeTargets — given the current distribution, compute what the NEW
 * batch should look like to move toward IDEAL.
 *
 * If a bucket is already over-represented relative to ideal, its target
 * in the new batch drops to near-zero. If under-represented, its target
 * rises above ideal to compensate.
 */
function computeTargets(
  fractions: Record<LengthBucket, number>,
  total: number
): BucketTarget {
  // Empty list — just return the ideal distribution
  if (total === 0) return { ...IDEAL }

  // How far each bucket is from ideal (negative = under-represented)
  const buckets: LengthBucket[] = ['short', 'medium', 'long']
  const raw: Record<LengthBucket, number> = { short: 0, medium: 0, long: 0 }

  for (const b of buckets) {
    const deficit = IDEAL[b] - fractions[b]
    // Boost under-represented buckets, mildly reduce over-represented ones
    // Clamp to [0.05, 0.80] so no bucket is ever completely excluded
    raw[b] = Math.max(0.05, Math.min(0.80, IDEAL[b] + deficit * 1.5))
  }

  // Normalise so targets sum to exactly 1.0
  const sum = raw.short + raw.medium + raw.long
  return {
    short:  Math.round((raw.short  / sum) * 100) / 100,
    medium: Math.round((raw.medium / sum) * 100) / 100,
    long:   Math.round((raw.long   / sum) * 100) / 100,
  }
}

/**
 * buildSummary — constructs a plain-English description for prompt injection.
 */
function buildSummary(
  counts: Record<LengthBucket, number>,
  fractions: Record<LengthBucket, number>,
  targets: BucketTarget,
  total: number
): string {
  if (total === 0) {
    return 'No existing words. Aim for ~35% short (3–5 letters), ~45% medium (6–9 letters), ~20% long (10–15 letters).'
  }

  const pct = (n: number) => `${Math.round(n * 100)}%`

  const lines = [
    `Existing list: ${total} words — ` +
      `${counts.short} short (${pct(fractions.short)}), ` +
      `${counts.medium} medium (${pct(fractions.medium)}), ` +
      `${counts.long} long (${pct(fractions.long)}).`,
    `For this batch, target approximately: ` +
      `${pct(targets.short)} short (3–5 letters), ` +
      `${pct(targets.medium)} medium (6–9 letters), ` +
      `${pct(targets.long)} long (10–15 letters).`,
  ]

  // Add a plain-language priority note when distribution is skewed
  if (fractions.short < 0.20) {
    lines.push('Priority: short words (3–5 letters) are underrepresented — they are essential for grid density and should be heavily prioritised in this batch.')
  } else if (fractions.long > 0.40) {
    lines.push('Note: long words are over-represented. Focus on short and medium words to improve crossword grid density.')
  }

  return lines.join(' ')
}
