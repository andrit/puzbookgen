/**
 * @file commands/generate-words.ts
 * @description CLI command that expands a themed word list using the Claude API.
 *
 * Usage examples:
 *
 *   # Minimal — generate 150 new words for a theme
 *   pbg generate-words --theme "Ancient Civilizations" --output wordlists/01-ancient.csv
 *
 *   # Expand an existing list in place (deduplicates, preserves existing clues)
 *   pbg generate-words \
 *     --theme "Ancient Civilizations" \
 *     --existing wordlists/01-ancient.csv \
 *     --output wordlists/01-ancient.csv
 *
 *   # Preview without writing
 *   pbg generate-words --theme "Chess" --output chess.csv --dry-run
 *
 *   # Full options
 *   pbg generate-words \
 *     --theme "Astronomy" \
 *     --seeds "NEBULA,QUASAR,PULSAR" \
 *     --count 150 \
 *     --existing wordlists/10-astronomy.csv \
 *     --output wordlists/10-astronomy.csv \
 *     --api-key sk-ant-...
 */

import type { Argv } from 'yargs'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { wordGenerator, readWordsCsv, writeWordsCsv } from '@puzzle-book/word-generator'

// ---------------------------------------------------------------------------
// Arg types
// ---------------------------------------------------------------------------

export interface GenerateWordsArgs {
  theme:     string
  output:    string
  existing?: string
  seeds?:    string
  count:     number
  'api-key'?: string
  'dry-run':  boolean
  'max-retries': number
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export const command  = 'generate-words'
export const describe = 'Generate themed word/clue pairs using the Claude API'

export function builder(yargs: Argv): Argv<GenerateWordsArgs> {
  return yargs
    .option('theme', {
      alias:    't',
      type:     'string',
      description: 'Theme name passed to the prompt (e.g. "Ancient Civilizations")',
      demandOption: true,
    })
    .option('output', {
      alias:    'o',
      type:     'string',
      description: 'Output CSV file path (can equal --existing to expand in place)',
      demandOption: true,
    })
    .option('existing', {
      alias:    'e',
      type:     'string',
      description: 'Path to existing CSV — words are preserved and used to dedup',
    })
    .option('seeds', {
      alias:    's',
      type:     'string',
      description: 'Comma-separated anchor words to guarantee in output (e.g. "NEBULA,QUASAR")',
    })
    .option('count', {
      alias:    'n',
      type:     'number',
      description: 'Target number of new words to generate',
      default:  150,
    })
    .option('api-key', {
      type:     'string',
      description: 'Anthropic API key (defaults to ANTHROPIC_API_KEY env var)',
    })
    .option('dry-run', {
      type:     'boolean',
      description: 'Print generated words to stdout without writing to disk',
      default:  false,
    })
    .option('max-retries', {
      type:     'number',
      description: 'Maximum API retry attempts on low yield',
      default:  3,
    }) as Argv<GenerateWordsArgs>
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handler(argv: GenerateWordsArgs): Promise<void> {
  const outputPath   = resolve(argv.output)
  const existingPath = argv.existing ? resolve(argv.existing) : null

  const seeds: string[] = argv.seeds
    ? argv.seeds.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : []

  // ── Load existing words ───────────────────────────────────────────────────
  const existing = existingPath ? readWordsCsv(existingPath) : []

  console.log('\n📖  Word Generator\n')
  console.log(`  Theme        : ${argv.theme}`)
  console.log(`  Target count : ${argv.count}`)
  if (seeds.length)   console.log(`  Seeds        : ${seeds.join(', ')}`)
  if (existingPath)   console.log(`  Existing     : ${existingPath} (${existing.length} words)`)
  console.log(`  Output       : ${outputPath}`)
  if (argv['dry-run']) console.log(`  Mode         : DRY RUN`)
  console.log()

  // ── Generate ──────────────────────────────────────────────────────────────
  console.log('🤖  Calling Claude API...\n')

  let result: Awaited<ReturnType<typeof wordGenerator.generate>>

  try {
    result = await wordGenerator.generate({
      theme:      argv.theme,
      seeds,
      count:      argv.count,
      maxRetries: argv['max-retries'],
      apiKey:     argv['api-key'],
      existing,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`\n❌  Generation failed: ${msg}\n`)
    process.exit(1)
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const newWords = result.words.length - existing.length

  console.log(`✅  Generation complete`)
  console.log(`    Total words    : ${result.words.length}`)
  console.log(`    New words added: ${newWords}`)
  console.log(`    Duplicates dropped: ${result.duplicatesRemoved}`)
  console.log(`    API calls made : ${result.apiCallCount}`)
  console.log()

  // ── Dry run — print table and exit ────────────────────────────────────────
  if (argv['dry-run']) {
    console.log('📋  Generated words (dry run — not written to disk):\n')
    console.log(`  ${'WORD'.padEnd(18)} ${'DIFF'.padEnd(8)} CLUE`)
    console.log(`  ${'─'.repeat(18)} ${'─'.repeat(8)} ${'─'.repeat(50)}`)
    for (const w of result.words.slice(existing.length)) {
      const truncClue = w.clue.length > 60 ? w.clue.slice(0, 57) + '...' : w.clue
      console.log(`  ${w.word.padEnd(18)} ${w.difficulty.padEnd(8)} ${truncClue}`)
    }
    console.log()
    return
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  writeWordsCsv(result.words, outputPath)
  console.log(`💾  Written to: ${outputPath}\n`)
}
