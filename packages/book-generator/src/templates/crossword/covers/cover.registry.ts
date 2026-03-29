/**
 * @file cover.registry.ts
 * @description Central registry of all available cover designs.
 *
 * To add a new cover:
 *   1. Create a new file in this directory implementing ICoverTemplate
 *   2. Import and add an instance to COVER_REGISTRY below
 *   3. The new ID is immediately available to CLI --cover flag and web UI
 *
 * Nothing else in the pipeline needs to change.
 */

import type { ICoverTemplate } from './ICoverTemplate'
import { SilhouetteCover } from './silhouette.cover'
import { CrosswordTitleCover } from './crossword-title.cover'

/** All registered covers, keyed by their ID. */
const COVER_REGISTRY: Record<string, ICoverTemplate> = {
  'silhouette':       new SilhouetteCover(),
  'crossword-title':  new CrosswordTitleCover(),
}

/** Default cover ID used when none is specified. */
export const DEFAULT_COVER_ID = 'silhouette'

/**
 * Retrieve a cover by ID.
 * Falls back to the default cover if the ID is not found,
 * logging a warning so the caller is aware.
 */
export const getCover = (id: string): ICoverTemplate => {
  const cover = COVER_REGISTRY[id]
  if (!cover) {
    console.warn(`Cover "${id}" not found. Using default: "${DEFAULT_COVER_ID}"`)
    return COVER_REGISTRY[DEFAULT_COVER_ID]
  }
  return cover
}

/**
 * List all registered covers — used to populate CLI choices and web UI dropdowns.
 */
export const listCovers = (): Array<{ id: string; name: string; description: string }> =>
  Object.values(COVER_REGISTRY).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
  }))
