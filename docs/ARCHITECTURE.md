# Arquitetura do Nexus

Este documento descreve a organização interna do **Nexus** para facilitar a continuidade do desenvolvimento e a adição de novos módulos.

---

## 1. Estrutura de Pastas

```text
nexus/
├── .github/workflows/
│   ├── ci.yml                  # CI em push/PR para main (Ubuntu + Windows)
│   └── build.yml               # Build Windows/Linux + publicação automática de GitHub Release em tags v*
├── bin/
│   ├── nexus.mjs               # Wrapper Node global (npm link / modo dev)
│   └── nexus.cmd               # Wrapper Windows para modo dev
├── build/
│   ├── icon.ico                # Ícone Windows (NSIS + WiX MSI)
│   ├── icon.png                # Ícone Linux (AppImage/deb/rpm)
│   └── installer.nsh           # Script NSIS que adiciona/remove bin no PATH do usuário
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CLI.md
│   ├── CLI_TUI_ROADMAP.md
│   ├── DEVELOPMENT.md          # Setup em novo PC e armadilhas técnicas já resolvidas
│   ├── GIT_WORKFLOW.md         # Padrão oficial de Git, commits, SemVer e releases
│   └── ROADMAP.md
├── prisma/
│   └── schema.prisma           # Modelos SQLite e binaryTargets (Windows + Linux)
├── resources/
│   └── bin/
│       ├── nexus.cmd           # Launcher Windows instalado (resources/bin)
│       └── nexus               # Launcher Bash Linux instalado (LF)
├── scripts/
│   └── build-cli.mjs           # Bundle esbuild para out/cli/index.js (CJS) e out/cli/tui.mjs (ESM autossuficiente)
├── src/
│   ├── cli/
│   │   ├── index.ts            # CLI Node standalone (TUI, consultas DB-first, doctor, pin, --headless)
│   │   └── tui/
│   │       ├── esmShim.ts      # Define __filename/__dirname no bundle ESM para compatibilidade com Prisma
│   │       ├── index.tsx       # Bootstrap Ink + controllers DB-first / sync / runner / tools
│   │       └── NexusTuiApp.tsx # Cockpit TUI animado (4 abas, slash commands, console ao vivo)
│   ├── main/
│   │   ├── index.ts            # Ciclo de vida Electron, single-instance e multi-janela
│   │   ├── adapters/           # Detectores/inspetores modulares por tipo de projeto
│   │   │   ├── types.ts
│   │   │   └── nodeAdapter.ts
│   │   ├── creator/            # Criador de projetos (APIs de registries, GitHub templates e scaffolder)
│   │   │   ├── registryApi.ts
│   │   │   ├── scaffoldPlan.ts
│   │   │   └── projectScaffolder.ts
│   │   ├── db/
│   │   │   └── prisma.ts       # Singleton Prisma, path dev/empacotado e bootstrap SQL
│   │   ├── engine/
│   │   │   ├── envLoader.ts       # Carregador de perfis .env / .env.<perfil>
│   │   │   ├── pipelineExporter.ts# Gerador de scripts exportáveis (.bat, .ps1, .sh)
│   │   │   └── processRunner.ts   # Execução sequencial, hooks, dry-run e cancelamento
│   │   ├── ipc/
│   │   │   └── registerHandlers.ts # Handlers IPC expostos ao preload
│   │   ├── scanner/
│   │   │   ├── workspaceScanner.ts # Scanner recursivo + persistência de ProjectCommand
│   │   │   └── dbSync.ts       # Engine de sincronização sob demanda (--sync)
│   │   └── system/
│   │       ├── cliManager.ts   # Registro/remoção do CLI no PATH (Windows) e ~/.local/bin (Linux)
│   │       ├── toolDetector.ts # Detecção dinâmica de IDEs, CLIs de IA e terminais + launcher
│   │       └── updateChecker.ts# Checagem de GitHub Releases, snooze e download/execução do instalador
│   ├── preload/
│   │   ├── index.ts            # contextBridge expondo window.nexus
│   │   └── index.d.ts          # Tipagem global de window.nexus
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx         # Layout principal, dropdowns de IDE/IA, listeners IPC e auto-ações de CLI
│   │       ├── main.tsx
│   │       ├── theme.ts        # Tema MUI Material dark/light
│   │       ├── store/
│   │       │   └── useNexusStore.ts # Estado global Zustand
│   │       └── components/
│   │           ├── TopBar.tsx
│   │           ├── UpdateBanner.tsx # Aviso de atualização com adiar (24h / 7 dias) e atualizar
│   │           ├── ScanProgressBanner.tsx
│   │           ├── ProjectSidebar.tsx
│   │           ├── ScriptsTab.tsx
│   │           ├── PipelinesTab.tsx
│   │           ├── NewProjectDialog.tsx # Wizard de criação de projetos (Stack, Meus Templates e Públicos)
│   │           ├── ExportPipelineDialog.tsx # Modal de exportação personalizada (.bat, .ps1, .sh)
│   │           ├── PipelineEditorDialog.tsx # Editor com @dnd-kit
│   │           ├── HistoryTab.tsx
│   │           ├── RunnerConsole.tsx
│   │           └── SettingsDialog.tsx
│   └── shared/
│       ├── cliArgs.ts          # Parser compartilhado de flags e subcomandos
│       ├── projectCatalog.ts   # Catálogo progressivo de stacks, linguagens, DBs e ORMs
│       └── types.ts            # DTOs e contrato NexusAPI compartilhados
├── CHANGELOG.md
├── CONTRIBUTING.md
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

---

## 2. Banco de Dados (Prisma 6 + SQLite)

Definido em [prisma/schema.prisma](file:///c:/Projetos/Pessoais/nexus/prisma/schema.prisma):

- **`WorkspaceHistory`**: pastas abertas recentemente (`path` único, `name`, `lastOpenedAt`, `isPinned`).
- **`ProjectRecord`**: projetos descobertos pelo scanner (`path` único, `name`, `adapterType`, `packageManager`, `lastScannedAt`).
- **`ProjectCommand`**: scripts/comandos persistidos por projeto (`projectId` + `name` único, `command`, `source`, `adapterType`) para consultas DB-first no CLI/TUI.
- **`Pipeline`**: conjuntos nomeados de comandos pertencentes a um `ProjectRecord`.
- **`PipelineStep`**: etapas ordenadas (`order`, `name`, `kind` = `script` | `command`, `command`, `onErrorAction` = `stop` | `continue` | `run_command`, `onErrorCommand`, `onSuccessCommand`, `enabled`).
- **`ExecutionRun`**: histórico de execuções (`title`, `status`, `startedAt`, `finishedAt`, `logs`).
- **`AppSetting`**: chave-valor (`themeMode`, `startupMode`, `defaultWorkspacePath`, `updateDismissedVersion`, `updateDismissedUntil`).

### Resolução e Bootstrap no App Empacotado
- **Em desenvolvimento:** utiliza `prisma/dev.db` (ou `DATABASE_URL`).
- **No app instalado (`app.isPackaged`):** utiliza `path.join(app.getPath('userData'), 'nexus.db')`.
- Como o app instalado não depende da CLI do Prisma para rodar migrations, `ensureDatabaseReady()` em [src/main/db/prisma.ts](file:///c:/Projetos/Pessoais/nexus/src/main/db/prisma.ts) executa `CREATE TABLE IF NOT EXISTS` e `CREATE UNIQUE INDEX IF NOT EXISTS` na inicialização.
- O `.prisma/client` é copiado para `resources/app.asar.unpacked/node_modules/.prisma/client` via `extraResources` em [electron-builder.yml](file:///c:/Projetos/Pessoais/nexus/electron-builder.yml) para manter o query engine nativo fora do `app.asar`.

---

## 3. Arquitetura CLI + TUI + GUI (Modo Triplo)

O ponto de entrada do CLI ([src/cli/index.ts](file:///c:/Projetos/Pessoais/nexus/src/cli/index.ts), compilado para `out/cli/index.js`) usa o parser [src/shared/cliArgs.ts](file:///c:/Projetos/Pessoais/nexus/src/shared/cliArgs.ts):

1. **Modo TUI Interativo (`nexus` ou `nexus tui`)**:
   - Carrega dinamicamente `out/cli/tui.mjs` (bundle ESM autossuficiente com Ink 6 + React 19).
   - Lê e executa direto do SQLite com suporte a `--sync` / `r`, slash commands (`/sync`, `/run`, `/open`, `/filter`, `/gui`) e console ao vivo.
2. **Modo Terminal / Headless / DB-First** (`projects`, `scripts`, `pipelines`, `history`, `run`, `ls`, `pin`, `doctor`, `--headless`, `--dry-run`, `--json`):
   - Roda diretamente no processo Node do CLI sem abrir janela Electron.
   - Consulta/persiste no mesmo SQLite do app e transmite logs no `stdout`/`stderr`.
3. **Modo Interface Gráfica (Electron)** (`nexus .`, `nexus --gui` ou `nexus <caminho>`):
   - Serializa `CliLaunchOptions` em `--nexus-launch=<base64>` (além de `--new-window` quando `-n` é passado) e inicia o executável Electron desanexado.
   - Em [src/main/index.ts](file:///c:/Projetos/Pessoais/nexus/src/main/index.ts), gerencia instância única, multi-janela e envio seguro de opções via IPC.

---

## 4. Canais IPC (`src/main/ipc/registerHandlers.ts` ↔ `src/preload/index.ts`)

- **Workspace:** `workspace:getInitialLaunch`, `workspace:getInitialTarget`, `workspace:scan`, `workspace:pickFolder`, `workspace:getHistory`, `workspace:togglePin`, `workspace:removeHistory`
- **Pipelines:** `pipeline:list`, `pipeline:save`, `pipeline:delete`, `pipeline:previewExport`, `pipeline:export`
- **Runner:** `runner:runScript`, `runner:runScriptsBatch`, `runner:runPipeline`, `runner:cancel`, `runner:getHistory`
- **Sistema, Ferramentas, Config & Updates:** `system:openInVSCode`, `system:openInExplorer`, `system:openInTerminal`, `system:getDetectedTools`, `system:openWithTool`, `system:getCliStatus`, `system:installCli`, `system:uninstallCli`, `system:getAppInfo`, `system:checkForUpdates`, `system:dismissUpdateNotice`, `system:downloadAndInstallUpdate`, `system:openExternalUrl`, `settings:get`, `settings:set`
- **Criador de Projetos:** `creator:getCatalog`, `creator:fetchLiveMeta`, `creator:listUserTemplates`, `creator:searchPublicTemplates`, `creator:previewPlan`, `creator:createProject`
- **Eventos Push (Main → Renderer):** `workspace:scan-progress`, `workspace:open-target`, `workspace:launch-options`, `runner:log`, `runner:status`, `runner:step-status`, `creator:progress`

---

## 5. Como Adicionar Novos Adaptadores de Projeto

1. Crie uma classe implementando `ProjectAdapter` ([src/main/adapters/types.ts](file:///c:/Projetos/Pessoais/nexus/src/main/adapters/types.ts)) com `id`, `label`, `detect(dirPath)` e `inspect(dirPath)`.
2. Registre a instância no array `adapters` em [src/main/scanner/workspaceScanner.ts](file:///c:/Projetos/Pessoais/nexus/src/main/scanner/workspaceScanner.ts).
3. Se o novo adaptador usar outro executável de scripts além de `npm`/`pnpm`/`yarn`/`bun`, estenda `buildPackageScriptCommand` em [src/main/engine/processRunner.ts](file:///c:/Projetos/Pessoais/nexus/src/main/engine/processRunner.ts).

---

## 6. Empacotamento (Windows e Linux)

- **Windows:** gera NSIS `.exe` (com [build/installer.nsh](file:///c:/Projetos/Pessoais/nexus/build/installer.nsh) adicionando `resources\bin` ao `PATH` do usuário) e WiX `.msi` (com `warningsAsErrors: false` e `-sval` para evitar bloqueio de validação ICE em conta sem privilégio de administrador).
- **Linux:** gera `AppImage`, `.deb`, `.rpm` e `.tar.gz` usando `resources/bin/nexus` (Bash) e engines Prisma `debian-openssl-3.0.x` / `rhel-openssl-3.0.x`.
