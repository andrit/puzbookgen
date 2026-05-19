/**
 * @file dedup/deduplicator.ts
 * @description Merges an incoming word list with an existing one,
 * removing duplicates. Existing words always take priority.
 *
 * Rules:
 *  - Deduplication key is word.toUpperCase() — case-insensitive
 *  - When a word appears in both lists, the existing entry wins
 *    (preserves hand-crafted clues and difficulty ratings)
 *  - Output order: existing words first, new words appended after
 *  - Never throws — empty inputs are valid
 */

import type { GeneratedWord } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeduplicateResult {
  /** Existing words followed by new non-duplicate words */
  merged:  GeneratedWord[]
  /** Count of incoming words that were added to the merged list */
  added:   number
  /** Count of incoming words dropped as duplicates */
  removed: number
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * deduplicate — merges incoming words into existing, dropping duplicates.
 *
 * @param incoming  Newly generated words (e.g. from Claude API)
 * @param existing  Words already in the word list (e.g. from source CSV)
 */
export function deduplicate(
  incoming: GeneratedWord[],
  existing: GeneratedWord[]
): DeduplicateResult {
  // Build a lookup set from existing words — O(1) membership test
  const existingKeys = new Set(existing.map(w => w.word.toUpperCase()))

  const newWords: GeneratedWord[] = []
  let removed = 0

  for (const word of incoming) {
    const key = word.word.toUpperCase()
    if (existingKeys.has(key)) {
      removed++
    } else {
      // Add to lookup so duplicate incoming words don't slip through either
      existingKeys.add(key)
      newWords.push({ ...word, word: key })  // normalise to uppercase
    }
  }

  return {
    merged: [...existing, ...newWords],
    added:  newWords.length,
    removed,
  }
}
