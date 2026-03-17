/**
 * @file crossword.functions.test.ts
 * @description Unit tests for the pure crossword grid-building functions.
 *
 * Each test group maps 1:1 to a function in crossword.functions.ts.
 * Tests are ordered to follow the pipeline: normalise → blank grid →
 * open cells → word starts → assign numbers → build clues → compose.
 *
 * No mocks, no async, no external dependencies.
 * If a test here fails, the problem is always in the pure function — nowhere else.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeCandidates,
  buildBlankCellMap,
  openWordCells,
  buildWordStartSets,
  assignClueNumbers,
  buildClueArrays,
  buildGrid,
  buildCrosswordGridAndClues,
} from '../crossword/crossword.functions'
import type { LibPlacedWord } from '../crossword/crossword.functions'
import {
  WORD_LIST_10,
  PLACED_APPLE,
  PLACED_CAT,
  PLACED_UNPLACED,
  LAYOUT_APPLE_CAT,
} from '@puzzle-book/test-fixtures'

// ---------------------------------------------------------------------------
// normalizeCandidates
// ---------------------------------------------------------------------------

describe('normalizeCandidates', () => {
  it('uppercases all answers', () => {
    const result = normalizeCandidates([{ word: 'apple', clue: 'fruit', difficulty: 'easy' }], 10)
    expect(result[0].answer).toBe('APPLE')
  })

  it('strips non-alpha characters from answers', () => {
    const result = normalizeCandidates([{ word: "rock'n'roll", clue: 'music', difficulty: 'easy' }], 10)
    expect(result[0].answer).toBe('ROCKNROLL')
  })

  it('trims whitespace from clues', () => {
    const result = normalizeCandidates([{ word: 'TREE', clue: '  a plant  ', difficulty: 'easy' }], 10)
    expect(result[0].clue).toBe('a plant')
  })

  it('filters out words shorter than 3 characters', () => {
    const entries = [
      { word: 'OK', clue: 'Fine', difficulty: 'easy' as const },
      { word: 'CAT', clue: 'A feline', difficulty: 'easy' as const },
    ]
    const result = normalizeCandidates(entries, 10)
    expect(result).toHaveLength(1)
    expect(result[0].answer).toBe('CAT')
  })

  it('filters out entries with missing clues', () => {
    const entries = [
      { word: 'TREE', clue: '', difficulty: 'easy' as const },
      { word: 'BIRD', clue: 'It flies', difficulty: 'easy' as const },
    ]
    const result = normalizeCandidates(entries, 10)
    expect(result).toHaveLength(1)
  })

  it('deduplicates by answer after normalisation', () => {
    const entries = [
      { word: 'APPLE', clue: 'red fruit', difficulty: 'easy' as const },
      { word: 'apple', clue: 'another clue', difficulty: 'easy' as const },
    ]
    const result = normalizeCandidates(entries, 10)
    expect(result).toHaveLength(1)
    expect(result[0].clue).toBe('red fruit') // keeps first occurrence
  })

  it('truncates to maxWords', () => {
    const result = normalizeCandidates(WORD_LIST_10, 5)
    expect(result).toHaveLength(5)
  })

  it('returns empty array for empty input', () => {
    expect(normalizeCandidates([], 10)).toEqual([])
  })

  it('filters entries where word becomes < 3 chars after stripping non-alpha', () => {
    const entries = [{ word: 'A-B', clue: 'dash word', difficulty: 'easy' as const }]
    const result = normalizeCandidates(entries, 10)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// buildBlankCellMap
// ---------------------------------------------------------------------------

describe('buildBlankCellMap', () => {
  it('creates width × height cells', () => {
    const map = buildBlankCellMap(5, 3)
    expect(map.size).toBe(15)
  })

  it('every cell is initialised as blocked', () => {
    const map = buildBlankCellMap(3, 3)
    for (const cell of map.values()) {
      expect(cell.type).toBe('blocked')
    }
  })

  it('every cell has null number and solution', () => {
    const map = buildBlankCellMap(3, 3)
    for (const cell of map.values()) {
      expect(cell.number).toBeNull()
      expect(cell.solution).toBeNull()
    }
  })

  it('cells are keyed as "row,col"', () => {
    const map = buildBlankCellMap(2, 2)
    expect(map.has('0,0')).toBe(true)
    expect(map.has('0,1')).toBe(true)
    expect(map.has('1,0')).toBe(true)
    expect(map.has('1,1')).toBe(true)
  })

  it('cell coordinates match their key', () => {
    const map = buildBlankCellMap(4, 3)
    const cell = map.get('2,3')!
    expect(cell.row).toBe(2)
    expect(cell.col).toBe(3)
  })

  it('does not mutate on repeated calls (referential independence)', () => {
    const a = buildBlankCellMap(3, 3)
    const b = buildBlankCellMap(3, 3)
    expect(a).not.toBe(b)
  })
})

// ---------------------------------------------------------------------------
// openWordCells
// ---------------------------------------------------------------------------

describe('openWordCells', () => {
  it('does not mutate the input map', () => {
    const blank = buildBlankCellMap(5, 3)
    const before = blank.size
    openWordCells(blank, [PLACED_APPLE])
    expect(blank.size).toBe(before)
    expect(blank.get('0,0')?.type).toBe('blocked') // unchanged
  })

  it('opens cells for an across word', () => {
    const blank = buildBlankCellMap(5, 1)
    const result = openWordCells(blank, [PLACED_APPLE])

    for (let col = 0; col < 5; col++) {
      expect(result.get(`0,${col}`)?.type).toBe('letter')
    }
  })

  it('sets correct solution letters for across word', () => {
    const blank = buildBlankCellMap(5, 1)
    const result = openWordCells(blank, [PLACED_APPLE])

    expect(result.get('0,0')?.solution).toBe('A')
    expect(result.get('0,1')?.solution).toBe('P')
    expect(result.get('0,2')?.solution).toBe('P')
    expect(result.get('0,3')?.solution).toBe('L')
    expect(result.get('0,4')?.solution).toBe('E')
  })

  it('opens cells for a down word', () => {
    const blank = buildBlankCellMap(1, 3)
    const result = openWordCells(blank, [PLACED_CAT])

    expect(result.get('0,0')?.type).toBe('letter')
    expect(result.get('1,0')?.type).toBe('letter')
    expect(result.get('2,0')?.type).toBe('letter')
  })

  it('sets correct solution letters for down word', () => {
    const blank = buildBlankCellMap(1, 3)
    const result = openWordCells(blank, [PLACED_CAT])

    expect(result.get('0,0')?.solution).toBe('C')
    expect(result.get('1,0')?.solution).toBe('A')
    expect(result.get('2,0')?.solution).toBe('T')
  })

  it('converts 1-based library coordinates to 0-based', () => {
    // PLACED_APPLE has startx=1, starty=1 (1-based) → row=0, col=0 (0-based)
    const blank = buildBlankCellMap(5, 3)
    const result = openWordCells(blank, [PLACED_APPLE])
    expect(result.get('0,0')?.solution).toBe('A')
  })

  it('handles overlapping cells from two words (intersection)', () => {
    const blank = buildBlankCellMap(5, 3)
    const result = openWordCells(blank, [PLACED_APPLE, PLACED_CAT])
    // Cell (0,0) is shared — last writer wins (CAT's 'C' overwrites APPLE's 'A')
    // In a valid crossword both should be the same letter; this tests the merge behaviour
    const sharedCell = result.get('0,0')
    expect(sharedCell?.type).toBe('letter')
    expect(sharedCell?.solution).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// buildWordStartSets
// ---------------------------------------------------------------------------

describe('buildWordStartSets', () => {
  it('places across word start in acrossStarts', () => {
    const { acrossStarts } = buildWordStartSets([PLACED_APPLE])
    expect(acrossStarts.has('0,0')).toBe(true)
  })

  it('places down word start in downStarts', () => {
    const { downStarts } = buildWordStartSets([PLACED_CAT])
    expect(downStarts.has('0,0')).toBe(true)
  })

  it('excludes unplaced words (orientation = none)', () => {
    const { acrossStarts, downStarts } = buildWordStartSets([PLACED_UNPLACED])
    expect(acrossStarts.size).toBe(0)
    expect(downStarts.size).toBe(0)
  })

  it('returns empty sets for empty input', () => {
    const { acrossStarts, downStarts } = buildWordStartSets([])
    expect(acrossStarts.size).toBe(0)
    expect(downStarts.size).toBe(0)
  })

  it('converts 1-based coords to 0-based in sets', () => {
    // PLACED_APPLE: startx=1, starty=1 → key should be "0,0"
    const { acrossStarts } = buildWordStartSets([PLACED_APPLE])
    expect(acrossStarts.has('0,0')).toBe(true)
    expect(acrossStarts.has('1,1')).toBe(false)
  })

  it('a cell starting both across and down appears in both sets', () => {
    const { acrossStarts, downStarts } = buildWordStartSets([PLACED_APPLE, PLACED_CAT])
    expect(acrossStarts.has('0,0')).toBe(true)
    expect(downStarts.has('0,0')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// assignClueNumbers
// ---------------------------------------------------------------------------

describe('assignClueNumbers', () => {
  it('does not mutate the input cell map', () => {
    const blank = buildBlankCellMap(5, 3)
    const open = openWordCells(blank, [PLACED_APPLE, PLACED_CAT])
    const before = new Map(open)
    const { acrossStarts, downStarts } = buildWordStartSets([PLACED_APPLE, PLACED_CAT])
    assignClueNumbers(open, acrossStarts, downStarts, 5, 3)
    expect(open.get('0,0')?.number).toBeNull() // original unchanged
    expect(before.size).toBe(open.size)
  })

  it('assigns number 1 to the first start cell in reading order', () => {
    const blank = buildBlankCellMap(5, 3)
    const open = openWordCells(blank, [PLACED_APPLE, PLACED_CAT])
    const { acrossStarts, downStarts } = buildWordStartSets([PLACED_APPLE, PLACED_CAT])
    const { numberMap } = assignClueNumbers(open, acrossStarts, downStarts, 5, 3)
    expect(numberMap.get('0,0')).toBe(1)
  })

  it('assigns ascending numbers in left-to-right, top-to-bottom order', () => {
    // Two across words on different rows — first row gets lower numbers
    const word1: LibPlacedWord = { answer: 'CAT', clue: 'feline', orientation: 'across', startx: 1, starty: 1, position: 1 }
    const word2: LibPlacedWord = { answer: 'DOG', clue: 'canine', orientation: 'across', startx: 1, starty: 3, position: 2 }
    const blank = buildBlankCellMap(5, 3)
    const open = openWordCells(blank, [word1, word2])
    const { acrossStarts, downStarts } = buildWordStartSets([word1, word2])
    const { numberMap } = assignClueNumbers(open, acrossStarts, downStarts, 5, 3)
    expect(numberMap.get('0,0')).toBe(1) // CAT
    expect(numberMap.get('2,0')).toBe(2) // DOG
  })

  it('sets number on the cell in the returned numberedCellMap', () => {
    const blank = buildBlankCellMap(5, 3)
    const open = openWordCells(blank, [PLACED_APPLE, PLACED_CAT])
    const { acrossStarts, downStarts } = buildWordStartSets([PLACED_APPLE, PLACED_CAT])
    const { numberedCellMap } = assignClueNumbers(open, acrossStarts, downStarts, 5, 3)
    expect(numberedCellMap.get('0,0')?.number).toBe(1)
  })

  it('non-start cells have no number assigned', () => {
    const blank = buildBlankCellMap(5, 1)
    const open = openWordCells(blank, [PLACED_APPLE])
    const { acrossStarts, downStarts } = buildWordStartSets([PLACED_APPLE])
    const { numberedCellMap } = assignClueNumbers(open, acrossStarts, downStarts, 5, 1)
    // Only cell (0,0) is a word start — others are mid-word
    expect(numberedCellMap.get('0,1')?.number).toBeNull()
    expect(numberedCellMap.get('0,4')?.number).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildClueArrays
// ---------------------------------------------------------------------------

describe('buildClueArrays', () => {
  const setupNumberMap = () => {
    const blank = buildBlankCellMap(5, 3)
    const open = openWordCells(blank, [PLACED_APPLE, PLACED_CAT])
    const { acrossStarts, downStarts } = buildWordStartSets([PLACED_APPLE, PLACED_CAT])
    const { numberMap } = assignClueNumbers(open, acrossStarts, downStarts, 5, 3)
    return numberMap
  }

  it('produces an across entry for each across word', () => {
    const numberMap = setupNumberMap()
    const { across } = buildClueArrays([PLACED_APPLE, PLACED_CAT], numberMap)
    expect(across).toHaveLength(1)
    expect(across[0].answer).toBe('APPLE')
  })

  it('produces a down entry for each down word', () => {
    const numberMap = setupNumberMap()
    const { down } = buildClueArrays([PLACED_APPLE, PLACED_CAT], numberMap)
    expect(down).toHaveLength(1)
    expect(down[0].answer).toBe('CAT')
  })

  it('across clues are sorted by number ascending', () => {
    const word1: LibPlacedWord = { answer: 'ZAP', clue: 'c1', orientation: 'across', startx: 3, starty: 1, position: 1 }
    const word2: LibPlacedWord = { answer: 'CAT', clue: 'c2', orientation: 'across', startx: 1, starty: 1, position: 2 }
    const blank = buildBlankCellMap(6, 1)
    const open = openWordCells(blank, [word1, word2])
    const { acrossStarts, downStarts } = buildWordStartSets([word1, word2])
    const { numberMap } = assignClueNumbers(open, acrossStarts, downStarts, 6, 1)
    const { across } = buildClueArrays([word1, word2], numberMap)
    expect(across[0].number).toBeLessThan(across[1].number)
  })

  it('clue has correct length field', () => {
    const numberMap = setupNumberMap()
    const { across } = buildClueArrays([PLACED_APPLE, PLACED_CAT], numberMap)
    expect(across[0].length).toBe(5) // APPLE
  })

  it('clue preserves startRow and startCol (0-based)', () => {
    const numberMap = setupNumberMap()
    const { across } = buildClueArrays([PLACED_APPLE, PLACED_CAT], numberMap)
    expect(across[0].startRow).toBe(0)
    expect(across[0].startCol).toBe(0)
  })

  it('excludes unplaced words', () => {
    const numberMap = setupNumberMap()
    const { across, down } = buildClueArrays([PLACED_UNPLACED], numberMap)
    expect(across).toHaveLength(0)
    expect(down).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// buildGrid
// ---------------------------------------------------------------------------

describe('buildGrid', () => {
  it('sets width and height from arguments', () => {
    const map = buildBlankCellMap(7, 4)
    const grid = buildGrid(map, 7, 4)
    expect(grid.width).toBe(7)
    expect(grid.height).toBe(4)
  })

  it('cells array length equals width × height', () => {
    const map = buildBlankCellMap(5, 3)
    const grid = buildGrid(map, 5, 3)
    expect(grid.cells).toHaveLength(15)
  })

  it('cells array contains all entries from the map', () => {
    const map = buildBlankCellMap(2, 2)
    const grid = buildGrid(map, 2, 2)
    const keys = grid.cells.map((c) => `${c.row},${c.col}`)
    expect(keys).toContain('0,0')
    expect(keys).toContain('0,1')
    expect(keys).toContain('1,0')
    expect(keys).toContain('1,1')
  })
})

// ---------------------------------------------------------------------------
// buildCrosswordGridAndClues — composition test
// ---------------------------------------------------------------------------

describe('buildCrosswordGridAndClues', () => {
  it('returns a grid with correct dimensions', () => {
    const placedWords = LAYOUT_APPLE_CAT.result.filter((w) => w.orientation !== 'none')
    const { grid } = buildCrosswordGridAndClues(placedWords, LAYOUT_APPLE_CAT)
    expect(grid.width).toBe(5)
    expect(grid.height).toBe(3)
  })

  it('returns across and down clue arrays', () => {
    const placedWords = LAYOUT_APPLE_CAT.result.filter((w) => w.orientation !== 'none')
    const { clues } = buildCrosswordGridAndClues(placedWords, LAYOUT_APPLE_CAT)
    expect(clues.across.length).toBeGreaterThan(0)
    expect(clues.down.length).toBeGreaterThan(0)
  })

  it('all clue numbers reference a numbered cell in the grid', () => {
    const placedWords = LAYOUT_APPLE_CAT.result.filter((w) => w.orientation !== 'none')
    const { grid, clues } = buildCrosswordGridAndClues(placedWords, LAYOUT_APPLE_CAT)

    const numberedCells = new Set(
      grid.cells.filter((c) => c.number !== null).map((c) => c.number)
    )

    for (const clue of [...clues.across, ...clues.down]) {
      expect(numberedCells.has(clue.number)).toBe(true)
    }
  })

  it('grid has the correct number of letter cells', () => {
    const placedWords = LAYOUT_APPLE_CAT.result.filter((w) => w.orientation !== 'none')
    const { grid } = buildCrosswordGridAndClues(placedWords, LAYOUT_APPLE_CAT)
    const letterCells = grid.cells.filter((c) => c.type === 'letter')
    // APPLE (5 cells) + CAT (3 cells) - 1 shared = 7 letter cells
    expect(letterCells.length).toBe(7)
  })

  it('all letter cells have a non-null solution', () => {
    const placedWords = LAYOUT_APPLE_CAT.result.filter((w) => w.orientation !== 'none')
    const { grid } = buildCrosswordGridAndClues(placedWords, LAYOUT_APPLE_CAT)
    const letterCells = grid.cells.filter((c) => c.type === 'letter')
    for (const cell of letterCells) {
      expect(cell.solution).toBeTruthy()
    }
  })
})
