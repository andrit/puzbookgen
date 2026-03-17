/**
 * @file fixtures.ts
 * @description Shared test fixtures for the puzzle-book-generator test suite.
 *
 * All test data lives here so individual test files stay focused on behaviour,
 * not on constructing data. Factory functions are preferred over static objects
 * so tests can make targeted overrides via spread without coupling to shape.
 *
 * Convention:
 *   make*    — factory function returning a minimal valid instance
 *   FIXTURE_* — small static constants for readability in assertions
 */

import type {
  WordListEntry,
  Puzzle,
  Cell,
  Clue,
  Grid,
} from '../types/puzzle.types'
// LibPlacedWord and LibLayoutResult redefined here to avoid cross-package imports in fixtures
// These must stay in sync with crossword.functions.ts
interface LibPlacedWord {
  answer: string
  clue: string
  orientation: 'across' | 'down' | 'none'
  startx: number
  starty: number
  position: number
}

interface LibLayoutResult {
  result: LibPlacedWord[]
  rows: number
  cols: number
}

// ---------------------------------------------------------------------------
// WordListEntry fixtures
// ---------------------------------------------------------------------------

/** Minimal valid word list entry */
export const makeWordEntry = (overrides: Partial<WordListEntry> = {}): WordListEntry => ({
  word: 'APPLE',
  clue: 'A red fruit',
  difficulty: 'easy',
  ...overrides,
})

/** A list of 10 distinct, valid word/clue pairs — enough for most generation tests */
export const WORD_LIST_10: WordListEntry[] = [
  { word: 'APPLE',   clue: 'A red fruit',            difficulty: 'easy'   },
  { word: 'BRIDGE',  clue: 'Spans a river',           difficulty: 'medium' },
  { word: 'CANDLE',  clue: 'Provides wax light',      difficulty: 'easy'   },
  { word: 'DESERT',  clue: 'Arid landscape',          difficulty: 'easy'   },
  { word: 'EAGLE',   clue: 'Bird of prey',            difficulty: 'easy'   },
  { word: 'FALCON',  clue: 'Fast raptor',             difficulty: 'medium' },
  { word: 'GARDEN',  clue: 'Where plants grow',       difficulty: 'easy'   },
  { word: 'HARBOR',  clue: 'Sheltered water for ships', difficulty: 'medium' },
  { word: 'ISLAND',  clue: 'Land surrounded by water', difficulty: 'easy'   },
  { word: 'JUNGLE',  clue: 'Dense tropical forest',   difficulty: 'easy'   },
]

/** A word list that is too short to generate a valid puzzle (below minWords=8) */
export const WORD_LIST_TOO_SHORT: WordListEntry[] = [
  { word: 'CAT', clue: 'A feline pet', difficulty: 'easy' },
  { word: 'DOG', clue: 'A canine pet', difficulty: 'easy' },
]

// ---------------------------------------------------------------------------
// LibPlacedWord / LibLayoutResult fixtures
// Represents what the layout library returns for a tiny 2-word grid.
//
// Layout (0-based coords after conversion):
//   Row 0: A P P L E
//   Row 0: A (col 0) — shared cell for CAT (down)
//   Row 1: A
//   Row 2: T
//
//   APPLE: across, starts row=0, col=0  (library: starty=1, startx=1)
//   CAT:   down,   starts row=0, col=0  (library: starty=1, startx=1)
// ---------------------------------------------------------------------------

export const PLACED_APPLE: LibPlacedWord = {
  answer: 'APPLE',
  clue: 'A red fruit',
  orientation: 'across',
  startx: 1,  // 1-based
  starty: 1,
  position: 1,
}

export const PLACED_CAT: LibPlacedWord = {
  answer: 'CAT',
  clue: 'A feline pet',
  orientation: 'down',
  startx: 1,  // shares col 0 with APPLE
  starty: 1,
  position: 2,
}

export const PLACED_UNPLACED: LibPlacedWord = {
  answer: 'NOPE',
  clue: 'Should be filtered',
  orientation: 'none',
  startx: 0,
  starty: 0,
  position: 3,
}

/** A minimal valid LibLayoutResult with APPLE (across) and CAT (down) intersecting */
export const LAYOUT_APPLE_CAT: LibLayoutResult = {
  result: [PLACED_APPLE, PLACED_CAT, PLACED_UNPLACED],
  rows: 3,
  cols: 5,
}

// ---------------------------------------------------------------------------
// Cell fixtures
// ---------------------------------------------------------------------------

export const makeBlockedCell = (row: number, col: number): Cell => ({
  row,
  col,
  type: 'blocked',
  number: null,
  solution: null,
})

export const makeLetterCell = (
  row: number,
  col: number,
  solution: string,
  number: number | null = null
): Cell => ({
  row,
  col,
  type: 'letter',
  number,
  solution,
})

// ---------------------------------------------------------------------------
// Grid fixtures
// ---------------------------------------------------------------------------

/** 3×5 grid matching LAYOUT_APPLE_CAT */
export const makeMinimalGrid = (): Grid => ({
  width: 5,
  height: 3,
  cells: [
    // Row 0: APPLE across; CAT starts here (col 0)
    makeLetterCell(0, 0, 'A', 1),
    makeLetterCell(0, 1, 'P'),
    makeLetterCell(0, 2, 'P'),
    makeLetterCell(0, 3, 'L'),
    makeLetterCell(0, 4, 'E'),
    // Row 1: CAT continues (col 0)
    makeLetterCell(1, 0, 'A'),
    makeBlockedCell(1, 1),
    makeBlockedCell(1, 2),
    makeBlockedCell(1, 3),
    makeBlockedCell(1, 4),
    // Row 2: CAT ends (col 0)
    makeLetterCell(2, 0, 'T'),
    makeBlockedCell(2, 1),
    makeBlockedCell(2, 2),
    makeBlockedCell(2, 3),
    makeBlockedCell(2, 4),
  ],
})

// ---------------------------------------------------------------------------
// Puzzle fixtures
// ---------------------------------------------------------------------------

/** Factory for a minimal valid Puzzle aggregate */
export const makePuzzle = (overrides: Partial<Puzzle> = {}): Puzzle => ({
  schemaVersion: '1.0.0',
  id: 'test-puzzle-id-001',
  puzzleType: 'crossword',
  metadata: {
    title: 'Test Puzzle',
    theme: null,
    difficulty: 'medium',
    author: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    wordCount: 2,
    gridWidth: 5,
    gridHeight: 3,
  },
  grid: makeMinimalGrid(),
  clues: {
    across: [
      {
        number: 1,
        clue: 'A red fruit',
        answer: 'APPLE',
        startRow: 0,
        startCol: 0,
        length: 5,
        direction: 'across',
      },
    ],
    down: [
      {
        number: 1,
        clue: 'A feline pet',
        answer: 'CAT',
        startRow: 0,
        startCol: 0,
        length: 3,
        direction: 'down',
      },
    ],
  },
  ...overrides,
})
