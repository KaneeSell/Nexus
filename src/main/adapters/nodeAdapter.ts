import fs from 'fs/promises';
import path from 'path';
import type { PackageManager, ProjectScript } from '../../shared/types';
import type { InspectedProjectInfo, ProjectAdapter } from './types';

interface RawPackageJson {
  name?: string;
  version?: string;
  description?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function detectPackageManager(dirPath: string, pkg: RawPackageJson): Promise<PackageManager> {
  if (typeof pkg.packageManager === 'string') {
    if (pkg.packageManager.startsWith('pnpm@')) return 'pnpm';
    if (pkg.packageManager.startsWith('yarn@')) return 'yarn';
    if (pkg.packageManager.startsWith('bun@')) return 'bun';
    if (pkg.packageManager.startsWith('npm@')) return 'npm';
  }

  if (await fileExists(path.join(dirPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fileExists(path.join(dirPath, 'yarn.lock'))) return 'yarn';
  if ((await fileExists(path.join(dirPath, 'bun.lockb'))) || (await fileExists(path.join(dirPath, 'bun.lock')))) {
    return 'bun';
  }
  return 'npm';
}

export class NodePackageAdapter implements ProjectAdapter {
  readonly id = 'node';
  readonly label = 'Node.js (package.json)';

  async detect(dirPath: string): Promise<boolean> {
    return fileExists(path.join(dirPath, 'package.json'));
  }

  async inspect(dirPath: string): Promise<InspectedProjectInfo | null> {
    const pkgPath = path.join(dirPath, 'package.json');
    try {
      const rawContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(rawContent) as RawPackageJson;
      const packageManager = await detectPackageManager(dirPath, pkg);
      const hasNodeModules = await fileExists(path.join(dirPath, 'node_modules'));

      const scripts: ProjectScript[] = pkg.scripts
        ? Object.entries(pkg.scripts).map(([name, command]) => ({
            name,
            command: String(command)
          }))
        : [];

      return {
        name: pkg.name?.trim() || path.basename(dirPath),
        path: dirPath,
        adapterType: this.id,
        packageManager,
        version: pkg.version,
        description: pkg.description,
        hasNodeModules,
        scripts
      };
    } catch {
      return null;
    }
  }
}
