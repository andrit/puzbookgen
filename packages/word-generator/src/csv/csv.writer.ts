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
