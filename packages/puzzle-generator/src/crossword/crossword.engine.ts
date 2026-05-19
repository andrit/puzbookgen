/**
 * @file crossword.engine.ts
 * @description Custom crossword layout engine — Step 1: GridState
 *
 * GridState is the core data structure for the backtracking placement algorithm.
 * It maintains a 2D grid that grows on demand, tracks which words own which cells,
 * validates placement constraints, and scores layouts by intersection density.
 *
 * Design principles:
 *   - Immutable-style API: place() and unplace() are paired operations
 *   - All constraint checking isolated in canPlace() — one place to audit
 *   - No dependency on PDFKit or any rendering concern
 *   - Fully unit-testable in isolation
 *
 * Used by: placementEngine (Step 3), which calls findCandidates (Step 2)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Direction = 'across' | 'down'

export interface PlacedWord {
  word:     string
  clue:     string
  row:      number   // top-left cell row (0-indexed)
  col:      number   // top-left cell col (0-indexed)
  dir:      Direction
}

/** A single cell in the grid */
interface GridCell {
  letter:   string        // uppercase letter, or '' if empty
  owners:   Set<number>   // indices into this.placed[] that own this cell
  blocked:  boolean       // true for separator cells adjacent to word ends
}

export interface LayoutScore {
  intersections:  number   // cells shared by ≥2 words (across × down)
  placedCount:    number   // total words placed
  boundingArea:   number   // rows × cols of tightest bounding box
  /** Higher is better */
  total:          number
}

export interface LayoutResult {
  placed:   PlacedWord[]
  score:    LayoutScore
  rows:     number
  cols:     number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Initial grid dimensions — grows automatically as words are placed */
const INITIAL_SIZE = 30

/** Score weights
 * Keep W_DISTANCE very small so that grid area never outweighs word count.
 * The primary objectives are: (1) place as many words as possible,
 * (2) maximize intersections, (3) minimise area as a tiebreaker only.
 */
const W_INTERSECTION = 20   // reward per intersection cell
const W_PLACED       = 50   // reward per placed word (dominant term)
const W_DISTANCE     = 0.1  // penalty per bounding-box cell (tiny tiebreaker)
const W_ALTERNATION  = 3    // legacy — kept for scorePlacement compat

// ---------------------------------------------------------------------------
// GridState
// ---------------------------------------------------------------------------

export class GridState {
  private grid:   GridCell[][]
  private _rows:  number
  private _cols:  number

  /** Words placed so far, in placement order */
  readonly placed: PlacedWord[] = []

  constructor(size: number = INITIAL_SIZE) {
    this._rows = size
    this._cols = size
    this.grid  = GridState.makeGrid(size, size)
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  get rows(): number { return this._rows }
  get cols(): number { return this._cols }

  /** Current letter at (row, col), or '' if empty */
  letterAt(row: number, col: number): string {
    if (!this.inBounds(row, col)) return ''
    return this.grid[row][col].letter
  }

  /** True if (row, col) is within the current grid bounds */
  inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this._rows && col >= 0 && col < this._cols
  }

  /** True if (row, col) has a letter from any placed word */
  hasLetter(row: number, col: number): boolean {
    return this.inBounds(row, col) && this.grid[row][col].letter !== ''
  }

  // ── Constraint validation ─────────────────────────────────────────────────

  /**
   * canPlace — validates all crossword constraints for placing `word` at
   * (row, col) in direction `dir`.
   *
   * Rules enforced:
   *  1. Word fits within grid bounds (or grid can be expanded)
   *  2. Each cell is either empty OR contains the same letter (valid intersection)
   *  3. No letter immediately before the word start (would merge two words)
   *  4. No letter immediately after the word end (would merge two words)
   *  5. No letter adjacent (perpendicular) to any non-intersecting cell
   *     that would imply an unregistered word
   *
   * Returns false as soon as any rule is violated.
   */
  canPlace(word: string, row: number, col: number, dir: Direction): boolean {
    const len  = word.length
    const dr   = dir === 'down' ? 1 : 0
    const dc   = dir === 'across' ? 1 : 0

    // ── Rule 1: bounds (we auto-expand, so just check no negative coords) ──
    if (row < 0 || col < 0) return false
    const endRow = row + dr * (len - 1)
    const endCol = col + dc * (len - 1)
    if (endRow >= INITIAL_SIZE * 3 || endCol >= INITIAL_SIZE * 3) return false

    // ── Rule 3: no letter immediately before word start ────────────────────
    if (this.hasLetter(row - dr, col - dc)) return false

    // ── Rule 4: no letter immediately after word end ───────────────────────
    if (this.hasLetter(endRow + dr, endCol + dc)) return false

    // ── Rules 2 & 5: scan each cell the word would occupy ─────────────────
    let hasIntersection = false

    for (let i = 0; i < len; i++) {
      const r  = row + dr * i
      const c  = col + dc * i
      const ch = word[i]

      if (!this.inBounds(r, c)) continue   // will be expanded

      const existing = this.grid[r][c].letter

      if (existing !== '') {
        // Cell is occupied — must be same letter (intersection)
        if (existing !== ch) return false

        // Valid intersection — check that the occupying word runs perpendicular
        // (an across word can only intersect with a down word and vice versa)
        const cell = this.grid[r][c]
        const crossDir: Direction = dir === 'across' ? 'down' : 'across'
        const hasCrossWord = [...cell.owners].some(
          idx => this.placed[idx].dir === crossDir
        )
        if (!hasCrossWord) {
          // Existing letter belongs only to a parallel word — collision
          return false
        }

        hasIntersection = true
      } else {
        // Cell is empty — check perpendicular neighbours aren't occupied
        // (that would create an implied word we haven't registered)
        const perpR1 = r + dc, perpC1 = c + dr   // one side
        const perpR2 = r - dc, perpC2 = c - dr   // other side
        if (this.hasLetter(perpR1, perpC1)) return false
        if (this.hasLetter(perpR2, perpC2)) return false
      }
    }

    // First word: no intersection required. Subsequent words must intersect.
    if (this.placed.length > 0 && !hasIntersection) return false

    return true
  }

  // ── Placement ─────────────────────────────────────────────────────────────

  /**
   * place — commits `word` to the grid at (row, col, dir).
   * Expands the grid if needed. Updates cell ownership.
   * Does not validate — caller must call canPlace() first.
   */
  place(word: string, clue: string, row: number, col: number, dir: Direction): void {
    const len = word.length
    const dr  = dir === 'down' ? 1 : 0
    const dc  = dir === 'across' ? 1 : 0

    // Expand grid to fit word + 1-cell border
    const needRows = row + dr * (len - 1) + 2
    const needCols = col + dc * (len - 1) + 2
    if (needRows > this._rows || needCols > this._cols) {
      this.expand(Math.max(needRows, this._rows), Math.max(needCols, this._cols))
    }

    const wordIdx = this.placed.length
    this.placed.push({ word, clue, row, col, dir })

    for (let i = 0; i < len; i++) {
      const r = row + dr * i
      const c = col + dc * i
      this.grid[r][c].letter = word[i]
      this.grid[r][c].owners.add(wordIdx)
    }
  }

  /**
   * unplace — removes the most recently placed word from the grid.
   * Only the last placed word can be removed (stack discipline for backtracking).
   * Returns the removed word's PlacedWord record, or null if nothing placed.
   */
  unplace(): PlacedWord | null {
    if (this.placed.length === 0) return null

    const wordIdx = this.placed.length - 1
    const pw      = this.placed[wordIdx]
    const len     = pw.word.length
    const dr      = pw.dir === 'down' ? 1 : 0
    const dc      = pw.dir === 'across' ? 1 : 0

    for (let i = 0; i < len; i++) {
      const r    = pw.row + dr * i
      const c    = pw.col + dc * i
      const cell = this.grid[r][c]
      cell.owners.delete(wordIdx)
      // Only clear the letter if no other word owns this cell
      if (cell.owners.size === 0) {
        cell.letter = ''
      }
    }

    this.placed.pop()
    return pw
  }

  // ── Scoring ───────────────────────────────────────────────────────────────

  /**
   * score — evaluates the current layout quality.
   *
   * Intersection count: cells owned by ≥2 words (an across and a down word
   * sharing a letter). This is the primary density metric.
   *
   * Bounding area: penalises sprawling layouts.
   *
   * Total: weighted combination, higher is better.
   */
  score(): LayoutScore {
    if (this.placed.length === 0) {
      return { intersections: 0, placedCount: 0, boundingArea: 0, total: 0 }
    }

    // Count intersections (cells with ≥2 owners, across + down)
    let intersections = 0
    let minRow = Infinity, maxRow = -Infinity
    let minCol = Infinity, maxCol = -Infinity

    for (let r = 0; r < this._rows; r++) {
      for (let c = 0; c < this._cols; c++) {
        const cell = this.grid[r][c]
        if (cell.letter === '') continue

        // Track bounding box
        minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r)
        minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c)

        // Intersection: owned by at least one across and one down word
        const dirs = new Set([...cell.owners].map(i => this.placed[i].dir))
        if (dirs.has('across') && dirs.has('down')) intersections++
      }
    }

    const boundingArea  = (maxRow - minRow + 1) * (maxCol - minCol + 1)
    const placedCount   = this.placed.length
    // Total: words placed is the dominant term, then intersections,
    // then area as a very small tiebreaker.
    const total         = placedCount   * W_PLACED
                        + intersections * W_INTERSECTION
                        - boundingArea  * W_DISTANCE

    return { intersections, placedCount, boundingArea, total }
  }

  /**
   * scorePlacement — scores a *candidate* placement without committing it.
   * Used by findCandidates (Step 2) to rank options.
   *
   * Quick heuristic: counts intersections this word would add + distance
   * from grid centre (closer = better, encourages bunching).
   */
  scorePlacement(
    word: string, row: number, col: number, dir: Direction
  ): number {
    const len  = word.length
    const dr   = dir === 'down' ? 1 : 0
    const dc   = dir === 'across' ? 1 : 0

    let newIntersections = 0

    for (let i = 0; i < len; i++) {
      const r = row + dr * i
      const c = col + dc * i
      // Only count genuine intersections — letter must match
      if (this.hasLetter(r, c) && this.letterAt(r, c) === word[i]) newIntersections++
    }

    // Centre of mass of placed letters
    const centreR = this._rows / 2
    const centreC = this._cols / 2
    const wordMidR = row + dr * (len / 2)
    const wordMidC = col + dc * (len / 2)
    const dist = Math.abs(wordMidR - centreR) + Math.abs(wordMidC - centreC)

    return newIntersections * W_INTERSECTION - dist * W_DISTANCE * 0.5
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * toResult — converts the current state to a LayoutResult suitable for
   * consumption by buildCrosswordGridAndClues.
   */
  toResult(): LayoutResult {
    return {
      placed: [...this.placed],
      score:  this.score(),
      rows:   this._rows,
      cols:   this._cols,
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static makeGrid(rows: number, cols: number): GridCell[][] {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        letter:  '',
        owners:  new Set<number>(),
        blocked: false,
      }))
    )
  }

  private expand(newRows: number, newCols: number): void {
    // Add new columns to existing rows
    if (newCols > this._cols) {
      for (let r = 0; r < this._rows; r++) {
        for (let c = this._cols; c < newCols; c++) {
          this.grid[r].push({ letter: '', owners: new Set(), blocked: false })
        }
      }
      this._cols = newCols
    }

    // Add new rows
    if (newRows > this._rows) {
      for (let r = this._rows; r < newRows; r++) {
        this.grid.push(
          Array.from({ length: this._cols }, () => ({
            letter: '', owners: new Set<number>(), blocked: false,
          }))
        )
      }
      this._rows = newRows
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2 — findCandidates
// ---------------------------------------------------------------------------

/**
 * A scored placement candidate for a single word.
 */
export interface Candidate {
  word:          string
  clue:          string
  row:           number
  col:           number
  dir:           Direction
  /** Number of genuine letter-matched intersections this placement adds */
  intersections: number
  /** Composite score from GridState.scorePlacement — higher is better */
  score:         number
}

/**
 * findCandidates — generates every valid placement for `word` in `grid`,
 * scores each one, and returns them sorted best-first.
 *
 * Strategy:
 *  1. Scan every letter cell already in the grid.
 *  2. For each cell whose letter matches any character in `word`, compute the
 *     (row, col) that would align word[i] with that cell, for both directions.
 *  3. Validate with grid.canPlace().
 *  4. Score with grid.scorePlacement().
 *  5. Deduplicate (same row/col/dir can arise from multiple matching chars).
 *  6. Return sorted by score descending.
 *
 * Special case — first word (empty grid):
 *  Returns a single candidate placing the word horizontally at the grid centre.
 *  This anchors all subsequent words near the centre, encouraging a compact,
 *  bunched layout rather than one that sprawls toward a corner.
 *
 * @param word  - uppercase word string
 * @param clue  - clue text (carried through to Candidate for convenience)
 * @param grid  - current GridState (read-only intent — not mutated here)
 */
export function findCandidates(
  word: string,
  clue: string,
  grid: GridState
): Candidate[] {
  // ── Special case: first word ──────────────────────────────────────────────
  if (grid.placed.length === 0) {
    const row = Math.floor(grid.rows / 2)
    const col = Math.floor((grid.cols - word.length) / 2)
    return [{
      word, clue, row, col,
      dir:          'across',
      intersections: 0,
      score:         0,
    }]
  }

  // ── General case: find cells matching each character of word ──────────────
  const seen    = new Set<string>()   // dedup key: "row,col,dir"
  const results: Candidate[] = []

  for (let i = 0; i < word.length; i++) {
    const ch = word[i]

    // Scan the entire grid for cells containing this character
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (grid.letterAt(r, c) !== ch) continue

        // Compute starting position for each direction so word[i] lands at (r, c)
        const candidates: Array<[number, number, Direction]> = [
          [r,     c - i, 'across'],   // word[i] at col c → start at col c-i
          [r - i, c,     'down'  ],   // word[i] at row r → start at row r-i
        ]

        for (const [startRow, startCol, dir] of candidates) {
          const key = `${startRow},${startCol},${dir}`
          if (seen.has(key)) continue
          seen.add(key)

          if (!grid.canPlace(word, startRow, startCol, dir)) continue

          // Count genuine intersections (letter-matched cells already in grid)
          const dr = dir === 'down' ? 1 : 0
          const dc = dir === 'across' ? 1 : 0
          let intersections = 0
          for (let k = 0; k < word.length; k++) {
            const lr = startRow + dr * k
            const lc = startCol + dc * k
            if (grid.hasLetter(lr, lc) && grid.letterAt(lr, lc) === word[k]) {
              intersections++
            }
          }

          const score = grid.scorePlacement(word, startRow, startCol, dir)

          results.push({ word, clue, row: startRow, col: startCol, dir, intersections, score })
        }
      }
    }
  }

  // Sort best-first: primary = score desc, secondary = intersections desc
  results.sort((a, b) =>
    b.score - a.score || b.intersections - a.intersections
  )

  return results
}

// ---------------------------------------------------------------------------
// Step 3 — placementEngine
// ---------------------------------------------------------------------------

/** Input word as expected by the engine (mirrors LibInputWord) */
export interface EngineWord {
  answer: string
  clue:   string
}

/** Options for the placement engine */
export interface PlacementOptions {
  /**
   * Minimum words that must be placed for the result to be considered valid.
   * If fewer than this are placed after all backtracking is exhausted, the
   * engine returns the best partial layout found rather than throwing.
   * Default: 5
   */
  minWords?: number

  /**
   * Maximum number of backtrack operations before giving up on improvement.
   * Each backtrack pops a word off the stack and tries the next candidate.
   * Higher values find denser grids but take longer.
   * Default: 150
   */
  maxBacktracks?: number

  /**
   * Number of top-scored candidates to consider per word at each stack level.
   * Larger values explore more of the search space but increase runtime.
   * Default: 6
   */
  topK?: number
}

/** Internal stack frame for the iterative backtracker */
interface Frame {
  wordIdx:    number       // index into the sorted word list
  candidates: Candidate[]  // all valid candidates for this word (pre-sorted)
  nextIdx:    number       // next candidate index to try if we backtrack here
}

/**
 * placementEngine — iterative backtracking crossword layout algorithm.
 *
 * Phase 1 — Greedy pass:
 *   Places words one at a time, longest-first, always choosing the
 *   highest-scored candidate from findCandidates. Words with no valid
 *   placement (no intersections possible) are skipped silently.
 *
 * Phase 2 — Backtrack improvement:
 *   After the greedy pass, if the placed count is below minWords (or if
 *   we simply want to improve density), the engine walks back through the
 *   stack trying alternate candidates at each level. Each backtrack step:
 *     1. Removes the most recently placed word (grid.unplace)
 *     2. Tries the next available candidate at that stack level
 *     3. Re-runs the greedy pass from that point forward
 *   This continues until maxBacktracks is reached or we find a result
 *   with a higher intersection score than the greedy pass produced.
 *
 * Best-tracking:
 *   The best layout seen at any point (by intersection density score)
 *   is retained and returned. Even if backtracking finds no improvement,
 *   the greedy result is always returned — the engine never fails.
 *
 * @param words  - word/clue pairs, may be in any order (engine sorts internally)
 * @param opts   - tuning parameters (all optional)
 */
export function placementEngine(
  words: EngineWord[],
  opts: PlacementOptions = {}
): LayoutResult {
  const maxBT = opts.maxBacktracks ?? 150
  const topK  = opts.topK          ?? 6

  // Sort longest-first — longer words anchor the grid with maximum intersection potential.
  const sorted = [...words].sort(
    (a, b) => b.answer.length - a.answer.length || a.answer.localeCompare(b.answer)
  )

  if (sorted.length === 0) {
    const g = new GridState()
    return { placed: [], score: { intersections: 0, placedCount: 0, boundingArea: 0, total: 0 }, rows: g.rows, cols: g.cols }
  }

  let best:       LayoutResult | null = null
  let bestScore = -Infinity
  let btUsed    = 0

  /**
   * solve — recursive backtracker.
   *
   * @param grid       current grid state (mutated in place, restored on return)
   * @param remaining  indices into sorted[] that have NOT yet been placed or skipped
   */
  const solve = (grid: GridState, remaining: number[]): void => {
    // Snapshot the best layout seen so far
    if (grid.placed.length > 0) {
      const s = grid.score()
      if (s.total > bestScore) {
        bestScore = s.total
        best      = grid.toResult()
      }
    }

    // Base case: nothing left to try
    if (remaining.length === 0) return

    // Early exit: excellent solution found
    if (
      best &&
      best.score.placedCount >= sorted.length * 0.85 &&
      best.score.intersections >= best.score.placedCount - 1
    ) return

    // Try to place each word in remaining[], in order
    // We iterate through remaining to find the first word we can place.
    // Words with no candidates are skipped (not counted as backtracks).
    for (let ri = 0; ri < remaining.length; ri++) {
      const wordIdx  = remaining[ri]
      const w        = sorted[wordIdx]
      const candidates = findCandidates(w.answer, w.clue, grid).slice(0, topK)

      if (candidates.length === 0) continue   // no valid placement — skip

      // The rest of remaining (excluding this word)
      const nextRemaining = [...remaining.slice(0, ri), ...remaining.slice(ri + 1)]

      // Try each candidate at this position.
      // candidateIdx 0 = greedy first choice (free, no backtrack cost).
      // candidateIdx > 0 = actual backtrack (costs from the budget).
      for (let ci = 0; ci < candidates.length; ci++) {
        if (ci > 0 && btUsed >= maxBT) return   // budget only applies to real backtracks

        const c = candidates[ci]
        grid.place(c.word, c.clue, c.row, c.col, c.dir)
        solve(grid, nextRemaining)
        grid.unplace()
        if (ci > 0) btUsed++   // only count actual backtracks
      }

      // Only try the first placeable word per call frame.
      // This gives us depth-first search: commit to the first placeable word,
      // recurse on the rest, backtrack if needed.
      // Without this break we'd try every word at every position — exponential.
      break
    }
  }

  const grid = new GridState()
  solve(grid, sorted.map((_, i) => i))

  if (!best) {
    // Fallback: place first word only (should never happen with a non-empty list)
    const g     = new GridState()
    const c1    = findCandidates(sorted[0].answer, sorted[0].clue, g)
    if (c1.length > 0) g.place(c1[0].word, c1[0].clue, c1[0].row, c1[0].col, c1[0].dir)
    best = g.toResult()
  }

  return best
}

