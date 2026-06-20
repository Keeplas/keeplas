#!/usr/bin/env bash
# Vercel Ignored Build Step — allowlist of auto-deployable branches.
# Exit 1 => proceed with build. Exit 0 => skip build.
# Wire it in Vercel: Settings → Git → Ignored Build Step →
#   bash apps/web/scripts/vercel-ignore-build.sh
set -euo pipefail

ALLOWED=("main" "develop")
branch="${VERCEL_GIT_COMMIT_REF:-}"

for b in "${ALLOWED[@]}"; do
  if [ "$branch" = "$b" ]; then
    echo "✅ Branch '$branch' is allowed — building."
    exit 1
  fi
done

echo "⏭️  Branch '$branch' is not in the allowlist — skipping build."
exit 0
