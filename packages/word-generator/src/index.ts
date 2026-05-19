/**
 * @file index.ts
 * @description Public exports for @puzzle-book/word-generator
 */

export { wordGenerator }       from './generator/word.generator'
export { buildPrompt,
         getSystemPrompt }     from './prompt/prompt.builder'
export { parseResponse }       from './parser/response.parser'
export { deduplicate }         from './dedup/deduplicator'
export { readWordsCsv,
         writeWordsCsv,
         analyzeWordList,
         toBucket }            from './csv/csv.writer'
export { callClaude }          from './api/claude.client'

export type {
  GeneratedWord,
  GeneratorOptions,
  GeneratorResult,
  WordListAnalysis,
  LengthBucket,
  BucketTarget,
  ApiError,
} from './types'
