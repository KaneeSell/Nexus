# Nexus

[![CI](https://github.com/KaneeSell/Nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/KaneeSell/Nexus/actions/workflows/ci.yml)
[![Build & Release](https://github.com/KaneeSell/Nexus/actions/workflows/build.yml/badge.svg)](https://github.com/KaneeSell/Nexus/actions/workflows/build.yml)
[![Latest Release](https://img.shields.io/github/v/release/KaneeSell/Nexus)](https://github.com/KaneeSell/Nexus/releases/latest)

Orquestrador de projetos local para desktop (**Windows** e **Linux**) e terminal (**TUI animada + CLI DB-first**), com scanner inteligente de workspaces, executor de scripts, editor visual de pipelines com drag-and-drop, detecção automática de IDEs e CLIs de IA e verificação de atualizações integrada.

---

## Download (Windows & Linux)

Baixe o instalador mais recente diretamente na página de [**Releases do GitHub**](https://github.com/KaneeSell/Nexus/releases/latest):

- **Windows:** `Nexus Setup <versão>.exe` (NSIS — já registra `nexus` no `PATH` do usuário) ou `Nexus <versão>.msi`
- **Linux:** `.AppImage`, `.deb`, `.rpm` ou `.tar.gz`

O próprio aplicativo verifica novas versões no GitHub Releases e exibe um aviso discreto com opções para **Atualizar agora**, **Lembrar em 24h** ou **Ignorar 7 dias**.

---

## Principais Recursos

- **Cockpit TUI no Terminal (`nexus`):** interface interativa animada em **Ink** com abas de Projetos, Pipelines, Comandos e Histórico, execução ao vivo, busca/slash commands (`/sync`, `/run`, `/open`, `/gui`) e sync sob demanda (`r` ou `--sync`).
- **CLI DB-First (`nexus projects`, `scripts`, `pipelines`, `history`, `run`):** consultas instantâneas direto do SQLite de qualquer diretório, com flag `-s` / `--sync` para atualizar o banco a partir do disco.
- **App Desktop Electron (`nexus .` ou `nexus --gui`):** interface React + MUI com modo claro/escuro, console ao vivo, seleção ordenada de scripts em lote, pipelines drag-and-drop e histórico persistente.
- **Integração Dinâmica com IDEs e CLIs de IA:** detecta automaticamente **VS Code, Antigravity, Cursor, Windsurf, Zed, WebStorm**, **Claude Code, Gemini CLI, Codex CLI, GitHub Copilot CLI, Aider, OpenCode, Qwen**, **Windows Terminal** e abre direto na pasta do projeto.

---

## Stack Principal

- **Desktop / Build:** Electron 35, `electron-vite`, Vite 6, TypeScript 5, `electron-builder`, `esbuild`
- **Interface (Desktop & Terminal):** React 19, MUI Material 7, Zustand, `@dnd-kit`, Ink 6
- **Banco de Dados Local:** Prisma 6 + SQLite (`prisma/dev.db` em dev; `userData/nexus.db` no app instalado)

---

## Documentação

- [Arquitetura e Banco de Dados](docs/ARCHITECTURE.md)
- [Referência Completa do CLI e TUI](docs/CLI.md)
- [Guia de Desenvolvimento e Continuidade](docs/DEVELOPMENT.md) — setup em novo PC e armadilhas já resolvidas
- [Fluxo e Boas Práticas de Git](docs/GIT_WORKFLOW.md) — commits, branches, SemVer e releases
- [Guia de Contribuição](CONTRIBUTING.md)
- [Roadmap do Produto](docs/ROADMAP.md) e [Roadmap CLI/TUI](docs/CLI_TUI_ROADMAP.md)
- [Histórico de Versões (Changelog)](CHANGELOG.md)

---

## Desenvolvimento Local

```powershell
# 1. Instalar dependências
npm.cmd install

# 2. Gerar Prisma Client e sincronizar SQLite local
npx.cmd prisma generate
npx.cmd prisma db push

# 3. Rodar Electron em desenvolvimento (hot reload)
npm.cmd run dev

# 4. Rodar TUI animada no terminal
npm.cmd run tui
```

> **Nota para Windows PowerShell:** caso a *ExecutionPolicy* bloqueie scripts `.ps1`, use `npm.cmd` e `npx.cmd`.

---

## Build, Empacotamento e Versionamento

| Script | O que faz |
| :--- | :--- |
| `npm.cmd run typecheck` | Valida TypeScript em `main`, `preload`, `renderer`, `cli` e `shared` |
| `npm.cmd run build` | Compila `out/main`, `out/preload`, `out/renderer`, `out/cli/index.js` e `out/cli/tui.mjs` |
| `npm.cmd run dist:win` | Gera instaladores Windows `.exe` (NSIS) e `.msi` (WiX) em `dist/` |
| `npm run dist:linux` | Gera pacotes Linux (`AppImage`, `.deb`, `.rpm`, `.tar.gz`) em `dist/` |

Para publicar uma nova versão com release automática no GitHub Actions:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```
