# Arquitetura do Nexus

Este documento descreve a organização interna do **Nexus** para facilitar a continuidade do desenvolvimento e a adição de novos módulos.

---

## 1. Estrutura de Pastas

```text
nexus/
├── .github/workflows/
│   └── build.yml               # CI para gerar instaladores Windows (.exe/.msi) e Linux
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
│   └── ROADMAP.md
├── prisma/
│   └── schema.prisma           # Modelos SQLite e binaryTargets (Windows + Linux)
├── resources/
│   └── bin/
│       ├── nexus.cmd           # Launcher Windows instalado (recursos/bin)
│       └── nexus               # Launcher Bash Linux instalado (LF)
├── src/
│   ├── cli/
│   │   └── index.ts            # CLI Node standalone (consultas, doctor, pin e --headless)
│   ├── main/
│   │   ├── index.ts            # Ciclo de vida Electron, single-instance e multi-janela
│   │   ├── adapters/           # Detectores/inspetores modulares por tipo de projeto
│   │   │   ├── types.ts
│   │   │   └── nodeAdapter.ts
│   │   ├── db/
│   │   │   └── prisma.ts       # Singleton Prisma, path dev/empacotado e bootstrap SQL
│   │   ├── engine/
│   │   │   ├── envLoader.ts    # Carregador de perfis .env / .env.<perfil>
│   │   │   └── processRunner.ts# Execução sequencial, hooks, dry-run e cancelamento
│   │   ├── ipc/
│   │   │   └── registerHandlers.ts # Handlers IPC expostos ao preload
│   │   ├── scanner/
│   │   │   └── workspaceScanner.ts # Scanner recursivo (profundidade configurável) + progresso
│   │   └── system/
│   │       └── cliManager.ts   # Registro/remoção do CLI no PATH (Windows) e ~/.local/bin (Linux)
│   ├── preload/
│   │   ├── index.ts            # contextBridge expondo window.nexus
│   │   └── index.d.ts          # Tipagem global de window.nexus
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx         # Layout principal, listeners IPC e auto-ações de CLI
│   │       ├── main.tsx
│   │       ├── theme.ts        # Tema MUI Material dark/light
│   │       ├── store/
│   │       │   └── useNexusStore.ts # Estado global Zustand
│   │       └── components/
│   │           ├── TopBar.tsx
│   │           ├── ScanProgressBanner.tsx
│   │           ├── ProjectSidebar.tsx
│   │           ├── ScriptsTab.tsx
│   │           ├── PipelinesTab.tsx
│   │           ├── PipelineEditorDialog.tsx # Editor com @dnd-kit
│   │           ├── HistoryTab.tsx
│   │           ├── RunnerConsole.tsx
│   │           └── SettingsDialog.tsx
│   └── shared/
│       ├── cliArgs.ts          # Parser compartilhado de flags e subcomandos
│       └── types.ts            # DTOs e contrato NexusAPI compartilhados
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

---

## 2. Banco de Dados (Prisma 6 + SQLite)

Definido em [prisma/schema.prisma](file:///C:/Projetos/Pessoais/nexus/prisma/schema.prisma):

- **`WorkspaceHistory`**: pastas abertas recentemente (`path` único, `name`, `lastOpenedAt`, `isPinned`).
- **`ProjectRecord`**: projetos descobertos pelo scanner (`path` único, `name`, `adapterType`, `packageManager`, `lastScannedAt`).
- **`Pipeline`**: conjuntos nomeados de comandos pertencentes a um `ProjectRecord`.
- **`PipelineStep`**: etapas ordenadas (`order`, `name`, `kind` = `script` | `command`, `command`, `onErrorAction` = `stop` | `continue` | `run_command`, `onErrorCommand`, `onSuccessCommand`, `enabled`).
- **`ExecutionRun`**: histórico de execuções (`title`, `status`, `startedAt`, `finishedAt`, `logs`).
- **`AppSetting`**: chave-valor (`themeMode`, `startupMode`, `defaultWorkspacePath`).

### Resolução e Bootstrap no App Empacotado
- **Em desenvolvimento:** utiliza `prisma/dev.db` (ou `DATABASE_URL`).
- **No app instalado (`app.isPackaged`):** utiliza `path.join(app.getPath('userData'), 'nexus.db')`.
- Como o app instalado não depende da CLI do Prisma para rodar migrations, `ensureDatabaseReady()` em [src/main/db/prisma.ts](file:///C:/Projetos/Pessoais/nexus/src/main/db/prisma.ts) executa `CREATE TABLE IF NOT EXISTS` e `CREATE UNIQUE INDEX IF NOT EXISTS` na inicialização.
- O `.prisma/client` é copiado para `resources/app.asar.unpacked/node_modules/.prisma/client` via `extraResources` em [electron-builder.yml](file:///C:/Projetos/Pessoais/nexus/electron-builder.yml) para manter o query engine nativo fora do `app.asar`.

---

## 3. Arquitetura CLI + GUI (Modo Duplo)

O ponto de entrada do CLI ([src/cli/index.ts](file:///C:/Projetos/Pessoais/nexus/src/cli/index.ts), compilado para `out/cli/index.js`) usa o parser [src/shared/cliArgs.ts](file:///C:/Projetos/Pessoais/nexus/src/shared/cliArgs.ts):

1. **Modo Terminal / Headless** (`--help`, `--version`, `--db-path`, `--doctor`, `--list`/`ls`, `--scripts`, `--pipelines`, `--history`, `pin`, `--headless`, `--no-ui`, `nexus run`, ou `--dry-run` sem intenção de abrir UI):
   - Roda diretamente no processo Node do CLI sem abrir janela Electron.
   - Consulta/persiste no mesmo SQLite do app e transmite logs no `stdout`/`stderr` (ou retorna JSON com `--json`).
2. **Modo Interface Gráfica (Electron)**:
   - Serializa `CliLaunchOptions` em `--nexus-launch=<base64>` (além de `--new-window` quando `-n` é passado) e inicia o executável Electron desanexado.
   - Em [src/main/index.ts](file:///C:/Projetos/Pessoais/nexus/src/main/index.ts):
     - Se `-n`/`--new-window` estiver ativo ou não houver janela aberta, cria uma nova `BrowserWindow` associando as opções ao `webContents.id`.
     - Caso contrário, foca a janela atual e envia `workspace:launch-options` via IPC para o renderer atualizar pasta, projeto selecionado, aba, tema, configurações ou disparar script/pipeline.

---

## 4. Canais IPC (`src/main/ipc/registerHandlers.ts` ↔ `src/preload/index.ts`)

- **Workspace:** `workspace:getInitialLaunch`, `workspace:getInitialTarget`, `workspace:scan`, `workspace:pickFolder`, `workspace:getHistory`, `workspace:togglePin`, `workspace:removeHistory`
- **Pipelines:** `pipeline:list`, `pipeline:save`, `pipeline:delete`
- **Runner:** `runner:runScript`, `runner:runScriptsBatch`, `runner:runPipeline`, `runner:cancel`, `runner:getHistory`
- **Sistema & Config:** `system:openInVSCode`, `system:openInExplorer`, `system:openInTerminal`, `system:getCliStatus`, `system:installCli`, `system:uninstallCli`, `system:getAppInfo`, `settings:get`, `settings:set`
- **Eventos Push (Main → Renderer):** `workspace:scan-progress`, `workspace:open-target`, `workspace:launch-options`, `runner:log`, `runner:status`, `runner:step-status`

---

## 5. Como Adicionar Novos Adaptadores de Projeto

1. Crie uma classe implementando `ProjectAdapter` ([src/main/adapters/types.ts](file:///C:/Projetos/Pessoais/nexus/src/main/adapters/types.ts)) com `id`, `label`, `detect(dirPath)` e `inspect(dirPath)`.
2. Registre a instância no array `adapters` em [src/main/scanner/workspaceScanner.ts](file:///C:/Projetos/Pessoais/nexus/src/main/scanner/workspaceScanner.ts).
3. Se o novo adaptador usar outro executável de scripts além de `npm`/`pnpm`/`yarn`/`bun`, estenda `buildPackageScriptCommand` em [src/main/engine/processRunner.ts](file:///C:/Projetos/Pessoais/nexus/src/main/engine/processRunner.ts).

---

## 6. Empacotamento (Windows e Linux)

- **Windows:** gera NSIS `.exe` (com [build/installer.nsh](file:///C:/Projetos/Pessoais/nexus/build/installer.nsh) adicionando `resources\bin` ao `PATH` do usuário) e WiX `.msi` (com `warningsAsErrors: false` e `-sval` para evitar bloqueio de validação ICE em conta sem privilégio de administrador).
- **Linux:** gera `AppImage`, `.deb`, `.rpm` e `.tar.gz` usando `resources/bin/nexus` (Bash) e engines Prisma `debian-openssl-3.0.x` / `rhel-openssl-3.0.x`.
