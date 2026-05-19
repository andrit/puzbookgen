/**
 * @file crossword.generator.ts
 * @description CrosswordGenerator — implements IPuzzleGenerator for crossword puzzles.
 *
 * This class is intentionally thin. All grid construction logic lives in
 * `crossword.functions.ts` as pure, independently testable functions.
 * This class is responsible only for:
 *   1. Orchestrating the generation pipeline
 *   2. Calling the layout library (side-effectful, so isolated here)
 *   3. Assembling the final Puzzle aggregate
 *   4. Validating the result
 *
 * The layout library (`crossword-layout-generator`) is isolated behind
 * `runLayoutGenerator`. Replacing it with a custom algorithm (Phase 3)
 * requires changing only that one function.
 *
 * @module puzzle-generator/crossword
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  IPuzzleGenerator,
  Puzzle,
  Cell,
  WordListEntry,
  GeneratorOptions,
  ValidationResult,
} from '@puzzle-book/shared'
import { SCHEMA_VERSION } from '@puzzle-book/shared'
import {
  normalizeCandidates,
  buildCrosswordGridAndClues,
  type LibInputWord,
  type LibLayoutResult,
} from './crossword.functions'

// ---------------------------------------------------------------------------
// Layout library adapter
// ---------------------------------------------------------------------------

/**
 * Calls the crossword-layout-generator library.
 * Isolated as the only impure function in this module.
 * Replace this function when building the custom algorithm (Phase 3).
 */
/**
 * Calls the layout library, retrying with different word orderings to find
 * the most compact result (highest placed-word count, lowest dead-space ratio).
 *
 * The library is deterministic per input order, so shuffling the candidate
 * list between attempts produces meaningfully different layouts. We run up to
 * RETRY_ATTEMPTS times and keep whichever result placed the most words.
 */
const RETRY_ATTEMPTS = 6

const runLayoutGenerator = (words: LibInputWord[], minWords: number): LibLayoutResult => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const generate = require('crossword-layout-generator').generateLayout

  let best: LibLayoutResult | null = null
  let bestCount = -1

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    // Attempt 0: longest first (best for density)
    // Attempt 1: shortest first (sometimes unlocks different patterns)
    // Attempt 2+: pseudo-random by attempt seed
    let shuffled: LibInputWord[]
    if (attempt === 0) {
      shuffled = [...words].sort((a, b) => b.answer.length - a.answer.length)
    } else if (attempt === 1) {
      shuffled = [...words].sort((a, b) => a.answer.length - b.answer.length)
    } else {
      shuffled = [...words].sort((a, b) => {
        const seed = attempt * 31337 + a.answer.charCodeAt(0) - b.answer.charCodeAt(0)
        return seed % 3 - 1
      })
    }

    const result = generate(shuffled) as LibLayoutResult
    const placedWords = result.result.filter((w) => w.orientation !== 'none')
    const placed      = placedWords.length

    // ── Intersection density score ───────────────────────────────────────────
    // Count how many cells are shared between an across word and a down word.
    // This directly measures how tightly the words interlock.
    // A grid with 15 words and 20 intersections beats one with 15 words and 8.
    const cellOwners = new Map<string, number>()
    for (const w of placedWords) {
      const len = w.answer.length
      for (let i = 0; i < len; i++) {
        const key = w.orientation === 'across'
          ? `${w.starty},${w.startx + i}`
          : `${w.starty + i},${w.startx}`
        cellOwners.set(key, (cellOwners.get(key) ?? 0) + 1)
      }
    }
    const intersections = [...cellOwners.values()].filter(v => v > 1).length

    // Score: intersections are worth 50pts each, placed words 100pts,
    // grid area penalised. High intersections = dense, connected grid.
    const area  = (result.rows || 1) * (result.cols || 1)
    const score = intersections * 50 + placed * 100 - area

    if (score > bestCount) {
      bestCount = score
      best      = result
    }

    // Early exit if excellent density achieved
    if (placed === words.length && intersections >= placed - 1) break
  }

  return best!
}

// ---------------------------------------------------------------------------
// CrosswordGenerator
// ---------------------------------------------------------------------------

/**
 * Generates crossword puzzles from a list of word/clue pairs.
 *
 * Implements `IPuzzleGenerator` so the Book Generator and CLI can work
 * with any puzzle type without knowing the underlying generation strategy.
 *
 * @example
 * ```ts
 * const puzzle = await crosswordGenerator.generate(wordList, { title: 'Puzzle #1' })
 * const result = crosswordGenerator.validate(puzzle)
 * ```
 */
export class CrosswordGenerator implements IPuzzleGenerator {
  readonly puzzleType = 'crossword' as const

  /**
   * Generates a single crossword puzzle.
   *
   * @param wordList - Source word/clue pairs (normalised internally)
   * @param options  - Optional generation parameters
   * @throws If the word list is empty, too small, or placement fails
   */
  async generate(wordList: WordListEntry[], options: GeneratorOptions = {}): Promise<Puzzle> {
    const {
      minWords = 8,
      maxWords = 30,
      difficulty = 'medium',
      theme = null,
      title = 'Crossword Puzzle',
      author = null,
      graphic = null,
      lens = null,
    } = options

    if (wordList.length === 0) {
      throw new Error('Word list is empty — cannot generate a crossword puzzle')
    }

    // Normalise: filter, uppercase, deduplicate, take up to maxWords.
    // The engine sorts internally (longest-first) so no pre-sorting needed here.
    const candidates = normalizeCandidates(wordList, maxWords)

    if (candidates.length < minWords) {
      throw new Error(
        `Not enough valid words after filtering. Need ${minWords}, got ${candidates.length}.`
      )
    }

    const layoutResult = runLayoutGenerator(candidates, minWords)
    const placedWords = layoutResult.result.filter((w) => w.orientation !== 'none')

    if (placedWords.length < minWords) {
      throw new Error(
        `Layout placed only ${placedWords.length} words. ` +
          `Try a larger or more varied word list.`
      )
    }

    const { grid, clues } = buildCrosswordGridAndClues(placedWords, layoutResult)

    return {
      schemaVersion: SCHEMA_VERSION,
      id: uuidv4(),
      puzzleType: 'crossword',
      metadata: {
        title,
        theme,
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        author,
        createdAt: new Date().toISOString(),
        wordCount: placedWords.length,
        gridWidth: grid.width,
        gridHeight: grid.height,
        graphic,
        lens,
      },
      grid,
      clues,
    }
  }

  /**
   * Validates a puzzle JSON for structural correctness.
   * Validates the data contract only — does not re-run layout.
   *
   * @returns `{ valid, errors, warnings }` — warnings are non-blocking
   */
  validate(puzzle: Puzzle): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (puzzle.puzzleType !== 'crossword') {
      errors.push(`Expected puzzleType "crossword", got "${puzzle.puzzleType}"`)
    }

    if (!puzzle.grid?.cells.length) {
      errors.push('Grid is empty')
    }

    if (!puzzle.clues.across.length && !puzzle.clues.down.length) {
      errors.push('No clues found in puzzle')
    }

    if (!puzzle.clues.across.length) {
      warnings.push('No across clues — unusual for a crossword')
    }

    if (!puzzle.clues.down.length) {
      warnings.push('No down clues — unusual for a crossword')
    }

    if (puzzle.metadata.wordCount < 8) {
      warnings.push(`Low word count (${puzzle.metadata.wordCount}) — puzzle may feel sparse`)
    }

    const numberedCells = new Set(
      puzzle.grid.cells.filter((c: Cell) => c.number !== null).map((c: Cell) => c.number)
    )
    for (const clue of [...puzzle.clues.across, ...puzzle.clues.down]) {
      if (!numberedCells.has(clue.number)) {
        errors.push(`Clue #${clue.number} (${clue.direction}) references a missing cell`)
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }
}

/** Singleton instance — equivalent to `new CrosswordGenerator()` */
export const crosswordGenerator = new CrosswordGenerator()
