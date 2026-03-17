import type { FastifyInstance } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { wordRepository, wordListRepository } from '@puzzle-book/content-db'
import { parse } from 'csv-parse/sync'

/**
 * /api/words — Word and word list management
 * These routes back the web UI's content management pages.
 */
export async function wordsRoutes(server: FastifyInstance): Promise<void> {

  // --- Word Lists ---

  server.get('/lists', async (_request, reply) => {
    const lists = await wordListRepository.findAll('crossword')
    return reply.send({ lists })
  })

  server.post<{
    Body: { name: string; description?: string; puzzleType?: string }
  }>('/lists', async (request, reply) => {
    const id = await wordListRepository.create(request.body)
    return reply.code(201).send({ id })
  })

  server.get<{ Params: { id: string } }>(
    '/lists/:id/entries',
    async (request, reply) => {
      const entries = await wordRepository.getWordListEntries(request.params.id)
      return reply.send({ entries, total: entries.length })
    }
  )

  // --- CSV Upload ---

  /**
   * POST /api/words/import
   * Upload a CSV file and bulk-import word/clue pairs
   * Optionally creates a word list from the imported entries
   *
   * Multipart fields:
   *   file: CSV file (columns: word, clue, difficulty)
   *   wordListName: (optional) name for a new word list
   *   vetted: "true" | "false"
   */
  server.post('/import', async (request, reply) => {
    const parts = request.parts()
    let csvBuffer: Buffer | null = null
    let wordListName: string | undefined
    let vetted = false

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        csvBuffer = await part.toBuffer()
      } else if (part.type === 'field') {
        if (part.fieldname === 'wordListName') wordListName = part.value as string
        if (part.fieldname === 'vetted') vetted = part.value === 'true'
      }
    }

    if (!csvBuffer) {
      return reply.code(400).send({ error: 'No CSV file uploaded' })
    }

    const rows = parse(csvBuffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<{ word: string; clue: string; difficulty?: string }>

    const entries = rows
      .filter((r) => r.word && r.clue)
      .map((r) => ({
        word: r.word,
        clueText: r.clue,
        difficulty: (r.difficulty?.toUpperCase() as any) ?? 'MEDIUM',
        vetted,
        source: 'IMPORTED' as const,
      }))

    const result = await wordRepository.bulkImport(entries)

    return reply.send({
      ...result,
      message: `Import complete: ${result.created} created, ${result.skipped} skipped`,
    })
  })

  // --- Search ---

  server.get<{
    Querystring: { q?: string; minLength?: string; maxLength?: string; limit?: string }
  }>('/search', async (request, reply) => {
    const { minLength, maxLength, limit = '50' } = request.query
    const results = await wordRepository.findWords(
      {
        minLength: minLength ? parseInt(minLength) : undefined,
        maxLength: maxLength ? parseInt(maxLength) : undefined,
      },
      { limit: parseInt(limit), offset: 0 }
    )
    return reply.send(results)
  })
}
