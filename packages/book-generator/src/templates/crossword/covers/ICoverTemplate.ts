/**
 * @file ICoverTemplate.ts
 * @description Interface contract for all cover designs.
 *
 * Each cover receives the PDFKit document, the Book aggregate,
 * and the full page dimensions. It is responsible for drawing
 * the entire cover page — background, artwork, typography.
 *
 * Adding a new cover = implement this interface and register
 * the ID in cover.registry.ts. Nothing else needs to change.
 */

import type PDFDocument from 'pdfkit'
import type { Book } from '@puzzle-book/shared'

export interface ICoverTemplate {
  /** Unique identifier used to select this cover via CLI / web UI */
  readonly id: string
  /** Human-readable name shown in the creator interface */
  readonly name: string
  /** Short description of the visual style */
  readonly description: string

  /** Draw the entire cover page onto the PDFKit document */
  render(
    doc: InstanceType<typeof PDFDocument>,
    book: Book,
    pageWidth: number,
    pageHeight: number
  ): void
}
