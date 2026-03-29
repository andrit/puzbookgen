/**
 * @file silhouette.cover.ts
 * @description Minimalist cover: three colored crossword silhouettes arching
 * left → right → center on a dark background with gold border treatment.
 *
 * The silhouette pattern is a 13×13 rotationally symmetric grid that reads
 * as abstract word-section shapes — not a real solvable puzzle.
 */

import type PDFDocument from 'pdfkit'
import type { Book } from '@puzzle-book/shared'
import type { ICoverTemplate } from './ICoverTemplate'

/** Rotationally symmetric 13×13 crossword-style pattern.
 *  1 = letter cell (colored), 0 = blocked cell (not drawn). */
const SILHOUETTE_PATTERN: number[][] = [
  [0,1,1,1,0,0,1,0,0,1,1,1,0],
  [1,0,0,1,0,0,1,0,0,1,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,0,1,0,1,0,1,0,1,0,1,0,0],
  [1,1,1,1,1,0,0,0,1,1,1,1,1],
  [1,0,0,0,1,0,1,0,1,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,1,0,1,0,1,0,0,0,1],
  [1,1,1,1,1,0,0,0,1,1,1,1,1],
  [0,0,1,0,1,0,1,0,1,0,1,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,1,0,0,1,0,0,1,0,0,1],
  [0,1,1,1,0,0,1,0,0,1,1,1,0],
]

/** Silhouette colors — coral, teal, gold */
const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D'] as const

/** Cell size in points: 10pt fill + 1pt gap */
const CELL_SIZE = 11

export class SilhouetteCover implements ICoverTemplate {
  readonly id = 'silhouette'
  readonly name = 'Silhouette Arc'
  readonly description = 'Three colored crossword silhouettes arching across a dark background'

  render(
    doc: InstanceType<typeof PDFDocument>,
    book: Book,
    pw: number,
    ph: number
  ): void {
    const gridPx = SILHOUETTE_PATTERN.length * CELL_SIZE

    // Arc positions: top-left (coral) → far-right mid (teal, apex) → center-low (gold)
    const grids = [
      { x: 42,                          y: 62,  opacity: 0.80, color: COLORS[0] },
      { x: pw - 26 - gridPx,            y: 224, opacity: 1.00, color: COLORS[1] },
      { x: Math.round(pw / 2 - gridPx / 2), y: 386, opacity: 0.80, color: COLORS[2] },
    ]

    // Dark background
    doc.rect(0, 0, pw, ph).fill('#1C1C2E')

    // Double gold border
    const bO = 18, bI = 27
    doc.rect(bO, bO, pw - bO*2, ph - bO*2).lineWidth(1.5).strokeColor('#C9A84C').stroke()
    doc.rect(bI, bI, pw - bI*2, ph - bI*2).lineWidth(0.4).strokeColor('#C9A84C').stroke()

    // Diamond corner ornaments
    for (const c of [{x:bO,y:bO},{x:pw-bO,y:bO},{x:bO,y:ph-bO},{x:pw-bO,y:ph-bO}]) {
      const s = 5
      doc.moveTo(c.x, c.y-s).lineTo(c.x+s, c.y).lineTo(c.x, c.y+s).lineTo(c.x-s, c.y)
        .closePath().fill('#C9A84C')
    }

    // Silhouette grids — letter cells only
    for (const grid of grids) {
      doc.save()
      doc.opacity(grid.opacity)
      SILHOUETTE_PATTERN.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          if (!cell) return
          doc.rect(grid.x + ci * CELL_SIZE, grid.y + ri * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1)
            .fill(grid.color)
        })
      })
      doc.restore()
    }

    this.renderTitleBlock(doc, book, pw, ph, bI)
  }

  private renderTitleBlock(
    doc: InstanceType<typeof PDFDocument>,
    book: Book,
    pw: number,
    ph: number,
    bI: number
  ): void {
    const contentX = bI + 14
    const contentW = pw - (bI + 14) * 2
    const ruleY = ph - bI - 100

    doc.moveTo(bI + 20, ruleY).lineTo(pw - bI - 20, ruleY)
      .lineWidth(0.6).strokeColor('#C9A84C').stroke()

    // Title — auto-shrink to fit one line
    const titleRaw = book.metadata.title.toUpperCase()
    let titleSize = 26
    while (titleSize > 12) {
      doc.font('Times-Bold').fontSize(titleSize)
      if (doc.widthOfString(titleRaw) <= contentW) break
      titleSize--
    }
    doc.font('Times-Bold').fontSize(titleSize).fillColor('#F5E6C8')
      .text(titleRaw, contentX, ruleY + 11, { width: contentW, align: 'center', lineBreak: false })

    let nextY = ruleY + titleSize + 18

    if (book.metadata.subtitle) {
      doc.font('Times-Roman').fontSize(11).fillColor('#C9A84C')
        .text(book.metadata.subtitle, contentX, nextY, { width: contentW, align: 'center', lineBreak: false })
      nextY += 20
    }

    const n = book.puzzles.length
    doc.font('Helvetica').fontSize(8.5).fillColor('#C9A84C')
      .text(`${n} CROSSWORD PUZZLE${n !== 1 ? 'S' : ''}`, contentX, nextY, {
        width: contentW, align: 'center', lineBreak: false,
      })

    doc.moveTo(bI + 20, nextY + 16).lineTo(pw - bI - 20, nextY + 16)
      .lineWidth(0.4).strokeColor('#C9A84C').stroke()

    if (book.metadata.author) {
      doc.font('Times-Italic').fontSize(10).fillColor('#C9A84C')
        .text(book.metadata.author, contentX, ph - bI - 28, {
          width: contentW, align: 'center', lineBreak: false,
        })
    }
  }
}
