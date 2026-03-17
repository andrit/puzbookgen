/**
 * @file schema.test.ts
 * @description Tests for the shared schema contracts.
 *
 * These tests verify that our TypeScript type definitions and runtime
 * constants behave as documented. They act as a canary: if someone
 * changes SCHEMA_VERSION or the shape of a core type in a breaking way,
 * these tests will catch it before it reaches the pipeline.
 */

import { describe, it, expect } from 'vitest'
import { SCHEMA_VERSION } from '@puzzle-book/shared'
import { makePuzzle } from '@puzzle-book/test-fixtures'

describe('SCHEMA_VERSION', () => {
  it('is a non-empty string', () => {
    expect(typeof SCHEMA_VERSION).toBe('string')
    expect(SCHEMA_VERSION.length).toBeGreaterThan(0)
  })

  it('follows semantic versioning format (x.y.z)', () => {
    expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('Puzzle schema shape', () => {
  it('has all required top-level fields', () => {
    const puzzle = makePuzzle()
    expect(puzzle).toHaveProperty('schemaVersion')
    expect(puzzle).toHaveProperty('id')
    expect(puzzle).toHaveProperty('puzzleType')
    expect(puzzle).toHaveProperty('metadata')
    expect(puzzle).toHaveProperty('grid')
    expect(puzzle).toHaveProperty('clues')
  })

  it('metadata has all required fields', () => {
    const { metadata } = makePuzzle()
    expect(metadata).toHaveProperty('title')
    expect(metadata).toHaveProperty('theme')
    expect(metadata).toHaveProperty('difficulty')
    expect(metadata).toHaveProperty('author')
    expect(metadata).toHaveProperty('createdAt')
    expect(metadata).toHaveProperty('wordCount')
    expect(metadata).toHaveProperty('gridWidth')
    expect(metadata).toHaveProperty('gridHeight')
  })

  it('grid has width, height, and cells array', () => {
    const { grid } = makePuzzle()
    expect(grid).toHaveProperty('width')
    expect(grid).toHaveProperty('height')
    expect(Array.isArray(grid.cells)).toBe(true)
  })

  it('clues has across and down arrays', () => {
    const { clues } = makePuzzle()
    expect(Array.isArray(clues.across)).toBe(true)
    expect(Array.isArray(clues.down)).toBe(true)
  })

  it('a Clue has all required fields', () => {
    const clue = makePuzzle().clues.across[0]
    expect(clue).toHaveProperty('number')
    expect(clue).toHaveProperty('clue')
    expect(clue).toHaveProperty('answer')
    expect(clue).toHaveProperty('startRow')
    expect(clue).toHaveProperty('startCol')
    expect(clue).toHaveProperty('length')
    expect(clue).toHaveProperty('direction')
  })

  it('direction is "across" or "down"', () => {
    const puzzle = makePuzzle()
    for (const clue of puzzle.clues.across) {
      expect(clue.direction).toBe('across')
    }
    for (const clue of puzzle.clues.down) {
      expect(clue.direction).toBe('down')
    }
  })

  it('a Cell has all required fields', () => {
    const cell = makePuzzle().grid.cells[0]
    expect(cell).toHaveProperty('row')
    expect(cell).toHaveProperty('col')
    expect(cell).toHaveProperty('type')
    expect(cell).toHaveProperty('number')
    expect(cell).toHaveProperty('solution')
  })

  it('cell type is "letter" or "blocked"', () => {
    for (const cell of makePuzzle().grid.cells) {
      expect(['letter', 'blocked']).toContain(cell.type)
    }
  })

  it('blocked cells have null solution and number', () => {
    const blockedCells = makePuzzle().grid.cells.filter((c) => c.type === 'blocked')
    for (const cell of blockedCells) {
      expect(cell.solution).toBeNull()
      expect(cell.number).toBeNull()
    }
  })
})
