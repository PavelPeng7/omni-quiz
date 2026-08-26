# Engineering harness bootstrap

**Date:** 2026-08-26  
**Status:** Completed

## Objective

Establish a repository-level engineering harness that gives contributors explicit operating rules, architecture and product contracts, durable design decisions, execution-plan locations, a technical-debt register, and repeatable quick/full verification commands.

## Delivered

- Added `AGENTS.md` as the repository operating contract.
- Added `ARCHITECTURE.md` with runtime boundaries, data flow, dependency direction, persistence identity, generator separation, and extension checklists.
- Added product and design-document indexes.
- Added active/completed execution-plan conventions and a concrete technical-debt register.
- Added executable POSIX scripts:
  - `scripts/verify-quick.sh`
  - `scripts/verify-full.sh`
- Added `npm run verify:quick` and `npm run verify:full` aliases.
- Linked the harness from `README.md`.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| `./scripts/verify-quick.sh` | Passed | TypeScript, 22 plugin tests, and 5 generator-validator tests passed |
| `./scripts/verify-full.sh` | Passed | Quick checks, production build, Schema sample, version/artifact checks, and Git whitespace passed |
| Version consistency | Passed | `package.json`, root `package-lock.json`, lockfile package entry, and `manifest.json` all report `0.3.1` |
| Release artifacts | Passed | `main.js`, `manifest.json`, and `styles.css` exist and are non-empty |

## Decisions and deviations

- Quick verification includes both plugin and generator tests because both are shipped contract surfaces.
- Full verification validates `sample-standard-quiz.md`, not the generator asset template. The first full run incorrectly treated the placeholder template as a finished Quiz and failed on `{{ANSWER_ID}}`; the harness was corrected to preserve the template's intended authoring role.
- Scripts use POSIX `sh` and resolve the repository root relative to their own location.
- Full verification rebuilds tracked `main.js` and reminds the contributor to review/commit it if changed.

## Remaining follow-ups

Known liabilities are recorded in `../tech-debt.md`. No blocker remains from this bootstrap.
