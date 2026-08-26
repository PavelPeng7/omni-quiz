# Technical debt register

This file tracks known engineering liabilities with concrete impact and exit criteria. Product ideas belong in product specs, not here.

## TD-001 — Runtime parser and generator validator duplicate Schema v2

- **Priority:** Medium
- **Area:** Protocol maintenance
- **Impact:** A schema change can be accepted by the plugin but rejected by the generator, or the reverse.
- **Current mitigation:** `AGENTS.md` requires synchronized edits; quick verification runs both test suites; full verification validates shipped examples.
- **Exit criteria:** Generate both validators from one environment-neutral schema/contract, or add shared conformance fixtures that every implementation consumes.

## TD-002 — Dashboard catalog uses full Vault rescans

- **Priority:** Medium when large-Vault latency is measured
- **Area:** Performance
- **Impact:** Any Markdown create/modify/delete/rename event causes a debounced read of every Markdown file while the dashboard is open.
- **Current mitigation:** 350 ms debounce, per-file read failure isolation, and a 100-card rendering limit.
- **Exit criteria:** Add an incremental file-path cache with create/modify/delete/rename invalidation, equivalence tests against a full scan, and measured improvement on a representative large Vault.

## TD-003 — Append-only attempts have no retention policy

- **Priority:** Low
- **Area:** Persistence
- **Impact:** Long-running, high-frequency usage can grow plugin `data.json` indefinitely.
- **Current mitigation:** Attempts contain only answer values, correctness, and timestamps; content is not duplicated.
- **Exit criteria:** Define a product-approved retention/export policy and implement migration-safe compaction without changing first-attempt or completed-session analytics.

## TD-004 — Obsidian UI behavior lacks automated integration tests

- **Priority:** Medium
- **Area:** Quality/accessibility
- **Impact:** Unit tests protect logic but do not verify MarkdownRenderChild/ItemView lifecycle, keyboard focus, popout-window behavior, or theme rendering.
- **Current mitigation:** UI code uses Obsidian lifecycle helpers, owning-window DOM constructors, scoped CSS, native controls, and manual Vault testing.
- **Exit criteria:** Add a supported Obsidian integration harness or deterministic DOM adapter tests for event flows, plus a documented light/dark/mobile/popout manual smoke matrix.

## TD-005 — No linter or continuous integration workflow

- **Priority:** Medium before community distribution
- **Area:** Release quality
- **Impact:** Type checking and tests do not enforce Obsidian community lint rules or run automatically on proposed changes.
- **Current mitigation:** Full verification is a single local command and `git diff --check` catches whitespace errors.
- **Exit criteria:** Add `eslint-plugin-obsidianmd` with zero warnings, expose it through the harness, and run quick/full verification in CI with a pinned Node version.

## TD-006 — Historical accuracy recalculates from all attempts

- **Priority:** Low until profiling shows dashboard cost
- **Area:** Analytics performance
- **Impact:** Dashboard aggregation walks all current Quiz histories and attempts on refresh; cost grows with retained sessions.
- **Current mitigation:** Aggregation is pure, linear, and cached during search/filter rendering.
- **Exit criteria:** Measure a meaningful latency threshold first; if exceeded, introduce derived summaries with versioned invalidation and equivalence tests against raw-history aggregation.

## Maintenance rules

- Add debt only when the current design imposes a real cost or risk.
- Every entry needs impact, mitigation, and observable exit criteria.
- When resolved, move the entry into the relevant completed execution plan rather than silently deleting the history.
- Re-evaluate priorities during release planning or after production evidence changes the impact.
