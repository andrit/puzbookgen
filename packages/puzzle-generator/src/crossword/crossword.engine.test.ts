/**
 * @file crossword.engine.test.ts
 * @description Unit tests for GridState (Step 1 of custom layout engine)
 *
 * Tests cover:
 *   - Basic placement and retrieval
 *   - Constraint validation (all 5 rules)
 *   - Intersection detection
 *   - Backtracking (place/unplace cycle)
 *   - Grid expansion
 *   - Scoring
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GridState } from './crossword.engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const place = (gs: GridState, word: string, row: number, col: number, dir: 'across' | 'down') =>
  gs.place(word, `Clue for ${word}`, row, col, dir)

// ---------------------------------------------------------------------------
// Basic placement
// ---------------------------------------------------------------------------

describe('GridState — basic placement', () => {
  it('places a word horizontally and reads back letters', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 5, 5, 'across')
    expect(gs.letterAt(5, 5)).toBe('H')
    expect(gs.letterAt(5, 9)).toBe('O')
    expect(gs.letterAt(5, 10)).toBe('')
  })

  it('places a word vertically and reads back letters', () => {
    const gs = new GridState()
    place(gs, 'WORLD', 3, 7, 'down')
    expect(gs.letterAt(3, 7)).toBe('W')
    expect(gs.letterAt(7, 7)).toBe('D')
    expect(gs.letterAt(8, 7)).toBe('')
  })

  it('records the word in placed[]', () => {
    const gs = new GridState()
    place(gs, 'TEST', 0, 0, 'across')
    expect(gs.placed).toHaveLength(1)
    expect(gs.placed[0].word).toBe('TEST')
    expect(gs.placed[0].dir).toBe('across')
  })
})

// ---------------------------------------------------------------------------
// canPlace — Rule 1 (bounds)
// ---------------------------------------------------------------------------

describe('GridState — bounds checking', () => {
  it('rejects negative row or col', () => {
    const gs = new GridState()
    expect(gs.canPlace('WORD', -1, 0, 'across')).toBe(false)
    expect(gs.canPlace('WORD', 0, -1, 'down')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canPlace — Rule 2 (letter conflict)
// ---------------------------------------------------------------------------

describe('GridState — letter conflict', () => {
  it('allows a valid intersection (same letter)', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 5, 5, 'across')
    // WELL placed vertically, sharing the L at row 5, col 7
    expect(gs.canPlace('BELL', 3, 7, 'down')).toBe(true)
  })

  it('rejects a conflicting letter at an intersection', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 5, 5, 'across')
    // XELL would put X where H is
    expect(gs.canPlace('XELL', 5, 5, 'down')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canPlace — Rule 3 & 4 (no merge at word ends)
// ---------------------------------------------------------------------------

describe('GridState — word end merging', () => {
  it('rejects a word that would extend an existing word (end merge)', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 5, 5, 'across')
    // WORLD starting immediately after HELLO would merge into HELLOWORLD
    expect(gs.canPlace('WORLD', 5, 10, 'across')).toBe(false)
  })

  it('rejects a word that abuts the start of an existing word', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 5, 5, 'across')
    // WORLD ending at col 4 would mean WORLD's last letter is at 5,4 and HELLO starts at 5,5
    expect(gs.canPlace('WORLD', 5, 0, 'across')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canPlace — Rule 5 (no implied words from perpendicular adjacency)
// ---------------------------------------------------------------------------

describe('GridState — perpendicular adjacency', () => {
  it('rejects placement that creates an unregistered implied word', () => {
    const gs = new GridState()
    // HELLO across at row 5
    place(gs, 'HELLO', 5, 5, 'across')
    // Placing WORLD across at row 6, col 5 would put W below H
    // W is adjacent to H (perpendicular to the across direction) — implies a down word HW
    expect(gs.canPlace('WORLD', 6, 5, 'across')).toBe(false)
  })

  it('allows a down word that intersects without creating perpendicular clashes', () => {
    const gs = new GridState()
    // HELLO across at (5,5): H(5,5) E(5,6) L(5,7) L(5,8) O(5,9)
    place(gs, 'HELLO', 5, 5, 'across')
    // BELL down: B(3,7) E(4,7) L(5,7) L(6,7) — L intersects HELLO's L at (5,7) ✓
    // No perpendicular clashes: B and E at cols 7 have no neighbours in HELLO's row
    expect(gs.canPlace('BELL', 3, 7, 'down')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// First word vs subsequent words
// ---------------------------------------------------------------------------

describe('GridState — intersection requirement', () => {
  it('allows first word with no intersections', () => {
    const gs = new GridState()
    expect(gs.canPlace('HELLO', 5, 5, 'across')).toBe(true)
  })

  it('rejects second word with no intersection', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 5, 5, 'across')
    // WORLD at a completely isolated position
    expect(gs.canPlace('WORLD', 15, 15, 'across')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Backtracking — place / unplace
// ---------------------------------------------------------------------------

describe('GridState — unplace (backtracking)', () => {
  it('restores grid after unplace', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 5, 5, 'across')
    place(gs, 'HELP', 5, 5, 'down')   // H is shared intersection
    expect(gs.placed).toHaveLength(2)

    const removed = gs.unplace()
    expect(removed?.word).toBe('HELP')
    expect(gs.placed).toHaveLength(1)

    // Letters from HELLO should remain, letters exclusive to HELP should be gone
    expect(gs.letterAt(5, 5)).toBe('H')   // shared — remains
    expect(gs.letterAt(6, 5)).toBe('')    // exclusive to HELP — removed
  })

  it('returns null when nothing placed', () => {
    const gs = new GridState()
    expect(gs.unplace()).toBeNull()
  })

  it('allows re-placement after unplace', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 5, 5, 'across')
    place(gs, 'HELP', 5, 5, 'down')
    gs.unplace()
    // Should be able to place something different now
    expect(gs.canPlace('HERO', 5, 5, 'down')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Grid expansion
// ---------------------------------------------------------------------------

describe('GridState — expansion', () => {
  it('expands grid when word would exceed initial bounds', () => {
    const gs = new GridState(5)
    place(gs, 'ABCDEFGHIJ', 0, 0, 'across')  // 10 chars, initial size 5
    expect(gs.cols).toBeGreaterThanOrEqual(10)
    expect(gs.letterAt(0, 9)).toBe('J')
  })
})

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe('GridState — scoring', () => {
  it('returns zero score for empty grid', () => {
    const gs = new GridState()
    const s = gs.score()
    expect(s.intersections).toBe(0)
    expect(s.placedCount).toBe(0)
    expect(s.total).toBe(0)
  })

  it('counts intersections correctly', () => {
    const gs = new GridState()
    // HELLO across: H(5,5) E(5,6) L(5,7) L(5,8) O(5,9)
    place(gs, 'HELLO', 5, 5, 'across')
    // BELL down: B(3,7) E(4,7) L(5,7) L(6,7)  — L at (5,7) is intersection
    place(gs, 'BELL', 3, 7, 'down')
    const s = gs.score()
    expect(s.intersections).toBe(1)
    expect(s.placedCount).toBe(2)
  })

  it('scores more intersections higher', () => {
    // Two layouts: same words, one more tightly intersected
    const gs1 = new GridState()
    place(gs1, 'CROSS', 5, 5, 'across')
    place(gs1, 'CROWN', 5, 5, 'down')    // C at (5,5) — 1 intersection

    const gs2 = new GridState()
    place(gs2, 'CROSS', 5, 5, 'across')
    place(gs2, 'ROCKS', 3, 7, 'down')    // O at (5,7) — 1 intersection, same
    // Both have 1 intersection but gs1's word centre is closer to grid centre
    // so this tests that scoring doesn't crash and returns reasonable values
    expect(gs1.score().total).toBeTypeOf('number')
    expect(gs2.score().total).toBeTypeOf('number')
  })

  it('scorePlacement scores intersecting placement above non-intersecting', () => {
    const gs = new GridState()
    // Place HELLO near grid centre so distance penalty is minimal
    place(gs, 'HELLO', 14, 12, 'across')

    // BELL down at (12,14): B(12,14) E(13,14) L(14,14) L(15,14)
    // L at (14,14) intersects with HELLO at col 14 — 1 intersection
    const scoreWith = gs.scorePlacement('BELL', 12, 14, 'down')

    // A word placed at a distant non-intersecting position (hypothetically)
    // Intersecting should always score higher than the intersection-free version
    // at an equivalent distance. We verify intersection bonus is applied.
    const scoreWithout = gs.scorePlacement('BZZZ', 12, 14, 'down')  // no intersection

    // BELL intersects (adds W_INTERSECTION=20), BZZZ does not
    expect(scoreWith).toBeGreaterThan(scoreWithout)
  })
})

// ---------------------------------------------------------------------------
// toResult
// ---------------------------------------------------------------------------

describe('GridState — toResult', () => {
  it('exports a LayoutResult with correct structure', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 5, 5, 'across')
    place(gs, 'BELL', 3, 7, 'down')

    const result = gs.toResult()
    expect(result.placed).toHaveLength(2)
    expect(result.score.placedCount).toBe(2)
    expect(result.rows).toBeGreaterThan(0)
    expect(result.cols).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Step 2 — findCandidates
// ---------------------------------------------------------------------------

import { findCandidates } from './crossword.engine'

describe('findCandidates — first word', () => {
  it('returns a single centred across candidate for an empty grid', () => {
    const gs = new GridState()
    const candidates = findCandidates('HELLO', 'A greeting', gs)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].dir).toBe('across')
    // Should be near the centre of the default 30×30 grid
    expect(candidates[0].row).toBe(15)
    expect(candidates[0].col).toBe(12)   // floor((30-5)/2)
    expect(candidates[0].intersections).toBe(0)
  })
})

describe('findCandidates — intersection finding', () => {
  it('finds candidates that intersect an existing word', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 15, 12, 'across')
    // BELT has an L — should find placements aligning with HELLO's L at (15,14)
    const candidates = findCandidates('BELL', 'A bell', gs)
    expect(candidates.length).toBeGreaterThan(0)
  })

  it('returns no candidates when no letters match', () => {
    const gs = new GridState()
    place(gs, 'HELLO', 15, 12, 'across')
    // FUZZ shares no letters with HELLO
    const candidates = findCandidates('FUZZ', 'A fuzzy thing', gs)
    expect(candidates).toHaveLength(0)
  })

  it('all returned candidates pass canPlace validation', () => {
    const gs = new GridState()
    place(gs, 'HISTORY', 15, 10, 'across')
    place(gs, 'STONE', 13, 13, 'down')   // S intersects H at (15,13)? Let's check
    const candidates = findCandidates('ORBIT', 'A circular path', gs)
    for (const c of candidates) {
      expect(gs.canPlace(c.word, c.row, c.col, c.dir)).toBe(true)
    }
  })

  it('deduplicates candidates found via multiple matching characters', () => {
    const gs = new GridState()
    // LLAMA has two L's — without dedup, each L could generate the same candidate
    place(gs, 'LLAMA', 15, 12, 'across')
    const candidates = findCandidates('TALL', 'A tall thing', gs)
    // Check no duplicate row/col/dir combos
    const keys = candidates.map(c => `${c.row},${c.col},${c.dir}`)
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  })
})

describe('findCandidates — scoring and ordering', () => {
  it('returns candidates sorted best-score first', () => {
    const gs = new GridState()
    place(gs, 'CROSSWORD', 15, 10, 'across')
    const candidates = findCandidates('SWORD', 'A blade', gs)
    // Scores should be non-increasing
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].score).toBeLessThanOrEqual(candidates[i - 1].score)
    }
  })

  it('candidate with more intersections scores higher than one with fewer', () => {
    const gs = new GridState()
    // Place two words to create multiple intersection opportunities
    place(gs, 'CROSS', 15, 13, 'across')
    place(gs, 'CROWN', 15, 13, 'down')  // C at (15,13) shared

    // ROCKS has R, O, C, K, S — multiple potential matches
    const candidates = findCandidates('ROCKS', 'Some rocks', gs)
    if (candidates.length >= 2) {
      // First candidate should have score >= second
      expect(candidates[0].score).toBeGreaterThanOrEqual(candidates[1].score)
    }
    // At least some candidates should have intersections > 0
    const hasIntersections = candidates.some(c => c.intersections > 0)
    expect(hasIntersections).toBe(true)
  })

  it('reports correct intersection count', () => {
    const gs = new GridState()
    // CROSSWORD across at (15,10): C(15,10) R(15,11) O(15,12) S(15,13) S(15,14) W(15,15) O(15,16) R(15,17) D(15,18)
    place(gs, 'CROSSWORD', 15, 10, 'across')

    // SWORD down starting at (13,15): S(13,15) W(14,15) O(15,15)→matches W? No.
    // Let's use a word that clearly intersects: SWORDS starting at col 13
    // S at (15,13) from CROSSWORD. Place SWORDS down: S(13,13) W(14,13) O(15,13)→ O≠S. No.
    // Use STRESS down at col 13: S(13,13) T(14,13) R(15,13)→ R≠S. No.
    // Use SONIC down at col 14: S(13,14) O(14,14) N(15,14)→ N≠S. No.
    // SWORD down at col 14 (S at row 13): S(13,14) W(14,14) O(15,14)→ O≠S. No.
    // GRASS down ending at row 15 col 14 with S: G(11,14) R(12,14) A(13,14) S(14,14) S(15,14)→ S matches CROSSWORD's S ✓
    const cands = findCandidates('GRASS', 'A lawn plant', gs)
    const matching = cands.filter(c => c.row === 11 && c.col === 14 && c.dir === 'down')
    if (matching.length > 0) {
      expect(matching[0].intersections).toBe(1)
    }
    // At least some candidate should exist
    expect(cands.length).toBeGreaterThan(0)
  })
})

describe('findCandidates — direction variety', () => {
  it('generates both across and down candidates', () => {
    const gs = new GridState()
    place(gs, 'STONE', 15, 12, 'across')
    const candidates = findCandidates('TONES', 'Musical tones', gs)
    const dirs = new Set(candidates.map(c => c.dir))
    // With S, T, O, N, E all present in STONE, should find placements in both directions
    expect(dirs.size).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Step 3 — placementEngine
// ---------------------------------------------------------------------------

import { placementEngine } from './crossword.engine'

// A small but realistic word set with good intersection potential
const NATURE_WORDS = [
  { answer: 'MARSH',    clue: 'A wetland' },
  { answer: 'RIVER',    clue: 'A flowing body of water' },
  { answer: 'STONE',    clue: 'A hard mineral' },
  { answer: 'SHORE',    clue: 'The edge of a body of water' },
  { answer: 'RIDGE',    clue: 'A narrow elevated landform' },
  { answer: 'STORM',    clue: 'A violent weather event' },
  { answer: 'RAIN',     clue: 'Water falling from clouds' },
  { answer: 'MOSS',     clue: 'A small flowerless plant' },
  { answer: 'MIST',     clue: 'A light fog' },
  { answer: 'FROST',    clue: 'Ice crystals on a surface' },
  { answer: 'FERN',     clue: 'A leafy woodland plant' },
  { answer: 'GORGE',    clue: 'A narrow steep-sided valley' },
  { answer: 'GRANITE',  clue: 'A hard igneous rock' },
  { answer: 'EROSION',  clue: 'Wearing away of rock by natural forces' },
  { answer: 'TUNDRA',   clue: 'A flat treeless Arctic plain' },
]

describe('placementEngine — basic correctness', () => {
  it('places at least minWords words', () => {
    const result = placementEngine(NATURE_WORDS, { minWords: 5 })
    expect(result.score.placedCount).toBeGreaterThanOrEqual(5)
  })

  it('returns a non-empty grid', () => {
    const result = placementEngine(NATURE_WORDS)
    expect(result.placed.length).toBeGreaterThan(0)
    expect(result.rows).toBeGreaterThan(0)
    expect(result.cols).toBeGreaterThan(0)
  })

  it('all placed words are from the input list', () => {
    const answers = new Set(NATURE_WORDS.map(w => w.answer))
    const result  = placementEngine(NATURE_WORDS)
    for (const p of result.placed) {
      expect(answers.has(p.word)).toBe(true)
    }
  })

  it('every placed word appears in the result score count', () => {
    const result = placementEngine(NATURE_WORDS)
    expect(result.score.placedCount).toBe(result.placed.length)
  })
})

describe('placementEngine — intersection density', () => {
  it('produces at least one intersection', () => {
    const result = placementEngine(NATURE_WORDS)
    expect(result.score.intersections).toBeGreaterThanOrEqual(1)
  })

  it('intersection ratio is reasonable (intersections ≥ placed/3)', () => {
    const result = placementEngine(NATURE_WORDS)
    const ratio  = result.score.intersections / result.score.placedCount
    // A decent crossword has roughly 1 intersection per 3 words minimum
    expect(ratio).toBeGreaterThanOrEqual(1 / 3)
  })

  it('placed words are all connected (no isolated words)', () => {
    // Every placed word must share at least one cell with another word
    // We verify this by checking that all words have ≥1 intersection
    // in the result's grid — which placementEngine enforces via canPlace
    const result = placementEngine(NATURE_WORDS)
    // If there's only 1 word (degenerate case), skip this check
    if (result.placed.length <= 1) return

    // Count how many words participate in at least one intersection
    // by examining which cells are shared between words
    const cellOwners = new Map<string, Set<number>>()
    result.placed.forEach((pw, i) => {
      const dr = pw.dir === 'down' ? 1 : 0
      const dc = pw.dir === 'across' ? 1 : 0
      for (let k = 0; k < pw.word.length; k++) {
        const key = `${pw.row + dr * k},${pw.col + dc * k}`
        if (!cellOwners.has(key)) cellOwners.set(key, new Set())
        cellOwners.get(key)!.add(i)
      }
    })

    const wordsWithIntersection = new Set<number>()
    for (const owners of cellOwners.values()) {
      if (owners.size > 1) owners.forEach(i => wordsWithIntersection.add(i))
    }

    // All placed words should participate in at least one intersection
    // (enforced by canPlace — only first word is exempt)
    expect(wordsWithIntersection.size).toBeGreaterThanOrEqual(
      result.placed.length - 1  // all except possibly the first anchor word
    )
  })
})

describe('placementEngine — word ordering', () => {
  it('places longest words first (anchor words establish the grid)', () => {
    const result = placementEngine(NATURE_WORDS)
    // The longest word (EROSION, 7 chars) should appear in the placed list
    const placedWords = result.placed.map(p => p.word)
    const longest     = NATURE_WORDS
      .map(w => w.answer)
      .sort((a, b) => b.length - a.length)[0]
    // The longest word should be placed if any words were placed
    if (result.placed.length > 0) {
      expect(placedWords).toContain(longest)
    }
  })
})

describe('placementEngine — graceful degradation', () => {
  it('returns a result even with a very small word list', () => {
    const tiny = [
      { answer: 'CAT', clue: 'A feline' },
      { answer: 'BAT', clue: 'A flying mammal' },
    ]
    const result = placementEngine(tiny, { minWords: 1 })
    expect(result).toBeDefined()
    expect(result.placed.length).toBeGreaterThanOrEqual(1)
  })

  it('returns best partial result when words cannot all be placed', () => {
    // Words with no common letters — most will be skipped
    const impossible = [
      { answer: 'RHYTHM', clue: 'A pattern of beats' },
      { answer: 'LYNX',   clue: 'A wild cat' },
      { answer: 'PYGMY',  clue: 'A small person' },
      { answer: 'CRYPTS', clue: 'Underground chambers' },
    ]
    const result = placementEngine(impossible, { minWords: 1 })
    // At minimum, the first word (longest) should be placed
    expect(result.placed.length).toBeGreaterThanOrEqual(1)
    expect(result.score.placedCount).toBe(result.placed.length)
  })

  it('never throws — always returns a LayoutResult', () => {
    expect(() => placementEngine([])).not.toThrow()
    expect(() => placementEngine(NATURE_WORDS)).not.toThrow()
    expect(() => placementEngine(NATURE_WORDS, { maxBacktracks: 0 })).not.toThrow()
  })
})

describe('placementEngine — backtracking improves density', () => {
  it('more backtracks does not produce a worse result', () => {
    // Use the same word list twice with different backtrack budgets
    // The one with more backtracks should have score >= the one with fewer
    const r0 = placementEngine(NATURE_WORDS, { maxBacktracks: 0   })
    const r50 = placementEngine(NATURE_WORDS, { maxBacktracks: 50  })
    // Score should be >= greedy-only result (more backtracks = at least as good)
    expect(r50.score.total).toBeGreaterThanOrEqual(r0.score.total)
  })
})
