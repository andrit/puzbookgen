/**
 * @file generator/word.generator.test.ts
 * @description Unit tests for wordGenerator.generate.
 * callClaude is mocked — no real API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { wordGenerator } from './word.generator'
import type { GeneratedWord } from '../types'

// ---------------------------------------------------------------------------
// Mock callClaude
// ---------------------------------------------------------------------------

vi.mock('../api/claude.client', () => ({
  callClaude: vi.fn(),
}))

import { callClaude } from '../api/claude.client'
const mockCallClaude = vi.mocked(callClaude)

afterEach(() => vi.clearAllMocks())

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

/** Build a valid Claude JSON response string for a list of words */
const mockResponse = (words: GeneratedWord[]): string => JSON.stringify(words)

/** 15 distinct words — enough to meet 60% of count=20 */
const BATCH_15 = Array.from({ length: 15 }, (_, i) =>
  word(`WORD${String.fromCharCode(65 + i)}`)
)

/** 12 distinct words */
const BATCH_12 = Array.from({ length: 12 }, (_, i) =>
  word(`ITEM${String.fromCharCode(65 + i)}`)
)

const BASE_OPTS = {
  theme:      'Astronomy',
  count:      20,
  maxRetries: 3,
  apiKey:     'test-key',
}

// ---------------------------------------------------------------------------
// Basic generation
// ---------------------------------------------------------------------------

describe('wordGenerator.generate — basic generation', () => {
  it('returns a GeneratorResult with words, duplicatesRemoved, apiCallCount', async () => {
    mockCallClaude.mockResolvedValueOnce(mockResponse(BATCH_15))

    const result = await wordGenerator.generate(BASE_OPTS)
    expect(result).toHaveProperty('words')
    expect(result).toHaveProperty('duplicatesRemoved')
    expect(result).toHaveProperty('apiCallCount')
  })

  it('includes words from Claude response in output', async () => {
    mockCallClaude.mockResolvedValueOnce(mockResponse([
      word('NEBULA'), word('COMET'), word('ORBIT'),
    ]))

    const result = await wordGenerator.generate({ ...BASE_OPTS, count: 2 })
    const outputWords = result.words.map(w => w.word)
    expect(outputWords).toContain('NEBULA')
    expect(outputWords).toContain('COMET')
  })

  it('uses exactly 1 API call when yield is sufficient on first attempt', async () => {
    mockCallClaude.mockResolvedValueOnce(mockResponse(BATCH_15))

    const result = await wordGenerator.generate(BASE_OPTS)
    expect(result.apiCallCount).toBe(1)
    expect(mockCallClaude).toHaveBeenCalledTimes(1)
  })

  it('uses apiKey from opts when provided', async () => {
    mockCallClaude.mockResolvedValueOnce(mockResponse(BATCH_15))

    await wordGenerator.generate({ ...BASE_OPTS, apiKey: 'my-key' })
    expect(mockCallClaude).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'my-key'
    )
  })
})

// ---------------------------------------------------------------------------
// Seed words
// ---------------------------------------------------------------------------

describe('wordGenerator.generate — seed words', () => {
  it('passes seeds to buildPrompt (verified via callClaude call arg)', async () => {
    mockCallClaude.mockResolvedValueOnce(mockResponse(BATCH_15))

    await wordGenerator.generate({ ...BASE_OPTS, seeds: ['GALAXY', 'NEBULA'] })

    const [, userArg] = mockCallClaude.mock.calls[0]
    expect(userArg).toContain('GALAXY')
    expect(userArg).toContain('NEBULA')
  })
})

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

describe('wordGenerator.generate — retry logic', () => {
  it('retries when first batch yield is below threshold', async () => {
    // First call: 3 words — below 60% of count=20 (need 12)
    mockCallClaude.mockResolvedValueOnce(mockResponse([
      word('ALPHA'), word('BETA'), word('GAMMA'),
    ]))
    // Second call: 12 more — now above threshold
    mockCallClaude.mockResolvedValueOnce(mockResponse(BATCH_12))

    const result = await wordGenerator.generate(BASE_OPTS)
    expect(result.apiCallCount).toBe(2)
    expect(mockCallClaude).toHaveBeenCalledTimes(2)
  })

  it('accumulates words from multiple API calls', async () => {
    mockCallClaude
      .mockResolvedValueOnce(mockResponse([word('ALPHA'), word('BETA')]))
      .mockResolvedValueOnce(mockResponse(BATCH_12))

    const result = await wordGenerator.generate(BASE_OPTS)
    const outputWords = result.words.map(w => w.word)
    expect(outputWords).toContain('ALPHA')
    expect(outputWords).toContain('BETA')
    expect(outputWords).toContain('ITEMA')
  })

  it('respects maxRetries — stops after limit even with low yield', async () => {
    // All calls return only 2 words — never reaches threshold
    mockCallClaude.mockResolvedValue(mockResponse([word('ALPHA'), word('BETA')]))

    const result = await wordGenerator.generate({ ...BASE_OPTS, maxRetries: 2 })
    expect(result.apiCallCount).toBe(2)
    expect(mockCallClaude).toHaveBeenCalledTimes(2)
  })

  it('stops retrying immediately when yield is met', async () => {
    // First call already exceeds threshold
    mockCallClaude.mockResolvedValueOnce(mockResponse(BATCH_15))

    const result = await wordGenerator.generate({ ...BASE_OPTS, maxRetries: 5 })
    expect(result.apiCallCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('wordGenerator.generate — deduplication', () => {
  it('deduplicates new words against existing list', async () => {
    const existing = [word('NEBULA', { clue: 'Original clue' })]
    mockCallClaude.mockResolvedValueOnce(
      mockResponse([word('NEBULA', { clue: 'New clue' }), word('COMET')])
    )

    const result = await wordGenerator.generate({ ...BASE_OPTS, existing, count: 1 })
    expect(result.duplicatesRemoved).toBe(1)

    // Original clue preserved
    const nebula = result.words.find(w => w.word === 'NEBULA')
    expect(nebula?.clue).toBe('Original clue')
  })

  it('includes existing words in output', async () => {
    const existing = [word('STAR'), word('MOON')]
    mockCallClaude.mockResolvedValueOnce(mockResponse([word('COMET')]))

    const result = await wordGenerator.generate({ ...BASE_OPTS, existing, count: 1 })
    const outputWords = result.words.map(w => w.word)
    expect(outputWords).toContain('STAR')
    expect(outputWords).toContain('MOON')
    expect(outputWords).toContain('COMET')
  })

  it('existing words appear before new words in output', async () => {
    const existing = [word('STAR'), word('MOON')]
    mockCallClaude.mockResolvedValueOnce(mockResponse([word('COMET')]))

    const result = await wordGenerator.generate({ ...BASE_OPTS, existing, count: 1 })
    expect(result.words[0].word).toBe('STAR')
    expect(result.words[1].word).toBe('MOON')
    expect(result.words[2].word).toBe('COMET')
  })

  it('reports zero duplicatesRemoved when all new words are unique', async () => {
    mockCallClaude.mockResolvedValueOnce(mockResponse([word('COMET'), word('ORBIT')]))

    const result = await wordGenerator.generate({ ...BASE_OPTS, existing: [], count: 1 })
    expect(result.duplicatesRemoved).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

describe('wordGenerator.generate — error propagation', () => {
  it('propagates ApiError from callClaude', async () => {
    const { ApiError } = await import('../types')
    mockCallClaude.mockRejectedValueOnce(
      new ApiError('Unauthorized', 401, 'bad key')
    )

    await expect(wordGenerator.generate(BASE_OPTS)).rejects.toThrow('Unauthorized')
  })

  it('propagates network errors from callClaude', async () => {
    mockCallClaude.mockRejectedValueOnce(new Error('Network timeout'))

    await expect(wordGenerator.generate(BASE_OPTS)).rejects.toThrow('Network timeout')
  })

  it('returns empty words list when Claude returns unparseable response', async () => {
    mockCallClaude.mockResolvedValue('this is not JSON at all')

    const result = await wordGenerator.generate({ ...BASE_OPTS, maxRetries: 1 })
    // Should not throw — gracefully returns what it has (possibly empty)
    expect(result).toHaveProperty('words')
    expect(result.apiCallCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe('wordGenerator.generate — defaults', () => {
  it('uses DEFAULT_COUNT when count is not provided', async () => {
    mockCallClaude.mockResolvedValueOnce(mockResponse(BATCH_15))

    const result = await wordGenerator.generate({ theme: 'Chess', apiKey: 'key' } as any)
    // Should not throw — defaults applied internally
    expect(result).toHaveProperty('words')
    expect(result.apiCallCount).toBeGreaterThanOrEqual(1)
  })

  it('treats empty existing array same as no existing', async () => {
    mockCallClaude.mockResolvedValueOnce(mockResponse([word('PAWN'), word('ROOK')]))

    const r1 = await wordGenerator.generate({ ...BASE_OPTS, existing: [],    count: 1 })
    vi.clearAllMocks()
    mockCallClaude.mockResolvedValueOnce(mockResponse([word('PAWN'), word('ROOK')]))
    const r2 = await wordGenerator.generate({ ...BASE_OPTS, existing: undefined as any, count: 1 })

    expect(r1.words.length).toBe(r2.words.length)
  })
})

// ---------------------------------------------------------------------------
// Analysis integration
// ---------------------------------------------------------------------------

describe('wordGenerator.generate — analysis integration', () => {
  it('passes word-length analysis summary into the prompt when existing words provided', async () => {
    const existing = [
      // 10 long words — analysis should flag short words as needed
      ...Array.from({ length: 10 }, () => ({ ...word('ABCDEFGHIJ') })),
    ]
    mockCallClaude.mockResolvedValueOnce(mockResponse(BATCH_15))

    await wordGenerator.generate({ ...BASE_OPTS, existing, count: 1 })

    const [, userArg] = mockCallClaude.mock.calls[0]
    // Analysis summary should appear in the user prompt
    expect(userArg).toMatch(/WORD LENGTH GUIDANCE|short.*underrepresented|short words/i)
  })

  it('does not include length guidance section when existing list is empty', async () => {
    mockCallClaude.mockResolvedValueOnce(mockResponse(BATCH_15))

    await wordGenerator.generate({ ...BASE_OPTS, existing: [], count: 1 })

    const [, userArg] = mockCallClaude.mock.calls[0]
    expect(userArg).not.toMatch(/WORD LENGTH GUIDANCE/i)
  })
})
