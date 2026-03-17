/**
 * Book Domain Types
 *
 * Defines the structure of a Book — the assembled collection of puzzles
 * that the Book Generator produces and the Publishing Pipeline renders.
 *
 * The `bookType` discriminator supports future expansion to other puzzle
 * book formats (word search collections, sudoku books, etc.).
 */

import type { Puzzle, PuzzleType } from './puzzle.types'

// ---------------------------------------------------------------------------
// Book Identity
// ---------------------------------------------------------------------------

export type BookType = 'crossword-collection' // | 'word-search-collection' | etc.

// ---------------------------------------------------------------------------
// Render Targets
// ---------------------------------------------------------------------------

/**
 * Named render target IDs — correspond to JSON config files in
 * packages/book-generator/src/targets/
 */
export type PrintTargetId = 'kdp-6x9-bw' | 'kdp-8x10-bw'
export type ScreenTargetId = 'screen-pdf-tablet' | 'screen-pdf-mobile'
export type RenderTargetId = PrintTargetId | ScreenTargetId

export type OutputType = 'print' | 'screen' | 'epub' | 'web'
export type ColorMode = 'bw' | 'color'
export type LengthUnit = 'inches' | 'mm'

export interface PageDimensions {
  width: number
  height: number
  unit: LengthUnit
  bleed: number
}

export interface PageMargins {
  top: number
  bottom: number
  /** Inside (gutter) margin */
  inside: number
  /** Outside margin */
  outside: number
  unit: LengthUnit
}

export interface RenderTarget {
  id: RenderTargetId
  name: string
  outputType: OutputType
  dimensions: PageDimensions
  margins: PageMargins
  color: ColorMode
  /** DPI hint for raster elements — vector elements are resolution-independent */
  resolution: number
  cropMarks: boolean
  fonts: {
    embed: boolean
  }
}

// ---------------------------------------------------------------------------
// Layout & Design
// ---------------------------------------------------------------------------

/**
 * Design tokens for a book's visual style.
 * Intentionally minimal for MVP — slots are reserved for Phase 3 design controls.
 */
export interface TypographyConfig {
  /** Primary font family name (must be embedded) */
  fontFamily?: string
  /** Base font size in points */
  baseSizePt?: number
}

export interface GridStyle {
  /** Cell size in points */
  cellSizePt?: number
  /** Border weight in points */
  borderWeightPt?: number
  /** Hex color for blocked cells, e.g. '#000000' */
  blockedCellColor?: string
  /** Hex color for letter cell borders */
  borderColor?: string
}

export interface PageDecorations {
  /** Named decoration theme — resolved by the renderer */
  theme?: string | null
}

export interface LayoutConfig {
  /** Named layout template, resolved by IBookTemplate implementations */
  template: string
  typography: TypographyConfig
  gridStyle: GridStyle
  pageDecorations: PageDecorations
}

// ---------------------------------------------------------------------------
// Book Content
// ---------------------------------------------------------------------------

export interface CoverConfig {
  title: string
  subtitle: string
  author: string
  /** Named cover design template */
  designTemplate: string
}

export interface IntroConfig {
  enabled: boolean
  text: string
}

export interface ChapterConfig {
  id: string // UUID v4
  /** Null = no chapter break, puzzles flow continuously */
  title: string | null
  /** Optional creative writing intro for themed chapters */
  intro: string | null
  puzzleIds: string[]
}

export interface AnswerKeyConfig {
  enabled: boolean
  /** Where the answer key appears in the book */
  position: 'back' | 'after-each-puzzle'
}

export interface BookContent {
  cover: CoverConfig
  intro: IntroConfig
  chapters: ChapterConfig[]
  answerKey: AnswerKeyConfig
}

// ---------------------------------------------------------------------------
// Book Aggregate
// ---------------------------------------------------------------------------

export interface BookMetadata {
  title: string
  subtitle: string
  author: string
  edition: number
  theme: string | null
  createdAt: string // ISO-8601
}

/**
 * The root aggregate for a book.
 * Input to the Publishing Pipeline / renderers.
 */
export interface Book {
  schemaVersion: string
  id: string // UUID v4
  bookType: BookType
  puzzleType: PuzzleType
  metadata: BookMetadata
  renderTargets: {
    print: PrintTargetId
    screen: ScreenTargetId
  }
  layout: LayoutConfig
  content: BookContent
  /** Resolved puzzles — populated at render time from puzzleIds in chapters */
  puzzles: Puzzle[]
}

// ---------------------------------------------------------------------------
// Renderer Interface
// ---------------------------------------------------------------------------

export interface RenderOptions {
  target: RenderTarget
  template: string
}

/**
 * All renderers implement this interface.
 * Adding a new output format = new class implementing IRenderer.
 */
export interface IRenderer {
  readonly outputType: OutputType
  render(book: Book, options: RenderOptions): Promise<Buffer>
}

// ---------------------------------------------------------------------------
// Book Template Interface
// ---------------------------------------------------------------------------

/**
 * Book templates handle the page-level layout for a specific puzzle type.
 * Adding a new puzzle type requires a new IBookTemplate implementation.
 * The renderer orchestrates calling these methods in order.
 */
export interface IBookTemplate {
  readonly puzzleType: PuzzleType
  readonly templateName: string
  renderCover(book: Book, options: RenderOptions): void
  renderIntro(book: Book, options: RenderOptions): void
  renderPuzzlePage(puzzle: Puzzle, pageNumber: number, options: RenderOptions): void
  renderAnswerKey(puzzles: Puzzle[], options: RenderOptions, requestNewPage: RequestNewPageFn): void
}

// ---------------------------------------------------------------------------
// Page Layout Helpers
// ---------------------------------------------------------------------------

/**
 * Content area coordinates in PDF points.
 * Returned by getContentArea() and by RequestNewPageFn.
 */
export interface ContentArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Callback the renderer passes to templates when a section may span multiple pages.
 * When the template determines the current page is full, it calls this to get
 * the content area of the freshly-added next page.
 * The renderer owns page addition — the template drives layout only.
 */
export type RequestNewPageFn = () => ContentArea
