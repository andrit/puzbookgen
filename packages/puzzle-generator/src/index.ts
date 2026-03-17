/**
 * @file index.ts
 * @description Public API for the puzzle-generator package.
 */

export { CrosswordGenerator, crosswordGenerator } from './crossword/crossword.generator'

// Pure grid-building functions — exported for testing and for future
// custom algorithm implementations that may reuse individual steps
export {
  normalizeCandidates,
  buildBlankCellMap,
  openWordCells,
  buildWordStartSets,
  assignClueNumbers,
  buildClueArrays,
  buildGrid,
  buildCrosswordGridAndClues,
} from './crossword/crossword.functions'

export type {
  LibInputWord,
  LibPlacedWord,
  LibLayoutResult,
} from './crossword/crossword.functions'
