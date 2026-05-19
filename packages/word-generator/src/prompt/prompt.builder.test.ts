/**
 * @file prompt/prompt.builder.test.ts
 * @description Unit tests for buildPrompt and getSystemPrompt.
 *
 * Tests verify that the prompt contains all required constraints and
 * instructions without testing for exact wording — so refactoring the
 * prose doesn't break tests as long as semantics are preserved.
 */

import { describe, it, expect } from 'vitest'
import { buildPrompt, getSystemPrompt } from './prompt.builder'
import type { GeneratorOptions } from '../types'
import {
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH,
  MAX_CLUE_LENGTH,
} from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseOpts = (overrides: Partial<GeneratorOptions> = {}): GeneratorOptions => ({
  theme:      'Ancient Civilizations',
  count:      150,
  maxRetries: 3,
  ...overrides,
})

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

describe('getSystemPrompt', () => {
  it('instructs Claude to return JSON only — no preamble', () => {
    const sys = getSystemPrompt()
    expect(sys).toContain('ONLY a valid JSON array')
    expect(sys).toContain('No preamble')
  })

  it('specifies all four required JSON fields', () => {
    const sys = getSystemPrompt()
    expect(sys).toContain('"word"')
    expect(sys).toContain('"clue"')
    expect(sys).toContain('"difficulty"')
    expect(sys).toContain('"syllables"')
  })

  it('specifies letters-only constraint for word field', () => {
    const sys = getSystemPrompt()
    expect(sys).toMatch(/[Ll]etters only/i)
  })

  it('specifies correct min and max word length', () => {
    const sys = getSystemPrompt()
    expect(sys).toContain(String(MIN_WORD_LENGTH))
    expect(sys).toContain(String(MAX_WORD_LENGTH))
  })

  it('specifies max clue length', () => {
    const sys = getSystemPrompt()
    expect(sys).toContain(String(MAX_CLUE_LENGTH))
  })

  it('specifies all three difficulty levels', () => {
    const sys = getSystemPrompt()
    expect(sys).toContain('"easy"')
    expect(sys).toContain('"medium"')
    expect(sys).toContain('"hard"')
  })

  it('specifies syllable count constraint', () => {
    const sys = getSystemPrompt()
    expect(sys).toMatch(/syllable/i)
  })

  it('specifies the syllable mix target percentages', () => {
    const sys = getSystemPrompt()
    expect(sys).toContain('25%')
    expect(sys).toContain('50%')
  })

  it('instructs response to begin with [ and end with ]', () => {
    const sys = getSystemPrompt()
    expect(sys).toContain('[')
    expect(sys).toContain(']')
  })

  // ── Clue craft guidelines ──────────────────────────────────────────────────

  it('explicitly forbids dry dictionary definitions', () => {
    const sys = getSystemPrompt()
    expect(sys).toMatch(/do not|NOT|never|avoid/i)
    expect(sys).toMatch(/dictionary/i)
  })

  it('instructs misdirection as a clue technique', () => {
    const sys = getSystemPrompt()
    expect(sys).toMatch(/misdirect/i)
  })

  it('instructs double meaning as a clue technique', () => {
    const sys = getSystemPrompt()
    expect(sys).toMatch(/double meaning|two.senses|multiple senses/i)
  })

  it('instructs economy — brevity in clue writing', () => {
    const sys = getSystemPrompt()
    expect(sys).toMatch(/economy|fewest words|cut every/i)
  })

  it('forbids "relating to" and "pertaining to" phrasing', () => {
    const sys = getSystemPrompt()
    expect(sys).toMatch(/relating to|pertaining to/i)
    // Should appear in a NEVER or prohibition context
    expect(sys).toMatch(/NEVER|never|do not/i)
  })

  it('forbids including the answer word in the clue', () => {
    const sys = getSystemPrompt()
    expect(sys).toMatch(/answer word|Copy the answer/i)
  })

  it('includes concrete clue examples to illustrate technique', () => {
    const sys = getSystemPrompt()
    // Examples are present — indicated by quoted sample clue text
    expect(sys).toMatch(/"[A-Za-z '?!,]+"/i)
  })

  it('frames the author as an expert editor not just a generator', () => {
    const sys = getSystemPrompt()
    expect(sys).toMatch(/master|expert|editor|publication/i)
  })
})

// ---------------------------------------------------------------------------
// buildPrompt — user message
// ---------------------------------------------------------------------------

describe('buildPrompt — user message', () => {
  it('includes the theme name in the user message', () => {
    const { user } = buildPrompt(baseOpts({ theme: 'Ancient Civilizations' }))
    expect(user).toContain('Ancient Civilizations')
  })

  it('includes the target word count in the user message', () => {
    const { user } = buildPrompt(baseOpts({ count: 120 }))
    expect(user).toContain('120')
  })

  it('requests exactly count items', () => {
    const { user } = buildPrompt(baseOpts({ count: 75 }))
    expect(user).toContain('exactly 75')
  })

  it('mentions word length variety requirement', () => {
    const { user } = buildPrompt(baseOpts())
    // The requirements section always lists word length guidance
    expect(user).toMatch(/short words|word length|variety|mix of core/i)
  })

  it('instructs no duplicate words', () => {
    const { user } = buildPrompt(baseOpts())
    expect(user).toMatch(/distinct|duplicates|no duplicates/i)
  })

  it('ends with a call to action prompting JSON output', () => {
    const { user } = buildPrompt(baseOpts())
    // The last non-whitespace content should invite the JSON response
    expect(user.trimEnd()).toMatch(/JSON array now:|Return the JSON|now:$/)
  })
})

// ---------------------------------------------------------------------------
// buildPrompt — seed words
// ---------------------------------------------------------------------------

describe('buildPrompt — seed words', () => {
  it('includes seed words in the user message when provided', () => {
    const { user } = buildPrompt(baseOpts({
      seeds: ['HIEROGLYPH', 'PHARAOH', 'NILE'],
    }))
    expect(user).toContain('HIEROGLYPH')
    expect(user).toContain('PHARAOH')
    expect(user).toContain('NILE')
  })

  it('uppercases seed words in the prompt', () => {
    const { user } = buildPrompt(baseOpts({ seeds: ['papyrus', 'sphinx'] }))
    expect(user).toContain('PAPYRUS')
    expect(user).toContain('SPHINX')
  })

  it('marks seed words as required/must-include', () => {
    const { user } = buildPrompt(baseOpts({ seeds: ['PYRAMID'] }))
    expect(user).toMatch(/MUST|required|anchor/i)
  })

  it('omits seed section entirely when no seeds provided', () => {
    const { user } = buildPrompt(baseOpts({ seeds: [] }))
    expect(user).not.toMatch(/anchor words|MUST appear/i)
  })

  it('omits seed section when seeds is undefined', () => {
    const opts = baseOpts()
    delete opts.seeds
    const { user } = buildPrompt(opts)
    expect(user).not.toMatch(/anchor words|MUST appear/i)
  })
})

// ---------------------------------------------------------------------------
// buildPrompt — return shape
// ---------------------------------------------------------------------------

describe('buildPrompt — return shape', () => {
  it('returns an object with system and user fields', () => {
    const result = buildPrompt(baseOpts())
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('system field is a non-empty string', () => {
    const { system } = buildPrompt(baseOpts())
    expect(typeof system).toBe('string')
    expect(system.length).toBeGreaterThan(100)
  })

  it('user field is a non-empty string', () => {
    const { user } = buildPrompt(baseOpts())
    expect(typeof user).toBe('string')
    expect(user.length).toBeGreaterThan(50)
  })

  it('system field is identical for different themes (stable)', () => {
    const { system: s1 } = buildPrompt(baseOpts({ theme: 'Chess' }))
    const { system: s2 } = buildPrompt(baseOpts({ theme: 'Astronomy' }))
    expect(s1).toBe(s2)
  })

  it('user field differs by theme', () => {
    const { user: u1 } = buildPrompt(baseOpts({ theme: 'Chess' }))
    const { user: u2 } = buildPrompt(baseOpts({ theme: 'Astronomy' }))
    expect(u1).not.toBe(u2)
  })
})

// ---------------------------------------------------------------------------
// buildPrompt — analysis integration
// ---------------------------------------------------------------------------

import type { WordListAnalysis } from '../types'

const mockAnalysis = (summary = 'Test summary'): WordListAnalysis => ({
  total:     75,
  counts:    { short: 5, medium: 50, long: 20 },
  fractions: { short: 0.07, medium: 0.67, long: 0.27 },
  targets:   { short: 0.55, medium: 0.35, long: 0.10 },
  summary,
})

describe('buildPrompt — analysis integration', () => {
  it('includes analysis summary in user message when provided', () => {
    const { user } = buildPrompt(baseOpts(), mockAnalysis('Short words needed urgently'))
    expect(user).toContain('Short words needed urgently')
  })

  it('includes word length guidance section header when analysis provided', () => {
    const { user } = buildPrompt(baseOpts(), mockAnalysis())
    expect(user).toMatch(/WORD LENGTH GUIDANCE/i)
  })

  it('omits length guidance section when no analysis provided', () => {
    const { user } = buildPrompt(baseOpts())
    expect(user).not.toMatch(/WORD LENGTH GUIDANCE/i)
  })

  it('system prompt is unchanged regardless of analysis', () => {
    const { system: s1 } = buildPrompt(baseOpts())
    const { system: s2 } = buildPrompt(baseOpts(), mockAnalysis())
    expect(s1).toBe(s2)
  })

  it('analysis summary appears between seed section and requirements', () => {
    const { user } = buildPrompt(
      baseOpts({ seeds: ['PYRAMID'] }),
      mockAnalysis('Boost short words')
    )
    const seedPos    = user.indexOf('PYRAMID')
    const analysisPos = user.indexOf('Boost short words')
    const reqPos     = user.indexOf('Requirements:')
    expect(seedPos).toBeLessThan(analysisPos)
    expect(analysisPos).toBeLessThan(reqPos)
  })
})
