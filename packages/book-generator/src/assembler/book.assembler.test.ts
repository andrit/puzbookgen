/**
 * @file book.assembler.test.ts
 * @description Unit tests for BookAssembler.
 *
 * Tests verify the structural contracts the assembler guarantees:
 * - Returns a valid Book aggregate
 * - Maps puzzle IDs into a single default chapter
 * - Applies metadata and layout defaults correctly
 * - Rejects empty puzzle arrays
 */

import { describe, it, expect } from 'vitest'
import { BookAssembler } from '../assembler/book.assembler'
import { makePuzzle } from '@puzzle-book/test-fixtures'
import { SCHEMA_VERSION } from '@puzzle-book/shared'
import type { AssemblerOptions } from '../assembler/book.assembler'

const assembler = new BookAssembler()

/** Minimal valid options for assembler.assemble() */
const makeOptions = (overrides: Partial<AssemblerOptions> = {}): AssemblerOptions => ({
  metadata: {
    title: 'Test Book',
    subtitle: 'A subtitle',
    author: 'Test Author',
    edition: 1,
    theme: null,
  },
  ...overrides,
})

describe('BookAssembler.assemble', () => {
  // ---------------------------------------------------------------------------
  // Guard conditions
  // ---------------------------------------------------------------------------

  it('throws when given an empty puzzle array', () => {
    expect(() => assembler.assemble([], makeOptions())).toThrow()
  })

  // ---------------------------------------------------------------------------
  // Schema and identity
  // ---------------------------------------------------------------------------

  it('sets schemaVersion on the book', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('generates a unique id for the book', () => {
    const a = assembler.assemble([makePuzzle()], makeOptions())
    const b = assembler.assemble([makePuzzle()], makeOptions())
    expect(a.id).toBeTruthy()
    expect(a.id).not.toBe(b.id)
  })

  it('sets bookType to "crossword-collection"', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.bookType).toBe('crossword-collection')
  })

  it('derives puzzleType from the first puzzle', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.puzzleType).toBe('crossword')
  })

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  it('copies title from options', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.metadata.title).toBe('Test Book')
  })

  it('copies author from options', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.metadata.author).toBe('Test Author')
  })

  it('sets createdAt to a valid ISO-8601 string', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(() => new Date(book.metadata.createdAt)).not.toThrow()
    expect(new Date(book.metadata.createdAt).getFullYear()).toBeGreaterThan(2020)
  })

  // ---------------------------------------------------------------------------
  // Chapter structure
  // ---------------------------------------------------------------------------

  it('places all puzzles in a single chapter', () => {
    const puzzles = [makePuzzle({ id: 'p1' }), makePuzzle({ id: 'p2' }), makePuzzle({ id: 'p3' })]
    const book = assembler.assemble(puzzles, makeOptions())
    expect(book.content.chapters).toHaveLength(1)
    expect(book.content.chapters[0].puzzleIds).toHaveLength(3)
  })

  it('chapter puzzleIds match the input puzzle ids in order', () => {
    const puzzles = [makePuzzle({ id: 'p1' }), makePuzzle({ id: 'p2' })]
    const book = assembler.assemble(puzzles, makeOptions())
    expect(book.content.chapters[0].puzzleIds).toEqual(['p1', 'p2'])
  })

  it('stores the full puzzle objects on book.puzzles', () => {
    const puzzle = makePuzzle({ id: 'p1' })
    const book = assembler.assemble([puzzle], makeOptions())
    expect(book.puzzles).toHaveLength(1)
    expect(book.puzzles[0].id).toBe('p1')
  })

  // ---------------------------------------------------------------------------
  // Render targets
  // ---------------------------------------------------------------------------

  it('defaults to kdp-6x9-bw for print target', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.renderTargets.print).toBe('kdp-6x9-bw')
  })

  it('defaults to screen-pdf-tablet for screen target', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.renderTargets.screen).toBe('screen-pdf-tablet')
  })

  it('accepts a custom print target', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions({ printTarget: 'kdp-8x10-bw' }))
    expect(book.renderTargets.print).toBe('kdp-8x10-bw')
  })

  // ---------------------------------------------------------------------------
  // Content defaults
  // ---------------------------------------------------------------------------

  it('enables intro by default', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.content.intro.enabled).toBe(true)
  })

  it('enables answer key by default', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.content.answerKey.enabled).toBe(true)
  })

  it('positions answer key at back by default', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.content.answerKey.position).toBe('back')
  })

  it('allows disabling the intro', () => {
    const book = assembler.assemble(
      [makePuzzle()],
      makeOptions({ content: { intro: { enabled: false, text: '' } } })
    )
    expect(book.content.intro.enabled).toBe(false)
  })

  it('sets cover title from metadata.title', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.content.cover.title).toBe('Test Book')
  })

  // ---------------------------------------------------------------------------
  // Layout defaults
  // ---------------------------------------------------------------------------

  it('defaults to "standard" layout template', () => {
    const book = assembler.assemble([makePuzzle()], makeOptions())
    expect(book.layout.template).toBe('standard')
  })
})
