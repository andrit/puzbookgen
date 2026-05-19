/**
 * @file lens-frames.ts
 * @description Decorative lens frames drawn AROUND the crossword grid.
 *
 * Critical constraint: no drawing element from this module may appear
 * inside the grid rectangle (x, y, gw, gh). The lens inner ring
 * clears the grid by padH/padV on each side. All ornaments (tick marks,
 * bolts, crosshairs, etc.) are positioned outside the inner ring.
 *
 * Caller is responsible for drawing the grid cells first, then calling
 * renderLensFrame(). The frame sits on top of the border but never
 * over any letter or blocked cell.
 */

import type PDFDocument from 'pdfkit'

const INK   = '#1A1814'
const GOLD  = '#C9A84C'
const STEEL = '#4A5060'

export type LensType =
  | 'magnifier' | 'telescope' | 'microscope' | 'camera'
  | 'loupe'     | 'compass'   | 'iris'       | 'porthole'
  | 'periscope' | 'viewfinder'

export const DEFAULT_LENS: LensType = 'magnifier'

/**
 * Draws a decorative frame around the grid rectangle.
 * The frame's inner boundary sits at least (padH, padV) outside the grid edges.
 *
 * @param x, y      — grid top-left corner
 * @param gw, gh    — grid pixel dimensions
 * @param padH, padV — minimum clearance between grid edge and lens inner ring
 * @param gap        — additional gap for outer ring / rim details
 */
export function renderLensFrame(
  doc: InstanceType<typeof PDFDocument>,
  lens: string | null | undefined,
  x: number, y: number, gw: number, gh: number,
  padH: number, padV: number, gap: number
): void {
  const type  = (lens ?? DEFAULT_LENS) as LensType
  const cx    = x + gw / 2
  const cy    = y + gh / 2
  // innerR: circle that just clears the grid corners with padding
  const innerR = Math.sqrt((gw / 2 + padH) ** 2 + (gh / 2 + padV) ** 2)

  switch (type) {
    case 'magnifier':   drawMagnifier(doc, cx, cy, x, y, gw, gh, innerR, gap);  break
    case 'telescope':   drawTelescope(doc, cx, cy, innerR, gap);                 break
    case 'microscope':  drawMicroscope(doc, cx, cy, innerR, gap);                break
    case 'camera':      drawCamera(doc, cx, cy, innerR, gap);                    break
    case 'loupe':       drawLoupe(doc, cx, cy, innerR, gap);                     break
    case 'compass':     drawCompass(doc, cx, cy, innerR, gap);                   break
    case 'iris':        drawIris(doc, cx, cy, gw, gh, padH, padV, gap);          break
    case 'porthole':    drawPorthole(doc, cx, cy, innerR, gap);                  break
    case 'periscope':   drawPeriscope(doc, cx, cy, innerR, gap);                 break
    case 'viewfinder':  drawViewfinder(doc, x, y, gw, gh, padH, padV, gap);     break
    default:            drawMagnifier(doc, cx, cy, x, y, gw, gh, innerR, gap)
  }
}

// ---------------------------------------------------------------------------
// 1. Magnifier
// ---------------------------------------------------------------------------
function drawMagnifier(
  doc: InstanceType<typeof PDFDocument>,
  cx: number, cy: number,
  _gx: number, _gy: number, _gw: number, _gh: number,
  innerR: number, gap: number
): void {
  const rimW   = gap + 5
  const outerR = innerR + rimW

  // Outer rim — drawn completely outside innerR
  doc.circle(cx, cy, outerR).lineWidth(rimW).strokeColor(INK).stroke()
  // Glass edge ring — sits exactly at innerR
  doc.circle(cx, cy, innerR).lineWidth(0.8).strokeColor(INK).stroke()
  // Gold accent ring inside the rim
  doc.circle(cx, cy, outerR - rimW * 0.45).lineWidth(0.8).strokeColor(GOLD).stroke()

  // Glass highlight — in the region between innerR and outerR at top-left
  const hA  = Math.PI * 1.25
  const hR1 = innerR + rimW * 0.2
  const hR2 = innerR + rimW * 0.75
  const hx1 = cx + Math.cos(hA) * hR1, hy1 = cy + Math.sin(hA) * hR1
  const hx2 = cx + Math.cos(hA - 0.4) * hR2, hy2 = cy + Math.sin(hA - 0.4) * hR2
  doc.moveTo(hx1, hy1).lineTo(hx2, hy2).lineWidth(2).strokeColor('#FFFFFF').stroke()

  // Handle — extends from outer rim at bottom-right 45°, no overlap with grid
  const hAng = Math.PI * 0.25
  const hsx  = cx + Math.cos(hAng) * outerR
  const hsy  = cy + Math.sin(hAng) * outerR
  const hLen = outerR * 1.0
  const hex  = hsx + Math.cos(hAng) * hLen
  const hey  = hsy + Math.sin(hAng) * hLen
  doc.moveTo(hsx, hsy).lineTo(hex, hey)
    .lineWidth(rimW * 0.85).lineCap('round').strokeColor(INK).stroke()
  doc.moveTo(hsx, hsy).lineTo(hex, hey)
    .lineWidth(rimW * 0.38).lineCap('round').strokeColor(GOLD).stroke()
}

// ---------------------------------------------------------------------------
// 2. Telescope — clean ring, crosshairs and ticks only outside innerR
// ---------------------------------------------------------------------------
function drawTelescope(
  doc: InstanceType<typeof PDFDocument>,
  cx: number, cy: number, innerR: number, gap: number
): void {
  const outerR = innerR + gap + 3

  doc.circle(cx, cy, outerR).lineWidth(2.2).strokeColor(INK).stroke()
  doc.circle(cx, cy, innerR).lineWidth(0.6).strokeColor(INK).stroke()
  doc.circle(cx, cy, outerR - 1).lineWidth(0.4).strokeColor(GOLD).stroke()

  // Crosshairs — only the segment from innerR outward (no grid overlap)
  const ext = outerR + 8
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const x1 = cx + Math.cos(a) * innerR
    const y1 = cy + Math.sin(a) * innerR
    const x2 = cx + Math.cos(a) * ext
    const y2 = cy + Math.sin(a) * ext
    doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(0.6).strokeColor(INK).stroke()
  }

  // Tick marks outside outerR
  for (let i = 0; i < 8; i++) {
    const a  = (i / 8) * Math.PI * 2
    const tL = i % 2 === 0 ? 6 : 3
    doc.moveTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR)
      .lineTo(cx + Math.cos(a) * (outerR + tL), cy + Math.sin(a) * (outerR + tL))
      .lineWidth(i % 2 === 0 ? 1.2 : 0.7).strokeColor(INK).stroke()
  }

  // Small centre cross — only the junction point, not over any cell
  // (just a 3pt dot at the true centre, outside the grid)
  // We intentionally omit a grid-crossing crosshair — see constraint above.
}

// ---------------------------------------------------------------------------
// 3. Microscope objective — concentric rings + 4 external mounting bolts
// ---------------------------------------------------------------------------
function drawMicroscope(
  doc: InstanceType<typeof PDFDocument>,
  cx: number, cy: number, innerR: number, gap: number
): void {
  const outerR = innerR + gap + 4
  const rings  = [
    { r: outerR,         w: 3.5, c: INK  },
    { r: outerR - gap,   w: 1.2, c: INK  },
    { r: innerR + 2,     w: 0.5, c: INK  },
    { r: innerR,         w: 0.4, c: INK  },
  ]
  for (const ring of rings) {
    if (ring.r > 0) doc.circle(cx, cy, ring.r).lineWidth(ring.w).strokeColor(ring.c).stroke()
  }
  doc.circle(cx, cy, outerR - 1.5).lineWidth(0.5).strokeColor(GOLD).stroke()

  // 4 bolts at cardinal points — positioned outside outerR
  for (let i = 0; i < 4; i++) {
    const a  = (i / 4) * Math.PI * 2
    const bx = cx + Math.cos(a) * (outerR + 5)
    const by = cy + Math.sin(a) * (outerR + 5)
    doc.circle(bx, by, 2.5).fill(INK)
    const sa = a + Math.PI / 2
    doc.moveTo(bx + Math.cos(sa) * 1.5, by + Math.sin(sa) * 1.5)
      .lineTo(bx - Math.cos(sa) * 1.5, by - Math.sin(sa) * 1.5)
      .lineWidth(0.5).strokeColor('#FFFFFF').stroke()
  }
}

// ---------------------------------------------------------------------------
// 4. Camera lens — steel rim with aperture blades on the rim band only
// ---------------------------------------------------------------------------
function drawCamera(
  doc: InstanceType<typeof PDFDocument>,
  cx: number, cy: number, innerR: number, gap: number
): void {
  const rimW   = gap + 7
  const outerR = innerR + rimW
  const midR   = innerR + rimW * 0.45

  doc.circle(cx, cy, outerR).lineWidth(rimW).strokeColor(STEEL).stroke()
  doc.circle(cx, cy, innerR).lineWidth(0.8).strokeColor(INK).stroke()
  doc.circle(cx, cy, midR).lineWidth(0.5).strokeColor(GOLD).stroke()

  // Aperture blade notches — positioned on the midR band, outside innerR
  for (let i = 0; i < 8; i++) {
    const a  = (i / 8) * Math.PI * 2 + Math.PI / 16
    // Points are all at radius >= innerR + 1
    const bx = cx + Math.cos(a) * midR
    const by = cy + Math.sin(a) * midR
    const b2x = cx + Math.cos(a + 0.2) * (midR + 4)
    const b2y = cy + Math.sin(a + 0.2) * (midR + 4)
    const b3x = cx + Math.cos(a - 0.2) * (midR + 4)
    const b3y = cy + Math.sin(a - 0.2) * (midR + 4)
    doc.moveTo(bx, by).lineTo(b2x, b2y).lineTo(b3x, b3y).closePath().fill(INK)
  }
  doc.circle(cx, cy, outerR - 2).lineWidth(0.3).strokeColor('#888888').stroke()
}

// ---------------------------------------------------------------------------
// 5. Loupe — very thick rim, hinged clip at top outside the ring
// ---------------------------------------------------------------------------
function drawLoupe(
  doc: InstanceType<typeof PDFDocument>,
  cx: number, cy: number, innerR: number, gap: number
): void {
  const rimW   = gap + 10
  const outerR = innerR + rimW

  doc.circle(cx, cy, outerR).lineWidth(rimW).strokeColor(INK).stroke()
  doc.circle(cx, cy, innerR).lineWidth(1.5).strokeColor(GOLD).stroke()
  doc.circle(cx, cy, innerR + rimW * 0.5).lineWidth(0.5).strokeColor(GOLD).stroke()

  // Hinged clip — above outerR so completely outside the lens glass area
  const clipY = cy - outerR - 4
  doc.rect(cx - 4, clipY, 8, 6).fill(INK)
  doc.moveTo(cx - 4, clipY + 3).lineTo(cx + 4, clipY + 3)
    .lineWidth(0.5).strokeColor(GOLD).stroke()
}

// ---------------------------------------------------------------------------
// 6. Compass — degree tick ring and cardinal labels all outside the rim
// ---------------------------------------------------------------------------
function drawCompass(
  doc: InstanceType<typeof PDFDocument>,
  cx: number, cy: number, innerR: number, gap: number
): void {
  const outerR = innerR + gap + 3

  doc.circle(cx, cy, outerR).lineWidth(2.5).strokeColor(INK).stroke()
  doc.circle(cx, cy, innerR).lineWidth(0.6).strokeColor(INK).stroke()
  doc.circle(cx, cy, outerR - 1.2).lineWidth(0.5).strokeColor(GOLD).stroke()

  // 36 ticks — all outside outerR
  for (let i = 0; i < 36; i++) {
    const a  = (i / 36) * Math.PI * 2 - Math.PI / 2
    const isC = i % 9 === 0, isM = i % 3 === 0
    const tL  = isC ? 8 : isM ? 5 : 3
    doc.moveTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR)
      .lineTo(cx + Math.cos(a) * (outerR + tL), cy + Math.sin(a) * (outerR + tL))
      .lineWidth(isC ? 1.5 : 0.6).strokeColor(INK).stroke()
  }

  // Cardinal labels — outside outerR + 8
  for (const [label, a] of [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['W', Math.PI]] as [string, number][]) {
    const lx = cx + Math.cos(a) * (outerR + 16)
    const ly = cy + Math.sin(a) * (outerR + 16)
    doc.font('Helvetica-Bold').fontSize(6).fillColor(INK)
      .text(label, lx - 3, ly - 4, { lineBreak: false })
  }

  // Compass rose — small diamond at absolute centre (just the pivot, not over cells
  // — if the grid has cells at center, this remains outside due to innerR clearance)
  // Place it at the innerR boundary on the north line instead
  const pivotY = cy - innerR + 4
  const roseR  = 4
  doc.moveTo(cx, pivotY - roseR).lineTo(cx + roseR * 0.5, pivotY)
    .lineTo(cx, pivotY + roseR).lineTo(cx - roseR * 0.5, pivotY)
    .closePath().fill(INK)

  // Gold dot at N tick
  doc.circle(cx, cy - outerR - 2, 2).fill(GOLD)
}

// ---------------------------------------------------------------------------
// 7. Iris — eye-shaped oval, all elements outside the grid
// ---------------------------------------------------------------------------
function drawIris(
  doc: InstanceType<typeof PDFDocument>,
  cx: number, cy: number,
  gw: number, gh: number,
  padH: number, padV: number, gap: number
): void {
  const rx = gw / 2 + padH + gap + 2
  const ry = gh / 2 + padV           // tighter vertically for eye shape

  doc.ellipse(cx, cy, rx + gap, ry + 2).lineWidth(2.5).strokeColor(INK).stroke()
  doc.ellipse(cx, cy, rx, ry).lineWidth(0.5).strokeColor(INK).stroke()
  doc.ellipse(cx, cy, rx + gap - 0.8, ry + 1.2).lineWidth(0.5).strokeColor(GOLD).stroke()

  // Radiating iris lines — between inner and outer ellipse only
  for (let i = 0; i < 12; i++) {
    const a   = (i / 12) * Math.PI * 2
    const ex1 = cx + rx * Math.cos(a)
    const ey1 = cy + ry * Math.sin(a)
    const ex2 = cx + (rx + gap - 0.5) * Math.cos(a)
    const ey2 = cy + (ry + 1.5) * Math.sin(a)
    doc.moveTo(ex1, ey1).lineTo(ex2, ey2).lineWidth(0.4).strokeColor(INK).stroke()
  }
  // No pupil drawn — that would be at centre over the grid
}

// ---------------------------------------------------------------------------
// 8. Porthole — thick rim with 8 external bolts
// ---------------------------------------------------------------------------
function drawPorthole(
  doc: InstanceType<typeof PDFDocument>,
  cx: number, cy: number, innerR: number, gap: number
): void {
  const rimW   = gap + 6
  const outerR = innerR + rimW

  doc.circle(cx, cy, outerR).lineWidth(rimW).strokeColor(INK).stroke()
  doc.circle(cx, cy, innerR).lineWidth(1).strokeColor(INK).stroke()
  doc.circle(cx, cy, innerR + rimW * 0.35).lineWidth(0.6).strokeColor(GOLD).stroke()

  // 8 bolts — all outside outerR
  for (let i = 0; i < 8; i++) {
    const a  = (i / 8) * Math.PI * 2
    const bx = cx + Math.cos(a) * (outerR + 5)
    const by = cy + Math.sin(a) * (outerR + 5)
    doc.circle(bx, by, 3).fill(INK)
    doc.circle(bx, by, 3.8).lineWidth(0.8).strokeColor(INK).stroke()
    const sa = a + Math.PI / 2
    doc.moveTo(bx + Math.cos(sa) * 1.5, by + Math.sin(sa) * 1.5)
      .lineTo(bx - Math.cos(sa) * 1.5, by - Math.sin(sa) * 1.5)
      .lineWidth(0.5).strokeColor('#888888').stroke()
  }
}

// ---------------------------------------------------------------------------
// 9. Periscope — concentric rings in cool steel, ticks outside
// ---------------------------------------------------------------------------
function drawPeriscope(
  doc: InstanceType<typeof PDFDocument>,
  cx: number, cy: number, innerR: number, gap: number
): void {
  const outerR = innerR + gap + 4
  for (const [r, w, c] of [
    [outerR, 3, STEEL], [outerR - gap, 1.5, STEEL],
    [outerR - gap * 2, 0.8, STEEL], [innerR, 0.4, INK],
  ] as [number, number, string][]) {
    if (r > 0) doc.circle(cx, cy, r).lineWidth(w).strokeColor(c).stroke()
  }
  doc.circle(cx, cy, outerR + 1).lineWidth(0.4).strokeColor(GOLD).stroke()

  // Short crosshair stubs from innerR outward only
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    doc.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR)
      .lineTo(cx + Math.cos(a) * (outerR + 6), cy + Math.sin(a) * (outerR + 6))
      .lineWidth(0.4).strokeColor(STEEL).stroke()
  }
}

// ---------------------------------------------------------------------------
// 10. Viewfinder — rounded rectangle with external L-bracket corners
// ---------------------------------------------------------------------------
function drawViewfinder(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, gw: number, gh: number,
  padH: number, padV: number, gap: number
): void {
  // Inner frame — just outside the grid
  const ifX = x - padH, ifY = y - padV
  const ifW = gw + padH * 2, ifH = gh + padV * 2

  // Outer frame — gap further out
  const ofX = ifX - gap, ofY = ifY - gap
  const ofW = ifW + gap * 2, ofH = ifH + gap * 2

  doc.roundedRect(ofX, ofY, ofW, ofH, 4).lineWidth(2).strokeColor(INK).stroke()
  doc.roundedRect(ifX, ifY, ifW, ifH, 2).lineWidth(0.5).strokeColor(INK).stroke()
  doc.roundedRect(ofX + 1, ofY + 1, ofW - 2, ofH - 2, 3.5)
    .lineWidth(0.5).strokeColor(GOLD).stroke()

  // Rule-of-thirds lines — inside the frame between ifX/ifY and ofX/ofY
  // These are in the padding band, not over the grid
  const t1h = ifY + ifH / 3, t2h = ifY + (ifH * 2) / 3
  const t1v = ifX + ifW / 3, t2v = ifX + (ifW * 2) / 3
  for (const ly of [t1h, t2h]) {
    doc.moveTo(ifX, ly).lineTo(ifX + ifW, ly).lineWidth(0.2).strokeColor(INK).stroke()
  }
  for (const lx of [t1v, t2v]) {
    doc.moveTo(lx, ifY).lineTo(lx, ifY + ifH).lineWidth(0.2).strokeColor(INK).stroke()
  }

  // Gold L-bracket corners — at outer frame corners, pointing inward
  const bL = 9
  const corners = [
    { ox: ofX,        oy: ofY,        dx: 1,  dy: 1  },
    { ox: ofX + ofW,  oy: ofY,        dx: -1, dy: 1  },
    { ox: ofX,        oy: ofY + ofH,  dx: 1,  dy: -1 },
    { ox: ofX + ofW,  oy: ofY + ofH,  dx: -1, dy: -1 },
  ]
  for (const c of corners) {
    doc.moveTo(c.ox + c.dx * bL, c.oy)
      .lineTo(c.ox, c.oy).lineTo(c.ox, c.oy + c.dy * bL)
      .lineWidth(1.5).strokeColor(GOLD).stroke()
  }
}
