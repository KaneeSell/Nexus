# Roadmap do Nexus CLI & TUI (100% Terminal / DB-First)

Este documento registra a evolução do **Nexus** em uma experiência completa de terminal (estilo Claude Code / Gemini CLI / Codex CLI), mantendo o app desktop Electron acessível via `nexus .` ou `nexus --gui`.

---

## Etapa 1 — Template Visual & TUI Animada (Concluída)

- [x] Roteamento no CLI:
  - `nexus` (sem argumentos) ou `nexus tui` abre a **TUI interativa no terminal**.
  - `nexus .`, `nexus <caminho>` ou `nexus --gui` (`-g`) abre a **interface gráfica Electron**.
- [x] Interface animada em **Ink** (`src/cli/tui/`):
  - Tela de abertura animada (skippable em qualquer tecla).
  - Logo `NEXUS` em blocos Unicode com animação contínua de cores/shimmer.
  - Barra de status com indicador pulsante do SQLite e fallback `PREVIEW` quando o banco está vazio.

---

## Etapa 2 — Persistência DB-First + Flag `--sync` (`-s`) (Concluída)

- [x] **Persistência de scripts/comandos no SQLite** ([prisma/schema.prisma](file:///c:/Projetos/Pessoais/nexus/prisma/schema.prisma) + [src/main/db/prisma.ts](file:///c:/Projetos/Pessoais/nexus/src/main/db/prisma.ts)):
  - Adicionado modelo `ProjectCommand` vinculado a `ProjectRecord` (`name`, `command`, `source`, `adapterType`).
  - [workspaceScanner.ts](file:///c:/Projetos/Pessoais/nexus/src/main/scanner/workspaceScanner.ts) grava e atualiza os scripts do `package.json` no SQLite durante o scan.
- [x] **Engine de sincronização (`src/main/scanner/dbSync.ts`) e flag `--sync` / `-s`**:
  - **Sem `--sync` (padrão):** consulta exclusivamente o SQLite (instantâneo de qualquer pasta).
  - **Com `--sync`:** re-escaneia workspaces cadastrados/alvo antes de listar ou executar e sinaliza projetos ausentes no disco.
  - **Na TUI:** pressionar `r`, `/sync` ou abrir com `nexus --sync` executa o sync real com barra de progresso no cabeçalho.

---

## Etapa 3 — Comandos Diretos DB-First no Terminal (Concluída)

- [x] `nexus projects [--sync] [--json]` — lista projetos cadastrados no SQLite.
- [x] `nexus scripts [projeto] [--sync] [--json]` — lista scripts/comandos salvos no SQLite.
- [x] `nexus pipelines [projeto] [--sync] [--json]` — lista pipelines e etapas salvos no SQLite.
- [x] `nexus history [projeto] [--history N] [--sync] [--json]` — lista execuções registradas no SQLite.
- [x] `nexus run <pipeline|script> [caminho] [-p projeto] [--sync] [--dry-run] [--env perfil]` — resolve e executa direto do SQLite (sem precisar estar na pasta do projeto).

---

## Etapa 4 — Cockpit Interativo na TUI (Concluída)

- [x] 4 abas navegáveis (`1 · Projetos`, `2 · Pipelines`, `3 · Comandos`, `4 · Histórico`).
- [x] Filtro instantâneo e barra de slash commands (`/`): `/sync`, `/run <nome>`, `/filter <txt>`, `/clear`, `/gui`, `/help`, `/quit`.
- [x] Execução ao vivo (`Enter` em pipeline ou comando) com console integrado, streaming de logs, status por etapa e cancelamento seguro (`c` / `Ctrl+C`).
- [x] Abertura rápida da interface gráfica Electron com `g` ou `/gui`.
