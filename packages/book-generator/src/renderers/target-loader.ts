import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { RenderTarget, RenderTargetId } from '@puzzle-book/shared'

// __dirname is natively available in CommonJS — no import.meta needed
const TARGETS_DIR = resolve(__dirname, '../targets')

/**
 * Load a RenderTarget config by ID.
 * Config files live in packages/book-generator/src/targets/
 * and are named <id>.json
 *
 * This is the mechanism that keeps output specs as data, not code.
 * Adding a new print size or screen format = add a JSON file.
 */
export function loadRenderTarget(id: RenderTargetId): RenderTarget {
  const filePath = resolve(TARGETS_DIR, `${id}.json`)
  try {
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as RenderTarget
  } catch {
    throw new Error(`RenderTarget not found: "${id}". Expected file at ${filePath}`)
  }
}

/**
 * Convert inches to PDF points (1 inch = 72 points)
 */
export function inchesToPoints(inches: number): number {
  return inches * 72
}

/**
 * Get the full page dimensions (including bleed) in points
 */
export function getPageSizePoints(target: RenderTarget): { width: number; height: number } {
  const bleed = target.dimensions.bleed
  return {
    width: inchesToPoints(target.dimensions.width + bleed * 2),
    height: inchesToPoints(target.dimensions.height + bleed * 2),
  }
}

/**
 * Get the content area (inside margins) in points, as an offset from
 * the top-left of the page (accounting for bleed)
 */
export function getContentArea(target: RenderTarget): {
  x: number
  y: number
  width: number
  height: number
} {
  const bleed = inchesToPoints(target.dimensions.bleed)
  const pageW = inchesToPoints(target.dimensions.width)
  const pageH = inchesToPoints(target.dimensions.height)
  const mt = inchesToPoints(target.margins.top)
  const mb = inchesToPoints(target.margins.bottom)
  const mi = inchesToPoints(target.margins.inside)
  const mo = inchesToPoints(target.margins.outside)

  return {
    x: bleed + mi,
    y: bleed + mt,
    width: pageW - mi - mo,
    height: pageH - mt - mb,
  }
}
