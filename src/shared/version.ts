import fs from 'fs';
import path from 'path';

declare const __NEXUS_VERSION__: string | undefined;

export interface ResolveVersionOptions {
  injectedVersion?: string;
  fallbackPaths?: string[];
}

/**
 * Resolves the Nexus version from build-time injection or package.json fallbacks.
 */
export function resolvePackageVersion(options: ResolveVersionOptions = {}): string {
  const buildVersion =
    options.injectedVersion !== undefined
      ? options.injectedVersion
      : typeof __NEXUS_VERSION__ === 'string'
        ? __NEXUS_VERSION__
        : '';

  if (buildVersion.trim()) {
    return buildVersion.trim();
  }

  const candidates = options.fallbackPaths ?? [
    path.resolve(__dirname, '../../package.json'),
    path.resolve(__dirname, '../package.json')
  ];

  for (const pkgPath of candidates) {
    if (fs.existsSync(pkgPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: unknown };
        if (typeof parsed.version === 'string' && parsed.version.trim()) {
          return parsed.version.trim();
        }
      } catch {
        // ignore invalid package.json
      }
    }
  }

  return '0.0.0';
}

/**
 * Returns the active Nexus application version.
 */
export function getNexusVersion(): string {
  return resolvePackageVersion();
}
