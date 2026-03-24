/**
 * @file crossword.functions.ts
 * @description Pure functions for crossword grid construction and clue numbering.
 *
 * These functions are intentionally stateless and side-effect-free.
 * Each transforms one data structure into another without mutation.
 * This makes them trivially testable and composable.
 *
 * The CrosswordGenerator class orchestrates these functions but contains
 * no grid logic itself — following Single Responsibility Principle.
 *
 * @module puzzle-generator/crossword
 */

import type { Cell, Clue, ClueSet, Grid, WordListEntry } from '@puzzle-book/shared'

// ---------------------------------------------------------------------------
// Library adapter types
// The crossword-layout-generator library has no TypeScript types, so we
// define a minimal adapter interface here. If the library is replaced
// (Phase 3 custom algorithm), only this file changes.
// ---------------------------------------------------------------------------

/** A word/clue pair as expected by the layout library */
export interface LibInputWord {
  answer: string
  clue: string
}

/** A word as returned by the layout library after placement */
export interface LibPlacedWord {
  answer: string
  clue: string
  orientation: 'across' | 'down' | 'none'
  startx: number // 1-based column
  starty: number // 1-based row
  position: number
}

/** Top-level result from the layout library */
export interface LibLayoutResult {
  result: LibPlacedWord[]
  rows: number
  cols: number
}

/** A cell key in `"row,col"` format */
type CellKey = string

const toCellKey = (row: number, col: number): CellKey => `${row},${col}`

// ---------------------------------------------------------------------------
// Step 1 — Normalise and filter the input word list
// ---------------------------------------------------------------------------

/**
 * Filters a raw WordListEntry array into clean LibInputWord candidates.
 *
 * - Removes entries missing a word or clue
 * - Uppercases and strips non-alpha characters from answers
 * - Removes answers shorter than 3 characters after stripping
 * - Deduplicates by answer
 * - Truncates to maxWords
 *
 * @pure
 */
export const normalizeCandidates = (
  entries: WordListEntry[],
  maxWords: number
): LibInputWord[] =>
  entries
    .filter((e) => e.word?.length >= 3 && e.clue?.length > 0)
    .map((e) => ({
      answer: e.word.toUpperCase().replace(/[^A-Z]/g, ''),
      clue: e.clue.trim(),
    }))
    .filter((e) => e.answer.length >= 3)
    .filter((e, i, arr) => arr.findIndex((x) => x.answer === e.answer) === i)
    .slice(0, maxWords)

// ---------------------------------------------------------------------------
// Step 2 — Initialise a blank grid of blocked cells
// ---------------------------------------------------------------------------

/**
 * Creates a Map of all cells in the grid, all initialised as blocked.
 * Subsequent steps open cells by overwriting entries in this map.
 *
 * Using a Map<CellKey, Cell> gives O(1) lookup by coordinate, which
 * the renderer and validator both rely on.
 *
 * @pure
 */
export const buildBlankCellMap = (width: number, height: number): Map<CellKey, Cell> => {
  const cellMap = new Map<CellKey, Cell>()
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      cellMap.set(toCellKey(row, col), { row, col, type: 'blocked', number: null, solution: null })
    }
  }
  return cellMap
}

// ---------------------------------------------------------------------------
// Step 3 — Open letter cells for all placed words
// ---------------------------------------------------------------------------

/**
 * Returns a new Map with each letter cell opened for every placed word.
 * Does not mutate the input map.
 *
 * Converts library's 1-based coordinates to 0-based internally.
 *
 * @pure
 */
export const openWordCells = (
  blankMap: Map<CellKey, Cell>,
  placedWords: LibPlacedWord[]
): Map<CellKey, Cell> => {
  const cellMap = new Map(blankMap)

  for (const word of placedWords) {
    const startRow = word.starty - 1
    const startCol = word.startx - 1

    for (let i = 0; i < word.answer.length; i++) {
      const row = word.orientation === 'down' ? startRow + i : startRow
      const col = word.orientation === 'across' ? startCol + i : startCol
      const key = toCellKey(row, col)
      cellMap.set(key, { row, col, type: 'letter', number: null, solution: word.answer[i] })
    }
  }

  return cellMap
}

// ---------------------------------------------------------------------------
// Step 4 — Build word-start coordinate sets for numbering
// ---------------------------------------------------------------------------

/**
 * Returns two Sets of cell keys — one for across-word starts, one for down.
 * Used by `assignClueNumbers` to determine which cells receive a number.
 *
 * @pure
 */
export const buildWordStartSets = (
  placedWords: LibPlacedWord[]
): { acrossStarts: Set<CellKey>; downStarts: Set<CellKey> } => ({
  acrossStarts: new Set(
    placedWords
      .filter((w) => w.orientation === 'across')
      .map((w) => toCellKey(w.starty - 1, w.startx - 1))
  ),
  downStarts: new Set(
    placedWords
      .filter((w) => w.orientation === 'down')
      .map((w) => toCellKey(w.starty - 1, w.startx - 1))
  ),
})

// ---------------------------------------------------------------------------
// Step 5 — Assign clue numbers in reading order
// ---------------------------------------------------------------------------

/**
 * Assigns standard American crossword numbering to cells.
 * Cells receive a number if they start an across or down word.
 * Numbers are assigned left-to-right, top-to-bottom (reading order).
 *
 * Returns:
 * - `numberedCellMap` — updated cell map with `number` fields set
 * - `numberMap` — coordinate key → clue number, used to build clue arrays
 *
 * @pure — returns new Map instances, does not mutate inputs
 */
export const assignClueNumbers = (
  cellMap: Map<CellKey, Cell>,
  acrossStarts: Set<CellKey>,
  downStarts: Set<CellKey>,
  width: number,
  height: number
): { numberedCellMap: Map<CellKey, Cell>; numberMap: Map<CellKey, number> } => {
  const numberedCellMap = new Map(cellMap)
  const numberMap = new Map<CellKey, number>()
  let clueNumber = 1

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const key = toCellKey(row, col)
      if (acrossStarts.has(key) || downStarts.has(key)) {
        numberMap.set(key, clueNumber)
        const cell = numberedCellMap.get(key)!
        numberedCellMap.set(key, { ...cell, number: clueNumber })
        clueNumber++
      }
    }
  }

  return { numberedCellMap, numberMap }
}

// ---------------------------------------------------------------------------
// Step 6 — Build sorted clue arrays
// ---------------------------------------------------------------------------

/**
 * Builds the across and down Clue arrays from placed words and the number map.
 * Each array is sorted by clue number ascending.
 *
 * @pure
 */
export const buildClueArrays = (
  placedWords: LibPlacedWord[],
  numberMap: Map<CellKey, number>
): ClueSet => {
  const makeClue = (w: LibPlacedWord, direction: 'across' | 'down'): Clue => ({
    number: numberMap.get(toCellKey(w.starty - 1, w.startx - 1))!,
    clue: w.clue,
    answer: w.answer,
    startRow: w.starty - 1,
    startCol: w.startx - 1,
    length: w.answer.length,
    direction,
  })

  const byNumber = (a: Clue, b: Clue) => a.number - b.number

  return {
    across: placedWords
      .filter((w) => w.orientation === 'across')
      .map((w) => makeClue(w, 'across'))
      .sort(byNumber),
    down: placedWords
      .filter((w) => w.orientation === 'down')
      .map((w) => makeClue(w, 'down'))
      .sort(byNumber),
  }
}

// ---------------------------------------------------------------------------
// Step 7 — Assemble the final Grid value object
// ---------------------------------------------------------------------------

/**
 * Assembles a Grid from a numbered cell map and dimensions.
 *
 * @pure
 */
export const buildGrid = (
  numberedCellMap: Map<CellKey, Cell>,
  width: number,
  height: number
): Grid => ({
  width,
  height,
  cells: Array.from(numberedCellMap.values()),
})


// ---------------------------------------------------------------------------
// Step 7b — Trim empty border rows and columns
// ---------------------------------------------------------------------------

/**
 * Removes all-blocked rows and columns from the edges of the grid.
 *
 * The layout library returns a bounding-box grid padded with empty rows/cols
 * around the placed words. This produces large black borders in the rendered
 * output. Trimming reduces the grid to the tightest bounding box of letter cells.
 *
 * Returns a new cell map and the trimmed dimensions. Does not mutate inputs.
 *
 * @pure
 */
export const trimGrid = (
  cellMap: Map<CellKey, Cell>,
  width: number,
  height: number
): { trimmedMap: Map<CellKey, Cell>; trimmedWidth: number; trimmedHeight: number } => {
  // Find the bounding box of all letter cells
  let minRow = height, maxRow = 0, minCol = width, maxCol = 0

  for (const cell of cellMap.values()) {
    if (cell.type === 'letter') {
      minRow = Math.min(minRow, cell.row)
      maxRow = Math.max(maxRow, cell.row)
      minCol = Math.min(minCol, cell.col)
      maxCol = Math.max(maxCol, cell.col)
    }
  }

  // If no letter cells found, return original unchanged
  if (minRow > maxRow || minCol > maxCol) {
    return { trimmedMap: cellMap, trimmedWidth: width, trimmedHeight: height }
  }

  const trimmedWidth = maxCol - minCol + 1
  const trimmedHeight = maxRow - minRow + 1
  const trimmedMap = new Map<CellKey, Cell>()

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell = cellMap.get(`${row},${col}`)
      const newRow = row - minRow
      const newCol = col - minCol
      const newKey = `${newRow},${newCol}`

      if (cell) {
        trimmedMap.set(newKey, { ...cell, row: newRow, col: newCol })
      } else {
        trimmedMap.set(newKey, { row: newRow, col: newCol, type: 'blocked', number: null, solution: null })
      }
    }
  }

  return { trimmedMap, trimmedWidth, trimmedHeight }
}

// ---------------------------------------------------------------------------
// Composition — full pipeline as a single pure function
// ---------------------------------------------------------------------------

/**
 * Composes all grid-building steps into a single transformation.
 * This is the function the CrosswordGenerator class calls after
 * receiving the raw library output.
 *
 * Separating this from the class makes it independently testable
 * and reusable if we ever need to build grids outside the generator context.
 *
 * @pure
 */
export const buildCrosswordGridAndClues = (
  placedWords: LibPlacedWord[],
  layout: LibLayoutResult
): { grid: Grid; clues: ClueSet } => {
  const { cols: width, rows: height } = layout
  const { acrossStarts, downStarts } = buildWordStartSets(placedWords)

  const blankMap = buildBlankCellMap(width, height)
  const openMap = openWordCells(blankMap, placedWords)
  const { numberedCellMap, numberMap } = assignClueNumbers(
    openMap,
    acrossStarts,
    downStarts,
    width,
    height
  )

  // Trim empty border rows/columns produced by the layout library
  const { trimmedMap, trimmedWidth, trimmedHeight } = trimGrid(numberedCellMap, width, height)

  return {
    grid: buildGrid(trimmedMap, trimmedWidth, trimmedHeight),
    clues: buildClueArrays(placedWords, numberMap),
  }
}
