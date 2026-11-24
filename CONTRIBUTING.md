# Contribuindo com o Nexus

Antes de implementar alterações, abrir um Pull Request ou realizar commits neste repositório, leia e siga os guias abaixo:

1. **[Fluxo e Boas Práticas de Git](docs/GIT_WORKFLOW.md)** — padrão de branches, Conventional Commits, checklist pré-commit, SemVer e fluxo de Release.
2. **[Guia de Desenvolvimento e Continuidade](docs/DEVELOPMENT.md)** — setup do ambiente (`.env`, Prisma, build) e cuidados técnicos essenciais do projeto.
3. **[Arquitetura do Sistema](docs/ARCHITECTURE.md)** — organização das camadas `main`, `preload`, `renderer`, `cli`, `tui`, schema do SQLite e adaptadores.
4. **[Referência do CLI e TUI](docs/CLI.md)** — contrato completo de subcomandos, flags e atalhos.

> **Nota para agentes de IA:** antes de commitar ou alterar fluxos de build/release, leia sempre `docs/GIT_WORKFLOW.md` e `docs/DEVELOPMENT.md` para seguir exatamente as convenções e salvaguardas do projeto.
