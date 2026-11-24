import fs from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import type { PrismaClient as PrismaClientType } from '@prisma/client';

const nodeRequire = createRequire(__filename);

interface ElectronAppLike {
  isPackaged?: boolean;
  getPath: (name: string) => string;
}

function getElectronApp(): ElectronAppLike | null {
  if (!process.versions.electron) return null;
  try {
    const electronMod = nodeRequire('electron') as { app?: ElectronAppLike };
    return electronMod?.app ?? null;
  } catch {
    return null;
  }
}

function resolvePackagedUserDataDir(): string {
  if (process.env.NEXUS_USER_DATA) {
    return process.env.NEXUS_USER_DATA;
  }
  const baseConfigDir =
    process.platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');

  const candidates = [path.join(baseConfigDir, 'Nexus'), path.join(baseConfigDir, 'nexus')];
  const existing = candidates.find((dir) => fs.existsSync(path.join(dir, 'nexus.db')));
  return existing ?? candidates[0];
}

export function resolveDatabasePath(): string {
  const electronApp = getElectronApp();
  if (electronApp?.isPackaged) {
    const dbPath = path.join(electronApp.getPath('userData'), 'nexus.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    return dbPath;
  }

  if (process.env.NEXUS_RESOURCES_DIR || process.env.NEXUS_APP_EXE) {
    const dbPath = path.join(resolvePackagedUserDataDir(), 'nexus.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    return dbPath;
  }

  const envUrl = process.env.DATABASE_URL;
  if (envUrl && !envUrl.startsWith('file:./') && !envUrl.startsWith('file:.\\')) {
    return envUrl.replace(/^file:/, '');
  }

  const candidates = [
    path.resolve(__dirname, '../../prisma/dev.db'),
    path.resolve(process.cwd(), 'prisma/dev.db')
  ];

  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  const dbPath = existing ?? candidates[0];
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return dbPath;
}

function resolveDatabaseUrl(): string {
  const dbPath = resolveDatabasePath();
  return `file:${dbPath.replace(/\\/g, '/')}`;
}

let prismaInstance: PrismaClientType | null = null;

function loadPrismaClientClass(): typeof PrismaClientType {
  const electronApp = getElectronApp();
  const resourcesDir = electronApp?.isPackaged
    ? process.resourcesPath
    : process.env.NEXUS_RESOURCES_DIR;

  if (resourcesDir) {
    const unpackedClientPath = path.join(
      resourcesDir,
      'app.asar.unpacked',
      'node_modules',
      '.prisma',
      'client',
      'default.js'
    );
    if (fs.existsSync(unpackedClientPath)) {
      const mod = nodeRequire(unpackedClientPath) as { PrismaClient: typeof PrismaClientType };
      return mod.PrismaClient;
    }
  }

  const mod = nodeRequire('@prisma/client') as { PrismaClient: typeof PrismaClientType };
  return mod.PrismaClient;
}

export function getPrisma(): PrismaClientType {
  if (!prismaInstance) {
    const PrismaClientCtor = loadPrismaClientClass();
    prismaInstance = new PrismaClientCtor({
      datasources: {
        db: {
          url: resolveDatabaseUrl()
        }
      }
    });
  }
  return prismaInstance;
}

export async function ensureDatabaseReady(): Promise<void> {
  const prisma = getPrisma();
  const statements = [
    'PRAGMA foreign_keys = ON;',
    `CREATE TABLE IF NOT EXISTS "WorkspaceHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "path" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "lastOpenedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isPinned" BOOLEAN NOT NULL DEFAULT false
    );`,
    'CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceHistory_path_key" ON "WorkspaceHistory"("path");',
    `CREATE TABLE IF NOT EXISTS "ProjectRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "path" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "adapterType" TEXT NOT NULL DEFAULT 'node',
      "packageManager" TEXT NOT NULL DEFAULT 'npm',
      "lastScannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );`,
    'CREATE UNIQUE INDEX IF NOT EXISTS "ProjectRecord_path_key" ON "ProjectRecord"("path");',
    `CREATE TABLE IF NOT EXISTS "ProjectCommand" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "command" TEXT NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'package.json',
      "adapterType" TEXT NOT NULL DEFAULT 'node',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ProjectCommand_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    'CREATE UNIQUE INDEX IF NOT EXISTS "ProjectCommand_projectId_name_key" ON "ProjectCommand"("projectId", "name");',
    `CREATE TABLE IF NOT EXISTS "Pipeline" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Pipeline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "PipelineStep" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "pipelineId" TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "kind" TEXT NOT NULL DEFAULT 'script',
      "command" TEXT NOT NULL,
      "onErrorAction" TEXT NOT NULL DEFAULT 'stop',
      "onErrorCommand" TEXT,
      "onSuccessCommand" TEXT,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      CONSTRAINT "PipelineStep_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "ExecutionRun" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "pipelineId" TEXT,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" DATETIME,
      "logs" TEXT NOT NULL DEFAULT '',
      CONSTRAINT "ExecutionRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ExecutionRun_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "AppSetting" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL
    );`
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
