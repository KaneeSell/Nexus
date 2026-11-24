# Contribuindo com o Nexus

Antes de implementar alterações, abrir um Pull Request ou realizar commits neste repositório, leia e siga os guias abaixo:

1. **[Fluxo e Boas Práticas de Git](docs/GIT_WORKFLOW.md)** — padrão de branches, Conventional Commits, checklist pré-commit, SemVer e fluxo de Release.
2. **[Fluxo de Qualidade, Testes (100%) e Entrega](docs/QUALITY_WORKFLOW.md)** — suíte Vitest, cobertura obrigatória de 100% e portão `npm.cmd run verify`.
3. **[Guia de Desenvolvimento e Continuidade](docs/DEVELOPMENT.md)** — setup do ambiente (`.env`, Prisma, build) e cuidados técnicos essenciais do projeto.
4. **[Arquitetura do Sistema](docs/ARCHITECTURE.md)** — organização das camadas `main`, `preload`, `renderer`, `cli`, `tui`, schema do SQLite e adaptadores.
5. **[Referência do CLI e TUI](docs/CLI.md)** — contrato completo de subcomandos, flags e atalhos.

> **Nota para agentes de IA:** siga as regras permanentes em [`AGENTS.md`](AGENTS.md) e na skill [`.agents/skills/nexus-delivery-flow/SKILL.md`](.agents/skills/nexus-delivery-flow/SKILL.md), além de `docs/GIT_WORKFLOW.md`, `docs/QUALITY_WORKFLOW.md` e `docs/DEVELOPMENT.md`.
