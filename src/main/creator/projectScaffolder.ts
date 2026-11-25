import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import type {
  CreateProjectInput,
  CreateProjectPhase,
  CreateProjectProgressEvent,
  CreateProjectResult,
  LivePackageMeta
} from '../../shared/types';
import { buildScaffoldPlan } from './scaffoldPlan';

export interface ExecCommandResult {
  exitCode: number;
}

export type ExecCommandFn = (
  command: string,
  cwd: string,
  onChunk: (stream: 'stdout' | 'stderr', chunk: string) => void
) => Promise<ExecCommandResult>;

export interface ScaffolderFsOps {
  existsSync: (p: string) => boolean;
  mkdirSync: (p: string, opts: { recursive: boolean }) => void;
  rmSync: (p: string, opts: { recursive: boolean; force: boolean }) => void;
  readFileSync: (p: string, enc: BufferEncoding) => string;
  writeFileSync: (p: string, content: string, enc: BufferEncoding) => void;
}

export interface ScaffolderDeps {
  execCommand?: ExecCommandFn;
  fsOps?: ScaffolderFsOps;
  resolvedMeta?: LivePackageMeta | null;
}

export function defaultExecCommand(
  command: string,
  cwd: string,
  onChunk: (stream: 'stdout' | 'stderr', chunk: string) => void
): Promise<ExecCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      env: process.env
    });

    child.stdout.on('data', (buf: Buffer) => onChunk('stdout', buf.toString('utf-8')));
    child.stderr.on('data', (buf: Buffer) => onChunk('stderr', buf.toString('utf-8')));
    child.on('error', (err) => {
      onChunk('stderr', `${err.message}\n`);
      resolve({ exitCode: 1 });
    });
    child.on('close', (code) => {
      resolve({ exitCode: code === 0 ? 0 : 1 });
    });
  });
}

const defaultFsOps: ScaffolderFsOps = {
  existsSync: fs.existsSync,
  mkdirSync: fs.mkdirSync,
  rmSync: fs.rmSync,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync
};

function emit(
  onProgress: ((ev: CreateProjectProgressEvent) => void) | undefined,
  phase: CreateProjectPhase,
  message: string,
  stepIndex: number,
  totalSteps: number,
  stream?: 'stdout' | 'stderr' | 'system',
  chunk?: string
): void {
  onProgress?.({ phase, message, stepIndex, totalSteps, stream, chunk });
}

export async function executeCreateProject(
  input: CreateProjectInput,
  onProgress?: (ev: CreateProjectProgressEvent) => void,
  deps: ScaffolderDeps = {}
): Promise<CreateProjectResult> {
  const execCommand = deps.execCommand ?? defaultExecCommand;
  const fsOps = deps.fsOps ?? defaultFsOps;

  try {
    const plan = buildScaffoldPlan(input, deps.resolvedMeta);
    const parentDir = input.parentDir.trim();
    const totalSteps = plan.commands.length + (plan.files.length > 0 ? 1 : 0);

    emit(onProgress, 'validating', `Validando destino ${plan.targetDir}...`, 0, totalSteps, 'system');

    if (!fsOps.existsSync(parentDir)) {
      const msg = `A pasta de destino não existe: ${parentDir}`;
      emit(onProgress, 'error', msg, 0, totalSteps, 'stderr', `${msg}\n`);
      return { ok: false, error: msg };
    }

    if (fsOps.existsSync(plan.targetDir)) {
      const msg = `Já existe uma pasta com esse nome: ${plan.targetDir}`;
      emit(onProgress, 'error', msg, 0, totalSteps, 'stderr', `${msg}\n`);
      return { ok: false, error: msg };
    }

    let stepIdx = 0;

    if (input.mode === 'github-template' || input.mode === 'public-template') {
      const cloneStep = plan.commands[0];
      stepIdx = 1;
      emit(onProgress, 'cloning', cloneStep.label, stepIdx, totalSteps, 'system', `> ${cloneStep.command}\n`);
      const cloneRes = await execCommand(cloneStep.command, parentDir, (stream, chunk) => {
        emit(onProgress, 'cloning', cloneStep.label, stepIdx, totalSteps, stream, chunk);
      });
      if (cloneRes.exitCode !== 0) {
        const msg = `Falha ao clonar template (código ${cloneRes.exitCode}).`;
        emit(onProgress, 'error', msg, stepIdx, totalSteps, 'stderr', `${msg}\n`);
        return { ok: false, error: msg };
      }

      const clonedGitDir = path.join(plan.targetDir, '.git');
      if (fsOps.existsSync(clonedGitDir)) {
        fsOps.rmSync(clonedGitDir, { recursive: true, force: true });
      }

      const pkgPath = path.join(plan.targetDir, 'package.json');
      if (fsOps.existsSync(pkgPath)) {
        try {
          const parsed = JSON.parse(fsOps.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
          parsed.name = plan.sanitizedName;
          fsOps.writeFileSync(pkgPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
        } catch {
          // ignore malformed package.json in external templates
        }
      }

      for (let i = 1; i < plan.commands.length; i += 1) {
        const cmd = plan.commands[i];
        stepIdx += 1;
        const phase: CreateProjectPhase = cmd.command.startsWith('git init')
          ? 'git-init'
          : 'installing';
        emit(onProgress, phase, cmd.label, stepIdx, totalSteps, 'system', `> ${cmd.command}\n`);
        const res = await execCommand(cmd.command, plan.targetDir, (stream, chunk) => {
          emit(onProgress, phase, cmd.label, stepIdx, totalSteps, stream, chunk);
        });
        if (res.exitCode !== 0) {
          const msg = `Falha na etapa "${cmd.label}" (código ${res.exitCode}).`;
          emit(onProgress, 'error', msg, stepIdx, totalSteps, 'stderr', `${msg}\n`);
          return { ok: false, error: msg };
        }
      }
    } else {
      const firstCmd = plan.commands[0];
      const hasParentScaffold = firstCmd?.cwd === 'parent';

      if (hasParentScaffold) {
        stepIdx = 1;
        emit(
          onProgress,
          'scaffolding',
          firstCmd.label,
          stepIdx,
          totalSteps,
          'system',
          `> ${firstCmd.command}\n`
        );
        const res = await execCommand(firstCmd.command, parentDir, (stream, chunk) => {
          emit(onProgress, 'scaffolding', firstCmd.label, stepIdx, totalSteps, stream, chunk);
        });
        if (res.exitCode !== 0) {
          const msg = `Falha ao criar estrutura base "${firstCmd.label}" (código ${res.exitCode}).`;
          emit(onProgress, 'error', msg, stepIdx, totalSteps, 'stderr', `${msg}\n`);
          return { ok: false, error: msg };
        }
      }

      if (!fsOps.existsSync(plan.targetDir)) {
        fsOps.mkdirSync(plan.targetDir, { recursive: true });
      }

      if (plan.files.length > 0) {
        stepIdx += 1;
        emit(
          onProgress,
          'writing-files',
          `Gerando ${plan.files.length} arquivo(s) da stack...`,
          stepIdx,
          totalSteps,
          'system'
        );
        for (const file of plan.files) {
          const fullPath = path.join(plan.targetDir, file.relativePath);
          const dir = path.dirname(fullPath);
          if (!fsOps.existsSync(dir)) {
            fsOps.mkdirSync(dir, { recursive: true });
          }
          fsOps.writeFileSync(fullPath, file.content, 'utf-8');
        }
      }

      const startIdx = hasParentScaffold ? 1 : 0;
      for (let i = startIdx; i < plan.commands.length; i += 1) {
        const cmd = plan.commands[i];
        stepIdx += 1;
        const phase: CreateProjectPhase = cmd.command.startsWith('git init')
          ? 'git-init'
          : 'installing';
        emit(onProgress, phase, cmd.label, stepIdx, totalSteps, 'system', `> ${cmd.command}\n`);
        const res = await execCommand(cmd.command, plan.targetDir, (stream, chunk) => {
          emit(onProgress, phase, cmd.label, stepIdx, totalSteps, stream, chunk);
        });
        if (res.exitCode !== 0) {
          const msg = `Falha na etapa "${cmd.label}" (código ${res.exitCode}).`;
          emit(onProgress, 'error', msg, stepIdx, totalSteps, 'stderr', `${msg}\n`);
          return { ok: false, error: msg };
        }
      }
    }

    emit(
      onProgress,
      'done',
      `Projeto ${plan.sanitizedName} criado com sucesso!`,
      totalSteps,
      totalSteps,
      'system',
      `Projeto pronto em: ${plan.targetDir}\n`
    );

    return { ok: true, projectPath: plan.targetDir, notes: plan.notes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(onProgress, 'error', msg, 0, 1, 'stderr', `${msg}\n`);
    return { ok: false, error: msg };
  }
}
