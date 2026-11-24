# Changelog

Todas as mudanças notáveis do **Nexus** são documentadas neste arquivo seguindo o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
