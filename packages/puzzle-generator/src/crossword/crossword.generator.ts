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
const runLayoutGenerator = (words: LibInputWord[]): LibLayoutResult => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const generate = require('crossword-layout-generator').generateLayout
  return generate(words) as LibLayoutResult
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
    } = options

    if (wordList.length === 0) {
      throw new Error('Word list is empty — cannot generate a crossword puzzle')
    }

    const candidates = normalizeCandidates(wordList, maxWords)

    if (candidates.length < minWords) {
      throw new Error(
        `Not enough valid words after filtering. Need ${minWords}, got ${candidates.length}.`
      )
    }

    const layoutResult = runLayoutGenerator(candidates)
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
