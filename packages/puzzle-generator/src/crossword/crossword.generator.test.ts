/**
 * @file crossword.generator.test.ts
 * @description Unit tests for CrosswordGenerator.validate().
 *
 * We do not test `generate()` here — that requires the crossword-layout-generator
 * library and is covered by the CLI integration test instead.
 *
 * validate() is pure in the sense that it only reads the Puzzle argument,
 * making it straightforward to test by constructing puzzle shapes directly.
 */

import { describe, it, expect } from 'vitest'
import { CrosswordGenerator } from '../crossword/crossword.generator'
import { makePuzzle } from '@puzzle-book/test-fixtures'
import type { Puzzle } from '@puzzle-book/shared'

const generator = new CrosswordGenerator()

describe('CrosswordGenerator.validate', () => {
  // ---------------------------------------------------------------------------
  // Valid puzzles
  // ---------------------------------------------------------------------------

  it('returns valid=true for a well-formed puzzle', () => {
    const result = generator.validate(makePuzzle())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // Error cases
  // ---------------------------------------------------------------------------

  it('errors when puzzleType is not "crossword"', () => {
    const puzzle = makePuzzle({ puzzleType: 'word-search' as any })
    const result = generator.validate(puzzle)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('puzzleType'))).toBe(true)
  })

  it('errors when grid has no cells', () => {
    const puzzle = makePuzzle({ grid: { width: 0, height: 0, cells: [] } })
    const result = generator.validate(puzzle)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.toLowerCase().includes('grid'))).toBe(true)
  })

  it('errors when there are no clues at all', () => {
    const puzzle = makePuzzle({ clues: { across: [], down: [] } })
    const result = generator.validate(puzzle)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.toLowerCase().includes('clue'))).toBe(true)
  })

  it('errors when a clue number has no matching numbered cell', () => {
    const puzzle = makePuzzle({
      clues: {
        across: [
          { number: 99, clue: 'Ghost clue', answer: 'GHOST', startRow: 0, startCol: 0, length: 5, direction: 'across' },
        ],
        down: [],
      },
    })
    const result = generator.validate(puzzle)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('99'))).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Warning cases (valid but flagged)
  // ---------------------------------------------------------------------------

  it('warns when there are no across clues', () => {
    const puzzle = makePuzzle({ clues: { across: [], down: makePuzzle().clues.down } })
    const result = generator.validate(puzzle)
    expect(result.warnings.some((w) => w.toLowerCase().includes('across'))).toBe(true)
  })

  it('warns when there are no down clues', () => {
    const puzzle = makePuzzle({ clues: { across: makePuzzle().clues.across, down: [] } })
    const result = generator.validate(puzzle)
    expect(result.warnings.some((w) => w.toLowerCase().includes('down'))).toBe(true)
  })

  it('warns when word count is below 8', () => {
    const puzzle = makePuzzle({ metadata: { ...makePuzzle().metadata, wordCount: 4 } })
    const result = generator.validate(puzzle)
    expect(result.warnings.some((w) => w.toLowerCase().includes('word count'))).toBe(true)
  })

  it('does not warn about word count when count is 8 or above', () => {
    const puzzle = makePuzzle({ metadata: { ...makePuzzle().metadata, wordCount: 8 } })
    const result = generator.validate(puzzle)
    expect(result.warnings.some((w) => w.toLowerCase().includes('word count'))).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // puzzleType field
  // ---------------------------------------------------------------------------

  it('exposes puzzleType = "crossword" on the instance', () => {
    expect(generator.puzzleType).toBe('crossword')
  })
})
