import type {
  OnErrorAction,
  PackageManager,
  PipelineExportFormat,
  PipelineExportOptions,
  PipelineExportStyle,
  StepKind
} from '../../shared/types';

export interface PipelineExportStep {
  name: string;
  kind: StepKind;
  command: string;
  onErrorAction: OnErrorAction;
  onErrorCommand?: string | null;
  onSuccessCommand?: string | null;
  enabled: boolean;
}

export interface PipelineExportInput {
  pipelineName: string;
  description?: string;
  projectName: string;
  projectPath: string;
  packageManager: PackageManager;
  steps: PipelineExportStep[];
}

export interface ResolvedPipelineExportOptions {
  style: PipelineExportStyle;
  confirmBeforeRun: boolean;
  pauseOnFinish: boolean;
  includeColors: boolean;
  useProjectDir: boolean;
  saveLogFile: boolean;
  envProfile: string | null;
  customHeader: string | null;
}

interface ResolvedExportStep {
  index: number;
  name: string;
  kind: StepKind;
  resolvedCommand: string;
  onErrorAction: OnErrorAction;
  onErrorCommand: string | null;
  onSuccessCommand: string | null;
}

function slugifyName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'pipeline';
}

/**
 * Normalizes optional pipeline export settings with sensible defaults for rich or raw mode.
 */
export function normalizeExportOptions(
  options: PipelineExportOptions = {}
): ResolvedPipelineExportOptions {
  const style: PipelineExportStyle = options.style === 'raw' ? 'raw' : 'rich';
  const isRaw = style === 'raw';

  return {
    style,
    confirmBeforeRun: options.confirmBeforeRun ?? !isRaw,
    pauseOnFinish: options.pauseOnFinish ?? !isRaw,
    includeColors: options.includeColors ?? !isRaw,
    useProjectDir: options.useProjectDir ?? true,
    saveLogFile: options.saveLogFile ?? false,
    envProfile: options.envProfile?.trim() || null,
    customHeader: options.customHeader?.trim() || null
  };
}

/**
 * Generates a filesystem-safe filename for an exported pipeline script.
 */
export function suggestExportFilename(
  pipelineName: string,
  format: PipelineExportFormat
): string {
  return `${slugifyName(pipelineName)}.${format}`;
}

/**
 * Resolves a pipeline step into the concrete shell command for the target export format.
 */
export function resolveExportStepCommand(
  step: Pick<PipelineExportStep, 'kind' | 'command'>,
  packageManager: PackageManager,
  format: PipelineExportFormat
): string {
  const cmd = step.command.trim();
  if (step.kind === 'command') {
    return cmd;
  }

  switch (packageManager) {
    case 'pnpm':
      return `pnpm run ${cmd}`;
    case 'yarn':
      return `yarn ${cmd}`;
    case 'bun':
      return `bun run ${cmd}`;
    case 'npm':
    default:
      return format === 'sh' ? `npm run ${cmd}` : `npm.cmd run ${cmd}`;
  }
}

function escapeBatEcho(text: string): string {
  return text
    .replace(/%/g, '%%')
    .replace(/\^/g, '^^')
    .replace(/&/g, '^&')
    .replace(/\|/g, '^|')
    .replace(/</g, '^<')
    .replace(/>/g, '^>')
    .replace(/\(/g, '^(')
    .replace(/\)/g, '^)');
}

function escapeBatPercent(text: string): string {
  return text.replace(/%/g, '%%');
}

function escapePsSingleQuote(text: string): string {
  return text.replace(/'/g, "''");
}

function escapeShSingleQuote(text: string): string {
  return text.replace(/'/g, "'\\''");
}

function formatStepNote(step: ResolvedExportStep): string {
  const parts: string[] = [];
  if (step.onErrorAction !== 'stop') {
    parts.push(`onError: ${step.onErrorAction}`);
  }
  if (step.onSuccessCommand) {
    parts.push('onSuccess: hook');
  }
  return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
}

function buildBatEnvLoaderLines(envProfile: string | null): string[] {
  if (!envProfile) return [];
  const safeProfile = escapeBatPercent(envProfile.replace(/"/g, ''));
  return [
    `set "NEXUS_ENV_FILE="`,
    `if exist ".env.${safeProfile}" set "NEXUS_ENV_FILE=.env.${safeProfile}"`,
    `if not defined NEXUS_ENV_FILE if exist ".env" set "NEXUS_ENV_FILE=.env"`,
    `if defined NEXUS_ENV_FILE (`,
    `  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%NEXUS_ENV_FILE%") do (`,
    `    if not "%%~A"=="" set "%%~A=%%~B"`,
    `  )`,
    `)`
  ];
}

function buildPsEnvLoaderLines(envProfile: string | null): string[] {
  if (!envProfile) return [];
  const safeProfile = escapePsSingleQuote(envProfile);
  return [
    `$envFile = if (Test-Path '.env.${safeProfile}') { '.env.${safeProfile}' } elseif (Test-Path '.env') { '.env' } else { $null }`,
    `if ($envFile) {`,
    `  Get-Content -LiteralPath $envFile | ForEach-Object {`,
    `    $line = $_.Trim()`,
    `    if ($line -and -not $line.StartsWith('#')) {`,
    `      $clean = if ($line.StartsWith('export ')) { $line.Substring(7).Trim() } else { $line }`,
    `      $eq = $clean.IndexOf('=')`,
    `      if ($eq -gt 0) {`,
    `        $k = $clean.Substring(0, $eq).Trim()`,
    `        $v = $clean.Substring($eq + 1).Trim().Trim('"').Trim("'")`,
    `        [Environment]::SetEnvironmentVariable($k, $v, 'Process')`,
    `      }`,
    `    }`,
    `  }`,
    `}`
  ];
}

function buildShEnvLoaderLines(envProfile: string | null): string[] {
  if (!envProfile) return [];
  const safeProfile = escapeShSingleQuote(envProfile);
  return [
    `ENV_FILE=""`,
    `if [ -f '.env.${safeProfile}' ]; then ENV_FILE='.env.${safeProfile}'; elif [ -f '.env' ]; then ENV_FILE='.env'; fi`,
    `if [ -n "$ENV_FILE" ]; then`,
    `  set -a`,
    `  . "./$ENV_FILE"`,
    `  set +a`,
    `fi`
  ];
}

function formatBatRawCommand(step: Pick<ResolvedExportStep, 'kind' | 'resolvedCommand'>): string {
  const cmd = escapeBatPercent(step.resolvedCommand);
  return step.kind === 'script' ? `call ${cmd}` : cmd;
}

function generateBatRawScript(
  input: PipelineExportInput,
  steps: ResolvedExportStep[],
  opts: ResolvedPipelineExportOptions
): string {
  const pathNoQuotes = escapeBatPercent(input.projectPath.replace(/"/g, ''));
  const logFile = `${slugifyName(input.pipelineName)}.log`;

  const lines: string[] = [
    `@echo off`,
    `chcp 65001 >nul`,
    `setlocal EnableExtensions`,
    `REM Pipeline: ${input.pipelineName} (${input.projectName})`
  ];

  if (opts.customHeader) {
    lines.push(`REM ${opts.customHeader}`);
  }
  lines.push('');

  if (opts.confirmBeforeRun) {
    lines.push(
      `set /p "NEXUS_GO=Pressione ENTER para executar ${escapeBatEcho(input.pipelineName)} (ou Ctrl+C para cancelar)... "`,
      ``
    );
  }

  if (opts.useProjectDir) {
    lines.push(`pushd "${pathNoQuotes}" || exit /b 1`);
  }

  lines.push(...buildBatEnvLoaderLines(opts.envProfile));

  if (opts.saveLogFile) {
    lines.push(`set "LOG_FILE=${logFile}"`, `type nul > "%LOG_FILE%"`);
  }
  lines.push('');

  for (const s of steps) {
    const rawCmd = formatBatRawCommand(s);
    if (opts.saveLogFile) {
      lines.push(`cmd /c "${escapeBatPercent(s.resolvedCommand)}" >> "%LOG_FILE%" 2>&1`);
    } else {
      lines.push(rawCmd);
    }

    if (s.onErrorAction === 'stop') {
      lines.push(`if errorlevel 1 (`);
      if (opts.useProjectDir) lines.push(`  popd`);
      if (opts.pauseOnFinish) lines.push(`  pause`);
      lines.push(`  exit /b 1`, `)`);
    } else if (s.onErrorAction === 'run_command') {
      lines.push(`if errorlevel 1 (`);
      if (s.onErrorCommand) {
        lines.push(`  ${escapeBatPercent(s.onErrorCommand)}`);
      }
      if (opts.useProjectDir) lines.push(`  popd`);
      if (opts.pauseOnFinish) lines.push(`  pause`);
      lines.push(`  exit /b 1`, `)`);
    }

    if (s.onSuccessCommand) {
      lines.push(
        `if not errorlevel 1 ${escapeBatPercent(s.onSuccessCommand)}`
      );
    }
    lines.push('');
  }

  if (opts.useProjectDir) {
    lines.push(`popd`);
  }
  if (opts.pauseOnFinish) {
    lines.push(`pause`);
  }
  lines.push(`exit /b 0`);

  return `${lines.join('\r\n')}\r\n`;
}

function generateBatRichScript(
  input: PipelineExportInput,
  steps: ResolvedExportStep[],
  opts: ResolvedPipelineExportOptions
): string {
  const total = steps.length;
  const safePipeline = escapeBatEcho(input.pipelineName);
  const safeProject = escapeBatEcho(input.projectName);
  const safePath = opts.useProjectDir
    ? escapeBatEcho(input.projectPath)
    : 'Pasta atual ^(%%CD%%^)';
  const safeDescription = input.description?.trim()
    ? escapeBatEcho(input.description.trim())
    : '';
  const safeHeader = opts.customHeader ? escapeBatEcho(opts.customHeader) : '';
  const pathNoQuotes = escapeBatPercent(input.projectPath.replace(/"/g, ''));
  const logFile = `${slugifyName(input.pipelineName)}.log`;

  const colorSetup = opts.includeColors
    ? [
        `for /f %%A in ('echo prompt $E ^| cmd') do set "ESC=%%A"`,
        `set "C_BRAND=%ESC%[38;2;124;156;255m"`,
        `set "C_CYAN=%ESC%[38;2;56;189;248m"`,
        `set "C_GREEN=%ESC%[38;2;52;211;153m"`,
        `set "C_RED=%ESC%[38;2;248;113;113m"`,
        `set "C_AMBER=%ESC%[38;2;251;191;36m"`,
        `set "C_MUTED=%ESC%[38;2;148;163;184m"`,
        `set "C_DIM=%ESC%[38;2;100;116;139m"`,
        `set "C_WHITE=%ESC%[97m"`,
        `set "C_BOLD=%ESC%[1m"`,
        `set "C_RESET=%ESC%[0m"`
      ]
    : [
        `set "C_BRAND="`,
        `set "C_CYAN="`,
        `set "C_GREEN="`,
        `set "C_RED="`,
        `set "C_AMBER="`,
        `set "C_MUTED="`,
        `set "C_DIM="`,
        `set "C_WHITE="`,
        `set "C_BOLD="`,
        `set "C_RESET="`
      ];

  const overviewLines = steps.flatMap((s) => {
    const note = escapeBatEcho(formatStepNote(s));
    return [
      `echo   %C_BRAND%│%C_RESET%    %C_CYAN%${s.index}.%C_RESET% %C_WHITE%${escapeBatEcho(s.name)}%C_RESET%%C_DIM%${note}%C_RESET%`,
      `echo   %C_BRAND%│%C_RESET%       %C_DIM%$ ${escapeBatEcho(s.resolvedCommand)}%C_RESET%`
    ];
  });

  const initResults = steps.map(
    (s) =>
      `set "RES_${s.index}_BADGE=%C_DIM%○ [SKIPPED]%C_RESET%"\r\nset "RES_${s.index}_TIME=-"`
  );

  const stepBlocks = steps.flatMap((s) => {
    const nextLabel = s.index < total ? `step_${s.index + 1}` : 'summary';
    const cmdLine = escapeBatPercent(s.resolvedCommand);
    const execLine = opts.saveLogFile
      ? `cmd /c "${cmdLine}" >> "%LOG_FILE%" 2>&1`
      : `cmd /c "${cmdLine}"`;

    const lines = [
      `:step_${s.index}`,
      `title [${s.index}/${total}] Nexus - ${escapeBatEcho(s.name)}`,
      `echo   %C_CYAN%▶ [${s.index}/${total}]%C_RESET% %C_BOLD%%C_WHITE%${escapeBatEcho(s.name)}%C_RESET%`,
      `echo   %C_DIM%  $ ${escapeBatEcho(s.resolvedCommand)}%C_RESET%`,
      `echo.`,
      `call :now_cs STEP_START_CS`,
      execLine,
      `set "STEP_EXIT=%ERRORLEVEL%"`,
      `call :now_cs STEP_END_CS`,
      `call :calc_elapsed "%STEP_START_CS%" "%STEP_END_CS%" STEP_ELAPSED`,
      `set "RES_${s.index}_TIME=%STEP_ELAPSED%"`,
      `if "%STEP_EXIT%"=="0" goto :step_${s.index}_ok`,
      `echo.`,
      `echo   %C_RED%✗ Etapa ${s.index} falhou ^(codigo %STEP_EXIT%, %STEP_ELAPSED%^)%C_RESET%`,
      `set "PIPELINE_FAILED=1"`
    ];

    if (s.onErrorAction === 'continue') {
      lines.push(
        `echo   %C_AMBER%⚠ onError=continue — prosseguindo para a proxima etapa.%C_RESET%`,
        `echo.`,
        `set "RES_${s.index}_BADGE=%C_AMBER%⚠ [WARN]%C_RESET%"`,
        `goto :${nextLabel}`
      );
    } else if (s.onErrorAction === 'run_command') {
      lines.push(`set "RES_${s.index}_BADGE=%C_RED%✗ [FAIL]%C_RESET%"`);
      if (s.onErrorCommand) {
        lines.push(
          `echo   %C_CYAN%↳ Executando fallback de erro:%C_RESET% %C_DIM%${escapeBatEcho(s.onErrorCommand)}%C_RESET%`,
          `cmd /c "${escapeBatPercent(s.onErrorCommand)}"`
        );
      }
      lines.push(
        `echo   %C_RED%■ Pipeline interrompido.%C_RESET%`,
        `echo.`,
        `goto :summary`
      );
    } else {
      lines.push(
        `set "RES_${s.index}_BADGE=%C_RED%✗ [FAIL]%C_RESET%"`,
        `echo   %C_RED%■ Pipeline interrompido.%C_RESET%`,
        `echo.`,
        `goto :summary`
      );
    }

    lines.push(
      `:step_${s.index}_ok`,
      `echo.`,
      `echo   %C_GREEN%✓ Etapa ${s.index} concluida ^(%STEP_ELAPSED%^)%C_RESET%`,
      `set "RES_${s.index}_BADGE=%C_GREEN%✓ [OK]%C_RESET%"`
    );
    if (s.onSuccessCommand) {
      lines.push(
        `echo   %C_CYAN%↳ Executando onSuccess:%C_RESET% %C_DIM%${escapeBatEcho(s.onSuccessCommand)}%C_RESET%`,
        `cmd /c "${escapeBatPercent(s.onSuccessCommand)}"`,
        `if errorlevel 1 echo   %C_AMBER%⚠ onSuccess retornou erro.%C_RESET%`
      );
    }
    lines.push(`echo.`, `goto :${nextLabel}`, ``);
    return lines;
  });

  const summaryRows = steps.map(
    (s) =>
      `echo   %C_BRAND%│%C_RESET%  %RES_${s.index}_BADGE%  ${s.index}. ${escapeBatEcho(s.name)}  %C_DIM%^(%RES_${s.index}_TIME%^)%C_RESET%`
  );

  const lines: string[] = [
    `@echo off`,
    `chcp 65001 >nul`,
    `setlocal EnableExtensions`,
    ``,
    `:: Gerado pelo Nexus Orchestrator`,
    ...colorSetup,
    ``,
    `set "SKIP_CONFIRM=${opts.confirmBeforeRun ? '0' : '1'}"`,
    `set "DRY_RUN=0"`,
    `set "NO_PAUSE=${opts.pauseOnFinish ? '0' : '1'}"`,
    ``,
    `:parse_args`,
    `if "%~1"=="" goto :args_done`,
    `if /i "%~1"=="--help" goto :show_help`,
    `if /i "%~1"=="-h" goto :show_help`,
    `if /i "%~1"=="--yes" set "SKIP_CONFIRM=1"`,
    `if /i "%~1"=="-y" set "SKIP_CONFIRM=1"`,
    `if /i "%~1"=="--dry-run" set "DRY_RUN=1"`,
    `if /i "%~1"=="--no-pause" set "NO_PAUSE=1"`,
    `shift`,
    `goto :parse_args`,
    ``,
    `:args_done`,
    `title Nexus Pipeline - ${safePipeline}`,
    `echo.`,
    `echo   %C_BRAND%  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗%C_RESET%`,
    `echo   %C_CYAN%  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝%C_RESET%   %C_BOLD%%C_WHITE%NEXUS PIPELINE%C_RESET%`,
    `echo   %C_CYAN%  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗%C_RESET%   %C_MUTED%${safePipeline}%C_RESET%`,
    `echo   %C_BRAND%  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║%C_RESET%   %C_DIM%Projeto: ${safeProject}%C_RESET%`,
    `echo   %C_BRAND%  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║%C_RESET%`,
    `echo   %C_DIM%  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝%C_RESET%`,
    `echo.`,
    `echo   %C_BRAND%╭──────────────────────────────────────────────────────────────────────────╮%C_RESET%`,
    `echo   %C_BRAND%│%C_RESET%  %C_BOLD%%C_WHITE%O QUE ESTE SCRIPT FAZ%C_RESET%`,
    `echo   %C_BRAND%├──────────────────────────────────────────────────────────────────────────┤%C_RESET%`,
    `echo   %C_BRAND%│%C_RESET%  %C_MUTED%Pipeline :%C_RESET% %C_WHITE%${safePipeline}%C_RESET%`,
    ...(safeDescription
      ? [`echo   %C_BRAND%│%C_RESET%  %C_MUTED%Descricao:%C_RESET% ${safeDescription}`]
      : []),
    ...(safeHeader
      ? [`echo   %C_BRAND%│%C_RESET%  %C_MUTED%Nota     :%C_RESET% ${safeHeader}`]
      : []),
    `echo   %C_BRAND%│%C_RESET%  %C_MUTED%Projeto  :%C_RESET% %C_CYAN%${safeProject}%C_RESET%`,
    `echo   %C_BRAND%│%C_RESET%  %C_MUTED%Pasta    :%C_RESET% %C_DIM%${safePath}%C_RESET%`,
    ...(opts.envProfile
      ? [`echo   %C_BRAND%│%C_RESET%  %C_MUTED%Perfil   :%C_RESET% %C_AMBER%${escapeBatEcho(opts.envProfile)}%C_RESET%`]
      : []),
    ...(opts.saveLogFile
      ? [`echo   %C_BRAND%│%C_RESET%  %C_MUTED%Log      :%C_RESET% %C_DIM%${logFile}%C_RESET%`]
      : []),
    `echo   %C_BRAND%│%C_RESET%  %C_MUTED%Etapas ^(${total}^):%C_RESET%`,
    ...overviewLines,
    `echo   %C_BRAND%╰──────────────────────────────────────────────────────────────────────────╯%C_RESET%`,
    `echo.`,
    `if "%DRY_RUN%"=="1" goto :dry_run_end`,
    `if "%SKIP_CONFIRM%"=="1" goto :begin_exec`,
    `set "NEXUS_GO="`,
    `set /p "NEXUS_GO=  %C_CYAN%❯%C_RESET% Pressione ENTER para executar ^(ou Ctrl+C para cancelar^)... "`,
    `echo.`,
    ``,
    `:begin_exec`,
    ...(opts.useProjectDir
      ? [
          `if not exist "${pathNoQuotes}\\" (`,
          `  echo   %C_RED%✗ Pasta do projeto nao encontrada: ${safePath}%C_RESET%`,
          `  if "%NO_PAUSE%"=="0" pause >nul`,
          `  exit /b 1`,
          `)`,
          `pushd "${pathNoQuotes}"`
        ]
      : []),
    ...buildBatEnvLoaderLines(opts.envProfile),
    ...(opts.saveLogFile ? [`set "LOG_FILE=${logFile}"`, `type nul > "%LOG_FILE%"`] : []),
    `call :now_cs PIPELINE_START_CS`,
    `set "PIPELINE_FAILED=0"`,
    ...initResults,
    `goto :step_1`,
    ``,
    ...stepBlocks,
    `:summary`,
    ...(opts.useProjectDir ? [`popd`] : []),
    `call :now_cs PIPELINE_END_CS`,
    `call :calc_elapsed "%PIPELINE_START_CS%" "%PIPELINE_END_CS%" TOTAL_ELAPSED`,
    `echo   %C_BRAND%╭──────────────────────────────────────────────────────────────────────────╮%C_RESET%`,
    `echo   %C_BRAND%│%C_RESET%  %C_BOLD%%C_WHITE%RESUMO FINAL%C_RESET%`,
    `echo   %C_BRAND%├──────────────────────────────────────────────────────────────────────────┤%C_RESET%`,
    ...summaryRows,
    `echo   %C_BRAND%├──────────────────────────────────────────────────────────────────────────┤%C_RESET%`,
    `if "%PIPELINE_FAILED%"=="0" (`,
    `  echo   %C_BRAND%│%C_RESET%  %C_GREEN%Status: SUCESSO%C_RESET%   %C_MUTED%Tempo total: %TOTAL_ELAPSED%%C_RESET%`,
    `  title [OK] Nexus Pipeline - ${safePipeline}`,
    `) else (`,
    `  echo   %C_BRAND%│%C_RESET%  %C_RED%Status: FALHOU%C_RESET%    %C_MUTED%Tempo total: %TOTAL_ELAPSED%%C_RESET%`,
    `  title [FALHOU] Nexus Pipeline - ${safePipeline}`,
    `)`,
    ...(opts.saveLogFile
      ? [`echo   %C_BRAND%│%C_RESET%  %C_DIM%Log salvo em: ${logFile}%C_RESET%`]
      : []),
    `echo   %C_BRAND%╰──────────────────────────────────────────────────────────────────────────╯%C_RESET%`,
    `echo.`,
    `if "%NO_PAUSE%"=="0" (`,
    `  echo   %C_DIM%Pressione qualquer tecla para fechar...%C_RESET%`,
    `  pause >nul`,
    `)`,
    `if "%PIPELINE_FAILED%"=="0" exit /b 0`,
    `exit /b 1`,
    ``,
    `:dry_run_end`,
    `echo   %C_AMBER%[DRY-RUN]%C_RESET% %C_MUTED%Simulacao concluida — nenhum comando foi executado.%C_RESET%`,
    `echo.`,
    `if "%NO_PAUSE%"=="0" (`,
    `  echo   %C_DIM%Pressione qualquer tecla para fechar...%C_RESET%`,
    `  pause >nul`,
    `)`,
    `exit /b 0`,
    ``,
    `:now_cs`,
    `setlocal EnableDelayedExpansion`,
    `set "T=%TIME%"`,
    `set "T=!T:,=.!"`,
    `set "T=!T: =0!"`,
    `for /f "tokens=1-4 delims=:." %%a in ("!T!") do (`,
    `  set "HH=%%a"`,
    `  set "MM=%%b"`,
    `  set "SS=%%c"`,
    `  set "FF=%%d"`,
    `)`,
    `set /a "CS=(((1!HH!-100)*3600) + ((1!MM!-100)*60) + (1!SS!-100))*100 + (1!FF!-100)"`,
    `for /f "delims=" %%V in ("!CS!") do (`,
    `  endlocal`,
    `  set "%~1=%%V"`,
    `)`,
    `exit /b 0`,
    ``,
    `:calc_elapsed`,
    `setlocal EnableDelayedExpansion`,
    `set /a "DIFF=%~2 - %~1"`,
    `if !DIFF! lss 0 set /a "DIFF+=8640000"`,
    `set /a "SEC=DIFF / 100"`,
    `set /a "REM=DIFF %% 100"`,
    `if !REM! lss 10 set "REM=0!REM!"`,
    `for /f "delims=" %%V in ("!SEC!.!REM!s") do (`,
    `  endlocal`,
    `  set "%~3=%%V"`,
    `)`,
    `exit /b 0`,
    ``,
    `:show_help`,
    `echo.`,
    `echo   Nexus Pipeline - ${safePipeline}`,
    `echo.`,
    `echo   Uso:`,
    `echo     %~nx0              Mostra o resumo e aguarda ENTER para executar`,
    `echo     %~nx0 --yes, -y    Executa direto sem aguardar ENTER`,
    `echo     %~nx0 --dry-run    Mostra o plano sem executar comandos`,
    `echo     %~nx0 --no-pause   Nao pausa ao finalizar`,
    `echo     %~nx0 -h, --help   Exibe esta ajuda`,
    `echo.`,
    `exit /b 0`
  ];

  return `${lines.join('\r\n')}\r\n`;
}

function generatePs1RawScript(
  input: PipelineExportInput,
  steps: ResolvedExportStep[],
  opts: ResolvedPipelineExportOptions
): string {
  const psPath = escapePsSingleQuote(input.projectPath);
  const logFile = `${slugifyName(input.pipelineName)}.log`;

  const lines: string[] = [
    `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)`,
    `# Pipeline: ${input.pipelineName} (${input.projectName})`
  ];
  if (opts.customHeader) {
    lines.push(`# ${opts.customHeader}`);
  }
  lines.push('');

  if (opts.confirmBeforeRun) {
    lines.push(
      `Read-Host 'Pressione ENTER para executar ${escapePsSingleQuote(input.pipelineName)} (ou Ctrl+C para cancelar)' | Out-Null`,
      ``
    );
  }

  if (opts.useProjectDir) {
    lines.push(`Push-Location -LiteralPath '${psPath}'`);
  }
  lines.push(`$exitCode = 0`, `try {`);

  if (opts.saveLogFile) {
    lines.push(`  Start-Transcript -Path '${logFile}' -Append | Out-Null`);
  }

  for (const envLine of buildPsEnvLoaderLines(opts.envProfile)) {
    lines.push(`  ${envLine}`);
  }

  for (const s of steps) {
    lines.push(`  $global:LASTEXITCODE = 0`, `  ${s.resolvedCommand}`);
    if (s.onErrorAction === 'stop') {
      lines.push(`  if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) { $exitCode = [int]$LASTEXITCODE; throw "Step failed" }`);
    } else if (s.onErrorAction === 'run_command') {
      lines.push(`  if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {`);
      lines.push(`    $exitCode = [int]$LASTEXITCODE`);
      if (s.onErrorCommand) {
        lines.push(`    ${s.onErrorCommand}`);
      }
      lines.push(`    throw "Step failed"`, `  }`);
    }
    if (s.onSuccessCommand) {
      lines.push(`  if (-not $LASTEXITCODE -or $LASTEXITCODE -eq 0) { ${s.onSuccessCommand} }`);
    }
    lines.push('');
  }

  lines.push(`} catch {`, `  if ($exitCode -eq 0) { $exitCode = 1 }`, `} finally {`);
  if (opts.saveLogFile) {
    lines.push(`  Stop-Transcript | Out-Null`);
  }
  if (opts.useProjectDir) {
    lines.push(`  Pop-Location`);
  }
  lines.push(`}`);

  if (opts.pauseOnFinish) {
    lines.push(`Read-Host 'Pressione ENTER para fechar' | Out-Null`);
  }
  lines.push(`exit $exitCode`);

  return `${lines.join('\r\n')}\r\n`;
}

function generatePs1RichScript(
  input: PipelineExportInput,
  steps: ResolvedExportStep[],
  opts: ResolvedPipelineExportOptions
): string {
  const total = steps.length;
  const psPipeline = escapePsSingleQuote(input.pipelineName);
  const psProject = escapePsSingleQuote(input.projectName);
  const psPath = escapePsSingleQuote(input.projectPath);
  const psDesc = escapePsSingleQuote(input.description?.trim() ?? '');
  const psHeader = escapePsSingleQuote(opts.customHeader ?? '');
  const logFile = `${slugifyName(input.pipelineName)}.log`;

  const stepEntries = steps.map((s) => {
    const onErrCmd = s.onErrorCommand ? `'${escapePsSingleQuote(s.onErrorCommand)}'` : '$null';
    const onOkCmd = s.onSuccessCommand ? `'${escapePsSingleQuote(s.onSuccessCommand)}'` : '$null';
    return [
      `  @{`,
      `    Index = ${s.index}`,
      `    Name = '${escapePsSingleQuote(s.name)}'`,
      `    Command = '${escapePsSingleQuote(s.resolvedCommand)}'`,
      `    OnErrorAction = '${s.onErrorAction}'`,
      `    OnErrorCommand = ${onErrCmd}`,
      `    OnSuccessCommand = ${onOkCmd}`,
      `    Note = '${escapePsSingleQuote(formatStepNote(s))}'`,
      `  }`
    ].join('\r\n');
  });

  const colorBlock = opts.includeColors
    ? [
        `$esc = [char]27`,
        `$C_BRAND = "$esc[38;2;124;156;255m"`,
        `$C_CYAN  = "$esc[38;2;56;189;248m"`,
        `$C_GREEN = "$esc[38;2;52;211;153m"`,
        `$C_RED   = "$esc[38;2;248;113;113m"`,
        `$C_AMBER = "$esc[38;2;251;191;36m"`,
        `$C_MUTED = "$esc[38;2;148;163;184m"`,
        `$C_DIM   = "$esc[38;2;100;116;139m"`,
        `$C_WHITE = "$esc[97m"`,
        `$C_BOLD  = "$esc[1m"`,
        `$C_RESET = "$esc[0m"`
      ]
    : [
        `$C_BRAND = ''`,
        `$C_CYAN  = ''`,
        `$C_GREEN = ''`,
        `$C_RED   = ''`,
        `$C_AMBER = ''`,
        `$C_MUTED = ''`,
        `$C_DIM   = ''`,
        `$C_WHITE = ''`,
        `$C_BOLD  = ''`,
        `$C_RESET = ''`
      ];

  const lines = [
    `param(`,
    `  [Alias('y')][switch]$Yes${opts.confirmBeforeRun ? '' : ' = $true'},`,
    `  [switch]$DryRun,`,
    `  [switch]$NoPause${opts.pauseOnFinish ? '' : ' = $true'},`,
    `  [Alias('h')][switch]$Help`,
    `)`,
    ``,
    `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)`,
    ...colorBlock,
    ``,
    `$PipelineName = '${psPipeline}'`,
    `$Description  = '${psDesc}'`,
    `$CustomHeader = '${psHeader}'`,
    `$ProjectName  = '${psProject}'`,
    `$ProjectPath  = '${psPath}'`,
    `$Steps = @(`,
    stepEntries.join(',\r\n'),
    `)`,
    ``,
    `if ($Help) {`,
    `  Write-Host ""`,
    `  Write-Host "  Nexus Pipeline - $PipelineName"`,
    `  Write-Host "  Uso: .\\<script>.ps1 [-Yes|-y] [-DryRun] [-NoPause] [-Help|-h]"`,
    `  Write-Host ""`,
    `  exit 0`,
    `}`,
    ``,
    `$Host.UI.RawUI.WindowTitle = "Nexus Pipeline - $PipelineName"`,
    `Write-Host ""`,
    `Write-Host "  $C_BRAND  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗$C_RESET"`,
    `Write-Host "  $C_CYAN  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝$C_RESET   $C_BOLD$C_WHITE NEXUS PIPELINE$C_RESET"`,
    `Write-Host "  $C_CYAN  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗$C_RESET   $C_MUTED$PipelineName$C_RESET"`,
    `Write-Host "  $C_BRAND  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║$C_RESET   $C_DIM Projeto: $ProjectName$C_RESET"`,
    `Write-Host "  $C_BRAND  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║$C_RESET"`,
    `Write-Host "  $C_DIM  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝$C_RESET"`,
    `Write-Host ""`,
    `Write-Host "  $C_BRAND╭──────────────────────────────────────────────────────────────────────────╮$C_RESET"`,
    `Write-Host "  $C_BRAND│$C_RESET  $C_BOLD$C_WHITE O QUE ESTE SCRIPT FAZ$C_RESET"`,
    `Write-Host "  $C_BRAND├──────────────────────────────────────────────────────────────────────────┤$C_RESET"`,
    `Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Pipeline :$C_RESET $C_WHITE$PipelineName$C_RESET"`,
    `if ($Description) { Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Descricao:$C_RESET $Description" }`,
    `if ($CustomHeader) { Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Nota     :$C_RESET $CustomHeader" }`,
    `Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Projeto  :$C_RESET $C_CYAN$ProjectName$C_RESET"`,
    `Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Pasta    :$C_RESET $C_DIM${opts.useProjectDir ? '$ProjectPath' : 'Pasta atual ($PWD)'}$C_RESET"`,
    ...(opts.envProfile ? [`Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Perfil   :$C_RESET $C_AMBER${escapePsSingleQuote(opts.envProfile)}$C_RESET"`] : []),
    ...(opts.saveLogFile ? [`Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Log      :$C_RESET $C_DIM${logFile}$C_RESET"`] : []),
    `Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Etapas (${total}):$C_RESET"`,
    `foreach ($s in $Steps) {`,
    `  Write-Host "  $C_BRAND│$C_RESET    $C_CYAN$($s.Index).$C_RESET $C_WHITE$($s.Name)$C_RESET$C_DIM$($s.Note)$C_RESET"`,
    `  Write-Host "  $C_BRAND│$C_RESET       $C_DIM$ $($s.Command)$C_RESET"`,
    `}`,
    `Write-Host "  $C_BRAND╰──────────────────────────────────────────────────────────────────────────╯$C_RESET"`,
    `Write-Host ""`,
    ``,
    `if ($DryRun) {`,
    `  Write-Host "  $C_AMBER[DRY-RUN]$C_RESET $C_MUTED Simulacao concluida — nenhum comando foi executado.$C_RESET"`,
    `  if (-not $NoPause) { Read-Host "  Pressione ENTER para fechar" | Out-Null }`,
    `  exit 0`,
    `}`,
    ``,
    `if (-not $Yes) {`,
    `  Read-Host "  ❯ Pressione ENTER para executar (ou Ctrl+C para cancelar)" | Out-Null`,
    `  Write-Host ""`,
    `}`,
    ``,
    ...(opts.useProjectDir
      ? [
          `if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {`,
          `  Write-Host "  $C_RED✗ Pasta do projeto nao encontrada: $ProjectPath$C_RESET"`,
          `  if (-not $NoPause) { Read-Host "  Pressione ENTER para fechar" | Out-Null }`,
          `  exit 1`,
          `}`
        ]
      : []),
    ``,
    `function Invoke-StepCmd([string]$Cmd) {`,
    `  $global:LASTEXITCODE = 0`,
    `  Invoke-Expression $Cmd`,
    `  if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) { return [int]$LASTEXITCODE }`,
    `  return 0`,
    `}`,
    ``,
    `$results = $Steps | ForEach-Object { [PSCustomObject]@{ Index = $_.Index; Name = $_.Name; Status = 'SKIPPED'; Elapsed = '-' } }`,
    `$pipelineFailed = $false`,
    `$totalWatch = [System.Diagnostics.Stopwatch]::StartNew()`,
    ``,
    ...(opts.useProjectDir ? [`Push-Location -LiteralPath $ProjectPath`] : []),
    `try {`,
    ...(opts.saveLogFile ? [`  Start-Transcript -Path '${logFile}' -Append | Out-Null`] : []),
    ...buildPsEnvLoaderLines(opts.envProfile).map((l) => `  ${l}`),
    `  for ($i = 0; $i -lt $Steps.Count; $i++) {`,
    `    $s = $Steps[$i]`,
    `    $Host.UI.RawUI.WindowTitle = "[$($s.Index)/${total}] Nexus - $($s.Name)"`,
    `    Write-Host "  $C_CYAN▶ [$($s.Index)/${total}]$C_RESET $C_BOLD$C_WHITE$($s.Name)$C_RESET"`,
    `    Write-Host "  $C_DIM  $ $($s.Command)$C_RESET"`,
    `    Write-Host ""`,
    ``,
    `    $sw = [System.Diagnostics.Stopwatch]::StartNew()`,
    `    $code = 0`,
    `    try { $code = Invoke-StepCmd $s.Command } catch { Write-Host $_; $code = 1 }`,
    `    $sw.Stop()`,
    `    $elapsed = "{0:N2}s" -f $sw.Elapsed.TotalSeconds`,
    `    $results[$i].Elapsed = $elapsed`,
    ``,
    `    if ($code -eq 0) {`,
    `      Write-Host ""`,
    `      Write-Host "  $C_GREEN✓ Etapa $($s.Index) concluida ($elapsed)$C_RESET"`,
    `      $results[$i].Status = 'OK'`,
    `      if ($s.OnSuccessCommand) {`,
    `        Write-Host "  $C_CYAN↳ Executando onSuccess:$C_RESET $C_DIM$($s.OnSuccessCommand)$C_RESET"`,
    `        $hookCode = Invoke-StepCmd $s.OnSuccessCommand`,
    `        if ($hookCode -ne 0) { Write-Host "  $C_AMBER⚠ onSuccess retornou codigo $hookCode.$C_RESET" }`,
    `      }`,
    `      Write-Host ""`,
    `    } else {`,
    `      Write-Host ""`,
    `      Write-Host "  $C_RED✗ Etapa $($s.Index) falhou (codigo $code, $elapsed)$C_RESET"`,
    `      $pipelineFailed = $true`,
    `      if ($s.OnErrorAction -eq 'continue') {`,
    `        Write-Host "  $C_AMBER⚠ onError=continue — prosseguindo para a proxima etapa.$C_RESET"`,
    `        Write-Host ""`,
    `        $results[$i].Status = 'WARN'`,
    `      } else {`,
    `        $results[$i].Status = 'FAIL'`,
    `        if ($s.OnErrorAction -eq 'run_command' -and $s.OnErrorCommand) {`,
    `          Write-Host "  $C_CYAN↳ Executando fallback de erro:$C_RESET $C_DIM$($s.OnErrorCommand)$C_RESET"`,
    `          [void](Invoke-StepCmd $s.OnErrorCommand)`,
    `        }`,
    `        Write-Host "  $C_RED■ Pipeline interrompido.$C_RESET"`,
    `        Write-Host ""`,
    `        break`,
    `      }`,
    `    }`,
    `  }`,
    `} finally {`,
    ...(opts.saveLogFile ? [`  Stop-Transcript | Out-Null`] : []),
    ...(opts.useProjectDir ? [`  Pop-Location`] : []),
    `}`,
    ``,
    `$totalWatch.Stop()`,
    `$totalElapsed = "{0:N2}s" -f $totalWatch.Elapsed.TotalSeconds`,
    `Write-Host "  $C_BRAND╭──────────────────────────────────────────────────────────────────────────╮$C_RESET"`,
    `Write-Host "  $C_BRAND│$C_RESET  $C_BOLD$C_WHITE RESUMO FINAL$C_RESET"`,
    `Write-Host "  $C_BRAND├──────────────────────────────────────────────────────────────────────────┤$C_RESET"`,
    `foreach ($r in $results) {`,
    `  $badge = switch ($r.Status) {`,
    `    'OK'   { "$C_GREEN✓ [OK]$C_RESET" }`,
    `    'WARN' { "$C_AMBER⚠ [WARN]$C_RESET" }`,
    `    'FAIL' { "$C_RED✗ [FAIL]$C_RESET" }`,
    `    default { "$C_DIM○ [SKIPPED]$C_RESET" }`,
    `  }`,
    `  Write-Host "  $C_BRAND│$C_RESET  $badge  $($r.Index). $($r.Name)  $C_DIM($($r.Elapsed))$C_RESET"`,
    `}`,
    `Write-Host "  $C_BRAND├──────────────────────────────────────────────────────────────────────────┤$C_RESET"`,
    `if (-not $pipelineFailed) {`,
    `  Write-Host "  $C_BRAND│$C_RESET  $C_GREEN Status: SUCESSO$C_RESET   $C_MUTED Tempo total: $totalElapsed$C_RESET"`,
    `  $Host.UI.RawUI.WindowTitle = "[OK] Nexus Pipeline - $PipelineName"`,
    `} else {`,
    `  Write-Host "  $C_BRAND│$C_RESET  $C_RED Status: FALHOU$C_RESET    $C_MUTED Tempo total: $totalElapsed$C_RESET"`,
    `  $Host.UI.RawUI.WindowTitle = "[FALHOU] Nexus Pipeline - $PipelineName"`,
    `}`,
    ...(opts.saveLogFile ? [`Write-Host "  $C_BRAND│$C_RESET  $C_DIM Log salvo em: ${logFile}$C_RESET"`] : []),
    `Write-Host "  $C_BRAND╰──────────────────────────────────────────────────────────────────────────╯$C_RESET"`,
    `Write-Host ""`,
    `if (-not $NoPause) { Read-Host "  Pressione ENTER para fechar" | Out-Null }`,
    `if ($pipelineFailed) { exit 1 }`,
    `exit 0`
  ];

  return `${lines.join('\r\n')}\r\n`;
}

function generateShRawScript(
  input: PipelineExportInput,
  steps: ResolvedExportStep[],
  opts: ResolvedPipelineExportOptions
): string {
  const shPath = escapeShSingleQuote(input.projectPath);
  const logFile = `${slugifyName(input.pipelineName)}.log`;

  const lines: string[] = [
    `#!/usr/bin/env bash`,
    `set -u`,
    `# Pipeline: ${input.pipelineName} (${input.projectName})`
  ];
  if (opts.customHeader) {
    lines.push(`# ${opts.customHeader}`);
  }
  lines.push('');

  if (opts.confirmBeforeRun) {
    lines.push(
      `if [ -t 0 ]; then read -r -p 'Pressione ENTER para executar ${escapeShSingleQuote(input.pipelineName)} (ou Ctrl+C para cancelar)... ' _; fi`,
      ``
    );
  }

  if (opts.useProjectDir) {
    lines.push(`cd '${shPath}' || exit 1`);
  }

  if (opts.saveLogFile) {
    lines.push(`exec > >(tee -a '${logFile}') 2>&1`);
  }

  lines.push(...buildShEnvLoaderLines(opts.envProfile), ``);

  for (const s of steps) {
    lines.push(s.resolvedCommand);
    if (s.onErrorAction === 'stop') {
      lines.push(`STATUS=$?; if [ "$STATUS" -ne 0 ]; then exit "$STATUS"; fi`);
    } else if (s.onErrorAction === 'run_command') {
      lines.push(`STATUS=$?; if [ "$STATUS" -ne 0 ]; then`);
      if (s.onErrorCommand) {
        lines.push(`  ${s.onErrorCommand}`);
      }
      lines.push(`  exit "$STATUS"`, `fi`);
    }
    if (s.onSuccessCommand) {
      lines.push(`if [ "$?" -eq 0 ]; then ${s.onSuccessCommand}; fi`);
    }
    lines.push('');
  }

  if (opts.pauseOnFinish) {
    lines.push(`if [ -t 0 ]; then read -r -p 'Pressione ENTER para fechar... ' _; fi`);
  }
  lines.push(`exit 0`);

  return `${lines.join('\n')}\n`;
}

function generateShRichScript(
  input: PipelineExportInput,
  steps: ResolvedExportStep[],
  opts: ResolvedPipelineExportOptions
): string {
  const total = steps.length;
  const shPipeline = escapeShSingleQuote(input.pipelineName);
  const shProject = escapeShSingleQuote(input.projectName);
  const shPath = escapeShSingleQuote(input.projectPath);
  const shDesc = escapeShSingleQuote(input.description?.trim() ?? '');
  const shHeader = escapeShSingleQuote(opts.customHeader ?? '');
  const logFile = `${slugifyName(input.pipelineName)}.log`;

  const stepArrays = steps.flatMap((s) => [
    `STEP_NAMES+=('${escapeShSingleQuote(s.name)}')`,
    `STEP_CMDS+=('${escapeShSingleQuote(s.resolvedCommand)}')`,
    `STEP_ONERR+=('${s.onErrorAction}')`,
    `STEP_ONERR_CMDS+=('${escapeShSingleQuote(s.onErrorCommand ?? '')}')`,
    `STEP_ONOK_CMDS+=('${escapeShSingleQuote(s.onSuccessCommand ?? '')}')`,
    `STEP_NOTES+=('${escapeShSingleQuote(formatStepNote(s))}')`,
    `RES_STATUS+=('SKIPPED')`,
    `RES_TIME+=('-')`
  ]);

  const colorSetup = opts.includeColors
    ? [
        `if [ -t 1 ] && [ -z "\${NO_COLOR:-}" ]; then`,
        `  C_BRAND=$'\\033[38;2;124;156;255m'`,
        `  C_CYAN=$'\\033[38;2;56;189;248m'`,
        `  C_GREEN=$'\\033[38;2;52;211;153m'`,
        `  C_RED=$'\\033[38;2;248;113;113m'`,
        `  C_AMBER=$'\\033[38;2;251;191;36m'`,
        `  C_MUTED=$'\\033[38;2;148;163;184m'`,
        `  C_DIM=$'\\033[38;2;100;116;139m'`,
        `  C_WHITE=$'\\033[97m'`,
        `  C_BOLD=$'\\033[1m'`,
        `  C_RESET=$'\\033[0m'`,
        `else`,
        `  C_BRAND="" C_CYAN="" C_GREEN="" C_RED="" C_AMBER="" C_MUTED="" C_DIM="" C_WHITE="" C_BOLD="" C_RESET=""`,
        `fi`
      ]
    : [
        `C_BRAND="" C_CYAN="" C_GREEN="" C_RED="" C_AMBER="" C_MUTED="" C_DIM="" C_WHITE="" C_BOLD="" C_RESET=""`
      ];

  const lines = [
    `#!/usr/bin/env bash`,
    `set -u`,
    ``,
    ...colorSetup,
    ``,
    `PIPELINE_NAME='${shPipeline}'`,
    `DESCRIPTION='${shDesc}'`,
    `CUSTOM_HEADER='${shHeader}'`,
    `PROJECT_NAME='${shProject}'`,
    `PROJECT_PATH='${shPath}'`,
    ``,
    `SKIP_CONFIRM=${opts.confirmBeforeRun ? '0' : '1'}`,
    `DRY_RUN=0`,
    `NO_PAUSE=${opts.pauseOnFinish ? '0' : '1'}`,
    ``,
    `for arg in "$@"; do`,
    `  case "$arg" in`,
    `    -h|--help)`,
    `      echo ""`,
    `      echo "  Nexus Pipeline - $PIPELINE_NAME"`,
    `      echo "  Uso: $0 [--yes|-y] [--dry-run] [--no-pause] [--help|-h]"`,
    `      echo ""`,
    `      exit 0`,
    `      ;;`,
    `    -y|--yes) SKIP_CONFIRM=1 ;;`,
    `    --dry-run) DRY_RUN=1 ;;`,
    `    --no-pause) NO_PAUSE=1 ;;`,
    `  esac`,
    `done`,
    ``,
    `STEP_NAMES=()`,
    `STEP_CMDS=()`,
    `STEP_ONERR=()`,
    `STEP_ONERR_CMDS=()`,
    `STEP_ONOK_CMDS=()`,
    `STEP_NOTES=()`,
    `RES_STATUS=()`,
    `RES_TIME=()`,
    ``,
    ...stepArrays,
    ``,
    `echo ""`,
    `printf '  %s  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗%s\\n' "$C_BRAND" "$C_RESET"`,
    `printf '  %s  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝%s   %s%sNEXUS PIPELINE%s\\n' "$C_CYAN" "$C_RESET" "$C_BOLD" "$C_WHITE" "$C_RESET"`,
    `printf '  %s  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗%s   %s%s%s\\n' "$C_CYAN" "$C_RESET" "$C_MUTED" "$PIPELINE_NAME" "$C_RESET"`,
    `printf '  %s  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║%s   %sProjeto: %s%s\\n' "$C_BRAND" "$C_RESET" "$C_DIM" "$PROJECT_NAME" "$C_RESET"`,
    `printf '  %s  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║%s\\n' "$C_BRAND" "$C_RESET"`,
    `printf '  %s  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝%s\\n' "$C_DIM" "$C_RESET"`,
    `echo ""`,
    `printf '  %s╭──────────────────────────────────────────────────────────────────────────╮%s\\n' "$C_BRAND" "$C_RESET"`,
    `printf '  %s│%s  %s%sO QUE ESTE SCRIPT FAZ%s\\n' "$C_BRAND" "$C_RESET" "$C_BOLD" "$C_WHITE" "$C_RESET"`,
    `printf '  %s├──────────────────────────────────────────────────────────────────────────┤%s\\n' "$C_BRAND" "$C_RESET"`,
    `printf '  %s│%s  %sPipeline :%s %s%s%s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "$C_RESET" "$C_WHITE" "$PIPELINE_NAME" "$C_RESET"`,
    `if [ -n "$DESCRIPTION" ]; then`,
    `  printf '  %s│%s  %sDescricao:%s %s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "$C_RESET" "$DESCRIPTION"`,
    `fi`,
    `if [ -n "$CUSTOM_HEADER" ]; then`,
    `  printf '  %s│%s  %sNota     :%s %s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "$C_RESET" "$CUSTOM_HEADER"`,
    `fi`,
    `printf '  %s│%s  %sProjeto  :%s %s%s%s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "$C_RESET" "$C_CYAN" "$PROJECT_NAME" "$C_RESET"`,
    `printf '  %s│%s  %sPasta    :%s %s%s%s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "$C_RESET" "$C_DIM" "${opts.useProjectDir ? '$PROJECT_PATH' : 'Pasta atual ($PWD)'}" "$C_RESET"`,
    ...(opts.envProfile
      ? [`printf '  %s│%s  %sPerfil   :%s %s${escapeShSingleQuote(opts.envProfile)}%s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "$C_RESET" "$C_AMBER" "$C_RESET"`]
      : []),
    ...(opts.saveLogFile
      ? [`printf '  %s│%s  %sLog      :%s %s${logFile}%s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "$C_RESET" "$C_DIM" "$C_RESET"`]
      : []),
    `printf '  %s│%s  %sEtapas (%d):%s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "${total}" "$C_RESET"`,
    `for ((i = 0; i < ${total}; i++)); do`,
    `  printf '  %s│%s    %s%d.%s %s%s%s%s%s%s\\n' "$C_BRAND" "$C_RESET" "$C_CYAN" "$((i + 1))" "$C_RESET" "$C_WHITE" "\${STEP_NAMES[$i]}" "$C_RESET" "$C_DIM" "\${STEP_NOTES[$i]}" "$C_RESET"`,
    `  printf '  %s│%s       %s$ %s%s\\n' "$C_BRAND" "$C_RESET" "$C_DIM" "\${STEP_CMDS[$i]}" "$C_RESET"`,
    `done`,
    `printf '  %s╰──────────────────────────────────────────────────────────────────────────╯%s\\n' "$C_BRAND" "$C_RESET"`,
    `echo ""`,
    ``,
    `pause_end() {`,
    `  if [ "$NO_PAUSE" -eq 0 ] && [ -t 0 ]; then`,
    `    printf '  %sPressione ENTER para fechar...%s' "$C_DIM" "$C_RESET"`,
    `    read -r _`,
    `  fi`,
    `}`,
    ``,
    `if [ "$DRY_RUN" -eq 1 ]; then`,
    `  printf '  %s[DRY-RUN]%s %sSimulacao concluida — nenhum comando foi executado.%s\\n\\n' "$C_AMBER" "$C_RESET" "$C_MUTED" "$C_RESET"`,
    `  pause_end`,
    `  exit 0`,
    `fi`,
    ``,
    `if [ "$SKIP_CONFIRM" -eq 0 ] && [ -t 0 ]; then`,
    `  printf '  %s❯%s Pressione ENTER para executar (ou Ctrl+C para cancelar)... ' "$C_CYAN" "$C_RESET"`,
    `  read -r _`,
    `  echo ""`,
    `fi`,
    ``,
    ...(opts.useProjectDir
      ? [
          `if [ ! -d "$PROJECT_PATH" ]; then`,
          `  printf '  %s✗ Pasta do projeto nao encontrada: %s%s\\n' "$C_RED" "$PROJECT_PATH" "$C_RESET"`,
          `  pause_end`,
          `  exit 1`,
          `fi`,
          `cd "$PROJECT_PATH" || exit 1`
        ]
      : []),
    ...(opts.saveLogFile ? [`exec > >(tee -a '${logFile}') 2>&1`] : []),
    ...buildShEnvLoaderLines(opts.envProfile),
    `PIPELINE_FAILED=0`,
    `PIPELINE_START=$SECONDS`,
    ``,
    `for ((i = 0; i < ${total}; i++)); do`,
    `  IDX=$((i + 1))`,
    `  S_NAME="\${STEP_NAMES[$i]}"`,
    `  S_CMD="\${STEP_CMDS[$i]}"`,
    `  S_ONERR="\${STEP_ONERR[$i]}"`,
    `  S_ONERR_CMD="\${STEP_ONERR_CMDS[$i]}"`,
    `  S_ONOK_CMD="\${STEP_ONOK_CMDS[$i]}"`,
    ``,
    `  printf '  %s▶ [%d/${total}]%s %s%s%s%s\\n' "$C_CYAN" "$IDX" "$C_RESET" "$C_BOLD" "$C_WHITE" "$S_NAME" "$C_RESET"`,
    `  printf '  %s  $ %s%s\\n\\n' "$C_DIM" "$S_CMD" "$C_RESET"`,
    ``,
    `  STEP_START=$SECONDS`,
    `  bash -c "$S_CMD"`,
    `  STEP_EXIT=$?`,
    `  STEP_ELAPSED="$((SECONDS - STEP_START))s"`,
    `  RES_TIME[$i]="$STEP_ELAPSED"`,
    ``,
    `  if [ "$STEP_EXIT" -eq 0 ]; then`,
    `    printf '\\n  %s✓ Etapa %d concluida (%s)%s\\n' "$C_GREEN" "$IDX" "$STEP_ELAPSED" "$C_RESET"`,
    `    RES_STATUS[$i]='OK'`,
    `    if [ -n "$S_ONOK_CMD" ]; then`,
    `      printf '  %s↳ Executando onSuccess:%s %s%s%s\\n' "$C_CYAN" "$C_RESET" "$C_DIM" "$S_ONOK_CMD" "$C_RESET"`,
    `      bash -c "$S_ONOK_CMD" || printf '  %s⚠ onSuccess retornou erro.%s\\n' "$C_AMBER" "$C_RESET"`,
    `    fi`,
    `    echo ""`,
    `  else`,
    `    printf '\\n  %s✗ Etapa %d falhou (codigo %d, %s)%s\\n' "$C_RED" "$IDX" "$STEP_EXIT" "$STEP_ELAPSED" "$C_RESET"`,
    `    PIPELINE_FAILED=1`,
    `    if [ "$S_ONERR" = "continue" ]; then`,
    `      printf '  %s⚠ onError=continue — prosseguindo para a proxima etapa.%s\\n\\n' "$C_AMBER" "$C_RESET"`,
    `      RES_STATUS[$i]='WARN'`,
    `    else`,
    `      RES_STATUS[$i]='FAIL'`,
    `      if [ "$S_ONERR" = "run_command" ] && [ -n "$S_ONERR_CMD" ]; then`,
    `        printf '  %s↳ Executando fallback de erro:%s %s%s%s\\n' "$C_CYAN" "$C_RESET" "$C_DIM" "$S_ONERR_CMD" "$C_RESET"`,
    `        bash -c "$S_ONERR_CMD"`,
    `      fi`,
    `      printf '  %s■ Pipeline interrompido.%s\\n\\n' "$C_RED" "$C_RESET"`,
    `      break`,
    `    fi`,
    `  fi`,
    `done`,
    ``,
    `TOTAL_ELAPSED="$((SECONDS - PIPELINE_START))s"`,
    `printf '  %s╭──────────────────────────────────────────────────────────────────────────╮%s\\n' "$C_BRAND" "$C_RESET"`,
    `printf '  %s│%s  %s%sRESUMO FINAL%s\\n' "$C_BRAND" "$C_RESET" "$C_BOLD" "$C_WHITE" "$C_RESET"`,
    `printf '  %s├──────────────────────────────────────────────────────────────────────────┤%s\\n' "$C_BRAND" "$C_RESET"`,
    `for ((i = 0; i < ${total}; i++)); do`,
    `  case "\${RES_STATUS[$i]}" in`,
    `    OK)   BADGE="\${C_GREEN}✓ [OK]\${C_RESET}" ;;`,
    `    WARN) BADGE="\${C_AMBER}⚠ [WARN]\${C_RESET}" ;;`,
    `    FAIL) BADGE="\${C_RED}✗ [FAIL]\${C_RESET}" ;;`,
    `    *)    BADGE="\${C_DIM}○ [SKIPPED]\${C_RESET}" ;;`,
    `  esac`,
    `  printf '  %s│%s  %s  %d. %s  %s(%s)%s\\n' "$C_BRAND" "$C_RESET" "$BADGE" "$((i + 1))" "\${STEP_NAMES[$i]}" "$C_DIM" "\${RES_TIME[$i]}" "$C_RESET"`,
    `done`,
    `printf '  %s├──────────────────────────────────────────────────────────────────────────┤%s\\n' "$C_BRAND" "$C_RESET"`,
    `if [ "$PIPELINE_FAILED" -eq 0 ]; then`,
    `  printf '  %s│%s  %sStatus: SUCESSO%s   %sTempo total: %s%s\\n' "$C_BRAND" "$C_RESET" "$C_GREEN" "$C_RESET" "$C_MUTED" "$TOTAL_ELAPSED" "$C_RESET"`,
    `else`,
    `  printf '  %s│%s  %sStatus: FALHOU%s    %sTempo total: %s%s\\n' "$C_BRAND" "$C_RESET" "$C_RED" "$C_RESET" "$C_MUTED" "$TOTAL_ELAPSED" "$C_RESET"`,
    `fi`,
    ...(opts.saveLogFile
      ? [`printf '  %s│%s  %sLog salvo em: ${logFile}%s\\n' "$C_BRAND" "$C_RESET" "$C_DIM" "$C_RESET"`]
      : []),
    `printf '  %s╰──────────────────────────────────────────────────────────────────────────╯%s\\n\\n' "$C_BRAND" "$C_RESET"`,
    `pause_end`,
    `exit "$PIPELINE_FAILED"`
  ];

  return `${lines.join('\n')}\n`;
}

/**
 * Generates a standalone .bat, .ps1, or .sh script for a Nexus pipeline.
 */
export function generatePipelineScript(
  input: PipelineExportInput,
  format: PipelineExportFormat,
  options?: PipelineExportOptions
): string {
  const enabledSteps = input.steps
    .filter((s) => s.enabled)
    .map((s, idx): ResolvedExportStep => ({
      index: idx + 1,
      name: s.name.trim() || s.command.trim(),
      kind: s.kind,
      resolvedCommand: resolveExportStepCommand(s, input.packageManager, format),
      onErrorAction: s.onErrorAction,
      onErrorCommand: s.onErrorCommand?.trim() || null,
      onSuccessCommand: s.onSuccessCommand?.trim() || null
    }));

  if (enabledSteps.length === 0) {
    throw new Error('Este pipeline não possui nenhuma etapa habilitada para exportar.');
  }

  const resolvedOpts = normalizeExportOptions(options);
  const isRaw = resolvedOpts.style === 'raw';

  switch (format) {
    case 'ps1':
      return isRaw
        ? generatePs1RawScript(input, enabledSteps, resolvedOpts)
        : generatePs1RichScript(input, enabledSteps, resolvedOpts);
    case 'sh':
      return isRaw
        ? generateShRawScript(input, enabledSteps, resolvedOpts)
        : generateShRichScript(input, enabledSteps, resolvedOpts);
    case 'bat':
    default:
      return isRaw
        ? generateBatRawScript(input, enabledSteps, resolvedOpts)
        : generateBatRichScript(input, enabledSteps, resolvedOpts);
  }
}
