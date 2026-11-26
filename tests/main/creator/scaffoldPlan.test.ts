import path from 'path';
import { describe, expect, it } from 'vitest';
import { buildScaffoldPlan } from '../../../src/main/creator/scaffoldPlan';
import type { CreateProjectInput } from '../../../src/shared/types';

function makeStackInput(overrides: Partial<NonNullable<CreateProjectInput['stack']>> = {}, rootOverrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
  return {
    mode: 'stack',
    projectName: 'My App',
    parentDir: 'C:\\Projects',
    initGit: true,
    installDeps: true,
    stack: {
      platform: 'web',
      language: 'typescript',
      frameworkId: 'nextjs',
      database: 'sqlite',
      orm: 'prisma',
      styling: 'tailwind',
      auth: 'authjs',
      packageManager: 'pnpm',
      versionMode: 'latest',
      includeDocker: false,
      includeTests: false,
      ...overrides
    },
    ...rootOverrides
  };
}

describe('scaffoldPlan', () => {
  it('validates parentDir, templateRepo, stack and frameworkId', () => {
    expect(() =>
      buildScaffoldPlan({ mode: 'stack', projectName: 'app', parentDir: '   ' })
    ).toThrow(/pasta de destino/);

    expect(() =>
      buildScaffoldPlan({ mode: 'github-template', projectName: 'app', parentDir: 'C:\\P' })
    ).toThrow(/repositório template/);

    expect(() =>
      buildScaffoldPlan({ mode: 'stack', projectName: 'app', parentDir: 'C:\\P' })
    ).toThrow(/Configuração de stack/);

    expect(() => buildScaffoldPlan(makeStackInput({ frameworkId: 'invalid' }))).toThrow(
      /Framework desconhecido/
    );
  });

  it('builds plan for GitHub/public template mode', () => {
    const plan = buildScaffoldPlan({
      mode: 'github-template',
      projectName: 'My Template App',
      parentDir: 'C:\\Projects',
      initGit: true,
      installDeps: true,
      packageManager: 'yarn',
      templateRepo: {
        fullName: 'KaneeSell/template-next-prisma-auth-mui',
        cloneUrl: 'https://github.com/KaneeSell/template-next-prisma-auth-mui.git',
        defaultBranch: ''
      }
    });

    expect(plan.targetDir).toBe(path.join('C:\\Projects', 'my-template-app'));
    expect(plan.commands.map((c) => c.command)).toEqual([
      'git clone --depth 1 --branch main "https://github.com/KaneeSell/template-next-prisma-auth-mui.git" "my-template-app"',
      'yarn install',
      'git init'
    ]);

    const bunTplPlan = buildScaffoldPlan({
      mode: 'public-template',
      projectName: 'bun-app',
      parentDir: 'C:\\Projects',
      installDeps: true,
      packageManager: 'bun',
      templateRepo: {
        fullName: 'org/repo',
        cloneUrl: 'https://github.com/org/repo.git',
        defaultBranch: 'main'
      }
    });
    expect(bunTplPlan.commands[1].command).toBe('bun install');

    const pinnedFallback = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'nextjs',
        language: 'javascript',
        database: 'postgresql',
        orm: 'prisma',
        styling: 'none',
        auth: 'none',
        versionMode: 'pinned',
        pinnedVersion: ''
      }),
      null
    );
    expect(pinnedFallback.commands[0].command).toContain('create-next-app@latest');
    expect(pinnedFallback.commands[0].command).toContain('--js');
    expect(pinnedFallback.commands[0].command).toContain('--no-tailwind');
    expect(
      pinnedFallback.files.find((f) => f.relativePath === 'prisma/schema.prisma')?.content
    ).toContain('provider = "postgresql"');

    const jsExpress = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'express',
        language: 'javascript',
        database: 'none',
        orm: 'none',
        styling: 'none',
        auth: 'none'
      })
    );
    expect(jsExpress.files.some((f) => f.relativePath === 'src/index.js')).toBe(true);
  });

  it('builds plan for Next.js + Prisma + SQLite + Auth.js + Pinned Version', () => {
    const plan = buildScaffoldPlan(
      makeStackInput({
        versionMode: 'pinned',
        pinnedVersion: null,
        includeDocker: true,
        includeTests: true
      }),
      {
        frameworkId: 'nextjs',
        packageName: 'next',
        provider: 'npm',
        latestVersion: '15.2.0',
        monthlyDownloads: 1000,
        description: null,
        homepage: null,
        source: 'live',
        fetchedAt: ''
      }
    );

    expect(plan.commands[0].command).toContain('create-next-app@15.2.0');
    expect(plan.commands[0].command).toContain('--tailwind');
    expect(plan.commands.some((c) => c.command.includes('pnpm install'))).toBe(true);
    expect(plan.commands.some((c) => c.command.includes('pnpm add @prisma/client next-auth'))).toBe(
      true
    );
    expect(plan.commands.some((c) => c.command.includes('pnpm add -D prisma vitest'))).toBe(true);
    expect(plan.files.some((f) => f.relativePath === 'prisma/schema.prisma')).toBe(true);
    expect(plan.files.some((f) => f.relativePath === 'Dockerfile')).toBe(true);
  });

  it('covers Drizzle, TypeORM, Mongoose, MUI, Better Auth, JWT and Docker DB services', () => {
    const drizzlePg = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'express',
        database: 'postgresql',
        orm: 'drizzle',
        styling: 'mui',
        auth: 'better-auth',
        packageManager: 'bun',
        includeDocker: true
      })
    );
    expect(drizzlePg.files.some((f) => f.relativePath === 'drizzle.config.ts')).toBe(true);
    expect(drizzlePg.files.some((f) => f.relativePath === 'docker-compose.yml')).toBe(true);
    expect(drizzlePg.commands.some((c) => c.command.includes('bun add -d'))).toBe(true);

    const mongoPlan = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'fastify',
        language: 'javascript',
        database: 'mongodb',
        orm: 'mongoose',
        styling: 'tailwind',
        auth: 'jwt',
        packageManager: 'npm',
        includeDocker: true,
        includeTests: true
      })
    );
    expect(mongoPlan.files.some((f) => f.relativePath === 'src/index.js')).toBe(true);
    expect(mongoPlan.files.some((f) => f.relativePath === 'docker-compose.yml')).toBe(true);

    const tsJwtPlan = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'express',
        language: 'typescript',
        database: 'none',
        orm: 'none',
        styling: 'none',
        auth: 'jwt',
        packageManager: 'npm'
      })
    );
    expect(tsJwtPlan.commands.some((c) => c.command.includes('@types/jsonwebtoken'))).toBe(true);

    const mysqlPrisma = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'hono',
        database: 'mysql',
        orm: 'prisma',
        language: 'javascript',
        styling: 'none',
        auth: 'none',
        includeDocker: true
      })
    );
    expect(mysqlPrisma.files.find((f) => f.relativePath === 'prisma/schema.prisma')?.content).toContain(
      'provider = "mysql"'
    );
    expect(mysqlPrisma.files.some((f) => f.relativePath === 'src/lib/prisma.js')).toBe(true);

    const mongoPrisma = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'nestjs',
        database: 'mongodb',
        orm: 'prisma',
        styling: 'none',
        auth: 'none',
        packageManager: 'yarn'
      })
    );
    expect(
      mongoPrisma.files.find((f) => f.relativePath === 'prisma/schema.prisma')?.content
    ).toContain('@db.ObjectId');

    const typeormPlan = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'nestjs',
        database: 'supabase',
        orm: 'typeorm',
        styling: 'none',
        auth: 'none'
      })
    );
    expect(typeormPlan.files.find((f) => f.relativePath === '.env')?.content).toContain(
      'NEXT_PUBLIC_SUPABASE_URL'
    );

    const drizzleMysql = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'node-cli',
        database: 'mysql',
        orm: 'drizzle',
        styling: 'none',
        auth: 'none'
      })
    );
    expect(
      drizzleMysql.files.find((f) => f.relativePath === 'drizzle.config.ts')?.content
    ).toContain("dialect: 'mysql'");

    const drizzleSqlite = buildScaffoldPlan(
      makeStackInput({
        frameworkId: 'node-cli',
        database: 'sqlite',
        orm: 'drizzle',
        styling: 'none',
        auth: 'none'
      })
    );
    expect(
      drizzleSqlite.files.find((f) => f.relativePath === 'drizzle.config.ts')?.content
    ).toContain("dialect: 'sqlite'");
  });

  it('covers all remaining framework generators (Vite, Astro, Nuxt, SvelteKit, Electron, Expo, Tauri, Python, PHP, Go, Rust, .NET, Flutter, Spring)', () => {
    const ids = [
      'vite-react',
      'vite-vue',
      'astro',
      'nuxt',
      'sveltekit',
      'electron-vite',
      'expo',
      'tauri',
      'fastapi',
      'python-cli',
      'django',
      'laravel',
      'go-gin',
      'rust-axum',
      'dotnet-webapi',
      'flutter',
      'spring-boot'
    ];

    for (const id of ids) {
      const plan = buildScaffoldPlan(
        makeStackInput({
          frameworkId: id,
          language: id === 'fastapi' || id === 'python-cli' ? 'python' : 'typescript',
          database: 'none',
          orm: id === 'fastapi' ? 'sqlalchemy' : id === 'python-cli' ? 'sqlmodel' : 'none',
          styling: 'none',
          auth: 'none',
          includeDocker: id === 'fastapi',
          includeTests: id === 'fastapi'
        })
      );
      expect(plan.sanitizedName).toBe('my-app');
    }

    // Also cover javascript branch for vite-react, astro, sveltekit, electron-vite and no-installDeps
    const jsVite = buildScaffoldPlan(
      makeStackInput(
        { frameworkId: 'vite-react', language: 'javascript', database: 'none', orm: 'none', styling: 'none', auth: 'none' },
        { installDeps: false, initGit: false }
      )
    );
    expect(jsVite.commands[0].command).toContain('--template react');

    const jsAstro = buildScaffoldPlan(
      makeStackInput(
        { frameworkId: 'astro', language: 'javascript', database: 'none', orm: 'none', styling: 'none', auth: 'none' },
        { installDeps: false, initGit: false }
      )
    );
    expect(jsAstro.commands[0].command).toContain('--typescript relaxed');

    const jsSvelte = buildScaffoldPlan(
      makeStackInput(
        { frameworkId: 'sveltekit', language: 'javascript', database: 'none', orm: 'none', styling: 'none', auth: 'none' },
        { installDeps: false, initGit: false }
      )
    );
    expect(jsSvelte.commands[0].command).toContain('--types jsdoc');

    const jsElectron = buildScaffoldPlan(
      makeStackInput(
        { frameworkId: 'electron-vite', language: 'javascript', database: 'none', orm: 'none', styling: 'none', auth: 'none' },
        { installDeps: false, initGit: false }
      )
    );
    expect(jsElectron.commands[0].command).toContain('--template react');

    const noInstallPythonGo = buildScaffoldPlan(
      makeStackInput(
        { frameworkId: 'fastapi', language: 'python', database: 'none', orm: 'none', styling: 'none', auth: 'none' },
        { installDeps: false, initGit: false }
      )
    );
    expect(noInstallPythonGo.commands).toHaveLength(0);
    expect(noInstallPythonGo.files.some((f) => f.relativePath === '.gitignore')).toBe(true);

    const noInstallGo = buildScaffoldPlan(
      makeStackInput(
        { frameworkId: 'go-gin', language: 'go', database: 'none', orm: 'none', styling: 'none', auth: 'none', includeCi: true },
        { installDeps: false, initGit: false }
      )
    );
    expect(noInstallGo.commands).toHaveLength(1);
    expect(noInstallGo.files.some((f) => f.relativePath === '.github/workflows/ci.yml')).toBe(true);

    const cliJsFull = buildScaffoldPlan(
      makeStackInput(
        {
          platform: 'cli',
          frameworkId: 'node-cli',
          language: 'javascript',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          linter: 'biome',
          license: 'mit',
          description: 'My CLI tool',
          author: 'KaneeSell',
          includeTests: true,
          includeCi: true
        },
        { installDeps: false, initGit: false }
      )
    );
    expect(cliJsFull.files.some((f) => f.relativePath === 'tests/index.test.mjs')).toBe(true);
    expect(cliJsFull.files.some((f) => f.relativePath === 'biome.json')).toBe(true);
    expect(cliJsFull.files.some((f) => f.relativePath === 'LICENSE')).toBe(true);
    expect(cliJsFull.files.some((f) => f.relativePath === 'README.md')).toBe(true);
    expect(cliJsFull.files.some((f) => f.relativePath === '.github/workflows/ci.yml')).toBe(true);
    expect(cliJsFull.files.find((f) => f.relativePath === 'package.json')?.content).toContain(
      '"author": "KaneeSell"'
    );

    const rustCiApache = buildScaffoldPlan(
      makeStackInput(
        {
          platform: 'backend',
          frameworkId: 'rust-axum',
          language: 'rust',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          license: 'apache-2.0',
          includeCi: true
        },
        { installDeps: false, initGit: false }
      )
    );
    expect(rustCiApache.files.find((f) => f.relativePath === 'LICENSE')?.content).toContain(
      'Apache License'
    );
    expect(
      rustCiApache.files.find((f) => f.relativePath === '.github/workflows/ci.yml')?.content
    ).toContain('cargo test');

    const pythonCiEslint = buildScaffoldPlan(
      makeStackInput(
        {
          platform: 'backend',
          frameworkId: 'fastapi',
          language: 'python',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          includeTests: true,
          includeCi: true
        },
        { installDeps: false, initGit: false }
      )
    );
    expect(
      pythonCiEslint.files.find((f) => f.relativePath === '.github/workflows/ci.yml')?.content
    ).toContain('pytest');

    const eslintPrettierPlan = buildScaffoldPlan(
      makeStackInput(
        {
          frameworkId: 'hono',
          language: 'typescript',
          database: 'none',
          orm: 'none',
          styling: 'none',
          auth: 'none',
          linter: 'eslint-prettier',
          license: 'mit',
          author: ''
        },
        { installDeps: true, initGit: false }
      )
    );
    expect(eslintPrettierPlan.files.some((f) => f.relativePath === '.prettierrc')).toBe(true);
    expect(eslintPrettierPlan.files.find((f) => f.relativePath === 'LICENSE')?.content).toContain(
      'Nexus User'
    );
  });
});
