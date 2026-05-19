/**
 * @file generator/word.generator.ts
 * @description Orchestrates the full word generation pipeline for one theme.
 *
 * Pipeline:
 *   buildPrompt → callClaude → parseResponse → [retry if low yield]
 *   → deduplicate(allNewWords, existing) → return GeneratorResult
 *
 * Retry logic:
 *   After each API call, if the cumulative new words gathered is still below
 *   MIN_YIELD_FRACTION × count AND retries remain, another call is made.
 *   New words from each call are accumulated before deduplication so the
 *   deduplicator sees the full set at once.
 *
 * The orchestrator is the only module that imports all others.
 * In tests, callClaude is mocked — no real API calls are made.
 */

import { buildPrompt }    from '../prompt/prompt.builder'
import { callClaude }     from '../api/claude.client'
import { parseResponse }  from '../parser/response.parser'
import { deduplicate }    from '../dedup/deduplicator'
import { analyzeWordList } from '../csv/csv.writer'
import type {
  GeneratorOptions,
  GeneratorResult,
  GeneratedWord,
} from '../types'
import { MIN_YIELD_FRACTION, DEFAULT_COUNT, DEFAULT_MAX_RETRIES } from '../types'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const wordGenerator = {
  /**
   * generate — runs the full pipeline for one theme.
   *
   * @param opts.theme       Theme name, e.g. "Ancient Civilizations"
   * @param opts.seeds       Optional anchor words to include
   * @param opts.count       Target output word count (default 150)
   * @param opts.maxRetries  Max API attempts on low yield (default 3)
   * @param opts.existing    Words already in the word list (for dedup)
   * @param opts.apiKey      API key — falls back to ANTHROPIC_API_KEY
   */
  generate,
}

async function generate(
  opts: GeneratorOptions & { existing?: GeneratedWord[] }
): Promise<GeneratorResult> {
  const {
    theme,
    seeds       = [],
    count       = DEFAULT_COUNT,
    maxRetries  = DEFAULT_MAX_RETRIES,
    apiKey,
    existing    = [],
  } = opts

  // Analyse the existing list so buildPrompt can tailor the length mix.
  // Only pass analysis when there are existing words — an empty list produces
  // the default mix which is already encoded in the system prompt.
  const analysis = existing.length > 0 ? analyzeWordList(existing) : undefined
  const { system, user } = buildPrompt({ theme, seeds, count, maxRetries, apiKey }, analysis)

  const accumulated: GeneratedWord[] = []
  let apiCallCount = 0

  // ── Retry loop ────────────────────────────────────────────────────────────
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    apiCallCount++

    let raw: string
    try {
      raw = await callClaude(system, user, apiKey)
    } catch (err) {
      // Surface API errors immediately — don't silently retry on auth failures
      throw err
    }

    const { words: batch } = parseResponse(raw, count)
    accumulated.push(...batch)

    // Check yield against existing + accumulated unique words
    const uniqueNewCount = countUnique(accumulated, existing)
    if (uniqueNewCount >= Math.ceil(count * MIN_YIELD_FRACTION)) break
  }

  // ── Deduplicate ────────────────────────────────────────────────────────────
  const { merged, added, removed } = deduplicate(accumulated, existing)

  return {
    words:             merged,
    duplicatesRemoved: removed,
    apiCallCount,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * countUnique — returns how many words in `incoming` are not already in
 * `existing`, counting each unique word once. Used to check yield before
 * committing to a full deduplicate pass.
 */
function countUnique(incoming: GeneratedWord[], existing: GeneratedWord[]): number {
  const existingKeys = new Set(existing.map(w => w.word.toUpperCase()))
  const seen         = new Set<string>()

  for (const w of incoming) {
    const key = w.word.toUpperCase()
    if (!existingKeys.has(key) && !seen.has(key)) seen.add(key)
  }

  return seen.size
}
