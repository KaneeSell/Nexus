import type {
  OnErrorAction,
  PackageManager,
  PipelineExportFormat,
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

interface ResolvedExportStep {
  index: number;
  name: string;
  kind: StepKind;
  resolvedCommand: string;
  onErrorAction: OnErrorAction;
  onErrorCommand: string | null;
  onSuccessCommand: string | null;
}

/**
 * Generates a filesystem-safe filename for an exported pipeline script.
 */
export function suggestExportFilename(
  pipelineName: string,
  format: PipelineExportFormat
): string {
  const slug = pipelineName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = slug || 'pipeline';
  return `${base}.${format}`;
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

function generateBatScript(
  input: PipelineExportInput,
  steps: ResolvedExportStep[]
): string {
  const total = steps.length;
  const safePipeline = escapeBatEcho(input.pipelineName);
  const safeProject = escapeBatEcho(input.projectName);
  const safePath = escapeBatEcho(input.projectPath);
  const safeDescription = input.description?.trim()
    ? escapeBatEcho(input.description.trim())
    : '';
  const pathNoQuotes = escapeBatPercent(input.projectPath.replace(/"/g, ''));

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
    const lines = [
      `:step_${s.index}`,
      `title [${s.index}/${total}] Nexus - ${escapeBatEcho(s.name)}`,
      `echo   %C_CYAN%▶ [${s.index}/${total}]%C_RESET% %C_BOLD%%C_WHITE%${escapeBatEcho(s.name)}%C_RESET%`,
      `echo   %C_DIM%  $ ${escapeBatEcho(s.resolvedCommand)}%C_RESET%`,
      `echo.`,
      `call :now_cs STEP_START_CS`,
      `cmd /c "${cmdLine}"`,
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
    `set "C_RESET=%ESC%[0m"`,
    ``,
    `set "SKIP_CONFIRM=0"`,
    `set "DRY_RUN=0"`,
    `set "NO_PAUSE=0"`,
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
    `echo   %C_BRAND%│%C_RESET%  %C_MUTED%Projeto  :%C_RESET% %C_CYAN%${safeProject}%C_RESET%`,
    `echo   %C_BRAND%│%C_RESET%  %C_MUTED%Pasta    :%C_RESET% %C_DIM%${safePath}%C_RESET%`,
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
    `if not exist "${pathNoQuotes}\\" (`,
    `  echo   %C_RED%✗ Pasta do projeto nao encontrada: ${safePath}%C_RESET%`,
    `  if "%NO_PAUSE%"=="0" pause >nul`,
    `  exit /b 1`,
    `)`,
    `pushd "${pathNoQuotes}"`,
    `call :now_cs PIPELINE_START_CS`,
    `set "PIPELINE_FAILED=0"`,
    ...initResults,
    `goto :step_1`,
    ``,
    ...stepBlocks,
    `:summary`,
    `popd`,
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

function generatePs1Script(
  input: PipelineExportInput,
  steps: ResolvedExportStep[]
): string {
  const total = steps.length;
  const psPipeline = escapePsSingleQuote(input.pipelineName);
  const psProject = escapePsSingleQuote(input.projectName);
  const psPath = escapePsSingleQuote(input.projectPath);
  const psDesc = escapePsSingleQuote(input.description?.trim() ?? '');

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

  const lines = [
    `param(`,
    `  [Alias('y')][switch]$Yes,`,
    `  [switch]$DryRun,`,
    `  [switch]$NoPause,`,
    `  [Alias('h')][switch]$Help`,
    `)`,
    ``,
    `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)`,
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
    `$C_RESET = "$esc[0m"`,
    ``,
    `$PipelineName = '${psPipeline}'`,
    `$Description  = '${psDesc}'`,
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
    `Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Projeto  :$C_RESET $C_CYAN$ProjectName$C_RESET"`,
    `Write-Host "  $C_BRAND│$C_RESET  $C_MUTED Pasta    :$C_RESET $C_DIM$ProjectPath$C_RESET"`,
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
    `if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {`,
    `  Write-Host "  $C_RED✗ Pasta do projeto nao encontrada: $ProjectPath$C_RESET"`,
    `  if (-not $NoPause) { Read-Host "  Pressione ENTER para fechar" | Out-Null }`,
    `  exit 1`,
    `}`,
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
    `Push-Location -LiteralPath $ProjectPath`,
    `try {`,
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
    `  Pop-Location`,
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
    `Write-Host "  $C_BRAND╰──────────────────────────────────────────────────────────────────────────╯$C_RESET"`,
    `Write-Host ""`,
    `if (-not $NoPause) { Read-Host "  Pressione ENTER para fechar" | Out-Null }`,
    `if ($pipelineFailed) { exit 1 }`,
    `exit 0`
  ];

  return `${lines.join('\r\n')}\r\n`;
}

function generateShScript(
  input: PipelineExportInput,
  steps: ResolvedExportStep[]
): string {
  const total = steps.length;
  const shPipeline = escapeShSingleQuote(input.pipelineName);
  const shProject = escapeShSingleQuote(input.projectName);
  const shPath = escapeShSingleQuote(input.projectPath);
  const shDesc = escapeShSingleQuote(input.description?.trim() ?? '');

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

  const lines = [
    `#!/usr/bin/env bash`,
    `set -u`,
    ``,
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
    `fi`,
    ``,
    `PIPELINE_NAME='${shPipeline}'`,
    `DESCRIPTION='${shDesc}'`,
    `PROJECT_NAME='${shProject}'`,
    `PROJECT_PATH='${shPath}'`,
    ``,
    `SKIP_CONFIRM=0`,
    `DRY_RUN=0`,
    `NO_PAUSE=0`,
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
    `printf '  %s│%s  %sProjeto  :%s %s%s%s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "$C_RESET" "$C_CYAN" "$PROJECT_NAME" "$C_RESET"`,
    `printf '  %s│%s  %sPasta    :%s %s%s%s\\n' "$C_BRAND" "$C_RESET" "$C_MUTED" "$C_RESET" "$C_DIM" "$PROJECT_PATH" "$C_RESET"`,
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
    `if [ ! -d "$PROJECT_PATH" ]; then`,
    `  printf '  %s✗ Pasta do projeto nao encontrada: %s%s\\n' "$C_RED" "$PROJECT_PATH" "$C_RESET"`,
    `  pause_end`,
    `  exit 1`,
    `fi`,
    ``,
    `cd "$PROJECT_PATH" || exit 1`,
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
  format: PipelineExportFormat
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

  switch (format) {
    case 'ps1':
      return generatePs1Script(input, enabledSteps);
    case 'sh':
      return generateShScript(input, enabledSteps);
    case 'bat':
    default:
      return generateBatScript(input, enabledSteps);
  }
}
