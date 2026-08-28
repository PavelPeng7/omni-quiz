# Review-first dashboard

## Objective

Turn the dashboard into a review-first home page where users can find unresolved wrong answers, browse quizzes by Obsidian tag, and inspect current and eight-week learning signals.

## Shipped behavior

- Added review, topic, library, and statistics dashboard surfaces.
- Added unresolved wrong-answer analytics and direct navigation to inline questions.
- Added note-tag topic indexing with nested parent aggregation.
- Added eight-week first-attempt volume and accuracy trends.
- Added topic/mode/state filters and recent/wrong/accuracy/title ordering.
- Added theme-aware index-card styling, reduced-motion support, and responsive layouts.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Plugin tests | Passed | 33 tests via `npm test` |
| Generator tests | Passed | 5 tests through `verify-full.sh` |
| Type check and bundle | Passed | `npm run build` through `verify-full.sh` |
| Release/sample checks | Passed | Schema sample and 0.3.2 artifacts validated |
| Whitespace | Passed | `git diff --check` through `verify-full.sh` |
| Manual Obsidian UI smoke test | Not run | No interactive Obsidian window was available in this environment |

## Decisions and deviations

- A question is unresolved when its latest attempt across all sessions is wrong.
- Nested tags contribute to their complete path and every parent path.
- Weekly trends use the current and seven prior local calendar weeks.
- Navigation state is in memory only; creating a new session requires the explicit “重做此题” action.
- No Quiz schema or persisted-data migration was required.

## Follow-up

- Manually smoke-test light/dark themes, narrow layouts, popout windows, and focus scrolling in a representative Vault before release.
