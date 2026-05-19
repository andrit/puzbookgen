import type { ICoverTemplate } from './ICoverTemplate'
import { SilhouetteCover } from './silhouette.cover'
import { CrosswordTitleCover } from './crossword-title.cover'
import { ObservatoryCover } from './observatory-scene.cover'

const COVER_REGISTRY: Record<string, ICoverTemplate> = {
  'silhouette':         new SilhouetteCover(),
  'crossword-title':    new CrosswordTitleCover(),
  'observatory-scene':  new ObservatoryCover(),
}

export const DEFAULT_COVER_ID = 'observatory-scene'

export const getCover = (id: string): ICoverTemplate => {
  const cover = COVER_REGISTRY[id]
  if (!cover) {
    console.warn(`Cover "${id}" not found. Using default: "${DEFAULT_COVER_ID}"`)
    return COVER_REGISTRY[DEFAULT_COVER_ID]
  }
  return cover
}

export const listCovers = (): Array<{ id: string; name: string; description: string }> =>
  Object.values(COVER_REGISTRY).map(c => ({ id: c.id, name: c.name, description: c.description }))
