#!/usr/bin/env bash
# ── Bump version, tag, and push ──
# Usage:
#   ./scripts/bump-version.sh 1.0.1        # set specific version
#   ./scripts/bump-version.sh patch        # 1.0.0 -> 1.0.1
#   ./scripts/bump-version.sh minor        # 1.0.0 -> 1.1.0
#   ./scripts/bump-version.sh major        # 1.0.0 -> 2.0.0
set -euo pipefail

VERSION_FILE="src/app/shared/lib/version.ts"
current=$(sed -n "s/^export const APP_VERSION = '\(.*\)';/\1/p" "$VERSION_FILE")

if [ $# -ne 1 ]; then
  echo "Current version: $current"
  echo "Usage: $0 <version | patch | minor | major>"
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

# Update version file
sed -i "s/^export const APP_VERSION = '.*';/export const APP_VERSION = '$new';/" "$VERSION_FILE"

# Commit and tag
git add "$VERSION_FILE"
git commit -m "Bump version to $new"
git tag -a "v$new" -m "v$new"

echo ""
echo "Done! Now push with:"
echo "  git push origin main --tags"
