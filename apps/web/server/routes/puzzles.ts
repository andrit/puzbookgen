import type { FastifyInstance } from 'fastify'
import { crosswordGenerator } from '@puzzle-book/puzzle-generator'
import type { WordListEntry, GeneratorOptions } from '@puzzle-book/shared'

/**
 * POST /api/puzzles/generate
 * Generate one or more crossword puzzles from a word list
 *
 * Body:
 *   wordList: WordListEntry[]
 *   count: number (default 1)
 *   options: GeneratorOptions
 */
export async function puzzlesRoutes(server: FastifyInstance): Promise<void> {
  server.post<{
    Body: {
      wordList: WordListEntry[]
      count?: number
      options?: GeneratorOptions
    }
  }>(
    '/generate',
    {
      schema: {
        body: {
          type: 'object',
          required: ['wordList'],
          properties: {
            wordList: { type: 'array', minItems: 1 },
            count: { type: 'number', minimum: 1, maximum: 50 },
            options: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const { wordList, count = 1, options = {} } = request.body

      const puzzles = []
      const errors = []

      for (let i = 0; i < count; i++) {
        const shuffled = [...wordList].sort(() => Math.random() - 0.5)
        try {
          const puzzle = await crosswordGenerator.generate(shuffled, {
            ...options,
            title: options.title ?? `Puzzle #${i + 1}`,
          })
          const validation = crosswordGenerator.validate(puzzle)
          puzzles.push({ puzzle, validation })
        } catch (err) {
          errors.push({
            index: i,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }

      return reply.send({ puzzles, errors, total: puzzles.length })
    }
  )

  /**
   * POST /api/puzzles/validate
   * Validate an existing puzzle JSON
   */
  server.post('/validate', async (request, reply) => {
    const puzzle = request.body as any
    const result = crosswordGenerator.validate(puzzle)
    return reply.send(result)
  })
}
