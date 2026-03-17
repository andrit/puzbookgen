/**
 * @file index.ts
 * @description Public API for the book-generator package.
 *
 * External consumers (CLI, web server) import only from this file.
 * Internal module paths are an implementation detail.
 */

export { BookAssembler, bookAssembler } from './assembler/book.assembler'
export type { AssemblerOptions } from './assembler/book.assembler'

export {
  PdfBookRenderer,
  createPrintRenderer,
  createScreenRenderer,
  // Legacy aliases — prefer factory functions above
  PrintRenderer,
  ScreenRenderer,
} from './renderers/pdf-book.renderer'

export {
  loadRenderTarget,
  getContentArea,
  getPageSizePoints,
  inchesToPoints,
} from './renderers/target-loader'

export { CrosswordTemplate } from './templates/crossword/crossword.template'
