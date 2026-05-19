import type PDFDocument from 'pdfkit'
import type {
  Book, Puzzle, RenderOptions, IBookTemplate, Cell, Clue,
} from '@puzzle-book/shared'
import { getContentArea } from '../../renderers/target-loader'
import { getCover, DEFAULT_COVER_ID } from './covers/cover.registry'

// ---------------------------------------------------------------------------
// Font map — swap values here when licensed files arrive
// doc.registerFont('BebasNeue', '/path/to/BebasNeue.ttf') in setDocument()
// then change F.title = 'BebasNeue' etc.
// ---------------------------------------------------------------------------
const F = {
  title:       'Helvetica-Bold',   // → Bebas Neue
  puzzleTitle: 'Helvetica-Bold',   // → Instrument Serif Bold
  clueNum:     'Courier',          // → IBM Plex Mono
  clueText:    'Helvetica',        // → Space Grotesk
  answerKey:   'Courier',          // → IBM Plex Mono
  pageNum:     'Times-Italic',     // → Instrument Serif Italic
  publisher:   'Courier',          // → Courier Prime
  intro:       'Times-Roman',
  introTitle:  'Times-Bold',
} as const

const GOLD = '#C9A84C'
const INK  = '#1A1814'

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
const CLUE_FONT_SIZE   = 7.5
const SECTION_HDR_SIZE = 8
const CLUE_NUM_WIDTH   = 16    // fixed box for right-aligned number
const CLUE_NUM_GAP     = 3
const CLUE_LINE_GAP    = 1.5   // passed to PDFKit lineGap — must match in measure + draw
const ENTRY_GAP        = 2.5   // extra space between successive clue entries
const SECTION_AFTER    = 6     // space after ACROSS / DOWN header

// ---------------------------------------------------------------------------
// Grid — fixed dimensions, always consistent
//
// KDP 6×9" content area ≈ 324pt wide × 540pt tall.
// GRID_CELL_SIZE × GRID_MAX_DIM = 15 × 21 = 315pt max grid width/height.
// In practice trimmed grids are 10–17 cells wide; a 13×13 at 15pt = 195pt.
// This is large enough to write in comfortably and never changes between puzzles.
// ---------------------------------------------------------------------------
const GRID_CELL_SIZE = 15     // pt — fixed cell size, all puzzles
const GRID_FRAME_W   = 1.5   // pt — outer grid border weight
const MARGIN         = 10    // pt — minimum margin on all sides

// ---------------------------------------------------------------------------
// Clue entry type
// ---------------------------------------------------------------------------
type ClueEntry =
  | { type: 'header'; label: string }
  | { type: 'clue';   clue: Clue    }

// ---------------------------------------------------------------------------
// CrosswordTemplate
// ---------------------------------------------------------------------------
export class CrosswordTemplate implements IBookTemplate {
  readonly puzzleType   = 'crossword' as const
  readonly templateName = 'observatory'

  private coverId = DEFAULT_COVER_ID
  private doc!: InstanceType<typeof PDFDocument>

  setDocument(doc: InstanceType<typeof PDFDocument>): void {
    this.doc = doc
  }

  setCoverId(id: string): void { this.coverId = id }

  // ── Cover ─────────────────────────────────────────────────────────────────

  renderCover(book: Book, _options: RenderOptions): void {
    getCover(this.coverId).render(
      this.doc, book, this.doc.page.width, this.doc.page.height
    )
  }

  // ── Intro ─────────────────────────────────────────────────────────────────

  renderIntro(book: Book, options: RenderOptions): void {
    const area = getContentArea(options.target)

    this.doc.moveTo(area.x, area.y + 2).lineTo(area.x + area.width, area.y + 2)
      .lineWidth(0.5).strokeColor(GOLD).stroke()

    this.doc.font(F.introTitle).fontSize(18).fillColor(INK)
      .text('How to Solve', area.x, area.y + 12, { width: area.width })

    this.doc.moveDown(0.6)

    const txt = book.content.intro.text ||
      'Welcome to The Observatory — a collection of crossword puzzles spanning ' +
      'thirty-two fields of human knowledge.\n\n' +
      'Each puzzle features a grid of white and black squares. Fill in the white ' +
      'squares with letters to form the words answering the numbered clues.\n\n' +
      'Clues are divided into two groups: Across and Down. The number at the start ' +
      'of each clue corresponds to the numbered square where the answer begins.\n\n' +
      'The answer key is at the back of the book. Good luck.'

    this.doc.font(F.intro).fontSize(12).fillColor(INK)
      .text(txt, area.x, this.doc.y, { width: area.width, lineGap: 4 })

    this.doc.moveTo(area.x, area.y + area.height - 2)
      .lineTo(area.x + area.width, area.y + area.height - 2)
      .lineWidth(0.5).strokeColor(GOLD).stroke()

    this.doc.font(F.publisher).fontSize(7.5).fillColor(GOLD)
      .text(
        'WORD Games  ·  A Syntax Press Production  ·  A Rhizo Labs Expedition',
        area.x, area.y + area.height - 18,
        { width: area.width, align: 'center', lineBreak: false, characterSpacing: 0.3 }
      )
  }

  // ── Puzzle Page ───────────────────────────────────────────────────────────
  //
  //  Page structure (top → bottom):
  //
  //    [ page number — outside top corner          ]   ~16pt
  //    [ puzzle title centred in gold              ]   ~14pt
  //    [ thin gold rule                            ]   ~4pt
  //    [ 4 clue columns — fills remaining space    ]   flexible
  //    [ fixed-size crossword grid — bottom centre ]   GRID_CELL_SIZE × grid dims
  //    [ 10pt bottom margin                        ]
  //
  //  The grid is always the same cell size. The clue zone takes whatever
  //  vertical space remains above it. No lens, no graphic zone.

  renderPuzzlePage(puzzle: Puzzle, pageNumber: number, options: RenderOptions): void {
    const area    = getContentArea(options.target)
    const isRight = pageNumber % 2 !== 0

    // ── Header — page number and title flush to top, minimal height ─────────
    // Page number and title share the same line to save vertical space.
    // Total header = 13pt (font) + 4pt gap + 1pt rule = 18pt.
    const HDR_FONT   = 10
    const ruleY      = area.y + HDR_FONT + 2   // rule sits 12pt from top

    // Page number — outside corner, same baseline as title
    this.doc.font(F.pageNum).fontSize(HDR_FONT).fillColor(INK)
      .text(String(pageNumber), area.x, area.y, {
        width: area.width,
        align: isRight ? 'right' : 'left',
        lineBreak: false,
      })

    // Puzzle title — centred on same line
    const titleText = puzzle.metadata?.title ?? 'Puzzle'
    this.doc.font(F.puzzleTitle).fontSize(HDR_FONT).fillColor(GOLD)
      .text(titleText.toUpperCase(), area.x, area.y, {
        width: area.width, align: 'center',
        lineBreak: false, characterSpacing: 2,
      })

    // Thin gold rule immediately below
    this.doc.moveTo(area.x, ruleY).lineTo(area.x + area.width, ruleY)
      .lineWidth(0.35).strokeColor(GOLD).stroke()

    // ── Zone split — clues get 45%, grid gets 50%, 5% already used by header ──
    // Clues always get their minimum space first; grid fills the rest.
    const MIN_CLUE_FRAC = 0.42   // at least 42% of content height for clues
    const MAX_GRID_FRAC = 0.50   // at most 50% of content height for grid zone

    const maxGridZoneH = Math.floor(area.height * MAX_GRID_FRAC)
    const minClueZoneH = Math.floor(area.height * MIN_CLUE_FRAC)

    // Cell size: target GRID_CELL_SIZE but shrink to fit both axes
    const cellByW   = Math.floor(area.width / puzzle.grid.width)
    const cellByH   = Math.floor(maxGridZoneH / puzzle.grid.height)
    const cellSize  = Math.min(GRID_CELL_SIZE, cellByW, cellByH)

    const gridW  = cellSize * puzzle.grid.width
    const gridH  = cellSize * puzzle.grid.height

    // Grid: bottom-centre of page with MARGIN clearance
    const gridX  = area.x + Math.round((area.width - gridW) / 2)
    const gridY  = area.y + area.height - gridH - MARGIN

    // ── Clue zone — from just below the rule to just above the grid ──────────
    const clueZoneY = ruleY + 4
    const clueZoneH = Math.max(minClueZoneH, gridY - clueZoneY - 6)

    // ── 4 clue columns across full content width ─────────────────────────────
    const NUM_COLS = 4
    const colGap   = 8
    const colW     = Math.floor((area.width - colGap * (NUM_COLS - 1)) / NUM_COLS)

    const entries  = this.buildEntries(puzzle)
    let   remaining = entries
    let   writtenClues = 0
    const totalClues = puzzle.clues.across.length + puzzle.clues.down.length

    for (let i = 0; i < NUM_COLS; i++) {
      const colX = area.x + i * (colW + colGap)
      const n    = this.measureFit(remaining, colW, clueZoneH)
      this.drawColumn(remaining.slice(0, n), colX, clueZoneY, colW)
      // Count only clue entries (not headers)
      writtenClues += remaining.slice(0, n).filter(e => e.type === 'clue').length
      remaining = remaining.slice(n)
    }

    // Clue audit — warn if any clues didn't make it onto the page
    const droppedClues = remaining.filter(e => e.type === 'clue').length
    if (droppedClues > 0) {
      console.warn(
        `[Layout] Puzzle "${puzzle.metadata?.title ?? pageNumber}": ` +
        `${writtenClues}/${totalClues} clues written, ${droppedClues} dropped. ` +
        `Consider reducing CLUE_FONT_SIZE or increasing GRID_CELL_SIZE.`
      )
    } else {
      console.log(
        `[Layout] Puzzle "${puzzle.metadata?.title ?? pageNumber}": ` +
        `${writtenClues}/${totalClues} clues ✓  words: ${puzzle.metadata?.wordCount ?? '?'}`
      )
    }

    // ── Grid ─────────────────────────────────────────────────────────────────
    this.renderGrid(puzzle, gridX, gridY, cellSize)
  }

  // ── Clue helpers ──────────────────────────────────────────────────────────

  private buildEntries(puzzle: Puzzle): ClueEntry[] {
    const out: ClueEntry[] = []
    out.push({ type: 'header', label: 'ACROSS' })
    for (const c of puzzle.clues.across) out.push({ type: 'clue', clue: c })
    out.push({ type: 'header', label: 'DOWN' })
    for (const c of puzzle.clues.down)   out.push({ type: 'clue', clue: c })
    return out
  }

  /**
   * Count how many entries fit in colWidth × colHeight.
   * Font must be set before heightOfString — done here explicitly so
   * measurements always match what drawColumn renders.
   */
  private measureFit(entries: ClueEntry[], colWidth: number, colHeight: number): number {
    const textW = colWidth - CLUE_NUM_WIDTH - CLUE_NUM_GAP
    let usedH = 0, count = 0
    for (const e of entries) {
      let h: number
      if (e.type === 'header') {
        h = SECTION_HDR_SIZE + SECTION_AFTER
      } else {
        this.doc.font(F.clueText).fontSize(CLUE_FONT_SIZE)
        h = this.doc.heightOfString(e.clue.clue, {
          width: textW, lineGap: CLUE_LINE_GAP,
        }) + ENTRY_GAP
      }
      if (usedH + h > colHeight) break
      usedH += h
      count++
    }
    return count
  }

  /**
   * Render a column slice. Numbers right-aligned in a fixed box so
   * "1." and "25." always produce identically indented clue text.
   */
  private drawColumn(
    entries: ClueEntry[], x: number, y: number, colWidth: number
  ): void {
    if (entries.length === 0) return
    const textX = x + CLUE_NUM_WIDTH + CLUE_NUM_GAP
    const textW = colWidth - CLUE_NUM_WIDTH - CLUE_NUM_GAP
    let curY = y

    for (const e of entries) {
      if (e.type === 'header') {
        this.doc.font(F.clueText).fontSize(SECTION_HDR_SIZE).fillColor(INK)
          .text(e.label, x, curY, { width: colWidth, lineBreak: false })
        curY += SECTION_HDR_SIZE + SECTION_AFTER
      } else {
        this.doc.font(F.clueNum).fontSize(CLUE_FONT_SIZE).fillColor(INK)
          .text(`${e.clue.number}.`, x, curY, {
            width: CLUE_NUM_WIDTH, align: 'right', lineBreak: false,
          })
        this.doc.font(F.clueText).fontSize(CLUE_FONT_SIZE).fillColor(INK)
          .text(e.clue.clue, textX, curY, {
            width: textW, lineGap: CLUE_LINE_GAP,
          })
        curY += this.doc.heightOfString(e.clue.clue, {
          width: textW, lineGap: CLUE_LINE_GAP,
        }) + ENTRY_GAP
      }
    }
  }

  // ── Grid ──────────────────────────────────────────────────────────────────

  private renderGrid(puzzle: Puzzle, x: number, y: number, cs: number = GRID_CELL_SIZE): void {
    const cells = new Map<string, Cell>()
    for (const cell of puzzle.grid.cells) {
      cells.set(`${cell.row},${cell.col}`, cell)
    }

    for (let row = 0; row < puzzle.grid.height; row++) {
      for (let col = 0; col < puzzle.grid.width; col++) {
        const cell = cells.get(`${row},${col}`)
        const cx   = x + col * cs
        const cy   = y + row * cs

        if (!cell || cell.type === 'blocked') {
          // Organic smudge — each blocked cell has slightly different corner radii
          const rx = 2 + ((row * 3 + col * 7) % 4)
          const ry = 2 + ((row * 5 + col * 3) % 4)
          this.doc.roundedRect(cx, cy, cs, cs, Math.min(rx, ry)).fill(INK)
        } else {
          this.doc.rect(cx, cy, cs, cs).fillAndStroke('#FFFFFF', INK)
          if (cell.number !== null) {
            this.doc.font(F.clueNum).fontSize(cs * 0.26).fillColor(INK)
              .text(String(cell.number), cx + 1.5, cy + 1.5, { lineBreak: false })
          }
        }
      }
    }

    // Outer border — heavier than cell lines
    this.doc
      .rect(x, y, puzzle.grid.width * cs, puzzle.grid.height * cs)
      .lineWidth(GRID_FRAME_W).stroke(INK)
  }

  // ── Answer Key ────────────────────────────────────────────────────────────
  //
  //  2 grids per row, 10pt margins on all sides.
  //  Overflow check runs BEFORE placing each item — never splits across pages.
  //  Last item centred if it lands alone on a row.

  renderAnswerKey(
    puzzles: Puzzle[],
    options: RenderOptions,
    requestNewPage: () => { x: number; y: number; width: number; height: number }
  ): void {
    // ── Answer key layout constants ─────────────────────────────────────────
    const MINI   = 6      // pt per cell — smaller so more fit per page
    const LBL_H  = 11     // pt — label line height
    const LBL_GAP = 3     // pt — gap between label and grid
    const CGAP   = 24     // pt — horizontal gap between left and right columns
    const RGAP   = 18     // pt — vertical gap between rows
    const HDRH   = 36     // pt — section header height
    const PAD    = 14     // pt — page margin on all sides (larger than puzzle pages)
    const COLS   = 2

    // ── Helpers ──────────────────────────────────────────────────────────────
    const margined = (a: { x: number; y: number; width: number; height: number }) => ({
      ax: a.x + PAD, ay: a.y + PAD,
      aw: a.width - PAD * 2, ah: a.height - PAD * 2,
    })

    const drawContinuedHeader = (ax: number, ay: number, aw: number) => {
      this.doc.font(F.publisher).fontSize(8).fillColor(GOLD)
        .text('Answer Key (continued)', ax, ay, { width: aw, align: 'right', lineBreak: false })
    }

    // ── Initial area ─────────────────────────────────────────────────────────
    let raw = getContentArea(options.target)
    let { ax, ay, aw, ah } = margined(raw)
    const colW = Math.floor((aw - CGAP) / COLS)

    // Section header
    this.doc.font(F.introTitle).fontSize(13).fillColor(INK)
      .text('Answer Key', ax, ay, { width: aw, align: 'center' })
    this.doc.moveTo(ax + aw * 0.2, ay + 20).lineTo(ax + aw * 0.8, ay + 20)
      .lineWidth(0.5).strokeColor(GOLD).stroke()

    let curY     = ay + HDRH
    let leftH    = 0   // height of the item currently in the left column
    let col      = 0   // 0 = left column, 1 = right column

    for (let i = 0; i < puzzles.length; i++) {
      const puz   = puzzles[i]
      const gw    = puz.grid.width  * MINI
      const gh    = puz.grid.height * MINI
      const itemH = LBL_H + LBL_GAP + gh   // total height of one answer grid block

      // ── Page overflow — check BEFORE placing anything ─────────────────────
      // When placing in col 0: check if itemH fits from curY.
      // When placing in col 1: check against the taller of left/right.
      const wouldOverflow = curY + itemH > ay + ah

      if (wouldOverflow) {
        raw = requestNewPage()
        const m = margined(raw)
        ax = m.ax; ay = m.ay; aw = m.aw; ah = m.ah
        drawContinuedHeader(ax, ay, aw)
        curY  = ay + LBL_H + 6
        col   = 0
        leftH = 0
      }

      // ── Compute X position ────────────────────────────────────────────────
      const isLastAlone = (i === puzzles.length - 1) && col === 0
      const itemX = isLastAlone
        ? ax + Math.round((aw - gw) / 2)   // lone final item — centre it
        : ax + col * (colW + CGAP)

      // ── Label — truncated to one line, never wraps ────────────────────────
      const titleStr = puz.metadata?.title ?? ''
      const lbl = titleStr ? `#${i + 1}  ${titleStr}` : `#${i + 1}`
      this.doc.font(F.clueNum).fontSize(7).fillColor(INK)
        .text(lbl, itemX, curY, { width: colW, lineBreak: false })

      // ── Grid ──────────────────────────────────────────────────────────────
      this.renderSolvedGrid(puz, itemX, curY + LBL_H + LBL_GAP, MINI)

      // ── Advance position ──────────────────────────────────────────────────
      if (col === 0 && !isLastAlone) {
        // Placed left — record height, move to right column (same Y)
        leftH = itemH
        col   = 1
      } else {
        // Placed right (or last-alone) — advance Y by the taller of the two
        const rowH = Math.max(leftH, itemH)
        curY  += rowH + RGAP
        col    = 0
        leftH  = 0
      }
    }
  }

  private renderSolvedGrid(puzzle: Puzzle, x: number, y: number, cs: number): void {
    const cells = new Map<string, Cell>()
    for (const cell of puzzle.grid.cells) {
      cells.set(`${cell.row},${cell.col}`, cell)
    }

    for (let row = 0; row < puzzle.grid.height; row++) {
      for (let col = 0; col < puzzle.grid.width; col++) {
        const cell = cells.get(`${row},${col}`)
        const cx   = x + col * cs
        const cy   = y + row * cs

        if (!cell || cell.type === 'blocked') {
          this.doc.rect(cx, cy, cs, cs).fill(INK)
        } else {
          this.doc.rect(cx, cy, cs, cs).fillAndStroke('#FFFFFF', '#CCCCCC')
          if (cell.solution) {
            this.doc.font(F.answerKey).fontSize(cs * 0.55).fillColor(INK)
              .text(cell.solution, cx, cy + cs * 0.08, {
                width: cs, align: 'center', lineBreak: false,
              })
          }
        }
      }
    }
  }
}
