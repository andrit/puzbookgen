#!/usr/bin/env bash
##
# setup-repo.sh
#
# Initialises a local git repository and pushes to a new GitHub remote.
#
# Usage:
#   ./scripts/setup-repo.sh <github-username> <repo-name>
#
# Example:
#   ./scripts/setup-repo.sh myusername puzzle-book-generator
#
# Prerequisites:
#   - git installed
#   - GitHub CLI (gh) installed and authenticated, OR
#     a GitHub Personal Access Token in the environment as GITHUB_TOKEN
#
# What it does:
#   1. Confirms you're in the project root
#   2. git init (safe to run on an existing repo)
#   3. Creates a .gitignore-safe first commit if none exists
#   4. Creates the GitHub repo via `gh` CLI (private by default)
#   5. Sets origin and pushes
##

set -euo pipefail

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <github-username> <repo-name>"
  echo "Example: $0 myusername puzzle-book-generator"
  exit 1
fi

GITHUB_USER="$1"
REPO_NAME="$2"
REMOTE_URL="git@github.com:${GITHUB_USER}/${REPO_NAME}.git"

# ---------------------------------------------------------------------------
# Validate location — must be run from project root
# ---------------------------------------------------------------------------

if [[ ! -f "package.json" ]]; then
  echo "❌ Error: Run this script from the project root (where package.json lives)"
  exit 1
fi

echo ""
echo "🧩 Puzzle Book Generator — GitHub Repo Setup"
echo "   User : ${GITHUB_USER}"
echo "   Repo : ${REPO_NAME}"
echo "   URL  : ${REMOTE_URL}"
echo ""

# ---------------------------------------------------------------------------
# Git init
# ---------------------------------------------------------------------------

if [[ ! -d ".git" ]]; then
  echo "📁 Initialising git repository..."
  git init
  git branch -M main
else
  echo "✅ Git repository already initialised"
fi

# ---------------------------------------------------------------------------
# Initial commit (if no commits exist)
# ---------------------------------------------------------------------------

if ! git log --oneline -1 &>/dev/null; then
  echo "📝 Creating initial commit..."
  git add .
  git commit -m "chore: initial project scaffold v0.1.0

- Monorepo structure (npm workspaces)
- packages/shared     — TypeScript schema contract
- packages/puzzle-generator — Crossword generation (functional core)
- packages/book-generator   — PDF rendering (print + screen)
- packages/content-db       — Prisma schema + Supabase PostgreSQL
- apps/cli            — yargs CLI (generate-book, import-words)
- apps/web            — Fastify + Vite/React web UI
- .github/workflows/ci.yml  — GitHub Actions CI

See docs/ARCHITECTURE.md for full design documentation."
else
  echo "✅ Repository already has commits"
fi

# ---------------------------------------------------------------------------
# Create GitHub repo (requires gh CLI)
# ---------------------------------------------------------------------------

if command -v gh &>/dev/null; then
  echo "🐙 Creating GitHub repository..."
  if gh repo create "${GITHUB_USER}/${REPO_NAME}" \
      --private \
      --description "Crossword puzzle book generator — print-on-demand and screen PDFs" \
      --source . \
      --remote origin \
      --push 2>/dev/null; then
    echo "✅ Repository created and pushed: https://github.com/${GITHUB_USER}/${REPO_NAME}"
  else
    echo "ℹ️  Repository may already exist. Attempting to set remote and push..."
    git remote remove origin 2>/dev/null || true
    git remote add origin "${REMOTE_URL}"
    git push -u origin main
    echo "✅ Pushed to existing repository"
  fi
else
  # Fallback: manual instructions if gh CLI is not installed
  echo "⚠️  GitHub CLI (gh) not found. Complete setup manually:"
  echo ""
  echo "   1. Create the repository at: https://github.com/new"
  echo "      Name: ${REPO_NAME}"
  echo "      Visibility: Private (recommended)"
  echo "      ⚠️  Do NOT initialise with README, .gitignore, or licence"
  echo ""
  echo "   2. Run these commands:"
  echo "      git remote add origin ${REMOTE_URL}"
  echo "      git push -u origin main"
  echo ""
  echo "   Or with HTTPS:"
  echo "      git remote add origin https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
  echo "      git push -u origin main"
fi

echo ""
echo "🎉 Done! Your repository is at:"
echo "   https://github.com/${GITHUB_USER}/${REPO_NAME}"
echo ""
