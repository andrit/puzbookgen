import { v4 as uuidv4 } from 'uuid'
import type { Book, Puzzle, BookMetadata, LayoutConfig, BookContent } from '@puzzle-book/shared'
import { SCHEMA_VERSION } from '@puzzle-book/shared'

export interface AssemblerOptions {
  metadata: Omit<BookMetadata, 'createdAt'>
  layout?: Partial<LayoutConfig>
  content?: Partial<Omit<BookContent, 'chapters'>>
  printTarget?: string
  screenTarget?: string
}

/**
 * BookAssembler
 *
 * Takes an array of resolved Puzzle objects and configuration options,
 * and produces a complete Book aggregate ready for rendering.
 *
 * For MVP, all puzzles are placed in a single default chapter.
 * Chapter support (grouping, intros) is wired in for future use.
 */
export class BookAssembler {
  assemble(puzzles: Puzzle[], options: AssemblerOptions): Book {
    if (puzzles.length === 0) {
      throw new Error('Cannot assemble a book with zero puzzles')
    }

    const puzzleType = puzzles[0].puzzleType

    // All puzzles in a single default chapter for MVP
    const defaultChapter = {
      id: uuidv4(),
      title: null,
      intro: null,
      puzzleIds: puzzles.map((p) => p.id),
    }

    const book: Book = {
      schemaVersion: SCHEMA_VERSION,
      id: uuidv4(),
      bookType: 'crossword-collection',
      puzzleType,
      metadata: {
        ...options.metadata,
        createdAt: new Date().toISOString(),
      },
      renderTargets: {
        print: (options.printTarget as any) ?? 'kdp-6x9-bw',
        screen: (options.screenTarget as any) ?? 'screen-pdf-tablet',
      },
      layout: {
        template: options.layout?.template ?? 'standard',
        typography: options.layout?.typography ?? {},
        gridStyle: options.layout?.gridStyle ?? {},
        pageDecorations: options.layout?.pageDecorations ?? {},
      },
      content: {
        cover: {
          title: options.metadata.title,
          subtitle: options.metadata.subtitle ?? '',
          author: options.metadata.author ?? '',
          designTemplate: 'standard',
        },
        intro: {
          enabled: options.content?.intro?.enabled ?? true,
          text: options.content?.intro?.text ?? '',
        },
        chapters: [defaultChapter],
        answerKey: {
          enabled: options.content?.answerKey?.enabled ?? true,
          position: options.content?.answerKey?.position ?? 'back',
        },
      },
      puzzles,
    }

    return book
  }
}

export const bookAssembler = new BookAssembler()
