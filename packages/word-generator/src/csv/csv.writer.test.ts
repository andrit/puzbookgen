/**
 * @file csv/csv.writer.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeWordsCsv, readWordsCsv } from './csv.writer'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { GeneratedWord } from '../types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TMP = '/tmp/csv-writer-test'

const word = (w: string, overrides: Partial<GeneratedWord> = {}): GeneratedWord => ({
  word:       w.toUpperCase(),
  clue:       `Clue for ${w}`,
  difficulty: 'medium',
  syllables:  2,
  ...overrides,
})

beforeEach(() => mkdirSync(TMP, { recursive: true }))
afterEach(() => rmSync(TMP, { recursive: true, force: true }))

// ---------------------------------------------------------------------------
// writeWordsCsv — output format
// ---------------------------------------------------------------------------

describe('writeWordsCsv — output format', () => {
  it('writes the correct header row', () => {
    writeWordsCsv([word('STAR')], join(TMP, 'out.csv'))
    const content = readFileSync(join(TMP, 'out.csv'), 'utf-8')
    expect(content.split('\n')[0]).toBe('word,clue,difficulty')
  })

  it('writes one row per word after the header', () => {
    writeWordsCsv([word('STAR'), word('MOON')], join(TMP, 'out.csv'))
    const lines = readFileSync(join(TMP, 'out.csv'), 'utf-8').split('\n').filter(Boolean)
    expect(lines).toHaveLength(3) // header + 2 words
  })

  it('writes word in uppercase', () => {
    writeWordsCsv([word('orbit')], join(TMP, 'out.csv'))
    const lines = readFileSync(join(TMP, 'out.csv'), 'utf-8').split('\n')
    expect(lines[1]).toMatch(/^ORBIT,/)
  })

  it('quotes the clue field', () => {
    writeWordsCsv([word('STAR', { clue: 'A bright object' })], join(TMP, 'out.csv'))
    const lines = readFileSync(join(TMP, 'out.csv'), 'utf-8').split('\n')
    expect(lines[1]).toContain('"A bright object"')
  })

  it('writes difficulty as the last field', () => {
    writeWordsCsv([word('STAR', { difficulty: 'hard' })], join(TMP, 'out.csv'))
    const lines = readFileSync(join(TMP, 'out.csv'), 'utf-8').split('\n')
    expect(lines[1]).toMatch(/,hard$/)
  })

  it('handles clues containing commas via RFC 4180 quoting', () => {
    writeWordsCsv([word('STAR', { clue: 'Bright, shiny, and distant' })], join(TMP, 'out.csv'))
    const content = readFileSync(join(TMP, 'out.csv'), 'utf-8')
    expect(content).toContain('"Bright, shiny, and distant"')
  })

  it('handles clues containing double-quotes by escaping them', () => {
    writeWordsCsv([word('STAR', { clue: 'He said "star"' })], join(TMP, 'out.csv'))
    const content = readFileSync(join(TMP, 'out.csv'), 'utf-8')
    expect(content).toContain('"He said ""star"""')
  })

  it('writes an empty file with just a header when words is empty', () => {
    writeWordsCsv([], join(TMP, 'out.csv'))
    const content = readFileSync(join(TMP, 'out.csv'), 'utf-8').trim()
    expect(content).toBe('word,clue,difficulty')
  })
})

// ---------------------------------------------------------------------------
// writeWordsCsv — directory creation
// ---------------------------------------------------------------------------

describe('writeWordsCsv — directory creation', () => {
  it('creates the output directory if it does not exist', () => {
    const nested = join(TMP, 'a', 'b', 'c', 'out.csv')
    writeWordsCsv([word('STAR')], nested)
    expect(existsSync(nested)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// readWordsCsv — happy path
// ---------------------------------------------------------------------------

describe('readWordsCsv — happy path', () => {
  it('reads back words written by writeWordsCsv', () => {
    const original = [
      word('NEBULA', { clue: 'A cloud of gas', difficulty: 'medium' }),
      word('COMET',  { clue: 'Icy space traveller', difficulty: 'easy' }),
    ]
    const path = join(TMP, 'roundtrip.csv')
    writeWordsCsv(original, path)
    const result = readWordsCsv(path)
    expect(result).toHaveLength(2)
    expect(result[0].word).toBe('NEBULA')
    expect(result[0].clue).toBe('A cloud of gas')
    expect(result[0].difficulty).toBe('medium')
    expect(result[1].word).toBe('COMET')
  })

  it('preserves clues with commas after round-trip', () => {
    const path = join(TMP, 'commas.csv')
    writeWordsCsv([word('STAR', { clue: 'Bright, hot, and distant' })], path)
    const result = readWordsCsv(path)
    expect(result[0].clue).toBe('Bright, hot, and distant')
  })

  it('preserves clues with double-quotes after round-trip', () => {
    const path = join(TMP, 'quotes.csv')
    writeWordsCsv([word('STAR', { clue: 'Also called a "sun"' })], path)
    const result = readWordsCsv(path)
    expect(result[0].clue).toBe('Also called a "sun"')
  })

  it('skips the header row', () => {
    const path = join(TMP, 'header.csv')
    writeWordsCsv([word('STAR')], path)
    const result = readWordsCsv(path)
    expect(result.every(w => w.word !== 'WORD')).toBe(true)
    expect(result).toHaveLength(1)
  })

  it('reads an unquoted clue (legacy format)', () => {
    const path = join(TMP, 'legacy.csv')
    writeFileContent(path, 'word,clue,difficulty\nSTAR,A bright star,easy\n')
    const result = readWordsCsv(path)
    expect(result).toHaveLength(1)
    expect(result[0].clue).toBe('A bright star')
    expect(result[0].difficulty).toBe('easy')
  })

  it('normalises word to uppercase when reading', () => {
    const path = join(TMP, 'lower.csv')
    writeFileContent(path, 'word,clue,difficulty\nstar,A star,easy\n')
    const result = readWordsCsv(path)
    expect(result[0].word).toBe('STAR')
  })

  it('returns empty array for empty file', () => {
    const path = join(TMP, 'empty.csv')
    writeFileContent(path, '')
    expect(readWordsCsv(path)).toHaveLength(0)
  })

  it('returns empty array when file does not exist', () => {
    expect(readWordsCsv(join(TMP, 'nonexistent.csv'))).toHaveLength(0)
  })

  it('skips blank lines', () => {
    const path = join(TMP, 'blanks.csv')
    writeFileContent(path, 'word,clue,difficulty\nSTAR,A star,easy\n\n\nMOON,The moon,easy\n')
    expect(readWordsCsv(path)).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// readWordsCsv — malformed rows
// ---------------------------------------------------------------------------

describe('readWordsCsv — malformed rows', () => {
  it('skips rows with missing difficulty field', () => {
    const path = join(TMP, 'bad.csv')
    writeFileContent(path, 'word,clue,difficulty\nSTAR,A star\nMOON,The moon,easy\n')
    expect(readWordsCsv(path)).toHaveLength(1)
    expect(readWordsCsv(path)[0].word).toBe('MOON')
  })

  it('skips rows with invalid difficulty value', () => {
    const path = join(TMP, 'baddiff.csv')
    writeFileContent(path, 'word,clue,difficulty\nSTAR,A star,extreme\nMOON,The moon,easy\n')
    expect(readWordsCsv(path)).toHaveLength(1)
  })

  it('skips header-only file', () => {
    const path = join(TMP, 'headeronly.csv')
    writeFileContent(path, 'word,clue,difficulty\n')
    expect(readWordsCsv(path)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Round-trip integrity — write then read preserves all data
// ---------------------------------------------------------------------------

describe('writeWordsCsv / readWordsCsv — round-trip', () => {
  it('preserves all three fields for all words', () => {
    const words = [
      word('ALPHA',   { clue: 'First Greek letter', difficulty: 'easy'   }),
      word('BETA',    { clue: 'Second Greek letter, a test version', difficulty: 'medium' }),
      word('GAMMA',   { clue: 'Third, and "important" in physics', difficulty: 'hard'   }),
    ]
    const path = join(TMP, 'roundtrip-full.csv')
    writeWordsCsv(words, path)
    const result = readWordsCsv(path)

    expect(result).toHaveLength(3)
    for (let i = 0; i < words.length; i++) {
      expect(result[i].word).toBe(words[i].word)
      expect(result[i].clue).toBe(words[i].clue)
      expect(result[i].difficulty).toBe(words[i].difficulty)
    }
  })
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function writeFileContent(path: string, content: string): void {
  const { writeFileSync } = require('fs')
  writeFileSync(path, content, 'utf-8')
}
