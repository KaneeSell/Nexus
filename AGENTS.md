# Nexus — Regras Permanentes de Entrega e Qualidade

Estas regras aplicam-se a **toda** alteração de código ou documentação neste repositório.

## Fluxo Obrigatório de Entrega (Toda Alteração)

1. **Ler antes de alterar:**
   - Leia os arquivos afetados e consulte [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (armadilhas técnicas) e [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
2. **Implementar de forma mínima e tipada:**
   - Qualquer alteração em `prisma/schema.prisma` deve ser espelhada em `ensureDatabaseReady()` dentro de `src/main/db/prisma.ts`.
   - Em componentes React/Ink (`src/cli/tui/`), nunca chame hooks (`useMemo`, `useEffect`, `useState`, etc.) dentro de callbacks (`useInput`, event handlers) ou após `return` condicional; sempre proteja `useInput` com `{ isActive: Boolean(isRawModeSupported) }`.
   - Nunca leia `process.cwd()/package.json` para obter a versão do Nexus; use `getNexusVersion()` ([src/shared/version.ts](src/shared/version.ts)).
3. **Testes automatizados com 100% de cobertura (obrigatório):**
   - Crie ou atualize testes em `tests/` cobrindo fluxo principal, casos de borda, tratamento de erro e regressão do bug corrigido.
   - Todo módulo novo ou alterado em `src/` deve ser incluído em `coverage.include` no arquivo `vitest.config.ts`, mantendo **100%** em `lines`, `statements`, `functions` e `branches` (`perFile: true`).
   - Nunca reduza ou remova os thresholds de 100% em `vitest.config.ts` para fazer um build passar.
4. **Atualizar documentação e `CHANGELOG.md`:**
   - Mudou flags, comandos ou atalhos? Atualize [docs/CLI.md](docs/CLI.md).
   - Mudou schema, IPC ou arquitetura? Atualize [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
   - Mudança relevante para o usuário? Registre em [CHANGELOG.md](CHANGELOG.md) (`## [Unreleased]`).
5. **Versionamento SemVer automático ([docs/VERSIONING.md](docs/VERSIONING.md)):**
   - Commits de código (`fix`/`perf` → `PATCH`, `feat` → `MINOR`, `BREAKING CHANGE`/`!:` → `MAJOR`) devem atualizar a versão em `package.json`, `package-lock.json` e `CHANGELOG.md` usando `npm.cmd run version:patch|minor|major` ou `npm.cmd run version:bump`.
   - Commits isolados de `docs`, `test`, `chore` ou `ci` não exigem bump de versão.
6. **Executar o portão completo de verificação (`verify`):**
   - Rode `npm.cmd run verify` (Windows PowerShell) ou `npm run verify` (Linux) **após** o bump de versão para garantir que `out/main`, `out/cli/index.js` e `out/cli/tui.mjs` sejam compilados já com a nova versão embutida:
     1. `npm run typecheck` (`tsc --noEmit`)
     2. `npm run test:coverage` (`vitest run --coverage`)
     3. `npm run build` (`electron-vite build && node scripts/build-cli.mjs`)
   - Corrija quaisquer falhas antes de prosseguir.
7. **Commits atômicos seguindo Conventional Commits ([docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)):**
   - Verifique `git status` e `git diff`. **Nunca** commite `.env`, `prisma/*.db`, `out/`, `dist/`, `coverage/` ou `node_modules/`.
   - Use `<tipo>(<escopo opcional>): <descrição curta no imperativo>` (ex.: `fix(tui): ...`, `feat(export): ...`, `test: ...`, `docs: ...`) e finalize o bump com `chore(release): bump version to vX.Y.Z`.
   - Só execute `git push` ou crie tags de release (`vX.Y.Z`) quando explicitamente solicitado pelo usuário.
