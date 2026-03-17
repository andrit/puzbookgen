import type { WordListEntry } from '@puzzle-book/shared'

/**
 * Parse a CSV string into WordListEntry objects.
 * Expects a header row with at minimum: word, clue
 * Optional column: difficulty
 *
 * Handles quoted fields and basic CSV escaping.
 */
export function parseCSV(csvText: string): WordListEntry[] {
  const lines = csvText.trim().split('\n').filter(Boolean)
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row')
  }

  const headers = parseCSVRow(lines[0]).map((h) => h.toLowerCase().trim())

  const wordIdx = headers.indexOf('word')
  const clueIdx = headers.indexOf('clue')
  const diffIdx = headers.indexOf('difficulty')

  if (wordIdx === -1) throw new Error('CSV must have a "word" column')
  if (clueIdx === -1) throw new Error('CSV must have a "clue" column')

  const entries: WordListEntry[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i])
    const word = cols[wordIdx]?.trim()
    const clue = cols[clueIdx]?.trim()

    if (!word || !clue) continue
    if (word.length < 2) continue

    entries.push({
      word: word.toUpperCase(),
      clue,
      difficulty: normalizeDifficulty(diffIdx !== -1 ? cols[diffIdx] : undefined),
    })
  }

  if (entries.length === 0) {
    throw new Error('No valid word/clue pairs found in CSV')
  }

  return entries
}

function parseCSVRow(line: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cols.push(current)
  return cols
}

function normalizeDifficulty(raw?: string): 'easy' | 'medium' | 'hard' {
  switch (raw?.toLowerCase().trim()) {
    case 'easy': return 'easy'
    case 'hard': return 'hard'
    default: return 'medium'
  }
}
