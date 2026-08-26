#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$REPO_ROOT"

if ! command -v node >/dev/null 2>&1; then
	echo "ERROR: Node.js is required." >&2
	exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
	echo "ERROR: npm is required." >&2
	exit 1
fi

if [ ! -x node_modules/.bin/tsc ] || [ ! -x node_modules/.bin/tsx ]; then
	echo "ERROR: Development dependencies are missing. Run 'npm ci' first." >&2
	exit 1
fi

echo "[quick 1/4] Checking harness script syntax"
sh -n scripts/verify-quick.sh scripts/verify-full.sh

echo "[quick 2/4] Type-checking plugin and tests"
node_modules/.bin/tsc --noEmit

echo "[quick 3/4] Running plugin unit tests"
npm test

echo "[quick 4/4] Running Quiz Generator validator tests"
node --test skills/omni-quiz-generator/tests/validate-quiz.test.mjs

echo "Quick verification passed."
