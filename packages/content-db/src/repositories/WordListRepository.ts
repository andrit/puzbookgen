import { prisma } from '../prisma'

export interface WordListSummary {
  id: string
  name: string
  description: string | null
  puzzleType: string
  themeName: string | null
  entryCount: number
  createdAt: Date
}

export class WordListRepository {
  async findAll(puzzleType = 'crossword'): Promise<WordListSummary[]> {
    const lists = await prisma.wordList.findMany({
      where: { puzzleType },
      include: {
        theme: { select: { name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return lists.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      puzzleType: l.puzzleType,
      themeName: l.theme?.name ?? null,
      entryCount: l._count.entries,
      createdAt: l.createdAt,
    }))
  }

  async create(data: {
    name: string
    description?: string
    puzzleType?: string
    themeId?: string
  }): Promise<string> {
    const list = await prisma.wordList.create({
      data: {
        name: data.name,
        description: data.description,
        puzzleType: data.puzzleType ?? 'crossword',
        themeId: data.themeId,
      },
    })
    return list.id
  }

  async addEntries(
    wordListId: string,
    clueIds: string[]
  ): Promise<void> {
    // Fetch word IDs for the clues
    const clues = await prisma.clue.findMany({
      where: { id: { in: clueIds } },
      select: { id: true, wordId: true },
    })

    await prisma.wordListEntry.createMany({
      data: clues.map((c, i) => ({
        wordListId,
        clueId: c.id,
        wordId: c.wordId,
        sortOrder: i,
      })),
      skipDuplicates: true,
    })
  }
}

export const wordListRepository = new WordListRepository()
