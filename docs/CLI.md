# Referência do CLI e TUI (`nexus`)

O CLI do **Nexus** oferece três modos integrados:
1. **TUI Interativa (Cockpit no Terminal)**: `nexus` ou `nexus tui`
2. **Consultas e Execução DB-First**: `nexus projects`, `nexus scripts`, `nexus pipelines`, `nexus history`, `nexus run` (com atualização opcional via `--sync`)
3. **Abertura da Interface Gráfica Electron**: `nexus .` ou `nexus --gui`

---

## Uso Geral

```text
nexus                          Abre a TUI interativa no terminal
nexus [caminho] [flags]        Abre a interface gráfica Electron (ex: nexus .)
nexus <subcomando> [args]      Executa consultas/ações direto no terminal
```

---

## Subcomandos DB-First (Terminal)

Por padrão, estes comandos consultam diretamente o banco SQLite de qualquer pasta do sistema. Passe `--sync` (`-s`) para atualizar o SQLite a partir do disco antes de responder/executar.

| Subcomando | Função |
| :--- | :--- |
| `nexus tui` | Abre o dashboard interativo animado no terminal |
| `nexus projects [caminho]` | Lista todos os projetos cadastrados no SQLite |
| `nexus scripts [projeto]` | Lista os scripts/comandos salvos no SQLite |
| `nexus pipelines [projeto]` | Lista os pipelines e etapas salvos no SQLite |
| `nexus history [projeto]` | Exibe as últimas execuções registradas no SQLite |
| `nexus run <nome> [caminho]` | Executa pipeline ou script (DB-first ou escaneando `[caminho]`) |
| `nexus export <pipeline> [arquivo]` | Exporta um pipeline salvo como script `.bat`, `.ps1` ou `.sh` |
| `nexus ls [caminho]` | Escaneia a pasta informada e lista os projetos encontrados |
| `nexus pin [caminho]` | Fixa a pasta na lista de workspaces favoritos no SQLite |
| `nexus doctor` | Verifica Node, gerenciadores de pacotes, `PATH` e SQLite |

---

## Atalhos e Comandos dentro da TUI (`nexus`)

- `↑` / `↓` ou `j` / `k`: navegar nos itens da lista
- `Tab` ou `1` / `2` / `3` / `4`: alternar entre **Projetos**, **Pipelines**, **Comandos** e **Histórico**
- `Enter`: executar pipeline/comando selecionado (ou filtrar comandos do projeto selecionado)
- `r`: sincronizar banco SQLite com os workspaces em disco (sync real com progresso)
- `/`: abrir barra de busca instantânea ou slash commands (`/sync`, `/run <nome>`, `/filter <txt>`, `/clear`, `/gui`, `/help`, `/quit`)
- `c` / `Ctrl+C`: cancelar execução ativa no console embutido
- `g`: abrir a interface gráfica Electron na pasta do item selecionado
- `q` / `Esc`: limpar filtro ou sair

---

## Flags de Sincronização e Execução

| Flag | Alias | Descrição |
| :--- | :--- | :--- |
| `--sync` | `-s` | Sincroniza o SQLite com o disco antes/durante o comando (também `--refresh`) |
| `--run <script>` | `-r` | Executa um script do `package.json` (na UI, DB-first ou `--headless`) |
| `--pipeline <nome>` | `-P` | Executa um pipeline salvo |
| `--headless` / `--no-ui` | — | Executa no terminal sem abrir janela Electron |
| `--dry-run` | — | Simula a execução exibindo comandos e regras de erro sem executá-los |
| `--continue-on-error` | — | Continua executando as próximas etapas mesmo se alguma falhar |
| `--env <perfil>` | — | Carrega variáveis de `.env.<perfil>` (ou `.env` como fallback) antes de rodar |

---

## Flags de Interface Gráfica (Electron)

| Flag | Alias | Descrição |
| :--- | :--- | :--- |
| `--gui` | `-g` | Força a abertura da interface gráfica Electron |
| `--new-window` | `-n` | Abre em uma nova janela em vez de reaproveitar a janela aberta |
| `--project <nome>` | `-p` | Seleciona ou filtra o projeto pelo nome ou pasta |
| `--tab <aba>` | `-t` | Abre diretamente na aba `scripts`, `pipelines` ou `history` |
| `--depth <n>` | — | Profundidade máxima de subpastas ao escanear (padrão `2`, faixa `1..5`) |
| `--config` | — | Abre o app já exibindo a janela de Configurações |
| `--theme <modo>` | — | Força o tema `dark` ou `light` nessa sessão |

---

## Flags de Consulta e Sistema

| Flag | Alias | Descrição |
| :--- | :--- | :--- |
| `--list` | `-l` | Escaneia e lista os projetos detectados na pasta |
| `--scripts` | — | Mostra os scripts do `package.json` do projeto |
| `--pipelines` | — | Lista os pipelines configurados no SQLite para o projeto |
| `--history [n]` | — | Exibe as últimas `n` execuções (padrão `10` na flag, `15` no subcomando) |
| `--json` | — | Formata a saída como JSON |
| `--format` | `-f` | Formato de exportação do pipeline (`bat`, `ps1` ou `sh`) |
| `--out` | `-o` | Caminho de destino do arquivo exportado em `nexus export` |
| `--db-path` | — | Imprime o caminho completo do arquivo SQLite utilizado |
| `--doctor` | — | Diagnóstico completo do ambiente (`node`, `npm`/`pnpm`/`yarn`/`bun`, CLI no `PATH` e SQLite) |
| `--version` | `-v` | Mostra a versão do Nexus |
| `--help` | `-h` | Mostra a ajuda resumida |

---

## Exemplos Práticos

```powershell
# Abrir TUI interativa no terminal
nexus

# Abrir TUI já sincronizando o banco SQLite
nexus --sync

# Consultar projetos, scripts e pipelines direto do SQLite (de qualquer pasta)
nexus projects
nexus projects --sync
nexus scripts nexus --sync
nexus pipelines
nexus history -p nexus

# Rodar pipeline ou script resolvendo direto do SQLite
nexus run "CI/CD" -p nexus --sync --dry-run

# Exportar pipeline para .bat, .ps1 ou .sh
nexus export "CI/CD" -p nexus --format bat --out ./ci.bat

# Abrir a interface gráfica Electron na pasta atual
nexus .
nexus --gui
```
