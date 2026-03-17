/**
 * @file pipeline.integration.test.ts
 * @description Integration test for the full puzzle generation pipeline.
 *
 * Tests the complete flow:
 *   WordListEntry[] → CrosswordGenerator → Puzzle → BookAssembler → Book
 *
 * This test uses the real crossword-layout-generator library.
 * It is tagged @integration and excluded from fast unit test runs,
 * but runs in CI on the `build` job after packages are installed.
 *
 * Run explicitly with:
 *   npx vitest run packages/puzzle-generator/src/__tests__/pipeline.integration.test.ts
 */

import { describe, it, expect } from 'vitest'
import { crosswordGenerator } from '../crossword/crossword.generator'
import { bookAssembler } from '@puzzle-book/book-generator'
import { WORD_LIST_10 } from '@puzzle-book/test-fixtures'
import { SCHEMA_VERSION } from '@puzzle-book/shared'

describe('@integration Full pipeline: word list → puzzle → book', () => {
  // ---------------------------------------------------------------------------
  // CrosswordGenerator.generate()
  // ---------------------------------------------------------------------------

  describe('CrosswordGenerator.generate', () => {
    it('generates a valid puzzle from WORD_LIST_10', async () => {
      const puzzle = await crosswordGenerator.generate(WORD_LIST_10, {
        title: 'Integration Test Puzzle',
        minWords: 4,
      })

      expect(puzzle.schemaVersion).toBe(SCHEMA_VERSION)
      expect(puzzle.puzzleType).toBe('crossword')
      expect(puzzle.id).toBeTruthy()
      expect(puzzle.metadata.title).toBe('Integration Test Puzzle')
    }, 15_000) // generous timeout for the layout library

    it('puzzle passes validate() with no errors', async () => {
      const puzzle = await crosswordGenerator.generate(WORD_LIST_10, { minWords: 4 })
      const result = crosswordGenerator.validate(puzzle)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    }, 15_000)

    it('grid has correct dimensions', async () => {
      const puzzle = await crosswordGenerator.generate(WORD_LIST_10, { minWords: 4 })
      expect(puzzle.grid.width).toBeGreaterThan(0)
      expect(puzzle.grid.height).toBeGreaterThan(0)
      expect(puzzle.grid.cells.length).toBe(puzzle.grid.width * puzzle.grid.height)
    }, 15_000)

    it('produces both across and down clues', async () => {
      const puzzle = await crosswordGenerator.generate(WORD_LIST_10, { minWords: 4 })
      expect(puzzle.clues.across.length).toBeGreaterThan(0)
      expect(puzzle.clues.down.length).toBeGreaterThan(0)
    }, 15_000)

    it('every clue number references a numbered cell in the grid', async () => {
      const puzzle = await crosswordGenerator.generate(WORD_LIST_10, { minWords: 4 })
      const numberedCells = new Set(
        puzzle.grid.cells.filter((c) => c.number !== null).map((c) => c.number)
      )
      for (const clue of [...puzzle.clues.across, ...puzzle.clues.down]) {
        expect(numberedCells.has(clue.number)).toBe(true)
      }
    }, 15_000)

    it('throws for an empty word list', async () => {
      await expect(crosswordGenerator.generate([])).rejects.toThrow()
    })

    it('throws when not enough words can be placed', async () => {
      await expect(
        crosswordGenerator.generate(WORD_LIST_10, { minWords: 999 })
      ).rejects.toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // BookAssembler after live generation
  // ---------------------------------------------------------------------------

  describe('BookAssembler with generated puzzles', () => {
    it('assembles a book from a generated puzzle', async () => {
      const puzzle = await crosswordGenerator.generate(WORD_LIST_10, { minWords: 4 })
      const book = bookAssembler.assemble([puzzle], {
        metadata: {
          title: 'Integration Book',
          subtitle: '',
          author: 'Test',
          edition: 1,
          theme: null,
        },
      })

      expect(book.puzzles).toHaveLength(1)
      expect(book.puzzles[0].id).toBe(puzzle.id)
      expect(book.metadata.title).toBe('Integration Book')
    }, 15_000)

    it('chapter puzzleIds contain the generated puzzle id', async () => {
      const puzzle = await crosswordGenerator.generate(WORD_LIST_10, { minWords: 4 })
      const book = bookAssembler.assemble([puzzle], {
        metadata: { title: 'T', subtitle: '', author: '', edition: 1, theme: null },
      })

      expect(book.content.chapters[0].puzzleIds).toContain(puzzle.id)
    }, 15_000)
  })
})
