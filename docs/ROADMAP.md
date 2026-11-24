# Roadmap do Nexus

## Implementado (v0.1.0)

- [x] Estrutura `electron-vite` (Electron + React + TypeScript + MUI Material + Zustand + `@dnd-kit`)
- [x] Banco local Prisma 6 + SQLite com inicialização automática no app empacotado
- [x] Scanner de projeto único ou pasta com múltiplos projetos + feedback de loading em tempo real
- [x] Execução de scripts individuais, seleção ordenada em lote e console ao vivo com cancelamento (`taskkill /T /F`)
- [x] Construtor de pipelines (`CI/CD`, etc.) com arrastar-e-soltar (`@dnd-kit`), comandos livres, etapa ativa/inativa, `onSuccessCommand` e `onErrorAction` (`stop` / `continue` / `run_command`)
- [x] Histórico de execuções salvo no SQLite
- [x] Tela de Configurações manuais (comportamento ao abrir, tema, gerenciamento do `nexus` no `PATH`, dados locais) e workspaces fixados (`Pin`)
- [x] Empacotamento Windows (`.exe` NSIS + `.msi` WiX) e configuração Linux (`AppImage`, `.deb`, `.rpm`, `.tar.gz` + GitHub Actions)
- [x] CLI completo com suporte a todas as flags, subcomandos (`ls`, `run`, `pin`, `doctor`), modo `--headless`, `--dry-run`, `--env`, `--json` e multi-janela

---

## Próximas Fases Sugeridas

### Fase 2 — Fluxos Avançados de Pipeline
- [ ] Execução de etapas em **paralelo** (grupos paralelos dentro de um pipeline, ex: `lint` + `typecheck` antes de `build`)
- [ ] Retry automático por etapa (`N` tentativas com intervalo configurável) e bloco `finally` (sempre roda ao final)
- [ ] Inputs/prompts interativos antes de rodar um pipeline (ex: escolher ambiente ou digitar mensagem de tag)
- [ ] Exportar e importar pipelines via `.nexus.json` na raiz do projeto para versionar no Git
- [ ] Terminal interativo completo (`xterm.js` + `node-pty`) preservando cores ANSI e prompts `y/n`

### Fase 3 — Multi-ecossistema e Monitoramento
- [ ] Novos adaptadores em `src/main/adapters/`: `DockerComposeAdapter`, `MakefileAdapter`, `CargoAdapter` (Rust), `PyProjectAdapter` (Python)
- [ ] Painel de Processos e Portas ativas (`:3000`, `:5173`, etc.) com uso de CPU/RAM e botão para encerrar porta travada
- [ ] Visão geral de Git em lote para todos os projetos da pasta (branch, alterações pendentes, commits atrás/à frente e ações rápidas)
- [ ] Workspaces virtuais multi-repo (agrupar `api` + `web` + `worker` de pastas diferentes e iniciar todos juntos)
- [ ] Editor visual de arquivos `.env` com valores mascarados e alternância rápida de perfis
- [ ] Analisador de espaço de `node_modules` com limpeza segura para projetos inativos
