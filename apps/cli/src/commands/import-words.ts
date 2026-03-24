import type { Argv } from 'yargs'
import { resolve } from 'path'
import { wordRepository } from '@puzzle-book/content-db'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

/**
 * Prisma enum values for Difficulty.
 * Defined locally to avoid a hard dependency on @prisma/client types
 * in the CLI layer — those types only exist after `prisma generate` runs.
 */
type PrismaDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface ImportWordsArgs {
  file: string
  'word-list'?: string
  vetted: boolean
}

export const command = 'import-words'
export const describe = 'Import word/clue pairs from a CSV file into the database'

export function builder(yargs: Argv): Argv<ImportWordsArgs> {
  return yargs
    .option('file', {
      alias: 'f',
      type: 'string',
      description: 'Path to CSV file (columns: word, clue, difficulty)',
      demandOption: true,
    })
    .option('word-list', {
      alias: 'l',
      type: 'string',
      description: 'Name of a word list to create from these entries',
    })
    .option('vetted', {
      type: 'boolean',
      description: 'Mark imported clues as vetted (human-reviewed)',
      default: false,
    }) as Argv<ImportWordsArgs>
}

export async function handler(argv: ImportWordsArgs): Promise<void> {
  console.log(`\n📂 Importing words from: ${argv.file}`)

  const raw = readFileSync(resolve(argv.file), 'utf-8')
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<{ word: string; clue: string; difficulty?: string }>

  console.log(`   Found ${rows.length} rows`)

  const entries = rows.map((r) => ({
    word: r.word,
    clueText: r.clue,
    difficulty: (r.difficulty?.toUpperCase() as PrismaDifficulty) ?? 'MEDIUM',
    vetted: argv.vetted,
  }))

  const result = await wordRepository.bulkImport(entries)

  console.log(`\n✅ Import complete:`)
  console.log(`   Created : ${result.created}`)
  console.log(`   Skipped : ${result.skipped}`)

  if (result.errors.length > 0) {
    console.warn(`\n⚠️  Errors (${result.errors.length}):`)
    result.errors.slice(0, 5).forEach((e: string) => console.warn(`   ${e}`))
  }
}
