import type PDFDocument from 'pdfkit'
import type {
  Book,
  Puzzle,
  RenderOptions,
  IBookTemplate,
  Cell,
  Clue,
} from '@puzzle-book/shared'
import { getContentArea, inchesToPoints } from '../renderers/target-loader'

/**
 * CrosswordTemplate
 *
 * Handles page-level layout for crossword puzzle books.
 * Receives a PDFKit document instance and draws onto it.
 *
 * This is the primary visual design surface — grid rendering,
 * clue layout, cover design, and answer key all live here.
 *
 * Designed to be replaced or extended for custom visual styles
 * without touching the renderer pipeline.
 */
export class CrosswordTemplate implements IBookTemplate {
  readonly puzzleType = 'crossword' as const
  readonly templateName = 'standard'

  private doc!: InstanceType<typeof PDFDocument>

  /**
   * The renderer passes its PDFKit instance to the template before calling
   * any render methods. This keeps the template stateless between books.
   */
  setDocument(doc: InstanceType<typeof PDFDocument>): void {
    this.doc = doc
  }

  // ---------------------------------------------------------------------------
  // Cover
  // ---------------------------------------------------------------------------

  renderCover(book: Book, options: RenderOptions): void {
    const area = getContentArea(options.target)

    // Background — clean white for MVP
    this.doc.rect(0, 0, this.doc.page.width, this.doc.page.height).fill('#FFFFFF')

    // Title block — centered vertically in upper two-thirds
    const titleY = area.y + area.height * 0.25

    this.doc
      .font('Helvetica-Bold')
      .fontSize(36)
      .fillColor('#000000')
      .text(book.metadata.title, area.x, titleY, {
        width: area.width,
        align: 'center',
      })

    if (book.metadata.subtitle) {
      this.doc
        .font('Helvetica')
        .fontSize(18)
        .fillColor('#444444')
        .text(book.metadata.subtitle, area.x, titleY + 60, {
          width: area.width,
          align: 'center',
        })
    }

    // Decorative rule
    const ruleY = titleY + (book.metadata.subtitle ? 110 : 70)
    this.doc
      .moveTo(area.x + area.width * 0.2, ruleY)
      .lineTo(area.x + area.width * 0.8, ruleY)
      .lineWidth(1.5)
      .strokeColor('#000000')
      .stroke()

    // Puzzle count label
    const puzzleCount = book.puzzles.length
    this.doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor('#222222')
      .text(`${puzzleCount} Crossword Puzzle${puzzleCount !== 1 ? 's' : ''}`, area.x, ruleY + 20, {
        width: area.width,
        align: 'center',
      })

    // Author — bottom of content area
    if (book.metadata.author) {
      this.doc
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#333333')
        .text(book.metadata.author, area.x, area.y + area.height - 40, {
          width: area.width,
          align: 'center',
        })
    }
  }

  // ---------------------------------------------------------------------------
  // Intro Page
  // ---------------------------------------------------------------------------

  renderIntro(book: Book, options: RenderOptions): void {
    const area = getContentArea(options.target)

    this.doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#000000')
      .text('How to Solve', area.x, area.y, { width: area.width })

    this.doc.moveDown(1)

    const introText =
      book.content.intro.text ||
      'Welcome to this collection of crossword puzzles. Each puzzle features a grid of white ' +
        'and black squares. Your goal is to fill in the white squares with letters, forming words ' +
        'that answer the numbered clues.\n\n' +
        'Clues are divided into two groups: Across and Down. The number at the start of each ' +
        'clue corresponds to the numbered square in the grid where the answer begins.\n\n' +
        'The answer key is provided at the back of the book. Good luck!'

    this.doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#000000')
      .text(introText, area.x, this.doc.y, {
        width: area.width,
        lineGap: 4,
      })
  }

  // ---------------------------------------------------------------------------
  // Puzzle Page
  // ---------------------------------------------------------------------------

  renderPuzzlePage(puzzle: Puzzle, pageNumber: number, options: RenderOptions): void {
    const area = getContentArea(options.target)

    // --- Puzzle title / number ---
    const titleText = puzzle.metadata.title || `Puzzle #${pageNumber}`
    this.doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#000000')
      .text(titleText, area.x, area.y, { width: area.width })

    const titleHeight = 24
    const gridTop = area.y + titleHeight

    // --- Determine how to split the page: grid left, clues right ---
    // For 6x9 print, we render grid on top half and clues below
    // For wider targets, side-by-side layout is better — resolved by target width
    const pageWidthIn = options.target.dimensions.width
    const useSideBySide = pageWidthIn >= 7.5

    if (useSideBySide) {
      this.renderSideBySideLayout(puzzle, area, gridTop, options)
    } else {
      this.renderStackedLayout(puzzle, area, gridTop, options)
    }
  }

  // ---------------------------------------------------------------------------
  // Grid rendering — used by both layout modes
  // ---------------------------------------------------------------------------

  private renderGrid(
    puzzle: Puzzle,
    x: number,
    y: number,
    cellSize: number
  ): void {
    const { grid } = puzzle
    const cells = new Map<string, Cell>()
    for (const cell of grid.cells) {
      cells.set(`${cell.row},${cell.col}`, cell)
    }

    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        const cell = cells.get(`${row},${col}`)
        const cx = x + col * cellSize
        const cy = y + row * cellSize

        if (!cell || cell.type === 'blocked') {
          // Filled black square
          this.doc.rect(cx, cy, cellSize, cellSize).fill('#000000')
        } else {
          // White letter cell
          this.doc
            .rect(cx, cy, cellSize, cellSize)
            .fill('#FFFFFF')
            .stroke('#000000')

          // Clue number
          if (cell.number !== null) {
            this.doc
              .font('Helvetica')
              .fontSize(cellSize * 0.28)
              .fillColor('#000000')
              .text(String(cell.number), cx + 1.5, cy + 1.5, {
                lineBreak: false,
              })
          }
        }
      }
    }

    // Outer border
    this.doc
      .rect(x, y, grid.width * cellSize, grid.height * cellSize)
      .lineWidth(1.5)
      .stroke('#000000')
  }

  // ---------------------------------------------------------------------------
  // Clue rendering
  // ---------------------------------------------------------------------------

  private renderClues(
    puzzle: Puzzle,
    x: number,
    y: number,
    width: number,
    options: RenderOptions
  ): void {
    const fontSize = options.target.dimensions.width < 7 ? 7 : 8.5
    const lineGap = 1.5

    const sections: Array<{ label: string; clues: Clue[] }> = [
      { label: 'ACROSS', clues: puzzle.clues.across },
      { label: 'DOWN', clues: puzzle.clues.down },
    ]

    let currentY = y

    for (const section of sections) {
      // Section header
      this.doc
        .font('Helvetica-Bold')
        .fontSize(fontSize + 1)
        .fillColor('#000000')
        .text(section.label, x, currentY, { width, lineBreak: false })

      currentY += fontSize + 6

      // Clue list — two columns for wider layouts
      const colWidth = width > 200 ? (width - 8) / 2 : width
      const useColumns = width > 200
      let col = 0
      let colY = currentY

      for (const clue of section.clues) {
        const clueText = `${clue.number}. ${clue.clue}`
        const clueX = x + (useColumns && col === 1 ? colWidth + 8 : 0)

        this.doc
          .font('Helvetica')
          .fontSize(fontSize)
          .fillColor('#000000')
          .text(clueText, clueX, colY, {
            width: colWidth,
            lineGap,
          })

        const textHeight = this.doc.heightOfString(clueText, { width: colWidth })

        if (useColumns) {
          if (col === 0) {
            col = 1
          } else {
            col = 0
            colY += Math.max(textHeight + lineGap, fontSize + lineGap + 2)
          }
        } else {
          colY += textHeight + lineGap + 2
        }
      }

      currentY = Math.max(colY, currentY) + 10
    }
  }

  // ---------------------------------------------------------------------------
  // Layout modes
  // ---------------------------------------------------------------------------

  private renderStackedLayout(
    puzzle: Puzzle,
    area: { x: number; y: number; width: number; height: number },
    gridTop: number,
    options: RenderOptions
  ): void {
    // Grid takes top portion, clues fill below
    const availableHeight = area.y + area.height - gridTop
    const gridAreaHeight = availableHeight * 0.5
    const cellSize = Math.min(
      Math.floor(gridAreaHeight / puzzle.grid.height),
      Math.floor(area.width / puzzle.grid.width)
    )
    const gridW = cellSize * puzzle.grid.width
    const gridX = area.x + (area.width - gridW) / 2 // Center horizontally

    this.renderGrid(puzzle, gridX, gridTop, cellSize)

    const clueTop = gridTop + cellSize * puzzle.grid.height + 12
    this.renderClues(puzzle, area.x, clueTop, area.width, options)
  }

  private renderSideBySideLayout(
    puzzle: Puzzle,
    area: { x: number; y: number; width: number; height: number },
    gridTop: number,
    options: RenderOptions
  ): void {
    // Grid on left ~55%, clues on right ~45%
    const gridAreaWidth = area.width * 0.55
    const clueAreaWidth = area.width * 0.43
    const clueX = area.x + area.width * 0.57
    const availableHeight = area.y + area.height - gridTop

    const cellSize = Math.min(
      Math.floor(availableHeight / puzzle.grid.height),
      Math.floor(gridAreaWidth / puzzle.grid.width)
    )

    this.renderGrid(puzzle, area.x, gridTop, cellSize)
    this.renderClues(puzzle, clueX, gridTop, clueAreaWidth, options)
  }

  // ---------------------------------------------------------------------------
  // Answer Key
  // ---------------------------------------------------------------------------

  renderAnswerKey(
    puzzles: Puzzle[],
    options: RenderOptions,
    requestNewPage: () => { x: number; y: number; width: number; height: number }
  ): void {
    // -------------------------------------------------------------------------
    // Layout constants
    // -------------------------------------------------------------------------
    const MINI_CELL_SIZE = 10    // pt per cell in mini grids
    const LABEL_HEIGHT = 14      // pt for puzzle title above each grid
    const GRID_GAP_X = 20        // horizontal gap between grid columns
    const GRID_GAP_Y = 20        // vertical gap between grid rows
    const HEADER_HEIGHT = 44     // space reserved for the section heading

    // -------------------------------------------------------------------------
    // Calculate column count from content width and representative grid size
    // -------------------------------------------------------------------------
    let area = getContentArea(options.target)
    const sampleGridW = puzzles[0].grid.width * MINI_CELL_SIZE
    const colCount = Math.max(1, Math.floor((area.width + GRID_GAP_X) / (sampleGridW + GRID_GAP_X)))

    // -------------------------------------------------------------------------
    // Section header
    // -------------------------------------------------------------------------
    this.doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#000000')
      .text('Answer Key', area.x, area.y, { width: area.width, align: 'center' })

    this.doc
      .moveTo(area.x + area.width * 0.3, area.y + 24)
      .lineTo(area.x + area.width * 0.7, area.y + 24)
      .lineWidth(0.75)
      .strokeColor('#888888')
      .stroke()

    let currentY = area.y + HEADER_HEIGHT

    // -------------------------------------------------------------------------
    // Lay out puzzles in columns, adding pages as needed
    // -------------------------------------------------------------------------
    for (let i = 0; i < puzzles.length; i++) {
      const puzzle = puzzles[i]
      const gridW = puzzle.grid.width * MINI_CELL_SIZE
      const gridH = puzzle.grid.height * MINI_CELL_SIZE
      const itemH = LABEL_HEIGHT + gridH

      const col = i % colCount
      const x = area.x + col * (gridW + GRID_GAP_X)

      // Add vertical gap between rows (not before the very first row)
      if (col === 0 && i > 0) {
        currentY += GRID_GAP_Y
      }

      // Overflow: request a new page and reset Y
      if (currentY + itemH > area.y + area.height) {
        area = requestNewPage()
        currentY = area.y
        this.doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#888888')
          .text('Answer Key (continued)', area.x, area.y, { width: area.width, align: 'right' })
        currentY = area.y + 18
      }

      // Puzzle label
      this.doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#333333')
        .text(puzzle.metadata.title || `Puzzle #${i + 1}`, x, currentY, {
          width: gridW,
          align: 'left',
          lineBreak: false,
        })

      // Mini solved grid
      this.renderSolvedGrid(puzzle, x, currentY + LABEL_HEIGHT, MINI_CELL_SIZE)

      // Advance Y only after completing a full row (or on the last item)
      if (col === colCount - 1 || i === puzzles.length - 1) {
        currentY += itemH
      }
    }
  }

  private renderSolvedGrid(puzzle: Puzzle, x: number, y: number, cellSize: number): void {
    const { grid } = puzzle
    const cells = new Map<string, Cell>()
    for (const cell of grid.cells) {
      cells.set(`${cell.row},${cell.col}`, cell)
    }

    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        const cell = cells.get(`${row},${col}`)
        const cx = x + col * cellSize
        const cy = y + row * cellSize

        if (!cell || cell.type === 'blocked') {
          this.doc.rect(cx, cy, cellSize, cellSize).fill('#000000')
        } else {
          this.doc
            .rect(cx, cy, cellSize, cellSize)
            .fill('#FFFFFF')
            .stroke('#AAAAAA')

          if (cell.solution) {
            this.doc
              .font('Helvetica-Bold')
              .fontSize(cellSize * 0.55)
              .fillColor('#000000')
              .text(cell.solution, cx, cy + cellSize * 0.15, {
                width: cellSize,
                align: 'center',
                lineBreak: false,
              })
          }
        }
      }
    }
  }
}
