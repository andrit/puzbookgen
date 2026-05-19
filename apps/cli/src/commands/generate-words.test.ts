/**
 * @file commands/generate-words.test.ts
 * @description Unit tests for the generate-words CLI command handler.
 * wordGenerator.generate is mocked — no real API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { GeneratorResult } from '@puzzle-book/word-generator'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@puzzle-book/word-generator', async () => {
  const actual = await vi.importActual<typeof import('@puzzle-book/word-generator')>(
    '@puzzle-book/word-generator'
  )
  return {
    ...actual,
    wordGenerator: {
      generate: vi.fn(),
    },
  }
})

import { wordGenerator, readWordsCsv } from '@puzzle-book/word-generator'
const mockGenerate = vi.mocked(wordGenerator.generate)

import { handler } from './generate-words'
import type { GenerateWordsArgs } from './generate-words'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TMP = '/tmp/generate-words-test'

beforeEach(() => mkdirSync(TMP, { recursive: true }))
afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
  vi.clearAllMocks()
})

const mockResult = (wordCount = 5): GeneratorResult => ({
  words: Array.from({ length: wordCount }, (_, i) => ({
    word:       `WORD${i}`,
    clue:       `Clue for word ${i}`,
    difficulty: 'medium' as const,
    syllables:  2,
  })),
  duplicatesRemoved: 0,
  apiCallCount:      1,
})

const baseArgs = (overrides: Partial<GenerateWordsArgs> = {}): GenerateWordsArgs => ({
  theme:          'Ancient Civilizations',
  output:         join(TMP, 'output.csv'),
  count:          150,
  'dry-run':      false,
  'max-retries':  3,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Basic generation
// ---------------------------------------------------------------------------

describe('generate-words handler — basic generation', () => {
  it('calls wordGenerator.generate with the correct theme', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs({ theme: 'Chess' }))
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'Chess' })
    )
  })

  it('passes count to the generator', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs({ count: 75 }))
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ count: 75 })
    )
  })

  it('passes max-retries to the generator', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs({ 'max-retries': 5 }))
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 5 })
    )
  })

  it('passes api-key to the generator', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs({ 'api-key': 'sk-test-123' }))
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-test-123' })
    )
  })

  it('writes output CSV when generation succeeds', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult(3))
    const output = join(TMP, 'out.csv')
    await handler(baseArgs({ output }))
    expect(existsSync(output)).toBe(true)
  })

  it('written CSV contains the generated words', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult(3))
    const output = join(TMP, 'out.csv')
    await handler(baseArgs({ output }))
    const words = readWordsCsv(output)
    expect(words.length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

describe('generate-words handler — seeds', () => {
  it('parses comma-separated seeds into an array', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs({ seeds: 'NEBULA,COMET,ORBIT' }))
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ seeds: ['NEBULA', 'COMET', 'ORBIT'] })
    )
  })

  it('uppercases seeds', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs({ seeds: 'nebula,comet' }))
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ seeds: ['NEBULA', 'COMET'] })
    )
  })

  it('passes empty seeds array when no seeds provided', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs())
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ seeds: [] })
    )
  })

  it('handles seeds with extra whitespace', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs({ seeds: ' NEBULA , COMET ' }))
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ seeds: ['NEBULA', 'COMET'] })
    )
  })
})

// ---------------------------------------------------------------------------
// Existing word list
// ---------------------------------------------------------------------------

describe('generate-words handler — existing list', () => {
  it('loads existing words and passes them to the generator', async () => {
    // Write a small existing CSV
    const { writeWordsCsv } = await import('@puzzle-book/word-generator')
    const existingPath = join(TMP, 'existing.csv')
    writeWordsCsv([
      { word: 'PYRAMID', clue: 'A pharaoh tomb', difficulty: 'medium', syllables: 3 },
    ], existingPath)

    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs({ existing: existingPath }))

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        existing: expect.arrayContaining([
          expect.objectContaining({ word: 'PYRAMID' }),
        ]),
      })
    )
  })

  it('passes empty existing array when no --existing flag', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs())
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ existing: [] })
    )
  })

  it('passes empty existing array when existing file does not exist', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult())
    await handler(baseArgs({ existing: join(TMP, 'nonexistent.csv') }))
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ existing: [] })
    )
  })
})

// ---------------------------------------------------------------------------
// Dry run
// ---------------------------------------------------------------------------

describe('generate-words handler — dry run', () => {
  it('does not write output file in dry-run mode', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult(5))
    const output = join(TMP, 'should-not-exist.csv')
    await handler(baseArgs({ output, 'dry-run': true }))
    expect(existsSync(output)).toBe(false)
  })

  it('still calls the generator in dry-run mode', async () => {
    mockGenerate.mockResolvedValueOnce(mockResult(5))
    await handler(baseArgs({ 'dry-run': true }))
    expect(mockGenerate).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('generate-words handler — error handling', () => {
  it('exits process on generator failure', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('API down'))
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    await expect(handler(baseArgs())).rejects.toThrow('process.exit called')
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})
