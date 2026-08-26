#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$REPO_ROOT"

echo "[full 1/5] Running quick verification"
"$SCRIPT_DIR/verify-quick.sh"

echo "[full 2/5] Building the production plugin bundle"
npm run build

echo "[full 3/5] Validating the shipped Schema v2 sample"
node skills/omni-quiz-generator/scripts/validate-quiz.mjs sample-standard-quiz.md

echo "[full 4/5] Checking release metadata and artifacts"
node -e '
const fs = require("node:fs");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const rootLockVersion = packageLock.packages?.[""]?.version;
const versions = [packageJson.version, packageLock.version, rootLockVersion, manifest.version];
if (versions.some((version) => version !== packageJson.version)) {
  console.error(`ERROR: Version mismatch: ${versions.join(" / ")}`);
  process.exit(1);
}
for (const path of ["main.js", "manifest.json", "styles.css"]) {
  const stat = fs.statSync(path);
  if (!stat.isFile() || stat.size === 0) {
    console.error(`ERROR: Missing or empty release artifact: ${path}`);
    process.exit(1);
  }
}
for (const path of [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "docs/product-specs/index.md",
  "docs/design-docs/index.md",
  "docs/exec-plans/active/progress.md",
  "docs/exec-plans/completed/README.md",
  "docs/exec-plans/tech-debt.md",
  "scripts/verify-quick.sh",
  "scripts/verify-full.sh",
]) {
  if (!fs.existsSync(path)) {
    console.error(`ERROR: Missing engineering harness file: ${path}`);
    process.exit(1);
  }
}
console.log(`Release metadata and artifacts are valid for ${packageJson.version}.`);
'

echo "[full 5/5] Checking Git whitespace"
git diff --check
git diff --cached --check

echo "Full verification passed. Review and commit main.js if the build changed it."
