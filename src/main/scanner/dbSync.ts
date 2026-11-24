import fs from 'fs';
import path from 'path';
import { getPrisma } from '../db/prisma';
import { scanWorkspace } from './workspaceScanner';

export interface SyncProgressInfo {
  message: string;
  current: number;
  total: number;
}

export interface SyncDatabaseOptions {
  targetPath?: string | null;
  projectQuery?: string | null;
  depth?: number;
  onProgress?: (info: SyncProgressInfo) => void;
}

export interface SyncSummary {
  scannedWorkspaces: number;
  updatedProjects: number;
  missingProjects: string[];
  errors: string[];
}

export async function syncDatabase(options: SyncDatabaseOptions = {}): Promise<SyncSummary> {
  const prisma = getPrisma();
  const missingProjects = new Set<string>();
  const errors: string[] = [];
  const updatedProjectIds = new Set<string>();
  let scannedWorkspaces = 0;

  const emit = (message: string, current: number, total: number): void => {
    options.onProgress?.({ message, current, total });
  };

  if (options.targetPath) {
    const resolved = path.resolve(options.targetPath);
    if (!fs.existsSync(resolved)) {
      missingProjects.add(resolved);
      errors.push(`Caminho não encontrado no disco: ${resolved}`);
    } else {
      emit(`Sincronizando ${resolved}...`, 0, 1);
      const result = await scanWorkspace(resolved, () => {}, { depth: options.depth });
      scannedWorkspaces += 1;
      for (const p of result.projects) updatedProjectIds.add(p.id);
      emit(`Sincronizado: ${result.projects.length} projeto(s).`, 1, 1);
    }

    return {
      scannedWorkspaces,
      updatedProjects: updatedProjectIds.size,
      missingProjects: Array.from(missingProjects),
      errors
    };
  }

  if (options.projectQuery) {
    const q = options.projectQuery.trim().toLowerCase();
    const allProjects = await prisma.projectRecord.findMany();
    const matched = allProjects.filter(
      (p) =>
        p.name.toLowerCase() === q ||
        path.basename(p.path).toLowerCase() === q ||
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q)
    );

    if (matched.length === 0) {
      const cwd = process.cwd();
      if (fs.existsSync(cwd)) {
        emit(`Projeto não encontrado na DB; escaneando ${cwd}...`, 0, 1);
        const result = await scanWorkspace(cwd, () => {}, { depth: options.depth });
        scannedWorkspaces += 1;
        for (const p of result.projects) updatedProjectIds.add(p.id);
        emit(`Sincronizado: ${result.projects.length} projeto(s).`, 1, 1);
      }
    } else {
      for (let i = 0; i < matched.length; i += 1) {
        const proj = matched[i];
        emit(`Sincronizando ${proj.name}...`, i, matched.length);
        if (!fs.existsSync(proj.path)) {
          missingProjects.add(proj.path);
          continue;
        }
        try {
          const result = await scanWorkspace(proj.path, () => {}, { depth: 1 });
          scannedWorkspaces += 1;
          for (const p of result.projects) updatedProjectIds.add(p.id);
        } catch (err) {
          errors.push(`${proj.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      emit(`Sincronização concluída (${updatedProjectIds.size} projeto(s)).`, matched.length, matched.length);
    }

    return {
      scannedWorkspaces,
      updatedProjects: updatedProjectIds.size,
      missingProjects: Array.from(missingProjects),
      errors
    };
  }

  const [workspaces, projects] = await Promise.all([
    prisma.workspaceHistory.findMany({
      orderBy: [{ isPinned: 'desc' }, { lastOpenedAt: 'desc' }]
    }),
    prisma.projectRecord.findMany()
  ]);

  for (const p of projects) {
    if (!fs.existsSync(p.path)) {
      missingProjects.add(p.path);
    }
  }

  const scanTargets: string[] = [];
  const seen = new Set<string>();
  const addTarget = (rawPath: string): void => {
    const resolved = path.resolve(rawPath);
    const key = resolved.toLowerCase();
    if (!seen.has(key) && fs.existsSync(resolved)) {
      seen.add(key);
      scanTargets.push(resolved);
    }
  };

  for (const ws of workspaces) addTarget(ws.path);
  for (const proj of projects) addTarget(proj.path);
  if (scanTargets.length === 0) {
    addTarget(process.cwd());
  }

  for (let i = 0; i < scanTargets.length; i += 1) {
    const target = scanTargets[i];
    emit(`Sincronizando ${path.basename(target) || target}...`, i, scanTargets.length);
    try {
      const result = await scanWorkspace(target, () => {}, { depth: options.depth });
      scannedWorkspaces += 1;
      for (const p of result.projects) updatedProjectIds.add(p.id);
    } catch (err) {
      errors.push(`${target}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  emit(
    `Sincronização concluída: ${updatedProjectIds.size} projeto(s) atualizado(s).`,
    scanTargets.length,
    Math.max(scanTargets.length, 1)
  );

  return {
    scannedWorkspaces,
    updatedProjects: updatedProjectIds.size,
    missingProjects: Array.from(missingProjects),
    errors
  };
}
