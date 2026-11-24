import fs from 'fs/promises';
import path from 'path';
import type {
  ScannedProject,
  ScanProgressEvent,
  WorkspaceScanOptions,
  WorkspaceScanResult
} from '../../shared/types';
import { NodePackageAdapter } from '../adapters/nodeAdapter';
import type { InspectedProjectInfo, ProjectAdapter } from '../adapters/types';
import { getPrisma } from '../db/prisma';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  'coverage',
  '.vscode',
  '.idea'
]);

const adapters: ProjectAdapter[] = [new NodePackageAdapter()];

async function detectWithAdapters(dirPath: string): Promise<InspectedProjectInfo | null> {
  for (const adapter of adapters) {
    if (await adapter.detect(dirPath)) {
      const info = await adapter.inspect(dirPath);
      if (info) return info;
    }
  }
  return null;
}

async function listSubdirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.'))
      .map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

export async function scanWorkspace(
  rawTargetPath: string,
  emitProgress: (event: ScanProgressEvent) => void,
  options?: WorkspaceScanOptions
): Promise<WorkspaceScanResult> {
  const targetPath = path.resolve(rawTargetPath);
  const maxDepth = Math.max(1, Math.min(5, options?.depth ?? 2));
  const prisma = getPrisma();

  emitProgress({
    phase: 'starting',
    message: `Verificando pasta ${targetPath}...`,
    current: 0,
    total: 1
  });

  const stat = await fs.stat(targetPath);
  if (!stat.isDirectory()) {
    throw new Error(`O caminho selecionado não é uma pasta válida: ${targetPath}`);
  }

  const rootProject = await detectWithAdapters(targetPath);
  const discovered: InspectedProjectInfo[] = [];
  let mode: WorkspaceScanResult['mode'] = 'empty';

  if (rootProject) {
    mode = 'single';
    emitProgress({
      phase: 'inspecting',
      message: `Projeto detectado na raiz: ${rootProject.name} (lendo package.json)...`,
      current: 1,
      total: 1
    });
    discovered.push(rootProject);
  } else {
    emitProgress({
      phase: 'listing',
      message: `Listando subpastas em ${path.basename(targetPath)} (profundidade ${maxDepth})...`,
      current: 0,
      total: 1
    });

    const level1Dirs = await listSubdirectories(targetPath);
    const totalCandidates = Math.max(level1Dirs.length, 1);

    const walk = async (dir: string, depth: number, rootIndex: number): Promise<void> => {
      const relLabel = path.relative(targetPath, dir) || path.basename(dir);
      emitProgress({
        phase: 'inspecting',
        message: `Consultando ${relLabel} (${rootIndex + 1}/${level1Dirs.length})...`,
        current: rootIndex + 1,
        total: totalCandidates
      });

      const found = await detectWithAdapters(dir);
      if (found) {
        discovered.push(found);
        return;
      }

      if (depth < maxDepth) {
        const children = await listSubdirectories(dir);
        for (const child of children) {
          await walk(child, depth + 1, rootIndex);
        }
      }
    };

    for (let i = 0; i < level1Dirs.length; i += 1) {
      await walk(level1Dirs[i], 1, i);
    }

    mode = discovered.length > 0 ? 'multi' : 'empty';
  }

  emitProgress({
    phase: 'syncing',
    message: `Sincronizando ${discovered.length} projeto(s) com o banco SQLite...`,
    current: discovered.length,
    total: Math.max(discovered.length, 1)
  });

  await prisma.workspaceHistory.upsert({
    where: { path: targetPath },
    update: {
      name: path.basename(targetPath) || targetPath,
      lastOpenedAt: new Date()
    },
    create: {
      path: targetPath,
      name: path.basename(targetPath) || targetPath,
      lastOpenedAt: new Date()
    }
  });

  const projects: ScannedProject[] = [];

  for (const item of discovered) {
    const normalizedPath = path.resolve(item.path);
    const record = await prisma.projectRecord.upsert({
      where: { path: normalizedPath },
      update: {
        name: item.name,
        adapterType: item.adapterType,
        packageManager: item.packageManager,
        lastScannedAt: new Date()
      },
      create: {
        path: normalizedPath,
        name: item.name,
        adapterType: item.adapterType,
        packageManager: item.packageManager,
        lastScannedAt: new Date()
      }
    });

    const uniqueScripts = Array.from(
      new Map(item.scripts.map((s) => [s.name, s])).values()
    );

    await prisma.$transaction(async (tx) => {
      await tx.projectCommand.deleteMany({ where: { projectId: record.id } });
      if (uniqueScripts.length > 0) {
        await tx.projectCommand.createMany({
          data: uniqueScripts.map((s) => ({
            projectId: record.id,
            name: s.name,
            command: s.command,
            source: 'package.json',
            adapterType: item.adapterType
          }))
        });
      }
    });

    projects.push({
      id: record.id,
      name: item.name,
      path: normalizedPath,
      adapterType: item.adapterType,
      packageManager: item.packageManager,
      version: item.version,
      description: item.description,
      hasNodeModules: item.hasNodeModules,
      scripts: item.scripts,
      lastScannedAt: record.lastScannedAt.toISOString()
    });
  }

  projects.sort((a, b) => a.name.localeCompare(b.name));

  emitProgress({
    phase: 'done',
    message:
      projects.length > 0
        ? `Pronto: ${projects.length} projeto(s) carregado(s).`
        : 'Nenhum projeto Node.js encontrado nesta pasta.',
    current: projects.length,
    total: Math.max(projects.length, 1)
  });

  return {
    targetPath,
    mode,
    projects
  };
}
