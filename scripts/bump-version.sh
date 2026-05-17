#!/usr/bin/env bash
# ── Bump version: tag and push ──
# Version is auto-derived from git tags at build time (gen-version.sh).
# This script just creates the tag and pushes it.
#
# Usage:
#   ./scripts/bump-version.sh 1.0.1        # set specific version
#   ./scripts/bump-version.sh patch        # 1.0.0 -> 1.0.1
#   ./scripts/bump-version.sh minor        # 1.0.0 -> 1.1.0
#   ./scripts/bump-version.sh major        # 1.0.0 -> 2.0.0
set -euo pipefail

# Determine current version from the last tag (or 0.0.0)
current=$(git describe --tags --match 'v*' --abbrev=0 2>/dev/null | sed 's/^v//' || echo "0.0.0")

if [ $# -ne 1 ]; then
  echo "Current version (from git tags): $current"
  echo "Usage: $0 <version | patch | minor | major>"
  echo ""
  echo "  Run 'pnpm build' after tagging to regenerate version.ts."
  exit 1
fi

case "$1" in
  patch|minor|major)
    IFS='.' read -r major minor patch <<< "$current"
    case "$1" in
      patch) new="$major.$minor.$((patch + 1))" ;;
      minor) new="$major.$((minor + 1)).0" ;;
      major) new="$((major + 1)).0.0" ;;
    esac
    ;;
  *)
    new="$1"
    ;;
esac

echo "Bumping: $current -> $new"

# Tag and push — version.ts is auto-generated at build time
git tag -a "v$new" -m "v$new"

echo ""
echo "Done! Push with:"
echo "  git push origin main --tags"
echo ""
echo "The next build (local or CI) will use v$new."
