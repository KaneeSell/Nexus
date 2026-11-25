# Guia de Desenvolvimento e Continuidade

Este guia reúne tudo o que você precisa para **configurar o Nexus do zero em outro computador** (ex: em casa), entender as decisões técnicas críticas já resolvidas e continuar o roadmap sem atritos.

---

## 1. Pré-requisitos na Nova Máquina

- **Node.js 22+** (testado também em Node 26)
- **Git** e **GitHub CLI (`gh`)** autenticados (opcional para automações de release)
- **Windows:** Windows Terminal recomendado para testar a TUI interativa com cores TrueColor e Unicode

---

## 2. Setup do Zero (Clone → Rodando)

```powershell
# 1. Clonar o repositório
git clone https://github.com/KaneeSell/Nexus.git
cd Nexus

# 2. Instalar dependências
npm.cmd install

# 3. Criar o arquivo .env na raiz (ele é ignorado pelo Git)
Set-Content -Path .env -Value 'DATABASE_URL="file:./dev.db"'

# 4. Gerar Prisma Client e criar o banco SQLite local (prisma/dev.db)
npx.cmd prisma generate
npx.cmd prisma db push

# 5. Validar TypeScript e build completo
npm.cmd run typecheck
npm.cmd run build
```

> **Windows PowerShell:** se scripts `.ps1` forem bloqueados por *ExecutionPolicy*, use sempre `npm.cmd` e `npx.cmd`.

---

## 3. Comandos de Dia a Dia

| Comando | Para que serve |
| :--- | :--- |
| `npm.cmd run dev` | Abre o app Electron com hot-reload |
| `npm.cmd run tui` | Compila e abre o cockpit TUI (`Ink`) no terminal |
| `node bin/nexus.mjs` | Executa o entrypoint oficial do CLI (abre TUI sem args; abre Electron com `.`) |
| `node bin/nexus.mjs projects --sync` | Sincroniza e lista projetos salvos no SQLite |
| `npm.cmd run typecheck` | Checa tipos de todo o projeto (`main`, `preload`, `renderer`, `cli`, `shared`, `tests`) |
| `npm.cmd run test` | Executa a suíte de testes automatizados com Vitest |
| `npm.cmd run test:watch` | Executa os testes em modo observação durante o desenvolvimento |
| `npm.cmd run test:coverage` | Executa todos os testes exigindo 100% de cobertura por arquivo (`vitest.config.ts`) |
| `npm.cmd run verify` | Portão completo pré-commit: `typecheck` + `test:coverage` + `build` |
| `npm.cmd run version:bump` | Calcula e aplica bump SemVer (`package.json`, lockfile e `CHANGELOG.md`) pelos commits |
| `npm.cmd run version:patch` | Incrementa versão `PATCH` (`0.1.0` → `0.1.1`) |
| `npm.cmd run version:minor` | Incrementa versão `MINOR` (`0.1.0` → `0.2.0`) |
| `npm.cmd run version:major` | Incrementa versão `MAJOR` (`0.1.0` → `1.0.0`) |
| `npm.cmd run build` | Compila Electron + `out/cli/index.js` + `out/cli/tui.mjs` autossuficiente |
| `npm.cmd run dist:win` | Gera instaladores `.exe` (NSIS) e `.msi` (WiX) em `dist/` |

---

## 4. Armadilhas Técnicas Já Resolvidas (Não Quebrar!)

1. **Ciclo de vida `BrowserWindow` (`src/main/index.ts`):**
   - No evento `win.on('closed', ...)`, o `win.webContents` já está destruído. Sempre capture `const webContentsId = win.webContents.id` na criação da janela antes de registrar listeners.
2. **Bundle autossuficiente da TUI (`scripts/build-cli.mjs`):**
   - `out/cli/tui.mjs` vai para `resources/cli/tui.mjs` **fora do `app.asar`** no app instalado. Por isso `ink` e `react` precisam ser empacotados dentro de `tui.mjs`, com `react-devtools-core` stubado e `createRequire(import.meta.url)` no banner.
   - Além disso, `src/cli/tui/esmShim.ts` define `__filename` e `__dirname` em `globalThis` usando `import.meta.url` (corrigindo `createRequire(__filename)` em `prisma.ts`).
3. **Ink em streams não-TTY e Rules of Hooks (`src/cli/tui/NexusTuiApp.tsx`):**
   - Sempre proteja `useInput` com `{ isActive: Boolean(isRawModeSupported) }` via `useStdin()`, evitando crash quando executado em consoles em pipe.
   - Nunca chame hooks (`useMemo`, `useEffect`, etc.) dentro do callback do `useInput`, em handlers ou após um `return` condicional (como o `if (!bootDone)`), para evitar o erro `Minified React error #321` em produção.
4. **Spawn de Terminal e Ferramentas no Windows (`src/main/system/toolDetector.ts`):**
   - Nunca passe `cd /d "..."` dentro de argumentos do `cmd.exe /c start` (aspas quebram no `CreateProcess`). Use `wt.exe -d <dir>` ou passe `cwd: resolvedPath` no `spawn`.
5. **Empacotamento Windows/Linux (`package.json` + `electron-builder.yml`):**
   - Scripts `dist:*` devem manter `--publish never` para o `electron-builder` não exigir `GH_TOKEN` durante os jobs de build (a publicação da Release é feita pelo job `release` com `softprops/action-gh-release@v2`).
   - O campo `author` em `package.json` e `maintainer` em `electron-builder.yml` precisam conter e-mail válido para o empacotamento `.deb` no Linux.
6. **Sincronização do Schema SQLite no App Instalado (`src/main/db/prisma.ts`):**
   - Sempre que criar/alterar tabelas ou colunas em `prisma/schema.prisma`, lembre-se de espelhar o `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` correspondente dentro de `ensureDatabaseReady()` em `src/main/db/prisma.ts`.

---

## 5. Onde Continuar o Projeto

Consulte os próximos passos planejados em:
- [docs/ROADMAP.md](ROADMAP.md) — Fase 2 (etapas paralelas, retry/finally, `.nexus.json`, `xterm.js` + `node-pty`) e Fase 3 (novos adaptadores Docker/Makefile/Cargo/Python, monitor de portas/processos, Git em lote, editor `.env`, analisador de `node_modules`).
- [docs/CLI_TUI_ROADMAP.md](CLI_TUI_ROADMAP.md) — Etapas 1 a 4 da TUI/CLI já concluídas (prontas para expandir com edição de pipelines pela CLI).
- [docs/GIT_WORKFLOW.md](GIT_WORKFLOW.md) — Regras de commit, branch e release para manter o repositório organizado.
