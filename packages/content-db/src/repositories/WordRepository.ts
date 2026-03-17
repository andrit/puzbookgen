import { prisma } from '../prisma'
import type { Difficulty } from '@prisma/client'
import type { WordListEntry } from '@puzzle-book/shared'
import type { PaginationParams, PaginatedResult } from '@puzzle-book/shared'

// ---------------------------------------------------------------------------
// WordRepository
// Handles all data access for the Word and Clue aggregates.
// ---------------------------------------------------------------------------

export class WordRepository {
  /**
   * Find all words matching optional filters.
   * Used by the Puzzle Generator to fetch candidate words for placement.
   */
  async findWords(
    filters: {
      minLength?: number
      maxLength?: number
      difficulty?: Difficulty
      themeId?: string
      vetted?: boolean
    } = {},
    pagination: PaginationParams = { limit: 100, offset: 0 }
  ): Promise<PaginatedResult<WordListEntry>> {
    const where = {
      ...(filters.minLength !== undefined || filters.maxLength !== undefined
        ? {
            word: {
              ...(filters.minLength !== undefined && { gte: 'a'.repeat(filters.minLength) }),
            },
          }
        : {}),
      clues: {
        some: {
          ...(filters.difficulty && { difficulty: filters.difficulty }),
          ...(filters.vetted !== undefined && { vetted: filters.vetted }),
        },
      },
      ...(filters.themeId && {
        themes: {
          some: { themeId: filters.themeId },
        },
      }),
    }

    const [words, total] = await Promise.all([
      prisma.word.findMany({
        where,
        include: {
          clues: {
            where: {
              ...(filters.difficulty && { difficulty: filters.difficulty }),
              ...(filters.vetted !== undefined && { vetted: filters.vetted }),
            },
            orderBy: { vetted: 'desc' },
            take: 1, // Best clue per word
          },
        },
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { word: 'asc' },
      }),
      prisma.word.count({ where }),
    ])

    const items: WordListEntry[] = words
      .filter((w) => w.clues.length > 0)
      .map((w) => ({
        word: w.word,
        clue: w.clues[0].clueText,
        difficulty: w.clues[0].difficulty.toLowerCase() as 'easy' | 'medium' | 'hard',
        theme: null,
      }))

    return { items, total, limit: pagination.limit, offset: pagination.offset }
  }

  /**
   * Get all entries from a named WordList, ready for the Puzzle Generator.
   */
  async getWordListEntries(wordListId: string): Promise<WordListEntry[]> {
    const entries = await prisma.wordListEntry.findMany({
      where: { wordListId },
      include: {
        word: true,
        clue: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { word: { word: 'asc' } }],
    })

    return entries.map((e) => ({
      word: e.word.word,
      clue: e.clue.clueText,
      difficulty: e.clue.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard',
      theme: null,
    }))
  }

  /**
   * Upsert a word and its clue. Used by the CSV import seed script.
   * Returns the word ID.
   */
  async upsertWordWithClue(entry: {
    word: string
    clueText: string
    difficulty?: Difficulty
    source?: 'MANUAL' | 'AI_GENERATED' | 'IMPORTED'
    vetted?: boolean
  }): Promise<string> {
    const normalizedWord = entry.word.toUpperCase().trim()

    const word = await prisma.word.upsert({
      where: { word: normalizedWord },
      create: { word: normalizedWord },
      update: {},
    })

    await prisma.clue.create({
      data: {
        wordId: word.id,
        clueText: entry.clueText.trim(),
        difficulty: entry.difficulty ?? 'MEDIUM',
        source: entry.source ?? 'IMPORTED',
        vetted: entry.vetted ?? false,
      },
    })

    return word.id
  }

  /**
   * Bulk upsert from CSV import. Wraps individual upserts in a transaction
   * and returns a summary of what was created.
   */
  async bulkImport(
    entries: Array<{
      word: string
      clueText: string
      difficulty?: Difficulty
    }>
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const entry of entries) {
      try {
        if (!entry.word || !entry.clueText) {
          skipped++
          continue
        }
        await this.upsertWordWithClue({
          ...entry,
          source: 'IMPORTED',
          vetted: false,
        })
        created++
      } catch (err) {
        errors.push(`Failed to import "${entry.word}": ${err instanceof Error ? err.message : String(err)}`)
        skipped++
      }
    }

    return { created, skipped, errors }
  }
}

export const wordRepository = new WordRepository()
