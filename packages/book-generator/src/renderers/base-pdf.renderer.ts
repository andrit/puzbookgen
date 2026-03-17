import PDFDocument from 'pdfkit'
import type { RenderTarget } from '@puzzle-book/shared'
import { getPageSizePoints, getContentArea, inchesToPoints } from './target-loader'

/**
 * BasePdfRenderer
 *
 * Shared PDFKit scaffolding used by both PrintRenderer and ScreenRenderer.
 * Handles document creation, page sizing, bleed, and crop marks.
 *
 * Neither renderer knows about puzzle content — that is delegated to
 * IBookTemplate implementations (crossword template, future types, etc.)
 */
export abstract class BasePdfRenderer {
  protected doc!: InstanceType<typeof PDFDocument>
  protected target!: RenderTarget

  protected initDocument(target: RenderTarget): void {
    this.target = target
    const { width, height } = getPageSizePoints(target)

    this.doc = new PDFDocument({
      size: [width, height],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
      info: {
        Producer: 'Puzzle Book Generator',
        Creator: 'Puzzle Book Generator',
      },
    })
  }

  /**
   * Add a new page, positioning the cursor at the content area origin
   */
  protected addPage(): void {
    const { width, height } = getPageSizePoints(this.target)
    this.doc.addPage({ size: [width, height], margins: { top: 0, bottom: 0, left: 0, right: 0 } })

    if (this.target.cropMarks) {
      this.drawCropMarks()
    }
  }

  /**
   * Draw standard crop marks at page corners
   */
  private drawCropMarks(): void {
    const bleed = inchesToPoints(this.target.dimensions.bleed)
    const markLength = inchesToPoints(0.125) // 1/8 inch marks
    const markOffset = inchesToPoints(0.0625) // 1/16 inch gap from bleed edge
    const { width, height } = getPageSizePoints(this.target)

    this.doc.save()
    this.doc.strokeColor('#000000').lineWidth(0.25)

    const corners = [
      { x: bleed, y: bleed },                 // top-left
      { x: width - bleed, y: bleed },          // top-right
      { x: bleed, y: height - bleed },         // bottom-left
      { x: width - bleed, y: height - bleed }, // bottom-right
    ]

    for (const corner of corners) {
      const xDir = corner.x === bleed ? -1 : 1
      const yDir = corner.y === bleed ? -1 : 1

      // Horizontal mark
      this.doc
        .moveTo(corner.x + xDir * markOffset, corner.y)
        .lineTo(corner.x + xDir * (markOffset + markLength), corner.y)
        .stroke()

      // Vertical mark
      this.doc
        .moveTo(corner.x, corner.y + yDir * markOffset)
        .lineTo(corner.x, corner.y + yDir * (markOffset + markLength))
        .stroke()
    }

    this.doc.restore()
  }

  /**
   * Expose content area calculation to subclasses and callbacks
   */
  protected getContentArea(target: RenderTarget): { x: number; y: number; width: number; height: number } {
    return getContentArea(target)
  }

  /**
   * Move the document cursor to the start of the content area
   */
  protected moveToContentStart(): void {
    const area = getContentArea(this.target)
    this.doc.moveTo(area.x, area.y)
  }

  /**
   * Render the document to a Buffer
   */
  protected async finalizeDocument(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      this.doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      this.doc.on('end', () => resolve(Buffer.concat(chunks)))
      this.doc.on('error', reject)
      this.doc.end()
    })
  }
}
