# Fluxo e Boas Práticas de Git (`KaneeSell/Nexus`)

Este documento define o padrão oficial de **Git, commits, branches e releases** do projeto **Nexus**. Sempre que for commitar código ou preparar uma nova versão (seja manualmente ou via assistente de IA), siga estas regras.

---

## 1. Estrutura de Branches

- **`main`**: branch principal e sempre compilável. Todo push ou PR em `main` dispara o workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (Windows + Ubuntu).
- **Branches de trabalho** (recomendado para novas features ou correções maiores):
  - `feat/<nome-curto>` — nova funcionalidade (ex: `feat/docker-adapter`, `feat/parallel-steps`)
  - `fix/<nome-curto>` — correção de bug (ex: `fix/window-close-crash`)
  - `docs/<nome-curto>` — apenas documentação
  - `chore/<nome-curto>` — manutenção, dependências, configs
  - `ci/<nome-curto>` — ajustes de GitHub Actions / empacotamento

> Para correções rápidas ou trabalho solo direto, commits bem separados na `main` são aceitos, desde que passem pelo checklist pré-commit abaixo.

---

## 2. Padrão de Commits (Conventional Commits)

Use o formato:

```text
<tipo>(<escopo opcional>): <descrição curta no imperativo>
```

### Tipos permitidos
| Tipo | Quando usar |
| :--- | :--- |
| `feat` | Nova funcionalidade visível para o usuário (GUI, TUI, CLI, adaptador) |
| `fix` | Correção de bug ou regressão |
| `docs` | Alterações em README, guias, CHANGELOG, comentários de documentação |
| `refactor` | Reestruturação de código sem alterar comportamento |
| `perf` | Melhoria de performance |
| `test` | Adição ou ajuste de testes |
| `ci` | Mudanças em `.github/workflows/`, `electron-builder.yml`, scripts de build |
| `chore` | Atualização de pacotes, configs ou tarefas sem impacto em produção |

### Escopos recomendados no Nexus
`main`, `gui`, `tui`, `cli`, `db`, `runner`, `scanner`, `tools`, `updater`, `ci`

### Exemplos reais do projeto
- `fix(main): capture webContentsId before window close to prevent destroyed object error`
- `feat(tui): add /open slash command for detected IDEs and AI CLIs`
- `feat(updater): check GitHub Releases with snooze options in app`
- `docs: add Git workflow and home setup documentation`
- `ci: publish Windows and Linux installers automatically on v* tags`

**Regra de atomicidade:** não misture correções de código com grandes mudanças não relacionadas no mesmo commit; separe `fix(...)` de `docs(...)` ou `feat(...)` sempre que possível.

---

## 3. Checklist Obrigatório Antes de Todo Commit

1. **Validar tipagem, testes (100% de cobertura) e build:**
   ```powershell
   npm.cmd run verify
   ```
   *(Executa `typecheck`, `test:coverage` com exigência de 100% em `vitest.config.ts` e `build` completo.)*
2. **Conferir `git status` e `git diff`:**
   Garanta que **nunca** entrem no commit:
   - `.env` (contém `DATABASE_URL` local)
   - `prisma/*.db` ou `prisma/*.db-journal`
   - `out/`, `dist/`, `coverage/`, `node_modules/`
3. **Atualizar a documentação e testes quando mudar comportamento:**
   - Criou ou alterou módulos em `src/`? Adicione/atualize testes em `tests/` e inclua o arquivo em `coverage.include` no [`vitest.config.ts`](../vitest.config.ts) com 100% de cobertura.
   - Mudou flags ou comandos? Atualize [docs/CLI.md](CLI.md).
   - Mudou schema, IPC ou arquitetura? Atualize [docs/ARCHITECTURE.md](ARCHITECTURE.md).
   - Fez mudança relevante para o usuário? Registre em [CHANGELOG.md](../CHANGELOG.md).
   - Siga também o guia completo em [docs/QUALITY_WORKFLOW.md](QUALITY_WORKFLOW.md).

---

## 4. Controle de Versão e Publicação de Releases (SemVer)

O Nexus segue **Semantic Versioning (`MAJOR.MINOR.PATCH`)**:
- `PATCH` (`0.1.1`): correções de bugs sem quebra (ex: fix no fechamento de janela).
- `MINOR` (`0.2.0`): novas funcionalidades compatíveis (ex: novo adaptador ou etapas paralelas).
- `MAJOR` (`1.0.0`): marco estável ou mudança incompatível.

### Passo a passo para lançar uma nova versão

1. Garanta que `main` está limpa e sincronizada (`git pull --rebase origin main`).
2. Atualize `"version"` em [package.json](../package.json) (e rode `npm.cmd install --package-lock-only` para sincronizar o `package-lock.json`, se desejar).
3. Adicione a nova seção de versão em [CHANGELOG.md](../CHANGELOG.md) com a data e os itens (`Adicionado`, `Corrigido`, `Alterado`).
4. Rode `npm.cmd run verify` (`typecheck` + testes com 100% de cobertura + `build`).
5. Faça o commit de release:
   ```bash
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "chore(release): prepare v0.2.0"
   git push origin main
   ```
6. Crie e envie a tag anotada `vX.Y.Z`:
   ```bash
   git tag -a v0.2.0 -m "Release v0.2.0"
   git push origin v0.2.0
   ```
7. O workflow [`.github/workflows/build.yml`](../.github/workflows/build.yml) compilará automaticamente **Windows (`.exe`, `.msi`)** e **Linux (`.AppImage`, `.deb`, `.rpm`, `.tar.gz`)** e criará a GitHub Release pública — que será detectada automaticamente pelo verificador de atualizações dentro do app.

> **Importante:** nunca reutilize/mova uma tag já publicada em produção depois que usuários baixarem a release; lance uma versão `PATCH` seguinte (`v0.1.1`).

---

## 5. Trabalhando entre Dois Computadores (Trabalho ↔ Casa)

### Ao terminar em um PC
```powershell
npm.cmd run typecheck
git status
git add <arquivos>
git commit -m "feat(...): ..."
git push origin main
```

### Ao continuar no outro PC
```powershell
git pull --rebase origin main
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma db push
```

Caso tenha alterações locais não commitadas antes de dar `pull`:
```powershell
git stash push -m "wip"
git pull --rebase origin main
git stash pop
```
