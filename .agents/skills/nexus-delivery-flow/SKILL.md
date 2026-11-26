---
name: nexus-delivery-flow
description: >-
  Use this skill for every code change, bug fix, or feature in the Nexus repository.
  Enforces the mandatory cycle: implement -> write/update automated tests with 100% coverage ->
  run full verification gate (`npm.cmd run verify`) -> update docs/changelog -> atomic Conventional Commit.
---

# Nexus Change Delivery Flow

Follow these steps in order for every change in the Nexus codebase.

## 1. Understand & Guard Against Known Pitfalls

- Read the target files and check [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md) before editing.
- Keep Electron `BrowserWindow` lifecycle, `ensureDatabaseReady()` SQL mirroring in `src/main/db/prisma.ts`, and Ink Rules-of-Hooks intact.

## 2. Implement the Change

- Keep edits minimal, typed, and aligned with `src/shared/types.ts` contracts.

## 3. Write / Update Vitest (100% Coverage) + E2E (Playwright) Tests

- Place unit/integration Vitest tests in `tests/` mirroring `src/` (e.g. `tests/cli/tui/NexusTuiApp.test.tsx`).
- For Ink TUI components, use the harness in [tests/helpers/renderInk.ts](../../../tests/helpers/renderInk.ts).
  - Never fake `setImmediate`/`nextTick` when using `vi.useFakeTimers()`, because Ink 6 flushes lone Escape keys on `setImmediate`. Use `{ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] }`.
  - Always call `unmount()` in `afterEach` so intervals do not leak.
- Register every newly added or modified testable module in `coverage.include` inside [vitest.config.ts](../../../vitest.config.ts).
- Verify 100% `lines`, `statements`, `functions`, and `branches` per file. Never relax thresholds.
- Add or update **Playwright E2E tests** in `tests/e2e/*.e2e.spec.ts` (Electron desktop app + compiled CLI) whenever adding or changing UI, IPC, CLI, or database flows.

## 4. Update Documentation & Changelog

- Update [docs/CLI.md](../../../docs/CLI.md), [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md), or [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md) if CLI behavior, schema, IPC, or architecture changed.
- Record user-facing fixes or features under `## [Unreleased]` in [CHANGELOG.md](../../../CHANGELOG.md).

## 5. Apply SemVer Version Bump

When the change introduces a `fix`/`perf` (`patch`), `feat` (`minor`), or breaking change (`major`) — see [docs/VERSIONING.md](../../../docs/VERSIONING.md):

```powershell
npm.cmd run version:patch   # or version:minor / version:major / version:bump
```

This keeps `package.json`, `package-lock.json`, and `CHANGELOG.md` synchronized. Skip for isolated `docs`/`test`/`chore`/`ci` changes.

## 6. Run the Full Verification Gate

On Windows PowerShell (use `.cmd` wrappers), run **after** the version bump so CLI/TUI/Electron bundles embed the updated version:

```powershell
npm.cmd run verify
```

This runs **all** checks and tests:
1. `npm run typecheck`
2. `npm run test:coverage` (Vitest 100% per file)
3. `npm run build`
4. `npm run test:e2e` (Playwright Electron + CLI E2E)

If any step or test fails, fix all errors and re-run `npm.cmd run verify` until it exits `0` with 100% passing.

## 7. Inspect & Commit Atomically

- Check `git status` and `git diff`. Ensure `.env`, `prisma/*.db`, `out/`, `dist/`, and `coverage/` are not staged.
- Commit code/tests/docs in atomic Conventional Commits following [docs/GIT_WORKFLOW.md](../../../docs/GIT_WORKFLOW.md), plus `chore(release): bump version to vX.Y.Z` when bumped.

## 8. Push, Release Tag & Monitor GitHub Actions End-to-End

- Push `main` (`git push origin main`) and, whenever a new version `vX.Y.Z` was generated, create and push the annotated tag (`git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin vX.Y.Z`).
- Always monitor GitHub Actions (`CI` on Ubuntu + Windows and `Build & Release Nexus` on Windows + Linux + `release`) via `https://api.github.com/repos/KaneeSell/Nexus/actions/runs` until every job finishes with `conclusion: success` and the GitHub Release `vX.Y.Z` is published.
- If any job fails, inspect the failing job step, fix the root cause, re-run `npm.cmd run verify`, bump a `PATCH` version if the tag was already pushed, push again, and monitor until all workflows are green.
