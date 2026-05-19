/**
 * @file parser/response.parser.test.ts
 * @description Unit tests for parseResponse.
 *
 * Tests verify correct parsing, fence stripping, validation rules,
 * normalisation, and graceful handling of every failure mode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseResponse } from './response.parser'
import type { GeneratedWord } from '../types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validWord = (overrides: Partial<GeneratedWord & Record<string, unknown>> = {}): object => ({
  word:       'NEBULA',
  clue:       'A vast cloud of gas and dust in space',
  difficulty: 'medium',
  syllables:  3,
  ...overrides,
})

const validJson = (words: object[] = [validWord()]): string =>
  JSON.stringify(words)

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('parseResponse — valid input', () => {
  it('parses a valid JSON array and returns all words', () => {
    const result = parseResponse(validJson([
      validWord({ word: 'NEBULA', syllables: 3 }),
      validWord({ word: 'COMET',  syllables: 2, difficulty: 'easy' }),
    ]))
    expect(result.words).toHaveLength(2)
    expect(result.totalFound).toBe(2)
    expect(result.totalDropped).toBe(0)
  })

  it('normalises word to uppercase', () => {
    const result = parseResponse(validJson([validWord({ word: 'nebula' })]))
    expect(result.words[0].word).toBe('NEBULA')
  })

  it('trims whitespace from word and clue', () => {
    const result = parseResponse(validJson([validWord({
      word: '  ORBIT  ',
      clue: '  The curved path of a body  ',
    })]))
    expect(result.words[0].word).toBe('ORBIT')
    expect(result.words[0].clue).toBe('The curved path of a body')
  })

  it('preserves difficulty and syllables on valid entries', () => {
    const result = parseResponse(validJson([
      validWord({ difficulty: 'hard', syllables: 4 }),
    ]))
    expect(result.words[0].difficulty).toBe('hard')
    expect(result.words[0].syllables).toBe(4)
  })

  it('returns dropReasons as empty array when all valid', () => {
    const result = parseResponse(validJson())
    expect(result.dropReasons).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Fence stripping
// ---------------------------------------------------------------------------

describe('parseResponse — fence stripping', () => {
  it('strips ```json fence from response', () => {
    const fenced = '```json\n' + validJson() + '\n```'
    const result = parseResponse(fenced)
    expect(result.words).toHaveLength(1)
  })

  it('strips plain ``` fence from response', () => {
    const fenced = '```\n' + validJson() + '\n```'
    const result = parseResponse(fenced)
    expect(result.words).toHaveLength(1)
  })

  it('handles response with preamble text before the array', () => {
    const withPreamble = 'Here are the words you requested:\n' + validJson()
    const result = parseResponse(withPreamble)
    expect(result.words).toHaveLength(1)
  })

  it('handles response with trailing text after the array', () => {
    const withTrailer = validJson() + '\nLet me know if you need more!'
    const result = parseResponse(withTrailer)
    expect(result.words).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// JSON failure modes
// ---------------------------------------------------------------------------

describe('parseResponse — JSON failure modes', () => {
  it('returns empty result for completely empty string', () => {
    const result = parseResponse('')
    expect(result.words).toHaveLength(0)
    expect(result.totalFound).toBe(0)
  })

  it('returns empty result when no JSON array found', () => {
    const result = parseResponse('Sorry, I cannot help with that.')
    expect(result.words).toHaveLength(0)
  })

  it('returns empty result for malformed JSON', () => {
    const result = parseResponse('[{word: NEBULA, broken}]')
    expect(result.words).toHaveLength(0)
  })

  it('returns empty result when JSON is an object not an array', () => {
    const result = parseResponse('{"word": "NEBULA"}')
    expect(result.words).toHaveLength(0)
  })

  it('never throws regardless of input', () => {
    const badInputs = [
      '',
      'null',
      'undefined',
      '[]',
      '[null, null]',
      '{{{{',
      '🎯🚀💥',
      '[' + 'x'.repeat(10000),
    ]
    for (const input of badInputs) {
      expect(() => parseResponse(input)).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// Word field validation
// ---------------------------------------------------------------------------

describe('parseResponse — word field validation', () => {
  it('drops entry with missing word field', () => {
    const result = parseResponse(validJson([{ clue: 'A test', difficulty: 'easy', syllables: 1 }]))
    expect(result.words).toHaveLength(0)
    expect(result.totalDropped).toBe(1)
  })

  it('drops entry where word contains numbers', () => {
    const result = parseResponse(validJson([validWord({ word: 'PLANET9' })]))
    expect(result.words).toHaveLength(0)
    expect(result.dropReasons[0].reason).toMatch(/non-letter/)
  })

  it('drops entry where word contains hyphens', () => {
    const result = parseResponse(validJson([validWord({ word: 'CROSS-WORD' })]))
    expect(result.words).toHaveLength(0)
  })

  it('drops entry where word contains spaces', () => {
    const result = parseResponse(validJson([validWord({ word: 'BLACK HOLE' })]))
    expect(result.words).toHaveLength(0)
  })

  it('drops entry where word is too short', () => {
    const result = parseResponse(validJson([validWord({ word: 'IT' })]))
    expect(result.words).toHaveLength(0)
    expect(result.dropReasons[0].reason).toMatch(/too short/)
  })

  it('drops entry where word is too long', () => {
    const result = parseResponse(validJson([validWord({ word: 'SUPERCALIFRAGILISTIC' })]))
    expect(result.words).toHaveLength(0)
    expect(result.dropReasons[0].reason).toMatch(/too long/)
  })

  it('accepts word at exactly MIN_WORD_LENGTH', () => {
    const result = parseResponse(validJson([validWord({ word: 'CAT', syllables: 1 })]))
    expect(result.words).toHaveLength(1)
  })

  it('accepts word at exactly MAX_WORD_LENGTH (15 chars)', () => {
    const result = parseResponse(validJson([validWord({ word: 'ABCDEFGHIJKLMNO', syllables: 4 })]))
    expect(result.words).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Clue field validation
// ---------------------------------------------------------------------------

describe('parseResponse — clue field validation', () => {
  it('drops entry with missing clue', () => {
    const result = parseResponse(validJson([{ word: 'NEBULA', difficulty: 'medium', syllables: 3 }]))
    expect(result.words).toHaveLength(0)
    expect(result.dropReasons[0].reason).toMatch(/clue/)
  })

  it('drops entry where clue exceeds 120 characters', () => {
    const longClue = 'A'.repeat(121)
    const result = parseResponse(validJson([validWord({ clue: longClue })]))
    expect(result.words).toHaveLength(0)
    expect(result.dropReasons[0].reason).toMatch(/too long/)
  })

  it('accepts clue at exactly 120 characters', () => {
    const exactClue = 'A'.repeat(120)
    const result = parseResponse(validJson([validWord({ clue: exactClue })]))
    expect(result.words).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Difficulty field validation
// ---------------------------------------------------------------------------

describe('parseResponse — difficulty validation', () => {
  it('accepts all three valid difficulty values', () => {
    for (const diff of ['easy', 'medium', 'hard'] as const) {
      const result = parseResponse(validJson([validWord({ difficulty: diff })]))
      expect(result.words).toHaveLength(1)
      expect(result.words[0].difficulty).toBe(diff)
    }
  })

  it('drops entry with invalid difficulty value', () => {
    const result = parseResponse(validJson([validWord({ difficulty: 'extreme' })]))
    expect(result.words).toHaveLength(0)
    expect(result.dropReasons[0].reason).toMatch(/difficulty/)
  })

  it('drops entry with missing difficulty', () => {
    const result = parseResponse(validJson([{ word: 'NEBULA', clue: 'A clue', syllables: 3 }]))
    expect(result.words).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Syllables field validation
// ---------------------------------------------------------------------------

describe('parseResponse — syllables validation', () => {
  it('accepts syllables at boundary values 1 and 4', () => {
    for (const s of [1, 4]) {
      const result = parseResponse(validJson([validWord({ syllables: s })]))
      expect(result.words).toHaveLength(1)
    }
  })

  it('drops entry with syllables = 0', () => {
    const result = parseResponse(validJson([validWord({ syllables: 0 })]))
    expect(result.words).toHaveLength(0)
    expect(result.dropReasons[0].reason).toMatch(/out of range/)
  })

  it('drops entry with syllables = 5', () => {
    const result = parseResponse(validJson([validWord({ syllables: 5 })]))
    expect(result.words).toHaveLength(0)
  })

  it('drops entry with string syllables that are not numeric', () => {
    const result = parseResponse(validJson([validWord({ syllables: 'three' })]))
    expect(result.words).toHaveLength(0)
    expect(result.dropReasons[0].reason).toMatch(/integer/)
  })

  it('accepts numeric string syllables (coerced to number)', () => {
    // Claude sometimes returns "3" instead of 3
    const result = parseResponse(validJson([validWord({ syllables: '3' as any })]))
    expect(result.words).toHaveLength(1)
    expect(result.words[0].syllables).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Mixed valid and invalid entries
// ---------------------------------------------------------------------------

describe('parseResponse — mixed entries', () => {
  it('returns only valid entries from a mixed array', () => {
    const result = parseResponse(validJson([
      validWord({ word: 'STAR',   syllables: 1, difficulty: 'easy' }),
      validWord({ word: 'BAD!!',  syllables: 1 }),     // invalid: non-letters
      validWord({ word: 'GALAXY', syllables: 3 }),
      { word: 'MISSING', clue: '', difficulty: 'easy', syllables: 2 }, // invalid: empty clue
    ]))
    expect(result.words).toHaveLength(2)
    expect(result.totalFound).toBe(4)
    expect(result.totalDropped).toBe(2)
    expect(result.words.map(w => w.word)).toEqual(['STAR', 'GALAXY'])
  })

  it('records a drop reason for every dropped entry', () => {
    const result = parseResponse(validJson([
      validWord({ word: 'OK',    syllables: 1 }), // too short
      validWord({ word: 'VALID', syllables: 1, difficulty: 'easy' }),
      validWord({ word: 'BAD1',  syllables: 1 }), // non-letter
    ]))
    expect(result.dropReasons).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Yield warning (spy on console.warn)
// ---------------------------------------------------------------------------

describe('parseResponse — yield warning', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks() })

  it('warns when yield is below MIN_YIELD_FRACTION of expectedCount', () => {
    // 1 valid word, expected 10 → 10% yield < 60% threshold
    const result = parseResponse(validJson([validWord()]), 10)
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/[Ll]ow yield/))
    expect(result.words).toHaveLength(1)
  })

  it('does not warn when yield meets the threshold', () => {
    const words = Array.from({ length: 9 }, (_, i) =>
      validWord({ word: `WORD${String.fromCharCode(65 + i)}`, syllables: 1, difficulty: 'easy' })
    )
    parseResponse(validJson(words), 10)  // 9/10 = 90% > 60%
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not warn when expectedCount is not provided', () => {
    parseResponse(validJson([validWord()]))
    expect(console.warn).not.toHaveBeenCalled()
  })
})
