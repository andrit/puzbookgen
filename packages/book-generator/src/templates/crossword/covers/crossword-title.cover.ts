/**
 * @file crossword-title.cover.ts
 * @description Cover design where the word CROSSWORD is spelled out horizontally
 * in a real crossword grid, with intersecting words crossing through each letter.
 *
 * Grid layout (0-indexed rows/cols, 13 wide × 12 tall):
 *
 *   Col:  0  1  2  3  4  5  6  7  8  9 10 11 12
 * Row 0:  █  █  █  █  █  █  █  █  █  █  █  █  █
 * Row 1:  █  █  █  H  █  █  █  █  █  █  █  █  █
 * Row 2:  █  █  █  E  █  S  █  █  █  █  █  █  █
 * Row 3:  █  █  █  R  █  O  █  █  █  █  █  █  █
 * Row 4:  █  █  █  O  █  L  █  █  █  █  █  █  █
 * Row 5:  C  R  O  S  S  W  O  R  D  █  █  █  █  ← CROSSWORD
 * Row 6:  L  █  █  █  █  █  █  I  O  █  █  █  █
 * Row 7:  U  █  █  █  █  █  █  D  W  █  █  █  █
 * Row 8:  E  █  █  █  █  █  █  D  N  █  █  █  █
 * Row 9:  █  █  █  █  █  █  █  L  █  █  █  █  █
 * Row10:  █  █  █  █  █  █  █  E  █  █  █  █  █
 * Row11:  █  █  █  █  █  █  █  █  █  █  █  █  █
 *
 * Words:
 *   CROSSWORD  — across, row 5, cols 0-8
 *   CLUE       — down,   col 0, rows 5-8  (C shared)
 *   HERO       — down,   col 3, rows 1-4  (S shared at row 5 = S from CROSSWORD, offset above)
 *   SOLVE      — down,   col 5, rows 2-6  (W shared... wait W is col5 in CROSSWORD)
 *
 * Let me recalculate carefully:
 * CROSSWORD cols: C=0,R=1,O=2,S=3,S=4,W=5,O=6,R=7,D=8
 *
 *   CLUE  — down, col 0 starting row 5: C(5,0),L(6,0),U(7,0),E(8,0)
 *   HERO  — down, col 3 ending at row 5: H(1,3),E(2,3),R(3,3),O(4,3) → S(5,3) from CROSSWORD is S not O — mismatch
 *
 * Revised: use letters that actually match CROSSWORD's letters:
 *   Col 0 = C: words ending in C going up, or CLUE going down
 *   Col 1 = R: RIDDLE going down R(5,1),I(6,1),D(7,1),D(8,1),L(9,1),E(10,1)
 *   Col 2 = O: ONYX going down O(5,2),N(6,2),Y(7,2),X(8,2)... or going up ending O
 *   Col 3 = S: SOLVE going down doesn't start S correctly... use SONIC S(5,3),O(6,3),N(7,3),I(8,3),C(9,3)
 *   Col 4 = S: SCORE going down S(5,4),C(6,4),O(7,4),R(8,4),E(9,4)
 *   Col 5 = W: WORD going down W(5,5),O(6,5),R(7,5),D(8,5)
 *   Col 6 = O: already used O
 *   Col 7 = R: RIDDLE already at col1; use RUNE R(5,7),U(6,7),N(7,7),E(8,7)
 *   Col 8 = D: DOWN going down D(5,8),O(6,8),W(7,8),N(8,8)
 *
 * Also going UP into CROSSWORD letters for visual balance:
 *   Col 0: CLUE going DOWN (C at row 5)
 *   Col 2: BOLD going up ending at O(5,2): B(2,2),O(3,2),L(4,2) → O at row 5 ✓
 *
 * Final clean grid plan (highlight only, not all shown):
 * CROSSWORD: row 5, cols 0-8
 * Down from C(5,0): CLUE — rows 5-8
 * Down from R(5,1): RIDDLE — rows 5-10
 * Up to O(5,2): BOLD — B(2,2),O(3,2),L(4,2),D... D doesn't match O. Use OAK reversed ending O: A(3,2),K(4,2)→ nope
 * Down from S(5,3): SONIC — rows 5-9
 * Down from second S(5,4): SCORE — rows 5-9
 * Down from W(5,5): WORD — rows 5-8
 * Down from R(5,7): RUNE — rows 5-8
 * Down from D(5,8): DOWN — rows 5-8
 */

import type PDFDocument from 'pdfkit'
import type { Book } from '@puzzle-book/shared'
import type { ICoverTemplate } from './ICoverTemplate'

// ---------------------------------------------------------------------------
// Grid definition
// ---------------------------------------------------------------------------

/** Sparse grid: only define letter cells. Key = "row,col". */
interface GridCell { letter: string; highlight: 'title' | 'cross' | 'none' }

// Build the grid data
const buildGrid = (): Map<string, GridCell> => {
  const g = new Map<string, GridCell>()
  const set = (r: number, c: number, letter: string, highlight: GridCell['highlight']) =>
    g.set(`${r},${c}`, { letter, highlight })

  // CROSSWORD — horizontal, row 5 — highlighted as title
  const word = 'CROSSWORD'
  word.split('').forEach((l, i) => set(5, i, l, 'title'))

  // Vertical crossing words — highlighted as cross
  // CLUE down from C (col 0)
  ;[['L',6],['U',7],['E',8]].forEach(([l,r]) => set(r as number, 0, l as string, 'cross'))

  // RIDDLE down from R (col 1)
  ;[['I',6],['D',7],['D',8],['L',9],['E',10]].forEach(([l,r]) => set(r as number, 1, l as string, 'cross'))

  // SONIC down from S (col 3) — 2nd S is at col 4, first S at col 3
  ;[['O',6],['N',7],['I',8],['C',9]].forEach(([l,r]) => set(r as number, 3, l as string, 'cross'))

  // SCORE down from S (col 4)
  ;[['C',6],['O',7],['R',8],['E',9]].forEach(([l,r]) => set(r as number, 4, l as string, 'cross'))

  // WORD down from W (col 5)
  ;[['O',6],['R',7],['D',8]].forEach(([l,r]) => set(r as number, 5, l as string, 'cross'))

  // RUNE down from R (col 7)
  ;[['U',6],['N',7],['E',8]].forEach(([l,r]) => set(r as number, 7, l as string, 'cross'))

  // DOWN down from D (col 8)
  ;[['O',6],['W',7],['N',8]].forEach(([l,r]) => set(r as number, 8, l as string, 'cross'))

  // Words going UP into CROSSWORD letters
  // OAF up to O(5,2): F(2,2),A(3,2),... wait O is at row 5 col 2
  // Going UP means rows 2,3,4 → O at row 5. Word reads top-to-bottom.
  // Use "ALSO" going down ending at O: A(2,2),L(3,2),S(4,2) — then O at (5,2) ✓
  ;[['A',2],['L',3],['S',4]].forEach(([l,r]) => set(r as number, 2, l as string, 'cross'))

  // WRIT going down ending at... hmm let's do up into O at col 6:
  // ONION up: put N(3,6),O(4,6) going down → O at (5,6) ✓ — use "NO" ending O(5,6): N(3,6),O(4,6)
  set(3, 6, 'N', 'cross')
  set(4, 6, 'O', 'cross')

  return g
}

const GRID_DATA = buildGrid()
const GRID_ROWS = 12
const GRID_COLS = 9

export class CrosswordTitleCover implements ICoverTemplate {
  readonly id = 'crossword-title'
  readonly name = 'Crossword Title'
  readonly description = 'The word CROSSWORD spelled out in a real crossword grid with intersecting words'

  render(
    doc: InstanceType<typeof PDFDocument>,
    book: Book,
    pw: number,
    ph: number
  ): void {
    // Dark background
    doc.rect(0, 0, pw, ph).fill('#1C1C2E')

    // Minimal single border — cleaner than double for this design
    const bO = 22
    doc.rect(bO, bO, pw - bO*2, ph - bO*2).lineWidth(0.8).strokeColor('#C9A84C').stroke()

    // Corner diamonds
    for (const c of [{x:bO,y:bO},{x:pw-bO,y:bO},{x:bO,y:ph-bO},{x:pw-bO,y:ph-bO}]) {
      const s = 4
      doc.moveTo(c.x, c.y-s).lineTo(c.x+s, c.y).lineTo(c.x, c.y+s).lineTo(c.x-s, c.y)
        .closePath().fill('#C9A84C')
    }

    // ---------------------------------------------------------------------------
    // Calculate cell size and grid position
    // Grid: GRID_COLS wide × GRID_ROWS tall
    // Target: occupy about 65% of page width, centered horizontally
    // Position: upper-center of page (leaves room for title block below)
    // ---------------------------------------------------------------------------
    const maxGridW = (pw - bO * 2 - 40) * 0.9
    const maxGridH = ph * 0.58
    const cellW = Math.floor(Math.min(maxGridW / GRID_COLS, maxGridH / GRID_ROWS))
    const cellH = cellW  // square cells

    const totalGridW = GRID_COLS * cellW
    const totalGridH = GRID_ROWS * cellH
    const gridX = Math.round((pw - totalGridW) / 2)
    const gridY = Math.round(ph * 0.07)

    // ---------------------------------------------------------------------------
    // Draw grid background (faint cell grid for all positions — crossword convention)
    // ---------------------------------------------------------------------------
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cx = gridX + c * cellW
        const cy = gridY + r * cellH
        const key = `${r},${c}`
        const cell = GRID_DATA.get(key)

        if (!cell) {
          // Blocked cell — draw as near-invisible dark square
          doc.rect(cx, cy, cellW - 1, cellH - 1).fill('#0E0E1A')
        } else if (cell.highlight === 'title') {
          // CROSSWORD letters — gold cells
          doc.rect(cx, cy, cellW - 1, cellH - 1).fill('#2A2040')
          doc.rect(cx, cy, cellW - 1, cellH - 1).lineWidth(1.2).strokeColor('#C9A84C').stroke()
        } else {
          // Crossing word letters — white cells
          doc.rect(cx, cy, cellW - 1, cellH - 1).fill('#2A2040')
          doc.rect(cx, cy, cellW - 1, cellH - 1).lineWidth(0.6).strokeColor('#6E6A8A').stroke()
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Draw letters
    // ---------------------------------------------------------------------------
    const numFontSize = Math.max(4, Math.floor(cellW * 0.22))
    const letterFontSize = Math.floor(cellW * 0.52)
    let clueNum = 1

    // Track which cells get a clue number (starts an across or down word)
    const numberedCells = new Set<string>()
    // Across starters: row 5, col 0 (CROSSWORD)
    numberedCells.add('5,0')
    // Down starters: anything that is a letter with no letter directly above
    GRID_DATA.forEach((_, key) => {
      const [r, c] = key.split(',').map(Number)
      if (!GRID_DATA.has(`${r-1},${c}`)) numberedCells.add(key)
    })

    // Assign numbers in reading order
    const numberMap = new Map<string, number>()
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const key = `${r},${c}`
        if (numberedCells.has(key) && GRID_DATA.has(key)) {
          numberMap.set(key, clueNum++)
        }
      }
    }

    // Render letters and numbers
    GRID_DATA.forEach((cell, key) => {
      const [r, c] = key.split(',').map(Number)
      const cx = gridX + c * cellW
      const cy = gridY + r * cellH

      // Clue number (small, top-left of cell)
      const num = numberMap.get(key)
      if (num !== undefined) {
        doc.font('Helvetica').fontSize(numFontSize).fillColor('#888888')
          .text(String(num), cx + 1.5, cy + 1.5, { lineBreak: false })
      }

      // Letter
      const color = cell.highlight === 'title' ? '#C9A84C' : '#E8E4F0'
      const fontWeight = cell.highlight === 'title' ? 'Helvetica-Bold' : 'Helvetica'
      doc.font(fontWeight).fontSize(letterFontSize).fillColor(color)
        .text(
          cell.letter,
          cx,
          cy + (cellH - letterFontSize) / 2 - 1,
          { width: cellW - 1, align: 'center', lineBreak: false }
        )
    })

    // ---------------------------------------------------------------------------
    // Outer grid border
    // ---------------------------------------------------------------------------
    doc.rect(gridX, gridY, totalGridW, totalGridH).lineWidth(1).strokeColor('#C9A84C').stroke()

    // ---------------------------------------------------------------------------
    // Horizontal divider line between grid and title
    // ---------------------------------------------------------------------------
    const dividerY = gridY + totalGridH + 18
    doc.moveTo(bO + 20, dividerY).lineTo(pw - bO - 20, dividerY)
      .lineWidth(0.5).strokeColor('#C9A84C').stroke()

    // ---------------------------------------------------------------------------
    // Title block — centered below grid
    // ---------------------------------------------------------------------------
    const contentX = bO + 16
    const contentW = pw - (bO + 16) * 2
    const titleY = dividerY + 14

    const titleRaw = book.metadata.title.toUpperCase()
    let titleSize = 22
    while (titleSize > 10) {
      doc.font('Times-Bold').fontSize(titleSize)
      if (doc.widthOfString(titleRaw) <= contentW) break
      titleSize--
    }
    doc.font('Times-Bold').fontSize(titleSize).fillColor('#F5E6C8')
      .text(titleRaw, contentX, titleY, { width: contentW, align: 'center', lineBreak: false })

    let nextY = titleY + titleSize + 10

    if (book.metadata.subtitle) {
      doc.font('Times-Roman').fontSize(10).fillColor('#C9A84C')
        .text(book.metadata.subtitle, contentX, nextY, { width: contentW, align: 'center', lineBreak: false })
      nextY += 16
    }

    const n = book.puzzles.length
    doc.font('Helvetica').fontSize(8).fillColor('#C9A84C')
      .text(`${n} CROSSWORD PUZZLE${n !== 1 ? 'S' : ''}`, contentX, nextY, {
        width: contentW, align: 'center', lineBreak: false,
      })

    doc.moveTo(bO + 20, nextY + 14).lineTo(pw - bO - 20, nextY + 14)
      .lineWidth(0.4).strokeColor('#C9A84C').stroke()

    if (book.metadata.author) {
      doc.font('Times-Italic').fontSize(9.5).fillColor('#C9A84C')
        .text(book.metadata.author, contentX, ph - bO - 24, {
          width: contentW, align: 'center', lineBreak: false,
        })
    }
  }
}
