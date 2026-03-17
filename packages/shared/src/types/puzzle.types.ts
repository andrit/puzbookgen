/**
 * Puzzle Domain Types
 *
 * This is the canonical schema contract between the Puzzle Generator
 * and the Book Generator. Both systems communicate exclusively through
 * these types — neither knows the internals of the other.
 *
 * The `puzzleType` discriminator field is the extensibility hook for
 * future puzzle types (word search, sudoku, hangman, etc.).
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type PuzzleType = 'crossword' // | 'word-search' | 'sudoku' | 'hangman' — extend here

export type Difficulty = 'easy' | 'medium' | 'hard'

export type Direction = 'across' | 'down'

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export type CellType = 'letter' | 'blocked'

export interface Cell {
  row: number
  col: number
  type: CellType
  /** Clue number displayed in this cell, if any */
  number: number | null
  /** The correct letter for this cell. Null for blocked cells. */
  solution: string | null
}

export interface Grid {
  width: number
  height: number
  cells: Cell[]
}

// ---------------------------------------------------------------------------
// Clues
// ---------------------------------------------------------------------------

export interface Clue {
  number: number
  clue: string
  answer: string
  startRow: number
  startCol: number
  length: number
  direction: Direction
}

export interface ClueSet {
  across: Clue[]
  down: Clue[]
}

// ---------------------------------------------------------------------------
// Puzzle Metadata
// ---------------------------------------------------------------------------

export interface PuzzleMetadata {
  title: string
  /** Null for arbitrary/unthemed puzzles */
  theme: string | null
  difficulty: Difficulty
  /** Creator name, if provided */
  author: string | null
  createdAt: string // ISO-8601
  wordCount: number
  gridWidth: number
  gridHeight: number
}

// ---------------------------------------------------------------------------
// Puzzle Aggregate
// ---------------------------------------------------------------------------

/**
 * The root aggregate for a single puzzle.
 * This is the output of the Puzzle Generator and the input to the Book Generator.
 */
export interface Puzzle {
  schemaVersion: string
  id: string // UUID v4
  puzzleType: PuzzleType
  metadata: PuzzleMetadata
  grid: Grid
  clues: ClueSet
}

// ---------------------------------------------------------------------------
// Generator I/O Types
// ---------------------------------------------------------------------------

export interface WordListEntry {
  word: string
  clue: string
  difficulty?: Difficulty
  theme?: string | null
}

export interface GeneratorOptions {
  gridWidth?: number // default: 15
  gridHeight?: number // default: 15
  minWords?: number // default: 12
  maxWords?: number // default: 30
  difficulty?: Difficulty
  theme?: string | null
  title?: string
  author?: string | null
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Generator Interface
// ---------------------------------------------------------------------------

/**
 * All puzzle generators implement this interface.
 * Adding a new puzzle type = new class implementing IPuzzleGenerator.
 * The pipeline does not change.
 */
export interface IPuzzleGenerator {
  readonly puzzleType: PuzzleType
  generate(wordList: WordListEntry[], options?: GeneratorOptions): Promise<Puzzle>
  validate(puzzle: Puzzle): ValidationResult
}
