import type { FastifyInstance } from 'fastify'
import archiver from 'archiver'
import { bookAssembler, PrintRenderer, ScreenRenderer, loadRenderTarget } from '@puzzle-book/book-generator'
import { crosswordGenerator } from '@puzzle-book/puzzle-generator'
import type { Puzzle, WordListEntry } from '@puzzle-book/shared'

/**
 * POST /api/books/generate
 * Full pipeline: word list → puzzles → book → ZIP download
 *
 * This is the primary endpoint for the web UI's "Generate Book" action.
 */
export async function booksRoutes(server: FastifyInstance): Promise<void> {
  server.post<{
    Body: {
      wordList: WordListEntry[]
      title: string
      subtitle?: string
      author?: string
      puzzleCount?: number
      printTarget?: string
      screenTarget?: string
    }
  }>(
    '/generate',
    {
      schema: {
        body: {
          type: 'object',
          required: ['wordList', 'title'],
          properties: {
            wordList: { type: 'array', minItems: 5 },
            title: { type: 'string', minLength: 1 },
            subtitle: { type: 'string' },
            author: { type: 'string' },
            puzzleCount: { type: 'number', minimum: 1, maximum: 50, default: 10 },
            printTarget: { type: 'string', default: 'kdp-6x9-bw' },
            screenTarget: { type: 'string', default: 'screen-pdf-tablet' },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        wordList,
        title,
        subtitle = '',
        author = '',
        puzzleCount = 10,
        printTarget = 'kdp-6x9-bw',
        screenTarget = 'screen-pdf-tablet',
      } = request.body

      // --- Generate puzzles ---
      const puzzles: Puzzle[] = []
      for (let i = 0; i < puzzleCount; i++) {
        const shuffled = [...wordList].sort(() => Math.random() - 0.5)
        try {
          const puzzle = await crosswordGenerator.generate(shuffled, {
            title: `Puzzle #${i + 1}`,
            maxWords: 25,
          })
          puzzles.push(puzzle)
        } catch {
          // Skip failed puzzles — best-effort for web UI
        }
      }

      if (puzzles.length === 0) {
        return reply.code(422).send({
          error: 'Could not generate any puzzles. Check your word list has enough valid entries.',
        })
      }

      // --- Assemble book ---
      const book = bookAssembler.assemble(puzzles, {
        metadata: { title, subtitle, author, edition: 1, theme: null },
        printTarget,
        screenTarget,
      })

      // --- Render both PDFs ---
      const printRenderTarget = loadRenderTarget(book.renderTargets.print)
      const screenRenderTarget = loadRenderTarget(book.renderTargets.screen)

      const [printPdf, screenPdf] = await Promise.all([
        new PrintRenderer().render(book, { target: printRenderTarget, template: 'standard' }),
        new ScreenRenderer().render(book, { target: screenRenderTarget, template: 'standard' }),
      ])

      // --- Stream ZIP response ---
      const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="${safeTitle}.zip"`)

      const archive = archiver('zip', { zlib: { level: 9 } })
      archive.append(printPdf, { name: `${safeTitle}-print.pdf` })
      archive.append(screenPdf, { name: `${safeTitle}-screen.pdf` })

      // Write a summary JSON alongside the PDFs
      const summary = {
        title,
        subtitle,
        author,
        puzzleCount: puzzles.length,
        generatedAt: new Date().toISOString(),
        printTarget,
        screenTarget,
      }
      archive.append(JSON.stringify(summary, null, 2), { name: 'book-summary.json' })

      archive.pipe(reply.raw)
      await archive.finalize()
    }
  )

  /**
   * POST /api/books/preview
   * Generate a single puzzle for live preview in the UI
   */
  server.post<{ Body: { wordList: WordListEntry[] } }>(
    '/preview',
    async (request, reply) => {
      const { wordList } = request.body
      const shuffled = [...wordList].sort(() => Math.random() - 0.5)
      const puzzle = await crosswordGenerator.generate(shuffled, {
        title: 'Preview',
        maxWords: 20,
      })
      return reply.send({ puzzle })
    }
  )
}
