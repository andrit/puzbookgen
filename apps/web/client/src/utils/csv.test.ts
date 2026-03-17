/**
 * @file csv.test.ts
 * @description Unit tests for the client-side CSV parser.
 *
 * The CSV parser is a pure function over strings — ideal for exhaustive
 * unit testing. Tests cover: valid input, edge cases, malformed input,
 * quoted field handling, column order independence, and difficulty normalisation.
 */

import { describe, it, expect } from 'vitest'
import { parseCSV } from '../utils/csv'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a CSV string from header + rows for readability in tests */
const csv = (header: string, ...rows: string[]): string =>
  [header, ...rows].join('\n')

// ---------------------------------------------------------------------------
// Valid input
// ---------------------------------------------------------------------------

describe('parseCSV — valid input', () => {
  it('parses a minimal two-column CSV', () => {
    const result = parseCSV(csv('word,clue', 'APPLE,A red fruit'))
    expect(result).toHaveLength(1)
    expect(result[0].word).toBe('APPLE')
    expect(result[0].clue).toBe('A red fruit')
  })

  it('uppercases all words', () => {
    const result = parseCSV(csv('word,clue', 'apple,A red fruit'))
    expect(result[0].word).toBe('APPLE')
  })

  it('parses difficulty column when present', () => {
    const result = parseCSV(csv('word,clue,difficulty', 'APPLE,A red fruit,easy'))
    expect(result[0].difficulty).toBe('easy')
  })

  it('defaults to medium difficulty when column is absent', () => {
    const result = parseCSV(csv('word,clue', 'APPLE,A red fruit'))
    expect(result[0].difficulty).toBe('medium')
  })

  it('defaults to medium for unrecognised difficulty value', () => {
    const result = parseCSV(csv('word,clue,difficulty', 'APPLE,A red fruit,banana'))
    expect(result[0].difficulty).toBe('medium')
  })

  it('normalises easy and hard difficulty correctly', () => {
    const result = parseCSV(
      csv('word,clue,difficulty', 'APPLE,fruit,easy', 'CASTLE,fort,hard')
    )
    expect(result[0].difficulty).toBe('easy')
    expect(result[1].difficulty).toBe('hard')
  })

  it('handles difficulty in any case (EASY → easy)', () => {
    const result = parseCSV(csv('word,clue,difficulty', 'APPLE,fruit,EASY'))
    expect(result[0].difficulty).toBe('easy')
  })

  it('parses multiple rows', () => {
    const result = parseCSV(
      csv('word,clue', 'APPLE,fruit', 'BRIDGE,spans water', 'CASTLE,fort')
    )
    expect(result).toHaveLength(3)
  })

  it('is case-insensitive for column headers', () => {
    const result = parseCSV(csv('Word,Clue', 'APPLE,A red fruit'))
    expect(result[0].word).toBe('APPLE')
    expect(result[0].clue).toBe('A red fruit')
  })

  it('handles columns in any order', () => {
    const result = parseCSV(csv('clue,word', 'A red fruit,APPLE'))
    expect(result[0].word).toBe('APPLE')
    expect(result[0].clue).toBe('A red fruit')
  })

  it('trims leading/trailing whitespace from the CSV text', () => {
    const result = parseCSV('  \nword,clue\nAPPLE,fruit\n  ')
    expect(result).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Quoted fields
// ---------------------------------------------------------------------------

describe('parseCSV — quoted fields', () => {
  it('parses a clue wrapped in double quotes', () => {
    const result = parseCSV(csv('word,clue', 'APPLE,"A red, round fruit"'))
    expect(result[0].clue).toBe('A red, round fruit')
  })

  it('handles escaped double quotes inside quoted fields', () => {
    const result = parseCSV(csv('word,clue', 'APPLE,"It\'s ""delicious"""'))
    expect(result[0].clue).toBe('It\'s "delicious"')
  })

  it('does not include quote characters in the parsed value', () => {
    const result = parseCSV(csv('word,clue', '"APPLE","A red fruit"'))
    expect(result[0].word).toBe('APPLE')
    expect(result[0].clue).toBe('A red fruit')
  })
})

// ---------------------------------------------------------------------------
// Filtering / skipping
// ---------------------------------------------------------------------------

describe('parseCSV — row filtering', () => {
  it('skips rows with an empty word', () => {
    const result = parseCSV(csv('word,clue', ',A clue without a word', 'APPLE,fruit'))
    expect(result).toHaveLength(1)
    expect(result[0].word).toBe('APPLE')
  })

  it('skips rows with an empty clue', () => {
    const result = parseCSV(csv('word,clue', 'APPLE,', 'BRIDGE,spans water'))
    expect(result).toHaveLength(1)
    expect(result[0].word).toBe('BRIDGE')
  })

  it('skips rows where word is less than 2 characters', () => {
    const result = parseCSV(csv('word,clue', 'A,single letter', 'APPLE,fruit'))
    expect(result).toHaveLength(1)
    expect(result[0].word).toBe('APPLE')
  })

  it('skips blank lines', () => {
    const result = parseCSV('word,clue\nAPPLE,fruit\n\nBRIDGE,spans water\n')
    expect(result).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('parseCSV — error cases', () => {
  it('throws when input has only a header row', () => {
    expect(() => parseCSV('word,clue')).toThrow()
  })

  it('throws when input is empty', () => {
    expect(() => parseCSV('')).toThrow()
  })

  it('throws when "word" column is missing', () => {
    expect(() => parseCSV(csv('answer,clue', 'APPLE,fruit'))).toThrow(/"word"/)
  })

  it('throws when "clue" column is missing', () => {
    expect(() => parseCSV(csv('word,hint', 'APPLE,fruit'))).toThrow(/"clue"/)
  })

  it('throws when all data rows are filtered out', () => {
    expect(() => parseCSV(csv('word,clue', ',', ' , '))).toThrow(/no valid/i)
  })
})
