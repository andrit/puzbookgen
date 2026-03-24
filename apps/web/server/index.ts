import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import { resolve } from 'path'
import { puzzlesRoutes } from './routes/puzzles'
import { booksRoutes } from './routes/books'
import { wordsRoutes } from './routes/words'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'
const IS_DEV = process.env.NODE_ENV !== 'production'

/**
 * Bootstrap the Fastify server.
 *
 * Wrapped in an async function so top-level await is not required —
 * keeping the file compatible with CommonJS module mode.
 * __dirname is natively available in CommonJS; no import.meta.url needed.
 */
async function main(): Promise<void> {
  const server = Fastify({
    logger: {
      transport: IS_DEV
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------

  await server.register(cors, {
    origin: IS_DEV ? 'http://localhost:5173' : false,
  })

  await server.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max upload
  })

  // Serve built React client in production
  if (!IS_DEV) {
    await server.register(staticFiles, {
      // __dirname is the compiled dist/server/ directory at runtime
      root: resolve(__dirname, '../client'),
      prefix: '/',
    })
  }

  // ---------------------------------------------------------------------------
  // API Routes
  // ---------------------------------------------------------------------------

  await server.register(puzzlesRoutes, { prefix: '/api/puzzles' })
  await server.register(booksRoutes, { prefix: '/api/books' })
  await server.register(wordsRoutes, { prefix: '/api/words' })

  // Health check
  server.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))

  // SPA fallback — serve index.html for all non-API routes in production
  if (!IS_DEV) {
    server.setNotFoundHandler(async (req, reply) => {
      if (!req.url.startsWith('/api')) {
        return reply.sendFile('index.html')
      }
      reply.code(404).send({ error: 'Not found' })
    })
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  try {
    await server.listen({ port: PORT, host: HOST })
    console.log(`\n🧩 Puzzle Book Generator server running at http://localhost:${PORT}`)
    if (IS_DEV) {
      console.log(`   React dev server at http://localhost:5173`)
    }
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

main()
