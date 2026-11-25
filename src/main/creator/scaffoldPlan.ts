import path from 'path';
import { getFrameworkById, sanitizeProjectName } from '../../shared/projectCatalog';
import type {
  CreateProjectInput,
  DatabaseOptionId,
  LivePackageMeta,
  PackageManager,
  ScaffoldCommandStep,
  ScaffoldGeneratedFile,
  ScaffoldPlanPreview,
  StackSelectionInput
} from '../../shared/types';

function pmInstallCmd(pm: PackageManager, packages: string[], dev = false): string {
  const list = packages.join(' ');
  if (pm === 'pnpm') return `pnpm add ${dev ? '-D ' : ''}${list}`;
  if (pm === 'yarn') return `yarn add ${dev ? '-D ' : ''}${list}`;
  if (pm === 'bun') return `bun add ${dev ? '-d ' : ''}${list}`;
  return `npm install ${dev ? '-D ' : ''}${list}`;
}

function pmBaseInstallCmd(pm: PackageManager): string {
  if (pm === 'pnpm') return 'pnpm install';
  if (pm === 'yarn') return 'yarn install';
  if (pm === 'bun') return 'bun install';
  return 'npm install';
}

function resolveVersionTag(
  stack: StackSelectionInput,
  resolvedMeta?: LivePackageMeta | null
): string {
  if (stack.versionMode === 'pinned') {
    const pinned = stack.pinnedVersion?.trim() || resolvedMeta?.latestVersion?.trim();
    if (pinned) return `@${pinned}`;
  }
  return '@latest';
}

function buildEnvExample(stack: StackSelectionInput): string {
  const lines: string[] = [];
  if (stack.database === 'sqlite') {
    lines.push('DATABASE_URL="file:./dev.db"');
  } else if (stack.database === 'postgresql' || stack.database === 'supabase') {
    lines.push('DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app?schema=public"');
  } else if (stack.database === 'mysql') {
    lines.push('DATABASE_URL="mysql://root:root@localhost:3306/app"');
  } else if (stack.database === 'mongodb') {
    lines.push('DATABASE_URL="mongodb://localhost:27017/app"');
  }

  if (stack.database === 'supabase') {
    lines.push('NEXT_PUBLIC_SUPABASE_URL=""');
    lines.push('NEXT_PUBLIC_SUPABASE_ANON_KEY=""');
  }

  if (stack.auth === 'authjs') {
    lines.push('AUTH_SECRET="change-me-to-a-random-32-char-secret"');
  } else if (stack.auth === 'better-auth') {
    lines.push('BETTER_AUTH_SECRET="change-me-to-a-random-32-char-secret"');
    lines.push('BETTER_AUTH_URL="http://localhost:3000"');
  } else if (stack.auth === 'jwt') {
    lines.push('JWT_SECRET="change-me-to-a-random-secret"');
  }

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

function buildPrismaSchema(database: DatabaseOptionId): string {
  const provider =
    database === 'postgresql' || database === 'supabase'
      ? 'postgresql'
      : database === 'mysql'
        ? 'mysql'
        : database === 'mongodb'
          ? 'mongodb'
          : 'sqlite';

  const idField =
    provider === 'mongodb'
      ? '  id        String   @id @default(auto()) @map("_id") @db.ObjectId'
      : '  id        String   @id @default(cuid())';

  return `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

model User {
${idField}
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
`;
}

function buildDockerFiles(
  sanitizedName: string,
  stack: StackSelectionInput
): ScaffoldGeneratedFile[] {
  const files: ScaffoldGeneratedFile[] = [];
  const isPython = stack.language === 'python';

  if (isPython) {
    files.push({
      relativePath: 'Dockerfile',
      content: `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`
    });
  } else {
    files.push({
      relativePath: 'Dockerfile',
      content: `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
`
    });
  }

  const services: string[] = [];
  if (stack.database === 'postgresql') {
    services.push(`  db:
    image: postgres:16-alpine
    container_name: ${sanitizedName}-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    ports:
      - "5432:5432"`);
  } else if (stack.database === 'mysql') {
    services.push(`  db:
    image: mysql:8
    container_name: ${sanitizedName}-mysql
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: app
    ports:
      - "3306:3306"`);
  } else if (stack.database === 'mongodb') {
    services.push(`  db:
    image: mongo:7
    container_name: ${sanitizedName}-mongo
    ports:
      - "27017:27017"`);
  }

  if (services.length > 0) {
    files.push({
      relativePath: 'docker-compose.yml',
      content: `services:\n${services.join('\n')}\n`
    });
  }

  return files;
}

function buildNodeStarterFiles(
  sanitizedName: string,
  stack: StackSelectionInput
): { files: ScaffoldGeneratedFile[]; deps: string[]; devDeps: string[] } {
  const isTs = stack.language === 'typescript';
  const files: ScaffoldGeneratedFile[] = [];
  const deps: string[] = [];
  const devDeps: string[] = [];
  const scripts: Record<string, string> = {};

  if (stack.frameworkId === 'express') {
    deps.push('express');
    if (isTs) devDeps.push('@types/express');
  } else if (stack.frameworkId === 'fastify') {
    deps.push('fastify');
  } else if (stack.frameworkId === 'hono') {
    deps.push('hono', '@hono/node-server');
  } else {
    deps.push('commander');
  }

  if (isTs) {
    devDeps.push('typescript', 'tsx', '@types/node');
    scripts.dev = 'tsx watch src/index.ts';
    scripts.build = 'tsc';
    scripts.start = 'node dist/index.js';
    files.push({
      relativePath: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            outDir: 'dist',
            rootDir: 'src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true
          },
          include: ['src']
        },
        null,
        2
      )
    });
  } else {
    scripts.dev = 'node --watch src/index.js';
    scripts.start = 'node src/index.js';
  }

  if (stack.includeTests) {
    scripts.test = 'vitest run';
  }

  files.push({
    relativePath: 'package.json',
    content: JSON.stringify(
      {
        name: sanitizedName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts
      },
      null,
      2
    )
  });

  const entryExt = isTs ? 'ts' : 'js';
  let entryCode = `console.log('Hello from ${sanitizedName}');\n`;
  if (stack.frameworkId === 'express') {
    entryCode = `import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: '${sanitizedName}' });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(\`Express listening on http://localhost:\${port}\`);
});
`;
  } else if (stack.frameworkId === 'fastify') {
    entryCode = `import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true, service: '${sanitizedName}' }));

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
`;
  } else if (stack.frameworkId === 'hono') {
    entryCode = `import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();
app.get('/health', (c) => c.json({ ok: true, service: '${sanitizedName}' }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(\`Hono listening on http://localhost:\${port}\`);
`;
  }

  files.push({
    relativePath: `src/index.${entryExt}`,
    content: entryCode
  });

  return { files, deps, devDeps };
}

export function buildScaffoldPlan(
  input: CreateProjectInput,
  resolvedMeta?: LivePackageMeta | null
): ScaffoldPlanPreview {
  const sanitizedName = sanitizeProjectName(input.projectName);
  const parentDir = input.parentDir.trim();
  if (!parentDir) {
    throw new Error('Selecione a pasta de destino onde o projeto será criado.');
  }

  const targetDir = path.join(parentDir, sanitizedName);
  const commands: ScaffoldCommandStep[] = [];
  const files: ScaffoldGeneratedFile[] = [];
  const notes: string[] = [];
  const pm: PackageManager = input.stack?.packageManager ?? input.packageManager ?? 'npm';

  if (input.mode === 'github-template' || input.mode === 'public-template') {
    if (!input.templateRepo?.cloneUrl) {
      throw new Error('Selecione um repositório template do GitHub para continuar.');
    }
    const branch = input.templateRepo.defaultBranch || 'main';
    commands.push({
      label: `Clonar template ${input.templateRepo.fullName}`,
      command: `git clone --depth 1 --branch ${branch} "${input.templateRepo.cloneUrl}" "${sanitizedName}"`,
      cwd: 'parent'
    });
    if (input.installDeps) {
      commands.push({
        label: `Instalar dependências (${pm})`,
        command: pmBaseInstallCmd(pm),
        cwd: 'project'
      });
    }
    if (input.initGit) {
      commands.push({
        label: 'Reinicializar repositório Git limpo',
        command: 'git init',
        cwd: 'project'
      });
    }
    notes.push(`Origem do template: ${input.templateRepo.fullName} (branch ${branch})`);
    return { targetDir, sanitizedName, commands, files, notes };
  }

  const stack = input.stack;
  if (!stack) {
    throw new Error('Configuração de stack não informada.');
  }

  const fw = getFrameworkById(stack.frameworkId);
  if (!fw) {
    throw new Error(`Framework desconhecido: ${stack.frameworkId}`);
  }

  const verTag = resolveVersionTag(stack, resolvedMeta);
  const isTs = stack.language === 'typescript';
  const nodeDeps: string[] = [];
  const nodeDevDeps: string[] = [];
  let isNodeEcosystem = false;

  switch (stack.frameworkId) {
    case 'nextjs': {
      isNodeEcosystem = true;
      const tsFlag = isTs ? '--ts' : '--js';
      const twFlag = stack.styling === 'tailwind' ? '--tailwind' : '--no-tailwind';
      commands.push({
        label: `Criar projeto Next.js (${verTag})`,
        command: `npx --yes create-next-app${verTag} "${sanitizedName}" ${tsFlag} --eslint --app --src-dir ${twFlag} --use-${pm} --yes`,
        cwd: 'parent'
      });
      break;
    }
    case 'vite-react':
    case 'vite-vue': {
      isNodeEcosystem = true;
      const base = stack.frameworkId === 'vite-react' ? 'react' : 'vue';
      const tpl = isTs ? `${base}-ts` : base;
      commands.push({
        label: `Criar projeto ${fw.name}`,
        command: `npm create vite${verTag} "${sanitizedName}" -- --template ${tpl}`,
        cwd: 'parent'
      });
      break;
    }
    case 'astro': {
      isNodeEcosystem = true;
      commands.push({
        label: 'Criar projeto Astro',
        command: `npm create astro${verTag} "${sanitizedName}" -- --template minimal --no-install --no-git --typescript ${isTs ? 'strict' : 'relaxed'}`,
        cwd: 'parent'
      });
      break;
    }
    case 'nuxt': {
      isNodeEcosystem = true;
      commands.push({
        label: 'Criar projeto Nuxt',
        command: `npx --yes nuxi${verTag} init "${sanitizedName}" --packageManager ${pm} --gitInit=false`,
        cwd: 'parent'
      });
      break;
    }
    case 'sveltekit': {
      isNodeEcosystem = true;
      commands.push({
        label: 'Criar projeto SvelteKit',
        command: `npx --yes sv${verTag} create "${sanitizedName}" --template minimal --types ${isTs ? 'ts' : 'jsdoc'} --no-add-ons --no-install`,
        cwd: 'parent'
      });
      break;
    }
    case 'nestjs': {
      isNodeEcosystem = true;
      commands.push({
        label: 'Criar projeto NestJS',
        command: `npx --yes @nestjs/cli${verTag} new "${sanitizedName}" --package-manager ${pm} --skip-git --skip-install`,
        cwd: 'parent'
      });
      break;
    }
    case 'electron-vite': {
      isNodeEcosystem = true;
      commands.push({
        label: 'Criar projeto Electron + Vite',
        command: `npm create @quick-start/electron${verTag} "${sanitizedName}" -- --template ${isTs ? 'react-ts' : 'react'}`,
        cwd: 'parent'
      });
      break;
    }
    case 'expo': {
      isNodeEcosystem = true;
      commands.push({
        label: 'Criar projeto Expo (React Native)',
        command: `npx --yes create-expo-app${verTag} "${sanitizedName}"`,
        cwd: 'parent'
      });
      break;
    }
    case 'tauri': {
      isNodeEcosystem = true;
      commands.push({
        label: 'Criar projeto Tauri',
        command: `npm create tauri-app${verTag} "${sanitizedName}" -- --manager ${pm} --template react-ts --yes`,
        cwd: 'parent'
      });
      break;
    }
    case 'express':
    case 'fastify':
    case 'hono':
    case 'node-cli': {
      isNodeEcosystem = true;
      const starter = buildNodeStarterFiles(sanitizedName, stack);
      files.push(...starter.files);
      nodeDeps.push(...starter.deps);
      nodeDevDeps.push(...starter.devDeps);
      break;
    }
    case 'fastapi':
    case 'python-cli': {
      const reqs =
        stack.frameworkId === 'fastapi' ? ['fastapi', 'uvicorn[standard]'] : ['typer'];
      if (stack.orm === 'sqlalchemy') reqs.push('sqlalchemy');
      if (stack.orm === 'sqlmodel') reqs.push('sqlmodel');
      if (stack.includeTests) reqs.push('pytest');

      files.push({
        relativePath: 'requirements.txt',
        content: `${reqs.join('\n')}\n`
      });
      files.push({
        relativePath: 'main.py',
        content:
          stack.frameworkId === 'fastapi'
            ? `from fastapi import FastAPI

app = FastAPI(title="${sanitizedName}")

@app.get("/health")
def health():
    return {"ok": True, "service": "${sanitizedName}"}
`
            : `import typer

app = typer.Typer()

@app.command()
def hello(name: str = "Nexus"):
    typer.echo(f"Hello {name}!")

if __name__ == "__main__":
    app()
`
      });
      if (input.installDeps) {
        commands.push({
          label: 'Criar ambiente virtual Python e instalar dependências',
          command: 'python -m venv .venv && .venv\\Scripts\\pip install -r requirements.txt',
          cwd: 'project'
        });
      }
      break;
    }
    case 'django': {
      commands.push({
        label: 'Criar projeto Django',
        command: `python -m django startproject "${sanitizedName}"`,
        cwd: 'parent'
      });
      break;
    }
    case 'laravel': {
      commands.push({
        label: 'Criar projeto Laravel',
        command: `composer create-project laravel/laravel "${sanitizedName}"`,
        cwd: 'parent'
      });
      break;
    }
    case 'go-gin': {
      commands.push({
        label: 'Inicializar módulo Go',
        command: `go mod init "${sanitizedName}"`,
        cwd: 'project'
      });
      files.push({
        relativePath: 'main.go',
        content: `package main

import "github.com/gin-gonic/gin"

func main() {
\tr := gin.Default()
\tr.GET("/health", func(c *gin.Context) {
\t\tc.JSON(200, gin.H{"ok": true, "service": "${sanitizedName}"})
\t})
\t_ = r.Run(":8080")
}
`
      });
      if (input.installDeps) {
        commands.push({
          label: 'Instalar Gin (go get)',
          command: 'go get github.com/gin-gonic/gin',
          cwd: 'project'
        });
      }
      break;
    }
    case 'rust-axum':
    case 'rust-cli': {
      commands.push({
        label: `Inicializar crate Rust (${fw.name})`,
        command: `cargo init "${sanitizedName}"`,
        cwd: 'parent'
      });
      break;
    }
    case 'dotnet-webapi': {
      commands.push({
        label: 'Criar API ASP.NET Core',
        command: `dotnet new webapi -n "${sanitizedName}"`,
        cwd: 'parent'
      });
      break;
    }
    case 'flutter': {
      commands.push({
        label: 'Criar app Flutter',
        command: `flutter create "${sanitizedName}"`,
        cwd: 'parent'
      });
      break;
    }
    default: {
      files.push({
        relativePath: 'README.md',
        content: `# ${sanitizedName}\n\nProjeto criado com ${fw.name} via Nexus.\n`
      });
      notes.push(`Para ${fw.name}, finalize a inicialização via Spring Initializr se desejar.`);
      break;
    }
  }

  if (isNodeEcosystem) {
    if (stack.orm === 'prisma') {
      nodeDeps.push('@prisma/client');
      nodeDevDeps.push('prisma');
      files.push({
        relativePath: 'prisma/schema.prisma',
        content: buildPrismaSchema(stack.database)
      });
      files.push({
        relativePath: isTs ? 'src/lib/prisma.ts' : 'src/lib/prisma.js',
        content: isTs
          ? `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
`
          : `import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
`
      });
    } else if (stack.orm === 'drizzle') {
      nodeDeps.push('drizzle-orm');
      nodeDevDeps.push('drizzle-kit');
      if (stack.database === 'sqlite') nodeDeps.push('better-sqlite3');
      if (stack.database === 'postgresql' || stack.database === 'supabase') nodeDeps.push('postgres');
      if (stack.database === 'mysql') nodeDeps.push('mysql2');

      files.push({
        relativePath: 'drizzle.config.ts',
        content: `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: '${stack.database === 'mysql' ? 'mysql' : stack.database === 'postgresql' || stack.database === 'supabase' ? 'postgresql' : 'sqlite'}'
});
`
      });
    } else if (stack.orm === 'typeorm') {
      nodeDeps.push('typeorm', 'reflect-metadata');
    } else if (stack.orm === 'mongoose') {
      nodeDeps.push('mongoose');
    }

    if (stack.styling === 'mui') {
      nodeDeps.push('@mui/material', '@emotion/react', '@emotion/styled', '@mui/icons-material');
    } else if (stack.styling === 'tailwind' && stack.frameworkId !== 'nextjs') {
      nodeDevDeps.push('tailwindcss');
    }

    if (stack.auth === 'authjs') {
      nodeDeps.push('next-auth');
    } else if (stack.auth === 'better-auth') {
      nodeDeps.push('better-auth');
    } else if (stack.auth === 'jwt') {
      nodeDeps.push('jsonwebtoken');
      if (isTs) nodeDevDeps.push('@types/jsonwebtoken');
    }

    if (stack.includeTests) {
      nodeDevDeps.push('vitest');
    }

    if (input.installDeps && commands.length > 0) {
      commands.push({
        label: `Instalar dependências base (${pm})`,
        command: pmBaseInstallCmd(pm),
        cwd: 'project'
      });
    }
    if (nodeDeps.length > 0 && input.installDeps !== false) {
      commands.push({
        label: 'Instalar pacotes da stack selecionada',
        command: pmInstallCmd(pm, nodeDeps, false),
        cwd: 'project'
      });
    }
    if (nodeDevDeps.length > 0 && input.installDeps !== false) {
      commands.push({
        label: 'Instalar dependências de desenvolvimento',
        command: pmInstallCmd(pm, nodeDevDeps, true),
        cwd: 'project'
      });
    }
  }

  const envContent = buildEnvExample(stack);
  if (envContent) {
    files.push({ relativePath: '.env.example', content: envContent });
    files.push({ relativePath: '.env', content: envContent });
  }

  if (stack.includeDocker) {
    files.push(...buildDockerFiles(sanitizedName, stack));
  }

  if (input.initGit) {
    commands.push({
      label: 'Inicializar repositório Git',
      command: 'git init',
      cwd: 'project'
    });
  }

  notes.push(`Stack: ${fw.name} (${stack.language}) | Versão: ${verTag.replace('@', '')}`);
  return { targetDir, sanitizedName, commands, files, notes };
}
