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

## 3. Write / Update Tests with 100% Coverage

- Place tests in `tests/` mirroring `src/` (e.g. `tests/cli/tui/NexusTuiApp.test.tsx`).
- For Ink TUI components, use the harness in [tests/helpers/renderInk.ts](../../../tests/helpers/renderInk.ts).
  - Never fake `setImmediate`/`nextTick` when using `vi.useFakeTimers()`, because Ink 6 flushes lone Escape keys on `setImmediate`. Use `{ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] }`.
  - Always call `unmount()` in `afterEach` so intervals do not leak.
- Register every newly added or modified testable module in `coverage.include` inside [vitest.config.ts](../../../vitest.config.ts).
- Verify 100% `lines`, `statements`, `functions`, and `branches` per file. Never relax thresholds.

## 4. Run the Full Verification Gate

On Windows PowerShell (use `.cmd` wrappers):

```powershell
npm.cmd run verify
```

This runs:
1. `npm run typecheck`
2. `npm run test:coverage`
3. `npm run build`

If any step fails, fix all errors and re-run `npm.cmd run verify` until it exits `0`.

## 5. Update Documentation & Changelog

- Update [docs/CLI.md](../../../docs/CLI.md), [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md), or [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md) if CLI behavior, schema, IPC, or architecture changed.
- Record user-facing fixes or features under `## [Unreleased]` in [CHANGELOG.md](../../../CHANGELOG.md).

## 6. Inspect & Commit Atomically

- Check `git status` and `git diff`. Ensure `.env`, `prisma/*.db`, `out/`, `dist/`, and `coverage/` are not staged.
- Commit in atomic Conventional Commits following [docs/GIT_WORKFLOW.md](../../../docs/GIT_WORKFLOW.md).
- Do not push or create release tags unless explicitly asked by the user.
