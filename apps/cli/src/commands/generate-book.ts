import type { Argv } from 'yargs'
import { readFileSync, mkdirSync, createWriteStream } from 'fs'
import { resolve } from 'path'
import { parse } from 'csv-parse/sync'
import archiver from 'archiver'
import { crosswordGenerator } from '@puzzle-book/puzzle-generator'
import { bookAssembler, PrintRenderer, ScreenRenderer, loadRenderTarget } from '@puzzle-book/book-generator'
import type { WordListEntry } from '@puzzle-book/shared'

export interface GenerateBookArgs {
  input: string
  output: string
  title: string
  author?: string
  subtitle?: string
  count: number
  'print-target': string
  'screen-target': string
  'min-words': number
  'max-words': number
}

export const command = 'generate-book'
export const describe = 'Generate a crossword puzzle book from a word/clue CSV file'

export function builder(yargs: Argv): Argv<GenerateBookArgs> {
  return yargs
    .option('input', {
      alias: 'i',
      type: 'string',
      description: 'Path to word/clue CSV file',
      demandOption: true,
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
      description: 'Book title',
      demandOption: true,
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
      description: 'Number of puzzles to generate',
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
      description: 'Minimum words per puzzle',
      default: 8,
    })
    .option('max-words', {
      type: 'number',
      description: 'Maximum words per puzzle',
      default: 25,
    }) as Argv<GenerateBookArgs>
}

export async function handler(argv: GenerateBookArgs): Promise<void> {
  console.log('\n🧩 Puzzle Book Generator\n')

  // --- Load word list ---
  console.log(`📂 Loading word list: ${argv.input}`)
  const rawRows = parse(readFileSync(resolve(argv.input), 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<{ word: string; clue: string; difficulty?: string }>

  const wordList: WordListEntry[] = rawRows
    .filter((r) => r.word && r.clue)
    .map((r) => ({
      word: r.word,
      clue: r.clue,
      difficulty: (r.difficulty as any) ?? 'medium',
    }))

  console.log(`   ✅ Loaded ${wordList.length} word/clue pairs`)

  if (wordList.length < argv['min-words']) {
    console.error(`❌ Not enough words. Need at least ${argv['min-words']}, got ${wordList.length}`)
    process.exit(1)
  }

  // --- Generate puzzles ---
  console.log(`\n🔧 Generating ${argv.count} puzzle(s)...`)
  const puzzles = []

  for (let i = 0; i < argv.count; i++) {
    process.stdout.write(`   Puzzle ${i + 1}/${argv.count}... `)

    // Shuffle word list for variety between puzzles
    const shuffled = [...wordList].sort(() => Math.random() - 0.5)

    try {
      const puzzle = await crosswordGenerator.generate(shuffled, {
        title: `Puzzle #${i + 1}`,
        minWords: argv['min-words'],
        maxWords: argv['max-words'],
      })

      const validation = crosswordGenerator.validate(puzzle)

      if (!validation.valid) {
        console.log(`⚠️  Validation errors: ${validation.errors.join(', ')}`)
      } else {
        console.log(`✅ ${puzzle.metadata.wordCount} words placed`)
        if (validation.warnings.length > 0) {
          validation.warnings.forEach((w: string) => console.log(`      ⚠️  ${w}`))
        }
      }

      puzzles.push(puzzle)
    } catch (err) {
      console.log(`❌ Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (puzzles.length === 0) {
    console.error('\n❌ No puzzles were generated successfully. Check your word list.')
    process.exit(1)
  }

  console.log(`\n✅ Generated ${puzzles.length} puzzle(s)`)

  // --- Assemble book ---
  console.log('\n📚 Assembling book...')
  const book = bookAssembler.assemble(puzzles, {
    metadata: {
      title: argv.title,
      subtitle: argv.subtitle ?? '',
      author: argv.author ?? '',
      edition: 1,
      theme: null,
    },
    printTarget: argv['print-target'],
    screenTarget: argv['screen-target'],
  })
  console.log(`   ✅ Book assembled: "${book.metadata.title}"`)

  // --- Render ---
  const printTarget = loadRenderTarget(book.renderTargets.print)
  const screenTarget = loadRenderTarget(book.renderTargets.screen)

  const renderOptions = {
    print: { target: printTarget, template: 'standard' },
    screen: { target: screenTarget, template: 'standard' },
  }

  console.log('\n🖨️  Rendering print PDF...')
  const printRenderer = new PrintRenderer()
  const printPdf = await printRenderer.render(book, renderOptions.print)
  console.log(`   ✅ Print PDF: ${(printPdf.length / 1024).toFixed(1)} KB`)

  console.log('📱 Rendering screen PDF...')
  const screenRenderer = new ScreenRenderer()
  const screenPdf = await screenRenderer.render(book, renderOptions.screen)
  console.log(`   ✅ Screen PDF: ${(screenPdf.length / 1024).toFixed(1)} KB`)

  // --- Package as ZIP ---
  console.log('\n📦 Packaging output...')
  const outputDir = resolve(argv.output)
  mkdirSync(outputDir, { recursive: true })

  const safeTitle = argv.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const zipPath = resolve(outputDir, `${safeTitle}.zip`)

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', resolve)
    archive.on('error', reject)

    archive.pipe(output)
    archive.append(printPdf, { name: `${safeTitle}-print.pdf` })
    archive.append(screenPdf, { name: `${safeTitle}-screen.pdf` })
    archive.finalize()
  })

  console.log(`\n✅ Done! Output saved to:\n   ${zipPath}`)
  console.log(`   Contains:`)
  console.log(`     ${safeTitle}-print.pdf   (${printTarget.name})`)
  console.log(`     ${safeTitle}-screen.pdf  (${screenTarget.name})\n`)
}
