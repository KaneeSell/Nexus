# Changelog

Todas as mudanças notáveis do **Nexus** são documentadas neste arquivo seguindo o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Corrigido
- **CI Linux (`pipelineExporter.test.ts`):** garantida cobertura de 100% de branches no `formatStepNote` independentemente do sistema operacional (Windows/Linux), adicionado teste real em `bash` para scripts `.sh` e aumentado `testTimeout` para `15000ms` em `vitest.config.ts`.

## [0.3.0] - 2026-11-24

### Adicionado
- **Personalização da Exportação de Pipelines (`ExportPipelineDialog` + CLI):** escolha entre estilo **Personalizado (Nexus)** ou **Cru (só comandos)**, pré-visualização ao vivo com cópia rápida e opções configuráveis (`confirmBeforeRun`, `pauseOnFinish`, `includeColors`, `useProjectDir` / `--portable`, `saveLogFile` / `--log`, perfil `.env` e cabeçalho personalizado).

## [0.2.0] - 2026-11-24

### Corrigido
- **TUI (`nexus` / `tui.mjs`):** removida chamada inválida de `useMemo` dentro do callback de `useInput` em `src/cli/tui/NexusTuiApp.tsx`, que causava `Minified React error #321` ao pressionar comandos no terminal, e adicionada dependência `data.detectedTools` ao `useCallback` de `executeSlashCommand`.

### Adicionado
- **Versionamento Automático & Fonte Única de Versão:** injeção da versão de `package.json` em tempo de compilação no CLI e na TUI (`__NEXUS_VERSION__` via `src/shared/version.ts`) e automação SemVer (`npm run version:bump|patch|minor|major`) baseada em Conventional Commits (`src/shared/semverBump.ts` + `scripts/bump-version.mjs`).
- **Exportação de Pipelines (`.bat`, `.ps1`, `.sh`):** botão **Exportar** na aba de Pipelines e subcomando `nexus export <pipeline> [--format bat|ps1|sh] [--out arquivo]` no CLI, gerando scripts autônomos com resumo das etapas, confirmação via `ENTER` antes de executar (`--yes` para modo direto, `--dry-run`, `--no-pause`), logs completos ao vivo e resumo final.
- **Testes Automatizados & Cobertura 100%:** adicionada suíte com Vitest + `@vitest/coverage-v8` (`vitest.config.ts`), harness para Ink 6 (`tests/helpers/renderInk.ts`) e testes com exigência de 100% de cobertura por arquivo (`lines`, `statements`, `functions`, `branches`), além de portão `npm run test:coverage` no CI/Build do GitHub Actions.
- **Fluxo Permanente de Entrega:** criados [`AGENTS.md`](AGENTS.md), a skill [`.agents/skills/nexus-delivery-flow/SKILL.md`](.agents/skills/nexus-delivery-flow/SKILL.md) e [`docs/QUALITY_WORKFLOW.md`](docs/QUALITY_WORKFLOW.md) padronizando o ciclo implementar -> testar (100%) -> `npm.cmd run verify` -> documentar -> commit atômico.

## [0.1.0] - 2026-11-24

### Adicionado
- **Aplicativo Desktop (Electron + React + MUI + Zustand):**
  - Scanner recursivo de projetos Node.js (`npm`, `pnpm`, `yarn`, `bun`) com progresso em tempo real e persistência em SQLite via Prisma 6.
  - Execução individual e em lote ordenado de scripts do `package.json` com console ao vivo e cancelamento da árvore de processos.
  - Editor visual de Pipelines com drag-and-drop (`@dnd-kit`), comandos shell livres, ações de sucesso (`onSuccessCommand`), tratamento de erro (`stop`, `continue`, `run_command`), perfis `.env` e modo `--dry-run`.
  - Detecção dinâmica de IDEs instalados (VS Code, Antigravity, Cursor, Windsurf, Zed, WebStorm), CLIs de IA (Claude Code, Gemini CLI, Codex CLI, GitHub Copilot CLI, Aider, OpenCode, Qwen) e Terminais (Windows Terminal, PowerShell, CMD).
  - Verificador de atualizações integrado consultando o GitHub Releases com opção de **Atualizar agora**, **Lembrar em 24h** e **Ignorar 7 dias**.
- **Cockpit TUI & CLI (`nexus`):**
  - Interface animada no terminal em **Ink** (`nexus` / `nexus tui`) com logo animado, 4 abas (`Projetos`, `Pipelines`, `Comandos`, `Histórico`), execução ao vivo, `/open <app>` e slash commands (`/sync`, `/run`, `/filter`, `/gui`, `/help`).
  - Persistência de comandos/scripts na tabela `ProjectCommand` do SQLite e engine de sincronização `--sync` (`-s`).
  - Comandos diretos DB-first: `nexus projects`, `nexus scripts`, `nexus pipelines`, `nexus history`, `nexus run`, além de `nexus .` e `nexus --gui` para abrir o app desktop.
- **CI/CD & Empacotamento:**
  - Workflows no GitHub Actions para CI multiplataforma (`.github/workflows/ci.yml`) e publicação automática de Releases Windows (`.exe`, `.msi`) e Linux (`AppImage`, `.deb`, `.rpm`, `.tar.gz`) ao criar tags `v*` (`.github/workflows/build.yml`).
