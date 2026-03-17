#!/usr/bin/env node
/**
 * Puzzle Book Generator — CLI
 *
 * Usage:
 *   pbg generate-book --input words.csv --title "My Crossword Book" --count 10
 *   pbg import-words --file words.csv --word-list "General Knowledge"
 *
 * Run `pbg --help` for full usage.
 */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as generateBook from './commands/generate-book'
import * as importWords from './commands/import-words'

yargs(hideBin(process.argv))
  .scriptName('pbg')
  .usage('$0 <command> [options]')
  .command(generateBook)
  .command(importWords)
  .demandCommand(1, 'Please specify a command')
  .strict()
  .help()
  .alias('h', 'help')
  .alias('v', 'version')
  .epilog('Puzzle Book Generator — https://github.com/your-org/puzzle-book-generator')
  .parse()
