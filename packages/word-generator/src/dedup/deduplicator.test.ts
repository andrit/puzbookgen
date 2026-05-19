/**
 * @file dedup/deduplicator.test.ts
 */

import { describe, it, expect } from 'vitest'
import { deduplicate } from './deduplicator'
import type { GeneratedWord } from '../types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const word = (w: string, overrides: Partial<GeneratedWord> = {}): GeneratedWord => ({
  word:       w.toUpperCase(),
  clue:       `Clue for ${w}`,
  difficulty: 'medium',
  syllables:  2,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Basic merge
// ---------------------------------------------------------------------------

describe('deduplicate — basic merge', () => {
  it('returns existing words when incoming is empty', () => {
    const result = deduplicate([], [word('STAR'), word('MOON')])
    expect(result.merged).toHaveLength(2)
    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
  })

  it('returns incoming words when existing is empty', () => {
    const result = deduplicate([word('STAR'), word('MOON')], [])
    expect(result.merged).toHaveLength(2)
    expect(result.added).toBe(2)
    expect(result.removed).toBe(0)
  })

  it('returns empty merged when both are empty', () => {
    const result = deduplicate([], [])
    expect(result.merged).toHaveLength(0)
    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
  })

  it('combines non-overlapping lists into one', () => {
    const result = deduplicate(
      [word('COMET'), word('ORBIT')],
      [word('STAR'),  word('MOON')]
    )
    expect(result.merged).toHaveLength(4)
    expect(result.added).toBe(2)
    expect(result.removed).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Order preservation
// ---------------------------------------------------------------------------

describe('deduplicate — order preservation', () => {
  it('existing words appear before incoming words', () => {
    const result = deduplicate(
      [word('COMET')],
      [word('STAR'), word('MOON')]
    )
    expect(result.merged[0].word).toBe('STAR')
    expect(result.merged[1].word).toBe('MOON')
    expect(result.merged[2].word).toBe('COMET')
  })

  it('preserves the original order within each list', () => {
    const result = deduplicate(
      [word('DELTA'), word('ALPHA'), word('GAMMA')],
      [word('ZETA'),  word('BETA')]
    )
    const words = result.merged.map(w => w.word)
    expect(words).toEqual(['ZETA', 'BETA', 'DELTA', 'ALPHA', 'GAMMA'])
  })
})

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('deduplicate — duplicate removal', () => {
  it('drops incoming word that matches an existing word', () => {
    const result = deduplicate(
      [word('STAR', { clue: 'Incoming clue' })],
      [word('STAR', { clue: 'Existing clue' })]
    )
    expect(result.merged).toHaveLength(1)
    expect(result.removed).toBe(1)
    expect(result.added).toBe(0)
  })

  it('preserves the existing clue when a duplicate is found', () => {
    const result = deduplicate(
      [word('STAR', { clue: 'Incoming clue', difficulty: 'hard' })],
      [word('STAR', { clue: 'Existing clue', difficulty: 'easy' })]
    )
    expect(result.merged[0].clue).toBe('Existing clue')
    expect(result.merged[0].difficulty).toBe('easy')
  })

  it('matches case-insensitively — lowercase incoming vs uppercase existing', () => {
    const result = deduplicate(
      [{ ...word('STAR'), word: 'star' }],
      [word('STAR')]
    )
    expect(result.merged).toHaveLength(1)
    expect(result.removed).toBe(1)
  })

  it('matches case-insensitively — mixed case', () => {
    const result = deduplicate(
      [{ ...word('NEBULA'), word: 'Nebula' }],
      [word('NEBULA')]
    )
    expect(result.merged).toHaveLength(1)
    expect(result.removed).toBe(1)
  })

  it('drops duplicate incoming words against each other', () => {
    // COMET appears twice in incoming — only first should be added
    const result = deduplicate(
      [word('COMET'), word('COMET')],
      []
    )
    expect(result.merged).toHaveLength(1)
    expect(result.added).toBe(1)
    expect(result.removed).toBe(1)
  })

  it('normalises incoming words to uppercase in merged output', () => {
    const result = deduplicate(
      [{ ...word('ORBIT'), word: 'orbit' }],
      []
    )
    expect(result.merged[0].word).toBe('ORBIT')
  })
})

// ---------------------------------------------------------------------------
// Counts invariant
// ---------------------------------------------------------------------------

describe('deduplicate — counts invariant', () => {
  it('added + removed always equals incoming.length', () => {
    const incoming = [word('A'), word('B'), word('C'), word('D')]
    const existing = [word('B'), word('D')]
    const result = deduplicate(incoming, existing)
    expect(result.added + result.removed).toBe(incoming.length)
  })

  it('holds for all-duplicate incoming', () => {
    const words = [word('STAR'), word('MOON')]
    const result = deduplicate(words, words)
    expect(result.added).toBe(0)
    expect(result.removed).toBe(2)
    expect(result.added + result.removed).toBe(2)
  })

  it('holds for no-duplicate incoming', () => {
    const result = deduplicate(
      [word('COMET'), word('ORBIT')],
      [word('STAR')]
    )
    expect(result.added).toBe(2)
    expect(result.removed).toBe(0)
    expect(result.added + result.removed).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Does not mutate inputs
// ---------------------------------------------------------------------------

describe('deduplicate — immutability', () => {
  it('does not mutate the incoming array', () => {
    const incoming = [word('STAR'), word('MOON')]
    const snapshot = incoming.map(w => ({ ...w }))
    deduplicate(incoming, [])
    expect(incoming).toEqual(snapshot)
  })

  it('does not mutate the existing array', () => {
    const existing = [word('STAR'), word('MOON')]
    const snapshot = existing.map(w => ({ ...w }))
    deduplicate([word('COMET')], existing)
    expect(existing).toEqual(snapshot)
  })
})
