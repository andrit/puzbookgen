import type PDFDocument from 'pdfkit'
import type {
  Book,
  Puzzle,
  RenderOptions,
  IBookTemplate,
  Cell,
  Clue,
} from '@puzzle-book/shared'
import { getContentArea } from '../../renderers/target-loader'

// ---------------------------------------------------------------------------
// Typography constants
// ---------------------------------------------------------------------------

const CLUE_FONT_SIZE  = 7.5   // pt — clue body text
const SECTION_HDR_SIZE = 8    // pt — ACROSS / DOWN headers
const CLUE_NUM_WIDTH  = 16    // pt — fixed box for right-aligned number
const CLUE_NUM_GAP    = 3     // pt — gap between number box and clue text
const CLUE_LINE_GAP   = 3     // pt — vertical gap between consecutive clues
const SECTION_AFTER   = 6     // pt — gap after ACROSS / DOWN header

// Internal discriminated union for the flat clue list
type ClueEntry =
  | { type: 'header'; label: string }
  | { type: 'clue';   clue: Clue    }

export class CrosswordTemplate implements IBookTemplate {
  readonly puzzleType  = 'crossword' as const
  readonly templateName = 'standard'

  private doc!: InstanceType<typeof PDFDocument>

  setDocument(doc: InstanceType<typeof PDFDocument>): void {
    this.doc = doc
  }

  // ---------------------------------------------------------------------------
  // Cover — Gothic / Mystery theme
  // ---------------------------------------------------------------------------

  renderCover(book: Book, _options: RenderOptions): void {
    const pw = this.doc.page.width
    const ph = this.doc.page.height
    const cx = pw / 2

    // Dark background
    this.doc.rect(0, 0, pw, ph).fill('#1C1C2E')

    // Double gold border
    const bO = 18, bI = 27
    this.doc.rect(bO, bO, pw - bO*2, ph - bO*2).lineWidth(2).strokeColor('#C9A84C').stroke()
    this.doc.rect(bI, bI, pw - bI*2, ph - bI*2).lineWidth(0.5).strokeColor('#C9A84C').stroke()

    // Diamond corner ornaments
    for (const c of [{ x:bO, y:bO },{ x:pw-bO, y:bO },{ x:bO, y:ph-bO },{ x:pw-bO, y:ph-bO }]) {
      const s = 6
      this.doc.moveTo(c.x,c.y-s).lineTo(c.x+s,c.y).lineTo(c.x,c.y+s).lineTo(c.x-s,c.y).closePath().fill('#C9A84C')
    }

    // Crossword square bands — top and bottom (deterministic pattern)
    const sq = 9, sqG = 1
    const sqN = Math.floor((pw - 80) / (sq + sqG))
    const sqX0 = (pw - sqN * (sq + sqG)) / 2
    const pat = [1,0,0,1,0,1,0,0,1,1,0,1,0,0,0,1,0,1,1,0]
    for (let i = 0; i < sqN; i++) {
      const sx = sqX0 + i * (sq + sqG)
      const filled = pat[i % pat.length] === 1
      if (filled) {
        this.doc.rect(sx, 50, sq, sq).fill('#C9A84C')
        this.doc.rect(sx, ph-50-sq, sq, sq).fill('#C9A84C')
      } else {
        this.doc.rect(sx, 50, sq, sq).lineWidth(0.4).strokeColor('#C9A84C').stroke()
        this.doc.rect(sx, ph-50-sq, sq, sq).lineWidth(0.4).strokeColor('#C9A84C').stroke()
      }
    }

    // Magnifying glass
    const mgCY = ph * 0.345, mgR = 38
    this.doc.circle(cx, mgCY, mgR).lineWidth(4.5).strokeColor('#C9A84C').stroke()
    const hx1 = cx + mgR*0.68, hy1 = mgCY + mgR*0.68
    this.doc.moveTo(hx1, hy1).lineTo(hx1+mgR*0.8, hy1+mgR*0.8).lineWidth(5.5).lineCap('round').strokeColor('#C9A84C').stroke()
    this.doc.fillOpacity(0.2).circle(cx-mgR*0.28, mgCY-mgR*0.28, mgR*0.14).fill('#F5E6C8')
    this.doc.fillOpacity(1)
    this.doc.font('Times-Bold').fontSize(34).fillColor('#C9A84C').text('?', cx-11, mgCY-21, { lineBreak: false })

    // Content block — work top-down from a fixed start Y
    const contentX = bI + 14
    const contentW = pw - (bI + 14) * 2

    // Decorative rule
    const ruleY = ph * 0.555
    this.doc.moveTo(bI+24, ruleY).lineTo(pw-bI-24, ruleY).lineWidth(0.75).strokeColor('#C9A84C').stroke()

    // Title — shrink font size until it fits on one line
    const titleRaw = book.metadata.title.toUpperCase()
    let titleSize = 28
    while (titleSize > 14) {
      this.doc.font('Times-Bold').fontSize(titleSize)
      if (this.doc.widthOfString(titleRaw) <= contentW) break
      titleSize -= 1
    }
    const titleY = ruleY + 11
    this.doc.font('Times-Bold').fontSize(titleSize).fillColor('#F5E6C8')
      .text(titleRaw, contentX, titleY, { width: contentW, align: 'center', lineBreak: false })

    let nextY = titleY + titleSize + 10

    // Subtitle
    if (book.metadata.subtitle) {
      this.doc.font('Times-Roman').fontSize(12).fillColor('#C9A84C')
        .text(book.metadata.subtitle, contentX, nextY, { width: contentW, align: 'center', lineBreak: false })
      nextY += 20
    }

    // Puzzle count
    const n = book.puzzles.length
    this.doc.font('Helvetica').fontSize(9.5).fillColor('#C9A84C')
      .text(`${n} Crossword Puzzle${n !== 1 ? 's' : ''}`, contentX, nextY, { width: contentW, align: 'center', lineBreak: false })
    nextY += 16

    // Lower rule
    this.doc.moveTo(bI+24, nextY).lineTo(pw-bI-24, nextY).lineWidth(0.75).strokeColor('#C9A84C').stroke()

    // Author
    if (book.metadata.author) {
      this.doc.font('Times-Italic').fontSize(11).fillColor('#C9A84C')
        .text(book.metadata.author, contentX, ph - bI - 46, { width: contentW, align: 'center', lineBreak: false })
    }
  }

  // ---------------------------------------------------------------------------
  // Intro Page
  // ---------------------------------------------------------------------------

  renderIntro(book: Book, options: RenderOptions): void {
    const area = getContentArea(options.target)
    this.doc.font('Times-Bold').fontSize(18).fillColor('#000000').text('How to Solve', area.x, area.y, { width: area.width })
    this.doc.moveDown(0.8)
    const txt = book.content.intro.text ||
      'Welcome to this collection of crossword puzzles. Each puzzle features a grid of white ' +
      'and black squares. Your goal is to fill in the white squares with letters, forming words ' +
      'that answer the numbered clues.\n\n' +
      'Clues are divided into two groups: Across and Down. The number at the start of each ' +
      'clue corresponds to the numbered square in the grid where the answer begins.\n\n' +
      'The answer key is provided at the back of the book. Good luck and enjoy the challenge!'
    this.doc.font('Times-Roman').fontSize(12).fillColor('#000000').text(txt, area.x, this.doc.y, { width: area.width, lineGap: 5 })
  }

  // ---------------------------------------------------------------------------
  // Puzzle Page
  // Layout: page number top-right → left column (full height) → 3 columns
  // top-right → grid bottom-right
  // ---------------------------------------------------------------------------

  renderPuzzlePage(puzzle: Puzzle, pageNumber: number, options: RenderOptions): void {
    const area = getContentArea(options.target)

    // Page number — top outside corner, no label
    this.doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
      .text(String(pageNumber), area.x, area.y, { width: area.width, align: 'right', lineBreak: false })

    const topReserved = 18
    const colGap = 5

    // Left column width (~22%)
    const leftColW = Math.floor(area.width * 0.22)
    const rightW   = area.width - leftColW - colGap
    const rightX   = area.x + leftColW + colGap

    // Grid: fits inside rightW, max 55% of content height
    const maxGridH = area.height * 0.55
    const cellSize = Math.min(
      Math.floor(maxGridH / puzzle.grid.height),
      Math.floor(rightW  / puzzle.grid.width)
    )
    const gridW = cellSize * puzzle.grid.width
    const gridH = cellSize * puzzle.grid.height
    const gridX = area.x + area.width - gridW    // right edge
    const gridY = area.y + area.height - gridH   // bottom edge

    // Top-right clue area (3 equal columns)
    const topRightH = gridY - area.y - topReserved - colGap
    const topRightY = area.y + topReserved
    const col3W = Math.floor(rightW / 3)

    // Build entry list and distribute across 4 columns
    const entries = this.buildEntries(puzzle)
    const leftH   = area.height - topReserved

    const n1 = this.measureFit(entries,              leftColW, leftH)
    const n2 = this.measureFit(entries.slice(n1),    col3W,    topRightH)
    const n3 = this.measureFit(entries.slice(n1+n2), col3W,    topRightH)
    const n4 = this.measureFit(entries.slice(n1+n2+n3), col3W, topRightH)

    this.drawColumn(entries.slice(0, n1),           area.x,                  area.y + topReserved, leftColW)
    this.drawColumn(entries.slice(n1, n1+n2),        rightX,                  topRightY, col3W)
    this.drawColumn(entries.slice(n1+n2, n1+n2+n3),  rightX + col3W + colGap, topRightY, col3W)
    if (n4 > 0) {
      this.drawColumn(entries.slice(n1+n2+n3, n1+n2+n3+n4), rightX + (col3W+colGap)*2, topRightY, col3W)
    }

    this.renderGrid(puzzle, gridX, gridY, cellSize)
  }

  // ---------------------------------------------------------------------------
  // Clue helpers
  // ---------------------------------------------------------------------------

  private buildEntries(puzzle: Puzzle): ClueEntry[] {
    const out: ClueEntry[] = []
    out.push({ type: 'header', label: 'ACROSS' })
    for (const c of puzzle.clues.across) out.push({ type: 'clue', clue: c })
    out.push({ type: 'header', label: 'DOWN' })
    for (const c of puzzle.clues.down)   out.push({ type: 'clue', clue: c })
    return out
  }

  /**
   * Count how many entries from the list fit in colWidth × colHeight.
   * Font must be set before calling heightOfString — we set it here explicitly
   * so measurements are always accurate regardless of prior document state.
   */
  private measureFit(entries: ClueEntry[], colWidth: number, colHeight: number): number {
    const textW = colWidth - CLUE_NUM_WIDTH - CLUE_NUM_GAP
    let usedH = 0
    let count = 0

    for (const e of entries) {
      let h: number
      if (e.type === 'header') {
        h = SECTION_HDR_SIZE + SECTION_AFTER
      } else {
        // Set font so heightOfString uses the correct metrics
        this.doc.font('Helvetica').fontSize(CLUE_FONT_SIZE)
        h = this.doc.heightOfString(e.clue.clue, { width: textW }) + CLUE_LINE_GAP
      }
      if (usedH + h > colHeight) break
      usedH += h
      count++
    }
    return count
  }

  /**
   * Render a slice of entries into a column.
   * Numbers right-aligned in a fixed box → clue text always starts at same x.
   */
  private drawColumn(entries: ClueEntry[], x: number, y: number, colWidth: number): void {
    if (entries.length === 0) return
    const textX = x + CLUE_NUM_WIDTH + CLUE_NUM_GAP
    const textW = colWidth - CLUE_NUM_WIDTH - CLUE_NUM_GAP
    let curY = y

    for (const e of entries) {
      if (e.type === 'header') {
        this.doc.font('Helvetica-Bold').fontSize(SECTION_HDR_SIZE).fillColor('#000000')
          .text(e.label, x, curY, { width: colWidth, lineBreak: false })
        curY += SECTION_HDR_SIZE + SECTION_AFTER
      } else {
        // Number — right-aligned in fixed box
        this.doc.font('Helvetica-Bold').fontSize(CLUE_FONT_SIZE).fillColor('#000000')
          .text(`${e.clue.number}.`, x, curY, { width: CLUE_NUM_WIDTH, align: 'right', lineBreak: false })
        // Clue text — constant indent regardless of number width
        this.doc.font('Helvetica').fontSize(CLUE_FONT_SIZE).fillColor('#000000')
          .text(e.clue.clue, textX, curY, { width: textW, lineGap: CLUE_LINE_GAP })
        curY += this.doc.heightOfString(e.clue.clue, { width: textW }) + CLUE_LINE_GAP
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Grid
  // ---------------------------------------------------------------------------

  private renderGrid(puzzle: Puzzle, x: number, y: number, cellSize: number): void {
    const cells = new Map<string, Cell>()
    for (const cell of puzzle.grid.cells) cells.set(`${cell.row},${cell.col}`, cell)

    for (let row = 0; row < puzzle.grid.height; row++) {
      for (let col = 0; col < puzzle.grid.width; col++) {
        const cell = cells.get(`${row},${col}`)
        const cx = x + col * cellSize
        const cy = y + row * cellSize

        if (!cell || cell.type === 'blocked') {
          this.doc.rect(cx, cy, cellSize, cellSize).fill('#000000')
        } else {
          this.doc.rect(cx, cy, cellSize, cellSize).fillAndStroke('#FFFFFF', '#000000')
          if (cell.number !== null) {
            this.doc.font('Helvetica').fontSize(cellSize * 0.27).fillColor('#000000')
              .text(String(cell.number), cx + 1.5, cy + 1.5, { lineBreak: false })
          }
        }
      }
    }

    this.doc.rect(x, y, puzzle.grid.width * cellSize, puzzle.grid.height * cellSize)
      .lineWidth(1.5).stroke('#000000')
  }

  // ---------------------------------------------------------------------------
  // Answer Key — 2-column layout, last item centred when count is odd
  // Larger gaps and cells so answers are readable
  // ---------------------------------------------------------------------------

  renderAnswerKey(
    puzzles: Puzzle[],
    options: RenderOptions,
    requestNewPage: () => { x: number; y: number; width: number; height: number }
  ): void {
    const MINI_CELL = 8     // slightly larger than before — more readable
    const LABEL_H   = 13
    const GAP_X     = 24   // wider horizontal gap between columns
    const GAP_Y     = 20   // taller vertical gap between rows
    const HEADER_H  = 36
    const COLS      = 2    // 2 per row → 2-2-1 for 5 puzzles

    let area = getContentArea(options.target)
    const colW = Math.floor((area.width - GAP_X * (COLS - 1)) / COLS)

    // Section header
    this.doc.font('Times-Bold').fontSize(14).fillColor('#000000')
      .text('Answer Key', area.x, area.y, { width: area.width, align: 'center' })
    this.doc.moveTo(area.x + area.width*0.25, area.y+20)
      .lineTo(area.x + area.width*0.75, area.y+20)
      .lineWidth(0.5).strokeColor('#888888').stroke()

    let currentY = area.y + HEADER_H

    for (let i = 0; i < puzzles.length; i++) {
      const puzzle = puzzles[i]
      const gridW = puzzle.grid.width  * MINI_CELL
      const gridH = puzzle.grid.height * MINI_CELL
      const itemH = LABEL_H + gridH

      const col = i % COLS

      // Add row gap when starting a new row (not first item)
      if (col === 0 && i > 0) currentY += GAP_Y

      // Page overflow
      if (currentY + itemH > area.y + area.height) {
        area = requestNewPage()
        currentY = area.y
        this.doc.font('Helvetica').fontSize(8).fillColor('#888888')
          .text('Answer Key (continued)', area.x, area.y, { width: area.width, align: 'right' })
        currentY = area.y + 16
      }

      // Horizontal position:
      // For 2-column rows, col 0 = left, col 1 = right.
      // For a lone last item (odd count), centre it.
      const isLastAndAlone = (i === puzzles.length - 1) && (col === 0)
      let itemX: number
      if (isLastAndAlone) {
        // Centre the single item across the full content width
        itemX = area.x + (area.width - gridW) / 2
      } else {
        itemX = area.x + col * (colW + GAP_X)
      }

      // Label
      this.doc.font('Helvetica-Bold').fontSize(8).fillColor('#333333')
        .text(`#${i + 1}`, itemX, currentY, { width: gridW, align: 'left', lineBreak: false })

      this.renderSolvedGrid(puzzle, itemX, currentY + LABEL_H, MINI_CELL)

      if (col === COLS - 1 || i === puzzles.length - 1) currentY += itemH
    }
  }

  private renderSolvedGrid(puzzle: Puzzle, x: number, y: number, cellSize: number): void {
    const cells = new Map<string, Cell>()
    for (const cell of puzzle.grid.cells) cells.set(`${cell.row},${cell.col}`, cell)

    for (let row = 0; row < puzzle.grid.height; row++) {
      for (let col = 0; col < puzzle.grid.width; col++) {
        const cell = cells.get(`${row},${col}`)
        const cx = x + col * cellSize
        const cy = y + row * cellSize

        if (!cell || cell.type === 'blocked') {
          this.doc.rect(cx, cy, cellSize, cellSize).fill('#000000')
        } else {
          this.doc.rect(cx, cy, cellSize, cellSize).fillAndStroke('#FFFFFF', '#CCCCCC')
          if (cell.solution) {
            this.doc.font('Helvetica-Bold').fontSize(cellSize * 0.58).fillColor('#000000')
              .text(cell.solution, cx, cy + cellSize * 0.1, {
                width: cellSize, align: 'center', lineBreak: false,
              })
          }
        }
      }
    }
  }
}
