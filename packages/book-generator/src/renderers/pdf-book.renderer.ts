/**
 * @file pdf-book.renderer.ts
 * @description Unified PDF renderer for both print and screen output types.
 *
 * Previously two near-identical classes (PrintRenderer, ScreenRenderer) existed
 * in violation of DRY. This single renderer accepts `outputType` at construction
 * time. The only behavioural difference between print and screen comes from the
 * RenderTarget config (bleed, crop marks, margins) — not from renderer logic.
 *
 * Factory functions `createPrintRenderer` and `createScreenRenderer` preserve
 * the original public API for callers.
 *
 * @module book-generator/renderers
 */

import type { Book, IRenderer, RenderOptions, OutputType, Puzzle } from '@puzzle-book/shared'
import { BasePdfRenderer } from './base-pdf.renderer'
import { CrosswordTemplate } from '../templates/crossword/crossword.template'

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

/**
 * Resolves the correct IBookTemplate implementation for a given puzzle type
 * and template name. Adding a new puzzle type = add an entry here.
 *
 * @param puzzleType - The puzzle type discriminator from the Book aggregate
 * @returns A configured template instance ready to receive a PDFKit document
 */
const resolveTemplate = (puzzleType: string, coverId?: string): CrosswordTemplate => {
  const registry: Record<string, () => CrosswordTemplate> = {
    crossword: () => new CrosswordTemplate(),
  }

  const factory = registry[puzzleType]
  if (!factory) {
    throw new Error(
      `No template registered for puzzle type "${puzzleType}". ` +
        `Register one in resolveTemplate() in pdf-book.renderer.ts`
    )
  }
  const template = factory()
  if (coverId) template.setCoverId(coverId)
  return template
}

// ---------------------------------------------------------------------------
// Page sequencing — pure function, no renderer state
// ---------------------------------------------------------------------------

/**
 * Iterates over a Book's chapter structure and yields each puzzle
 * in reading order with its 1-based display number.
 *
 * Pure function: does not mutate the book or renderer state.
 *
 * @param book - The assembled Book aggregate
 * @yields `{ puzzle, pageNumber }` for each resolvable puzzle
 */
function* iteratePuzzles(
  book: Book
): Generator<{ puzzle: (typeof book.puzzles)[number]; pageNumber: number }> {
  let pageNumber = 1
  for (const chapter of book.content.chapters) {
    for (const puzzleId of chapter.puzzleIds) {
      const puzzle = book.puzzles.find((p: Puzzle) => p.id === puzzleId)
      if (puzzle) {
        yield { puzzle, pageNumber }
        pageNumber++
      }
    }
  }
}

// ---------------------------------------------------------------------------
// PdfBookRenderer
// ---------------------------------------------------------------------------

/**
 * Renders a Book aggregate to a PDF Buffer using PDFKit.
 *
 * Handles document lifecycle, page sequencing, and crop marks.
 * Delegates all visual layout to the appropriate IBookTemplate implementation.
 *
 * @example
 * ```ts
 * const renderer = createPrintRenderer()
 * const buffer = await renderer.render(book, { target: kdpTarget, template: 'standard' })
 * ```
 */
export class PdfBookRenderer extends BasePdfRenderer implements IRenderer {
  readonly outputType: OutputType

  constructor(outputType: OutputType) {
    super()
    this.outputType = outputType
  }

  async render(book: Book, options: RenderOptions): Promise<Buffer> {
    this.initDocument(options.target)

    const coverId = (book.layout as any).coverId
    const template = resolveTemplate(book.puzzleType, coverId)
    template.setDocument(this.doc)

    // Cover
    this.addPage()
    template.renderCover(book, options)

    // Intro (optional)
    if (book.content.intro.enabled) {
      this.addPage()
      template.renderIntro(book, options)
    }

    // Puzzle pages — driven by the pure chapter iterator
    for (const { puzzle, pageNumber } of iteratePuzzles(book)) {
      this.addPage()
      template.renderPuzzlePage(puzzle, pageNumber, options)
    }

    // Answer key (optional, may span multiple pages via callback)
    if (book.content.answerKey.enabled) {
      this.addPage()
      template.renderAnswerKey(book.puzzles, options, () => {
        this.addPage()
        return this.getContentArea(options.target)
      })
    }

    return this.finalizeDocument()
  }
}

// ---------------------------------------------------------------------------
// Factory functions — maintain backward-compatible named exports
// ---------------------------------------------------------------------------

/**
 * Creates a renderer configured for press-ready print output.
 * Output respects bleed, crop marks, and KDP margin specs from the RenderTarget.
 */
export const createPrintRenderer = (): PdfBookRenderer => new PdfBookRenderer('print')

/**
 * Creates a renderer configured for screen/tablet PDF output.
 * Output has no bleed or crop marks; optimised for Kindle Scribe annotation.
 */
export const createScreenRenderer = (): PdfBookRenderer => new PdfBookRenderer('screen')

// Legacy class aliases for callers that instantiate directly
/** @deprecated Use `createPrintRenderer()` instead */
export class PrintRenderer extends PdfBookRenderer {
  constructor() { super('print') }
}

/** @deprecated Use `createScreenRenderer()` instead */
export class ScreenRenderer extends PdfBookRenderer {
  constructor() { super('screen') }
}
