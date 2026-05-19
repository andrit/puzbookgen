import type { Argv } from 'yargs'
import { readFileSync, mkdirSync, createWriteStream, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { parse } from 'csv-parse/sync'
import archiver from 'archiver'
import { crosswordGenerator } from '@puzzle-book/puzzle-generator'
import { wordGenerator } from '@puzzle-book/word-generator'
import { bookAssembler, PrintRenderer, ScreenRenderer, loadRenderTarget } from '@puzzle-book/book-generator'
import type { WordListEntry } from '@puzzle-book/shared'

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

interface ManifestPuzzle {
  /** Puzzle title shown on the page and in the answer key */
  title: string
  /** Path to the theme CSV, relative to the manifest file */
  wordlist: string
  /** Graphic motif ID — passed to puzzle metadata */
  graphic?: string
  /** Lens frame type ID — passed to puzzle metadata */
  lens?: string
}

interface BookManifest {
  title?: string
  subtitle?: string
  author?: string
  cover?: string
  printTarget?: string
  screenTarget?: string
  puzzles: ManifestPuzzle[]
}

// ---------------------------------------------------------------------------
// CLI arg types
// ---------------------------------------------------------------------------

export interface GenerateBookArgs {
  input?: string
  manifest?: string
  output: string
  title?: string
  author?: string
  subtitle?: string
  count: number
  'print-target': string
  'screen-target': string
  'min-words': number
  'max-words': number
  cover: string
  expand: boolean
  'expand-threshold': number
}

export const command  = 'generate-book'
export const describe = 'Generate a crossword puzzle book from a CSV or manifest file'

export function builder(yargs: Argv): Argv<GenerateBookArgs> {
  return yargs
    .option('manifest', {
      alias: 'm',
      type: 'string',
      description: 'Path to a book manifest JSON (one themed puzzle per entry)',
    })
    .option('input', {
      alias: 'i',
      type: 'string',
      description: 'Path to word/clue CSV (single word pool, used with --count)',
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: 'Output directory for generated files',
      default: './output',
    })
    .option('title', {
      alias: 't',
      type: 'string',
      description: 'Book title (overrides manifest title if both provided)',
    })
    .option('author', {
      alias: 'a',
      type: 'string',
      description: 'Author name',
    })
    .option('subtitle', {
      type: 'string',
      description: 'Book subtitle',
    })
    .option('count', {
      alias: 'n',
      type: 'number',
      description: 'Number of puzzles (only used with --input, ignored with --manifest)',
      default: 10,
    })
    .option('print-target', {
      type: 'string',
      description: 'Print render target ID',
      default: 'kdp-6x9-bw',
      choices: ['kdp-6x9-bw', 'kdp-8x10-bw'],
    })
    .option('screen-target', {
      type: 'string',
      description: 'Screen render target ID',
      default: 'screen-pdf-tablet',
      choices: ['screen-pdf-tablet'],
    })
    .option('min-words', {
      type: 'number',
      description: 'Minimum words placed per puzzle',
      default: 8,
    })
    .option('max-words', {
      type: 'number',
      description: 'Maximum words drawn from word list per puzzle',
      default: 25,
    })
    .option('cover', {
      type: 'string',
      description: 'Cover design ID',
      default: 'observatory-scene',
      choices: ['silhouette', 'crossword-title', 'observatory-scene'],
    })
    .option('expand', {
      type: 'boolean',
      description: 'Auto-expand word lists below --expand-threshold using the Claude API',
      default: false,
    })
    .option('expand-threshold', {
      type: 'number',
      description: 'Expand word lists with fewer words than this value (requires --expand)',
      default: 100,
    })
    .check((argv) => {
      if (!argv.manifest && !argv.input) {
        throw new Error('Provide either --manifest (themed book) or --input (single word pool)')
      }
      return true
    }) as Argv<GenerateBookArgs>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadWordList(csvPath: string): WordListEntry[] {
  const raw = readFileSync(csvPath, 'utf-8')
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<{ word: string; clue: string; difficulty?: string }>

  return rows
    .filter((r) => r.word && r.clue)
    .map((r) => ({
      word:       r.word.trim(),
      clue:       r.clue.trim(),
      difficulty: (r.difficulty?.trim() as any) ?? 'medium',
    }))
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handler(argv: GenerateBookArgs): Promise<void> {
  console.log('\n🔭 Puzzle Book Generator — The Observatory\n')

  // ── Determine puzzle configs ─────────────────────────────────────────────
  //
  // Manifest mode: one puzzle per entry, each with its own themed word list.
  // Single-input mode: N puzzles all drawn from the same word pool.

  type PuzzleConfig = { title: string; wordList: WordListEntry[]; graphic?: string; lens?: string }
  const puzzleConfigs: PuzzleConfig[] = []

  let bookTitle    = argv.title    ?? 'Crossword Puzzle Book'
  let bookSubtitle = argv.subtitle ?? ''
  let bookAuthor   = argv.author   ?? ''
  let bookCover    = argv.cover
  let printTarget  = argv['print-target']
  let screenTarget = argv['screen-target']

  if (argv.manifest) {
    // ── Manifest mode ──────────────────────────────────────────────────────
    const manifestPath = resolve(argv.manifest)
    if (!existsSync(manifestPath)) {
      console.error(`❌ Manifest not found: ${manifestPath}`)
      process.exit(1)
    }

    const manifest: BookManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    const manifestDir = dirname(manifestPath)

    // CLI flags override manifest metadata when explicitly provided
    if (!argv.title    && manifest.title)    bookTitle    = manifest.title
    if (!argv.subtitle && manifest.subtitle) bookSubtitle = manifest.subtitle
    if (!argv.author   && manifest.author)   bookAuthor   = manifest.author
    if (manifest.cover && argv.cover === 'observatory-scene') bookCover = manifest.cover
    if (manifest.printTarget)  printTarget  = manifest.printTarget
    if (manifest.screenTarget) screenTarget = manifest.screenTarget

    console.log(`📋 Manifest: ${manifestPath}`)
    console.log(`   Word lists resolved from: ${manifestDir}`)
    console.log(`   ${manifest.puzzles.length} themed puzzles defined\n`)

    // Pre-check: list which word lists exist and which are missing
    const missing = manifest.puzzles.filter(e => !existsSync(resolve(manifestDir, e.wordlist)))
    if (missing.length > 0) {
      console.warn(`⚠️  ${missing.length} word list(s) not found:`)
      missing.forEach(e => console.warn(`   ✗ ${e.wordlist}  (for: ${e.title})`))
      console.warn(`\n   Make sure the wordlists/ and wordlists2/ folders sit beside the manifest.\n`)
    }

    for (const entry of manifest.puzzles) {
      const wordlistPath = resolve(manifestDir, entry.wordlist)
      if (!existsSync(wordlistPath)) {
        console.warn(`   ⚠️  Word list not found — SKIPPING puzzle: "${entry.title}"`)
        console.warn(`      Expected at: ${wordlistPath}`)
        console.warn(`      Manifest dir: ${manifestDir}`)
        console.warn(`      Relative path in manifest: ${entry.wordlist}`)
        continue
      }
      const wordList = loadWordList(wordlistPath)
      if (wordList.length < argv['min-words']) {
        console.warn(`   ⚠️  Word list too small (${wordList.length}), skipping: ${entry.title}`)
        continue
      }
      puzzleConfigs.push({ title: entry.title, wordList, graphic: entry.graphic, lens: entry.lens })
    }

    console.log(`   ✅ Loaded word lists for ${puzzleConfigs.length} puzzles`)

  } else {
    // ── Single-input mode ──────────────────────────────────────────────────
    const inputPath = resolve(argv.input!)
    if (!existsSync(inputPath)) {
      console.error(`❌ Input file not found: ${inputPath}`)
      process.exit(1)
    }

    console.log(`📂 Loading word list: ${argv.input}`)
    const wordList = loadWordList(inputPath)
    console.log(`   ✅ Loaded ${wordList.length} word/clue pairs`)

    if (wordList.length < argv['min-words']) {
      console.error(`❌ Not enough words. Need at least ${argv['min-words']}, got ${wordList.length}`)
      process.exit(1)
    }

    for (let i = 0; i < argv.count; i++) {
      puzzleConfigs.push({ title: `Puzzle ${i + 1}`, wordList })
    }
  }

  // ── Generate one puzzle per config ──────────────────────────────────────

  // ── Optional word list expansion ──────────────────────────────────────────
  if (argv.expand) {
    console.log(`\n📖 Expanding thin word lists (threshold: ${argv['expand-threshold']} words)...\n`)
    for (let i = 0; i < puzzleConfigs.length; i++) {
      const cfg = puzzleConfigs[i]
      if (cfg.wordList.length >= argv['expand-threshold']) {
        console.log(`   [${i+1}/${puzzleConfigs.length}] "${cfg.title}" — ${cfg.wordList.length} words, skipping`)
        continue
      }
      process.stdout.write(`   [${i+1}/${puzzleConfigs.length}] "${cfg.title}" — ${cfg.wordList.length} words, expanding... `)
      try {
        const expanded = await wordGenerator.generate({
          theme:      cfg.title,
          existing:   cfg.wordList as any,
          count:      150,
          maxRetries: 3,
        })
        const before = cfg.wordList.length
        cfg.wordList = expanded.words as any
        console.log(`✅ ${before} → ${expanded.words.length} words (+${expanded.words.length - before})`)
      } catch (err) {
        console.log(`⚠️  failed (${err instanceof Error ? err.message : String(err)}), using original list`)
      }
    }
    console.log()
  }

  console.log(`\n🔧 Generating ${puzzleConfigs.length} puzzle(s)...\n`)
  const puzzles = []

  for (let i = 0; i < puzzleConfigs.length; i++) {
    const { title, wordList } = puzzleConfigs[i]
    const label = `[${i + 1}/${puzzleConfigs.length}] ${title}`
    process.stdout.write(`   ${label}... `)

    try {
      // Each puzzle draws only from its own themed word list
      const puzzle = await crosswordGenerator.generate(shuffle(wordList), {
        title,
        minWords: argv['min-words'],
        maxWords: argv['max-words'],
        graphic: puzzleConfigs[i].graphic ?? null,
        lens:    puzzleConfigs[i].lens    ?? null,
      })

      const validation = crosswordGenerator.validate(puzzle)

      if (!validation.valid) {
        console.log(`⚠️  ${validation.errors.join(', ')}`)
      } else {
        console.log(`✅ ${puzzle.metadata.wordCount} words placed`)
        validation.warnings.forEach((w: string) => console.log(`         ⚠️  ${w}`))
      }

      puzzles.push(puzzle)
    } catch (err) {
      console.log(`❌ ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (puzzles.length === 0) {
    console.error('\n❌ No puzzles generated. Check your word lists.')
    process.exit(1)
  }

  console.log(`\n✅ Generated ${puzzles.length} of ${puzzleConfigs.length} puzzle(s)`)

  // ── Assemble ─────────────────────────────────────────────────────────────

  console.log('\n📚 Assembling book...')
  const book = bookAssembler.assemble(puzzles, {
    metadata: {
      title:    bookTitle,
      subtitle: bookSubtitle,
      author:   bookAuthor,
      edition:  1,
      theme:    null,
    },
    printTarget,
    screenTarget,
    coverId: bookCover,
  })
  console.log(`   ✅ "${book.metadata.title}" — ${puzzles.length} puzzles`)

  // ── Render ────────────────────────────────────────────────────────────────

  const printRenderTarget  = loadRenderTarget(book.renderTargets.print)
  const screenRenderTarget = loadRenderTarget(book.renderTargets.screen)

  console.log('\n🖨️  Rendering print PDF...')
  const printPdf = await new PrintRenderer().render(book, { target: printRenderTarget,  template: 'standard' })
  console.log(`   ✅ ${(printPdf.length / 1024).toFixed(1)} KB`)

  console.log('📱 Rendering screen PDF...')
  const screenPdf = await new ScreenRenderer().render(book, { target: screenRenderTarget, template: 'standard' })
  console.log(`   ✅ ${(screenPdf.length / 1024).toFixed(1)} KB`)

  // ── Package ZIP ───────────────────────────────────────────────────────────

  console.log('\n📦 Packaging...')
  const outputDir = resolve(argv.output)
  mkdirSync(outputDir, { recursive: true })

  const safeTitle = bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const zipPath   = resolve(outputDir, `${safeTitle}.zip`)

  await new Promise<void>((res, rej) => {
    const output  = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', res)
    archive.on('error', rej)
    archive.pipe(output)
    archive.append(printPdf,  { name: `${safeTitle}-print.pdf`  })
    archive.append(screenPdf, { name: `${safeTitle}-screen.pdf` })
    archive.finalize()
  })

  console.log(`\n✅ Done!\n   ${zipPath}`)
  console.log(`   ├── ${safeTitle}-print.pdf   (${printRenderTarget.name})`)
  console.log(`   └── ${safeTitle}-screen.pdf  (${screenRenderTarget.name})\n`)
}
