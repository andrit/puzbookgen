#!/usr/bin/env tsx
/**
 * CSV Import Script
 *
 * Imports word/clue pairs from a CSV file into the content database.
 *
 * Expected CSV format (with header row):
 *   word,clue,difficulty
 *   APPLE,"A fruit that keeps the doctor away",easy
 *   ENIGMA,"A puzzling mystery",hard
 *
 * Usage:
 *   npm run db:seed -- --file ./words.csv
 *   npm run db:seed -- --file ./words.csv --word-list "General Knowledge"
 *
 * The `difficulty` column is optional. Defaults to MEDIUM if omitted.
 */

import { createReadStream } from 'fs'
import { resolve } from 'path'
import { parse } from 'csv-parse'
import { wordRepository } from '../repositories/WordRepository'
import { wordListRepository } from '../repositories/WordListRepository'
import { prisma } from '../prisma'
import type { Difficulty } from '@prisma/client'

// ---------------------------------------------------------------------------
// Parse CLI args (simple, no yargs here — this is an internal script)
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const fileFlag = args.indexOf('--file')
const listFlag = args.indexOf('--word-list')

if (fileFlag === -1 || !args[fileFlag + 1]) {
  console.error('Usage: npm run db:seed -- --file <path-to-csv> [--word-list "List Name"]')
  process.exit(1)
}

const csvPath = resolve(args[fileFlag + 1])
const wordListName = listFlag !== -1 ? args[listFlag + 1] : null

// ---------------------------------------------------------------------------
// Parse difficulty string to Prisma enum
// ---------------------------------------------------------------------------

function parseDifficulty(raw: string | undefined): Difficulty {
  switch (raw?.toLowerCase().trim()) {
    case 'easy': return 'EASY'
    case 'hard': return 'HARD'
    default:     return 'MEDIUM'
  }
}

// ---------------------------------------------------------------------------
// Main import logic
// ---------------------------------------------------------------------------

interface CsvRow {
  word: string
  clue: string
  difficulty?: string
}

async function importCsv(): Promise<void> {
  console.log(`\n📂 Importing from: ${csvPath}`)

  const rows: CsvRow[] = []

  await new Promise<void>((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(
        parse({
          columns: true,        // Use first row as header
          skip_empty_lines: true,
          trim: true,
        })
      )
      .on('data', (row: CsvRow) => rows.push(row))
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`📋 Found ${rows.length} rows`)

  const entries = rows.map((row) => ({
    word: row.word,
    clueText: row.clue,
    difficulty: parseDifficulty(row.difficulty),
  }))

  const result = await wordRepository.bulkImport(entries)

  console.log(`\n✅ Import complete:`)
  console.log(`   Created : ${result.created}`)
  console.log(`   Skipped : ${result.skipped}`)

  if (result.errors.length > 0) {
    console.warn(`\n⚠️  Errors (${result.errors.length}):`)
    result.errors.slice(0, 10).forEach((e) => console.warn(`   ${e}`))
    if (result.errors.length > 10) {
      console.warn(`   ...and ${result.errors.length - 10} more`)
    }
  }

  // Optionally create a WordList from the imported entries
  if (wordListName && result.created > 0) {
    console.log(`\n📝 Creating word list: "${wordListName}"`)

    // Fetch the clue IDs we just created (imported, not vetted)
    const importedClues = await prisma.clue.findMany({
      where: {
        source: 'IMPORTED',
        word: {
          word: { in: rows.map((r) => r.word.toUpperCase().trim()) },
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: result.created,
    })

    const listId = await wordListRepository.create({ name: wordListName })
    await wordListRepository.addEntries(listId, importedClues.map((c) => c.id))

    console.log(`   ✅ Word list created with ${importedClues.length} entries (ID: ${listId})`)
  }

  await prisma.$disconnect()
}

importCsv().catch((err) => {
  console.error('❌ Import failed:', err)
  prisma.$disconnect()
  process.exit(1)
})
