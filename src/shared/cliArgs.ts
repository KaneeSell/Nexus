import type { PipelineExportFormat } from './types';

export type CliTab = 'scripts' | 'pipelines' | 'history';

export type CliSubcommand =
  | 'ls'
  | 'run'
  | 'pin'
  | 'doctor'
  | 'tui'
  | 'projects'
  | 'scripts'
  | 'pipelines'
  | 'history'
  | 'export'
  | null;

export interface ParsedCliArgs {
  subcommand: CliSubcommand;
  targetPath: string | null;
  runTarget: string | null;
  exportTarget: string | null;
  exportFormat: PipelineExportFormat | null;
  outputPath: string | null;
  newWindow: boolean;
  gui: boolean;
  sync: boolean;
  project: string | null;
  tab: CliTab | null;
  depth: number | null;
  openConfig: boolean;
  theme: 'dark' | 'light' | null;
  runScript: string | null;
  runPipeline: string | null;
  headless: boolean;
  dryRun: boolean;
  continueOnError: boolean;
  envProfile: string | null;
  list: boolean;
  showScripts: boolean;
  showPipelines: boolean;
  historyLimit: number | null;
  json: boolean;
  dbPath: boolean;
  doctor: boolean;
  version: boolean;
  help: boolean;
}

const SUBCOMMANDS = new Set<Exclude<CliSubcommand, null>>([
  'ls',
  'run',
  'pin',
  'doctor',
  'tui',
  'projects',
  'scripts',
  'pipelines',
  'history',
  'export'
]);

function clampDepth(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(5, parsed));
}

function parseTab(raw: string | undefined): CliTab | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'scripts' || normalized === 'pipelines' || normalized === 'history') {
    return normalized;
  }
  return null;
}

function parseTheme(raw: string | undefined): 'dark' | 'light' | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'dark' || normalized === 'light') {
    return normalized;
  }
  return null;
}

function parseExportFormat(raw: string | undefined): PipelineExportFormat | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase().replace(/^\./, '');
  if (normalized === 'bat' || normalized === 'ps1' || normalized === 'sh') {
    return normalized;
  }
  return null;
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const result: ParsedCliArgs = {
    subcommand: null,
    targetPath: null,
    runTarget: null,
    exportTarget: null,
    exportFormat: null,
    outputPath: null,
    newWindow: false,
    gui: false,
    sync: false,
    project: null,
    tab: null,
    depth: null,
    openConfig: false,
    theme: null,
    runScript: null,
    runPipeline: null,
    headless: false,
    dryRun: false,
    continueOnError: false,
    envProfile: null,
    list: false,
    showScripts: false,
    showPipelines: false,
    historyLimit: null,
    json: false,
    dbPath: false,
    doctor: false,
    version: false,
    help: false
  };

  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    if (!token.startsWith('-')) {
      positionals.push(token);
      continue;
    }

    const eqIndex = token.indexOf('=');
    const flag = eqIndex === -1 ? token : token.slice(0, eqIndex);
    const inlineValue = eqIndex === -1 ? undefined : token.slice(eqIndex + 1);

    const readNextValue = (): string | undefined => {
      if (inlineValue !== undefined) return inlineValue;
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        i += 1;
        return next;
      }
      return undefined;
    };

    switch (flag) {
      case '-h':
      case '--help':
        result.help = true;
        break;
      case '-v':
      case '--version':
        result.version = true;
        break;
      case '-n':
      case '--new-window':
        result.newWindow = true;
        break;
      case '-g':
      case '--gui':
        result.gui = true;
        break;
      case '-s':
      case '--sync':
      case '--refresh':
        result.sync = true;
        break;
      case '-p':
      case '--project':
        result.project = readNextValue() ?? null;
        break;
      case '-t':
      case '--tab':
        result.tab = parseTab(readNextValue());
        break;
      case '--depth':
        result.depth = clampDepth(readNextValue());
        break;
      case '--config':
        result.openConfig = true;
        break;
      case '--theme':
        result.theme = parseTheme(readNextValue());
        break;
      case '-r':
      case '--run':
        result.runScript = readNextValue() ?? null;
        break;
      case '-P':
      case '--pipeline':
        result.runPipeline = readNextValue() ?? null;
        break;
      case '--headless':
      case '--no-ui':
        result.headless = true;
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--continue-on-error':
        result.continueOnError = true;
        break;
      case '--env':
        result.envProfile = readNextValue() ?? null;
        break;
      case '-l':
      case '--list':
        result.list = true;
        break;
      case '--scripts':
        result.showScripts = true;
        break;
      case '--pipelines':
        result.showPipelines = true;
        break;
      case '--history': {
        if (inlineValue !== undefined) {
          const n = Number.parseInt(inlineValue, 10);
          result.historyLimit = Number.isFinite(n) && n > 0 ? n : 10;
        } else {
          const next = argv[i + 1];
          if (next !== undefined && /^\d+$/.test(next)) {
            i += 1;
            result.historyLimit = Math.max(1, Number.parseInt(next, 10));
          } else {
            result.historyLimit = 10;
          }
        }
        break;
      }
      case '--json':
        result.json = true;
        break;
      case '--db-path':
        result.dbPath = true;
        break;
      case '--doctor':
        result.doctor = true;
        break;
      case '-f':
      case '--format':
        result.exportFormat = parseExportFormat(readNextValue());
        break;
      case '-o':
      case '--out':
        result.outputPath = readNextValue() ?? null;
        break;
      default:
        break;
    }
  }

  if (positionals.length > 0 && SUBCOMMANDS.has(positionals[0] as Exclude<CliSubcommand, null>)) {
    result.subcommand = positionals[0] as Exclude<CliSubcommand, null>;
    if (result.subcommand === 'run') {
      result.runTarget = positionals[1] ?? null;
      result.targetPath = positionals[2] ?? null;
    } else if (result.subcommand === 'export') {
      result.exportTarget = positionals[1] ?? null;
      result.outputPath = result.outputPath ?? positionals[2] ?? null;
    } else if (
      result.subcommand === 'ls' ||
      result.subcommand === 'pin' ||
      result.subcommand === 'projects'
    ) {
      result.targetPath = positionals[1] ?? null;
    } else if (
      result.subcommand === 'scripts' ||
      result.subcommand === 'pipelines' ||
      result.subcommand === 'history'
    ) {
      result.project = result.project ?? positionals[1] ?? null;
    }
  } else if (positionals.length > 0) {
    result.targetPath = positionals[0];
  }

  return result;
}

export function isTerminalOnlyArgs(args: ParsedCliArgs): boolean {
  if (
    args.help ||
    args.version ||
    args.dbPath ||
    args.doctor ||
    args.list ||
    args.showScripts ||
    args.showPipelines ||
    args.historyLimit !== null ||
    args.headless ||
    args.subcommand === 'ls' ||
    args.subcommand === 'run' ||
    args.subcommand === 'pin' ||
    args.subcommand === 'doctor' ||
    args.subcommand === 'projects' ||
    args.subcommand === 'scripts' ||
    args.subcommand === 'pipelines' ||
    args.subcommand === 'history' ||
    args.subcommand === 'export'
  ) {
    return true;
  }

  if (args.dryRun && !args.newWindow && !args.tab && !args.openConfig && !args.theme && !args.gui) {
    return true;
  }

  return false;
}

export function shouldLaunchTui(args: ParsedCliArgs): boolean {
  if (args.gui || isTerminalOnlyArgs(args)) {
    return false;
  }
  if (args.subcommand === 'tui') {
    return true;
  }

  const hasGuiIntent =
    Boolean(args.targetPath) ||
    Boolean(args.subcommand) ||
    args.newWindow ||
    Boolean(args.project) ||
    Boolean(args.tab) ||
    args.depth !== null ||
    args.openConfig ||
    Boolean(args.theme) ||
    Boolean(args.runScript) ||
    Boolean(args.runPipeline) ||
    args.dryRun ||
    args.continueOnError ||
    Boolean(args.envProfile);

  return !hasGuiIntent;
}

export function formatCliHelp(): string {
  return `
Nexus CLI — Orquestrador de Projetos

Uso:
  nexus                        Abre a interface interativa no terminal (TUI)
  nexus [caminho] [flags]      Abre a interface gráfica Electron (ex: nexus .)
  nexus <subcomando> [argumentos] [flags]

Subcomandos (DB-First):
  tui                          Abre o dashboard interativo no terminal (TUI)
  projects [caminho]           Lista projetos cadastrados no SQLite
  scripts [projeto]            Lista scripts/comandos salvos no SQLite
  pipelines [projeto]          Lista pipelines salvos no SQLite
  history [projeto]            Exibe histórico de execuções salvo no SQLite
  run <nome> [caminho]         Executa pipeline ou script (DB-first ou por caminho)
  export <pipeline> [arquivo]  Exporta pipeline como script .bat, .ps1 ou .sh
  ls [caminho]                 Escaneia e lista projetos da pasta atual
  pin [caminho]                Fixa a pasta nos workspaces favoritos
  doctor                       Verifica Node, gerenciadores de pacote, PATH e SQLite

Sincronização & Execução:
  -s, --sync                   Atualiza o banco SQLite a partir do disco antes/durante o comando
  -r, --run <script>           Executa um script do package.json
  -P, --pipeline <nome>        Executa um pipeline salvo
      --headless, --no-ui      Executa no terminal sem abrir janela Electron
      --dry-run                Simula a execução sem rodar comandos reais
      --continue-on-error      Não interrompe o pipeline se uma etapa falhar
      --env <perfil>           Carrega variáveis de .env.<perfil> (fallback: .env)

Navegação e Interface (UI):
  -g, --gui                    Força a abertura da interface gráfica Electron
  -n, --new-window             Abre em uma nova janela
  -p, --project <nome>         Filtra ou seleciona um projeto específico
  -t, --tab <aba>              Abre na aba: scripts | pipelines | history
      --depth <n>              Profundidade de scan de subpastas (1..5, padrão: 2)
      --config                 Abre diretamente na janela de Configurações
      --theme <dark|light>     Força o tema nessa abertura

Consultas em Pasta / Saída:
  -l, --list                   Escaneia e lista os projetos da pasta
      --scripts                Exibe os scripts do package.json
      --pipelines              Lista pipelines salvos para o projeto
      --history [n]            Mostra as últimas n execuções (padrão: 10)
      --json                   Formata a saída em JSON

Exportação de Pipeline:
  -f, --format <bat|ps1|sh>    Formato do script exportado
  -o, --out <arquivo>          Caminho de destino do script exportado

Sistema:
      --db-path                Imprime o caminho do banco SQLite
      --doctor                 Diagnostica ambiente e dependências
  -v, --version                Exibe a versão
  -h, --help                   Exibe esta ajuda

Exemplos:
  nexus
  nexus --sync
  nexus projects --sync
  nexus scripts api --sync
  nexus pipelines
  nexus run "CI/CD" -p api --sync
  nexus .
  nexus --gui
`.trim();
}
