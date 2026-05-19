#!/usr/bin/env bash
# =============================================================================
# generate-all-wordlists.sh
#
# Loops through every CSV in the wordlists/ directory, calls generate-words
# for each one, and writes the expanded list to generated-wordlists/.
#
# The existing file is passed as --existing so its words are preserved and
# used as seeds. The theme is derived from the filename (no extension).
#
# Usage:
#   ./scripts/generate-all-wordlists.sh
#
# Run from the project root (puzzle-book-generator/).
# Requires ANTHROPIC_API_KEY to be set in the environment, or pass it as:
#   ANTHROPIC_API_KEY=sk-... ./scripts/generate-all-wordlists.sh
#
# Options (env vars):
#   WORDLISTS_DIR   — source directory  (default: wordlists)
#   OUTPUT_DIR      — output directory  (default: generated-wordlists)
#   COUNT           — words per theme   (default: 150)
#   DRY_RUN         — set to 1 to print commands without running (default: 0)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config (override via env vars)
# ---------------------------------------------------------------------------
WORDLISTS_DIR="${WORDLISTS_DIR:-wordlists}"
OUTPUT_DIR="${OUTPUT_DIR:-generated-wordlists}"
COUNT="${COUNT:-150}"
DRY_RUN="${DRY_RUN:-0}"
CLI="node apps/cli/dist/index.js"

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
if [[ ! -d "$WORDLISTS_DIR" ]]; then
  echo "❌  Source directory not found: $WORDLISTS_DIR"
  echo "    Run from the project root (where observatory-book.manifest.json lives)."
  exit 1
fi

if [[ ! -f "apps/cli/dist/index.js" ]]; then
  echo "❌  CLI not built. Run 'npm run build' first."
  exit 1
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "❌  ANTHROPIC_API_KEY is not set."
  echo "    Export it or prefix the script: ANTHROPIC_API_KEY=sk-... $0"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# ---------------------------------------------------------------------------
# Count files for progress display
# ---------------------------------------------------------------------------
total=$(find "$WORDLISTS_DIR" -maxdepth 1 -name "*.csv" | wc -l | tr -d ' ')

if [[ "$total" -eq 0 ]]; then
  echo "⚠️   No CSV files found in $WORDLISTS_DIR/"
  exit 0
fi

echo ""
echo "🔭  Observatory Word List Generator"
echo "    Source : $WORDLISTS_DIR/ ($total files)"
echo "    Output : $OUTPUT_DIR/"
echo "    Count  : $COUNT words per theme"
[[ "$DRY_RUN" == "1" ]] && echo "    Mode   : DRY RUN (no API calls)"
echo ""

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
success=0
failed=0
skipped=0
idx=0

for filepath in "$WORDLISTS_DIR"/*.csv; do
  idx=$((idx + 1))
  filename=$(basename "$filepath")           # 01-ancient-civilizations.csv
  theme="${filename%.csv}"                   # 01-ancient-civilizations
  output="$OUTPUT_DIR/$filename"

  echo "[$idx/$total] $theme"
  echo "         source : $filepath"
  echo "         output : $output"

  cmd=(
    $CLI generate-words
    --theme   "$theme"
    --existing "$filepath"
    --output  "$output"
    --count   "$COUNT"
  )

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "         cmd    : ${cmd[*]}"
    echo ""
    skipped=$((skipped + 1))
    continue
  fi

  # Run the command; capture exit code without letting set -e abort the loop
  if "${cmd[@]}"; then
    echo "         ✅  done"
    success=$((success + 1))
  else
    echo "         ❌  failed (exit $?)"
    failed=$((failed + 1))
  fi

  echo ""
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "────────────────────────────────────"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "  Dry run complete — $skipped command(s) printed, no API calls made."
else
  echo "  ✅  $success succeeded"
  [[ "$failed" -gt 0 ]] && echo "  ❌  $failed failed"
fi
echo ""
