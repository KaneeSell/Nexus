# Versionamento Automático (SemVer + Conventional Commits)

O **Nexus** utiliza **Semantic Versioning (`MAJOR.MINOR.PATCH`)** com fonte única de verdade em [`package.json`](../package.json).

---

## 1. Fonte Única de Verdade (`package.json` → Electron + CLI + TUI)

Durante o build (`npm.cmd run build`), a versão de `package.json` é propagada automaticamente para:
- **App Desktop Electron & Instaladores (`.exe`, `.msi`, `AppImage`, `.deb`, `.rpm`):** via `app.getVersion()` / `electron-builder`.
- **CLI (`out/cli/index.js`) e TUI (`out/cli/tui.mjs`):** injetada em tempo de compilação via `__NEXUS_VERSION__` no [`scripts/build-cli.mjs`](../scripts/build-cli.mjs) e resolvida por [`src/shared/version.ts`](../src/shared/version.ts) (sem jamais ler o `package.json` de outros repositórios onde `nexus` for executado).

---

## 2. Regra de Bump por Tipo de Alteração

| Tipo de Commit | Bump SemVer | Exemplo | Quando aplicar |
| :--- | :--- | :--- | :--- |
| `fix:` / `perf:` | **`PATCH`** (`0.1.0` → `0.1.1`) | `fix(tui): ...` | Correções de bug, regressões e melhorias de performance |
| `feat:` | **`MINOR`** (`0.1.0` → `0.2.0`) | `feat(export): ...` | Nova funcionalidade compatível |
| `feat!:` / `BREAKING CHANGE:` | **`MAJOR`** (`0.2.0` → `1.0.0`) | `feat(cli)!: ...` | Mudança incompatível em CLI, schema ou contrato |
| `docs:` / `test:` / `chore:` / `ci:` | **Sem bump** | `docs: ...` | Alterações apenas internas, testes ou documentação |

---

## 3. Comandos Oficiais de Bump

O script [`scripts/bump-version.mjs`](../scripts/bump-version.mjs) usa o módulo testado [`src/shared/semverBump.ts`](../src/shared/semverBump.ts) para atualizar sincronizadamente **`package.json`**, **`package-lock.json`** e promover `## [Unreleased]` em **`CHANGELOG.md`**:

```powershell
# Detecta automaticamente o bump pelos commits desde a última tag v*
npm.cmd run version:bump

# Simula sem alterar arquivos
node scripts/bump-version.mjs --dry-run

# Bumps explícitos
npm.cmd run version:patch
npm.cmd run version:minor
npm.cmd run version:major
```

---

## 4. Rotina Obrigatória em Toda Entrega com Código

1. Implementar alteração + testes (100% cobertura) + atualizar `CHANGELOG.md` (`## [Unreleased]`).
2. Commitar as alterações de código/testes/docs com Conventional Commits.
3. Se houve `fix`, `perf`, `feat` ou breaking change desde a última versão:
   - Rodar `npm.cmd run version:patch` / `version:minor` / `version:major` (ou `npm.cmd run version:bump`).
4. Rodar `npm.cmd run verify` (`typecheck` + `test:coverage` + `build`) para recompilar `out/cli/*` e `out/main/*` já com a nova versão embutida.
5. Commitar o bump (`chore(release): bump version to vX.Y.Z`).
6. Fazer `git push origin main`, criar a tag anotada (`git tag -a vX.Y.Z -m "Release vX.Y.Z"`), enviar a tag (`git push origin vX.Y.Z`) e acompanhar os workflows `CI` e `Build & Release Nexus` no GitHub Actions até todos os jobs e a Release concluírem com sucesso.
