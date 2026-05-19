/**
 * @file observatory-scene.cover.ts
 * @description Cover for "The Observatory" — a lone figure on a cliff edge
 * at night, looking up at a star-filled sky. Rendered as a silhouette scene
 * using PDFKit drawing primitives. Low-angle perspective: cliff occupies the
 * lower third, sky the upper two-thirds.
 *
 * Layout top to bottom:
 *   1. Title block — THE OBSERVATORY  (Bebas Neue / Helvetica-Bold)
 *   2. Subtitle
 *   3. Night scene — stars, cliff, dome, figure
 *   4. Attribution — WORD Games · Syntax Press · Rhizo Labs
 *   5. Author line
 */

import type PDFDocument from 'pdfkit'
import type { Book } from '@puzzle-book/shared'
import type { ICoverTemplate } from './ICoverTemplate'

// Colour palette — Observatory night theme
const C = {
  sky:        '#0B0C1A',  // near-black deep sky
  skyMid:     '#111428',  // slightly lighter sky midtone
  horizon:    '#1C2240',  // blue-purple horizon glow
  cliff:      '#0D0D14',  // very dark cliff silhouette
  cliffEdge:  '#1A1A28',  // slightly lighter cliff face highlight
  dome:       '#14142A',  // observatory dome silhouette
  domeRim:    '#C9A84C',  // gold rim accent on dome
  starBright: '#FFFFFF',  // bright stars
  starDim:    '#8899CC',  // dim blue-white stars
  gold:       '#C9A84C',  // accent gold throughout
  cream:      '#F5E6C8',  // warm cream for title
  muted:      '#8A7860',  // muted gold for attribution
  border:     '#C9A84C',  // border lines
} as const

// Deterministic pseudo-random from a seed
const seededRand = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

export class ObservatoryCover implements ICoverTemplate {
  readonly id          = 'observatory-scene'
  readonly name        = 'Observatory Scene'
  readonly description = 'Night sky scene with astronomer on cliff, low-angle looking up at stars'

  render(
    doc: InstanceType<typeof PDFDocument>,
    book: Book,
    pw: number,
    ph: number
  ): void {
    this.drawBackground(doc, pw, ph)
    this.drawBorder(doc, pw, ph)
    this.drawStars(doc, pw, ph)
    this.drawMilkyWay(doc, pw, ph)
    this.drawConstellationLines(doc, pw, ph)
    this.drawHorizonGlow(doc, pw, ph)
    this.drawCliff(doc, pw, ph)
    this.drawObservatoryDome(doc, pw, ph)
    this.drawObserverFigure(doc, pw, ph)
    this.drawTitleBlock(doc, book, pw, ph)
    this.drawAttributionBlock(doc, book, pw, ph)
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(doc: InstanceType<typeof PDFDocument>, pw: number, ph: number): void {
    // Sky gradient simulation — three stacked rects of increasing darkness top to bottom
    doc.rect(0, 0, pw, ph * 0.45).fill(C.sky)
    doc.rect(0, ph * 0.45, pw, ph * 0.25).fill(C.skyMid)
    doc.rect(0, ph * 0.70, pw, ph * 0.30).fill(C.cliff)
  }

  // ── Border ─────────────────────────────────────────────────────────────────

  private drawBorder(doc: InstanceType<typeof PDFDocument>, pw: number, ph: number): void {
    const bO = 16, bI = 24
    doc.rect(bO, bO, pw-bO*2, ph-bO*2).lineWidth(1.5).strokeColor(C.border).stroke()
    doc.rect(bI, bI, pw-bI*2, ph-bI*2).lineWidth(0.4).strokeColor(C.border).stroke()

    // Diamond corner ornaments
    const diamonds = [{x:bO,y:bO},{x:pw-bO,y:bO},{x:bO,y:ph-bO},{x:pw-bO,y:ph-bO}]
    for (const c of diamonds) {
      const s = 5
      doc.moveTo(c.x,c.y-s).lineTo(c.x+s,c.y).lineTo(c.x,c.y+s).lineTo(c.x-s,c.y)
        .closePath().fill(C.gold)
    }
  }

  // ── Stars ──────────────────────────────────────────────────────────────────

  private drawStars(doc: InstanceType<typeof PDFDocument>, pw: number, ph: number): void {
    const rand = seededRand(42)
    const skyBottom = ph * 0.72  // stars only appear above cliff line

    // 180 stars of varying sizes and brightness
    for (let i = 0; i < 180; i++) {
      const x    = 28 + rand() * (pw - 56)
      const y    = 28 + rand() * (skyBottom - 60)
      const size = rand() < 0.08 ? 1.4 : rand() < 0.25 ? 0.9 : 0.5
      const bright = rand() < 0.3

      doc.circle(x, y, size).fill(bright ? C.starBright : C.starDim)

      // A few stars get a soft glow ring
      if (size > 1.2) {
        doc.circle(x, y, size * 2.5).fillOpacity(0.08).fill(C.starBright)
        doc.fillOpacity(1)
      }
    }

    // 4 prominent "named" stars — larger with cross glints
    const featured = [
      { x: pw * 0.18, y: ph * 0.10 },
      { x: pw * 0.72, y: ph * 0.08 },
      { x: pw * 0.55, y: ph * 0.22 },
      { x: pw * 0.30, y: ph * 0.32 },
    ]
    for (const s of featured) {
      doc.circle(s.x, s.y, 2).fill(C.starBright)
      // Cross glint — 4 short lines
      const gl = 5
      for (const [dx,dy] of [[0,-gl],[0,gl],[-gl,0],[gl,0]]) {
        doc.moveTo(s.x, s.y).lineTo(s.x+dx, s.y+dy)
          .lineWidth(0.5).strokeColor(C.starBright).stroke()
      }
    }
  }

  // ── Milky Way — faint diffuse band ─────────────────────────────────────────

  private drawMilkyWay(doc: InstanceType<typeof PDFDocument>, pw: number, ph: number): void {
    // Render as a series of soft blurred ellipses at low opacity
    const rand = seededRand(99)
    const band = [
      { x: pw*0.10, y: ph*0.12, rx: 30, ry: 18 },
      { x: pw*0.22, y: ph*0.18, rx: 45, ry: 22 },
      { x: pw*0.38, y: ph*0.14, rx: 55, ry: 20 },
      { x: pw*0.54, y: ph*0.10, rx: 50, ry: 18 },
      { x: pw*0.68, y: ph*0.16, rx: 42, ry: 22 },
      { x: pw*0.80, y: ph*0.24, rx: 35, ry: 18 },
    ]
    for (const b of band) {
      doc.ellipse(b.x, b.y, b.rx, b.ry)
        .fillOpacity(0.04 + rand() * 0.03).fill('#A0B0E8')
    }
    doc.fillOpacity(1)
  }

  // ── Constellation hint lines ───────────────────────────────────────────────

  private drawConstellationLines(doc: InstanceType<typeof PDFDocument>, pw: number, ph: number): void {
    // A subtle constellation — 5 stars connected
    const stars = [
      { x: pw*0.62, y: ph*0.07 },
      { x: pw*0.68, y: ph*0.13 },
      { x: pw*0.74, y: ph*0.10 },
      { x: pw*0.78, y: ph*0.17 },
      { x: pw*0.72, y: ph*0.20 },
    ]
    for (let i = 0; i < stars.length - 1; i++) {
      doc.moveTo(stars[i].x, stars[i].y)
        .lineTo(stars[i+1].x, stars[i+1].y)
        .lineWidth(0.4).strokeColor(C.starDim).stroke()
    }
    for (const s of stars) doc.circle(s.x, s.y, 1).fill(C.starBright)
  }

  // ── Horizon glow ───────────────────────────────────────────────────────────

  private drawHorizonGlow(doc: InstanceType<typeof PDFDocument>, pw: number, ph: number): void {
    // Simulate atmospheric glow above the horizon/cliff line
    const horizonY = ph * 0.72
    const glowH = 60

    for (let i = 0; i < 8; i++) {
      const t = i / 8
      const y = horizonY - glowH * (1 - t)
      const opacity = (1 - t) * 0.07
      doc.rect(28, y, pw - 56, glowH / 8)
        .fillOpacity(opacity).fill(C.horizon)
    }
    doc.fillOpacity(1)
  }

  // ── Cliff silhouette ───────────────────────────────────────────────────────

  private drawCliff(doc: InstanceType<typeof PDFDocument>, pw: number, ph: number): void {
    // Main cliff mass — rises from bottom, peaks at center-right
    const peakX = pw * 0.60
    const peakY = ph * 0.64

    doc.moveTo(0, ph)
      .lineTo(0, ph * 0.82)
      .lineTo(pw * 0.08, ph * 0.79)
      .lineTo(pw * 0.18, ph * 0.76)
      .lineTo(pw * 0.30, ph * 0.74)
      .lineTo(pw * 0.42, ph * 0.70)
      .lineTo(pw * 0.50, ph * 0.67)
      .lineTo(peakX, peakY)          // peak of cliff
      .lineTo(pw * 0.68, ph * 0.67)
      .lineTo(pw * 0.76, ph * 0.70)
      .lineTo(pw * 0.84, ph * 0.73)
      .lineTo(pw * 0.92, ph * 0.75)
      .lineTo(pw, ph * 0.77)
      .lineTo(pw, ph)
      .closePath()
      .fill(C.cliff)

    // Secondary cliff layer — slightly lighter, gives depth
    doc.moveTo(0, ph)
      .lineTo(0, ph * 0.88)
      .lineTo(pw * 0.12, ph * 0.86)
      .lineTo(pw * 0.28, ph * 0.84)
      .lineTo(pw * 0.45, ph * 0.82)
      .lineTo(pw * 0.55, ph * 0.80)
      .lineTo(pw * 0.62, ph * 0.78)
      .lineTo(pw * 0.70, ph * 0.80)
      .lineTo(pw * 0.80, ph * 0.82)
      .lineTo(pw * 0.90, ph * 0.84)
      .lineTo(pw, ph * 0.85)
      .lineTo(pw, ph)
      .closePath()
      .fill(C.cliffEdge)

    // A few cliff edge rock details
    doc.moveTo(pw*0.30, ph*0.74).lineTo(pw*0.33, ph*0.73).lineTo(pw*0.36, ph*0.74)
      .lineWidth(0.5).strokeColor('#2A2A3A').stroke()
    doc.moveTo(pw*0.70, ph*0.70).lineTo(pw*0.73, ph*0.69).lineTo(pw*0.75, ph*0.70)
      .lineWidth(0.5).strokeColor('#2A2A3A').stroke()
  }

  // ── Observatory dome ───────────────────────────────────────────────────────

  private drawObservatoryDome(doc: InstanceType<typeof PDFDocument>, pw: number, ph: number): void {
    const cx  = pw * 0.60
    const baseY = ph * 0.64
    const domeR = pw * 0.055
    const baseH = domeR * 0.4

    // Cylindrical base
    doc.rect(cx - domeR, baseY - baseH, domeR * 2, baseH).fill(C.dome)

    // Dome semi-circle
    // SVG arc: sweep-flag=0 (counterclockwise) draws the top half of the circle
    doc.path(`M ${cx - domeR} ${baseY - baseH} A ${domeR} ${domeR} 0 0 0 ${cx + domeR} ${baseY - baseH} Z`)
      .fill(C.dome)

    // Dome rim — gold accent line
    doc.moveTo(cx - domeR, baseY - baseH)
      .lineTo(cx + domeR, baseY - baseH)
      .lineWidth(1).strokeColor(C.domeRim).stroke()

    // Slit opening in dome
    const slitW = domeR * 0.15
    doc.path(`M ${cx - slitW} ${baseY - baseH} A ${slitW} ${slitW} 0 0 0 ${cx + slitW} ${baseY - baseH}`)
      .lineWidth(0.5).strokeColor(C.gold).stroke()

    // Telescope tube peeking through slit at angle
    doc.moveTo(cx, baseY - baseH - domeR * 0.3)
      .lineTo(cx + domeR * 0.5, baseY - baseH - domeR * 0.9)
      .lineWidth(1.5).strokeColor('#2A2A3A').stroke()
    doc.moveTo(cx, baseY - baseH - domeR * 0.3)
      .lineTo(cx + domeR * 0.5, baseY - baseH - domeR * 0.9)
      .lineWidth(0.8).strokeColor(C.domeRim).stroke()

    // Small finial on top of dome
    doc.circle(cx, baseY - baseH - domeR, 1.5).fill(C.gold)
  }

  // ── Observer figure ────────────────────────────────────────────────────────

  private drawObserverFigure(doc: InstanceType<typeof PDFDocument>, pw: number, ph: number): void {
    // Standing figure on the cliff peak, slightly left of dome, facing skyward
    const figX = pw * 0.46
    const figBaseY = ph * 0.664  // standing on cliff surface
    const figH = 26              // total figure height in points

    // Head
    doc.circle(figX, figBaseY - figH, 3.5).fill(C.cliffEdge)

    // Body — slight backward lean (looking up)
    doc.moveTo(figX, figBaseY - figH + 3.5)
      .lineTo(figX + 2, figBaseY - figH * 0.45)
      .lineWidth(1.5).strokeColor(C.cliffEdge).stroke()

    // Legs
    doc.moveTo(figX + 2, figBaseY - figH * 0.45)
      .lineTo(figX - 1, figBaseY)
      .lineWidth(1.5).strokeColor(C.cliffEdge).stroke()
    doc.moveTo(figX + 2, figBaseY - figH * 0.45)
      .lineTo(figX + 4, figBaseY)
      .lineWidth(1.5).strokeColor(C.cliffEdge).stroke()

    // Arms raised upward pointing at sky
    doc.moveTo(figX + 1, figBaseY - figH * 0.65)
      .lineTo(figX - 6, figBaseY - figH * 0.9)
      .lineWidth(1.2).strokeColor(C.cliffEdge).stroke()
    doc.moveTo(figX + 1, figBaseY - figH * 0.65)
      .lineTo(figX + 7, figBaseY - figH * 0.95)
      .lineWidth(1.2).strokeColor(C.cliffEdge).stroke()

    // Gaze line — faint dotted line from figure toward a bright star
    const starX = pw * 0.30, starY = ph * 0.32
    doc.moveTo(figX, figBaseY - figH + 3)
      .lineTo(starX, starY)
      .lineWidth(0.3).strokeColor(C.gold).dash(3, { space: 4 }).stroke()
    doc.undash()
  }

  // ── Title block ────────────────────────────────────────────────────────────

  private drawTitleBlock(
    doc: InstanceType<typeof PDFDocument>,
    book: Book,
    pw: number,
    ph: number
  ): void {
    const bI = 24
    const contentX = bI + 16
    const contentW = pw - (bI + 16) * 2

    // Rule below border before title
    const ruleY = bI + 18
    doc.moveTo(bI + 20, ruleY).lineTo(pw - bI - 20, ruleY)
      .lineWidth(0.6).strokeColor(C.gold).stroke()

    // Title — Bebas Neue feel (Helvetica-Bold wide-tracked)
    const titleRaw = book.metadata.title.toUpperCase()
    let titleSize = 30
    doc.font('Helvetica-Bold')
    while (titleSize > 14) {
      doc.fontSize(titleSize)
      if (doc.widthOfString(titleRaw) <= contentW) break
      titleSize--
    }
    doc.font('Helvetica-Bold').fontSize(titleSize).fillColor(C.cream)
      .text(titleRaw, contentX, ruleY + 10, {
        width: contentW, align: 'center', lineBreak: false,
        characterSpacing: 4,
      })

    const afterTitle = ruleY + titleSize + 16

    // Subtitle — Instrument Serif feel (Times-Italic)
    if (book.metadata.subtitle) {
      doc.font('Times-Italic').fontSize(11).fillColor(C.gold)
        .text(book.metadata.subtitle, contentX, afterTitle, {
          width: contentW, align: 'center', lineBreak: false,
        })
    }

    // Puzzle count
    const n = book.puzzles.length
    const countY = afterTitle + (book.metadata.subtitle ? 20 : 0)
    doc.font('Helvetica').fontSize(9).fillColor(C.muted)
      .text(`${n} Crossword Puzzles`, contentX, countY, {
        width: contentW, align: 'center', lineBreak: false,
        characterSpacing: 2,
      })

    // Rule below count
    const rule2Y = countY + 16
    doc.moveTo(bI + 20, rule2Y).lineTo(pw - bI - 20, rule2Y)
      .lineWidth(0.4).strokeColor(C.gold).stroke()
  }

  // ── Attribution block ──────────────────────────────────────────────────────

  private drawAttributionBlock(
    doc: InstanceType<typeof PDFDocument>,
    book: Book,
    pw: number,
    ph: number
  ): void {
    const bI = 24
    const contentX = bI + 16
    const contentW = pw - (bI + 16) * 2

    // Author — Instrument Serif Italic
    if (book.metadata.author) {
      doc.font('Times-Italic').fontSize(11).fillColor(C.gold)
        .text(book.metadata.author, contentX, ph - bI - 52, {
          width: contentW, align: 'center', lineBreak: false,
        })
    }

    // Publisher lines — Courier Prime feel
    const pubLine = 'WORD Games  ·  A Syntax Press Production  ·  A Rhizo Labs Expedition'
    doc.font('Courier').fontSize(7).fillColor(C.muted)
      .text(pubLine, contentX, ph - bI - 32, {
        width: contentW, align: 'center', lineBreak: false,
        characterSpacing: 0.5,
      })
  }
}
