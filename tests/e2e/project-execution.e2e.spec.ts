import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;
let tempRoot: string;
let projectsDir: string;

test.describe('Nexus Created Project Execution E2E', () => {
  test.beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-e2e-exec-'));
    const userDataDir = path.join(tempRoot, 'userdata');
    projectsDir = path.join(tempRoot, 'projects');
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(projectsDir, { recursive: true });

    const dbPath = path.join(tempRoot, 'exec-e2e.db').replace(/\\/g, '/');
    const launchArgs = [
      ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : []),
      path.resolve('out/main/index.js')
    ];

    electronApp = await electron.launch({
      args: launchArgs,
      env: {
        ...process.env,
        NEXUS_E2E: '1',
        NEXUS_USER_DATA: userDataDir,
        DATABASE_URL: `file:${dbPath}`
      }
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('creates a runnable Node CLI project via 1-click Preset, executes it, runs its tests and runs it inside Nexus GUI', async () => {
    await page.getByRole('button', { name: 'Novo Projeto' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Criar Novo Projeto')).toBeVisible();

    // Apply 1-click preset "Node CLI Pronto (CLI)"
    await dialog.getByText('Node CLI Pronto (CLI)', { exact: true }).click();

    // Fill project name, description and destination
    await dialog.getByLabel('Nome do projeto').fill('e2e-runnable-cli');
    await dialog.getByLabel('Descrição (opcional)').fill('CLI criada e executada via E2E');
    await dialog.getByLabel('Pasta pai de destino').fill(projectsDir);

    // Keep git init enabled; disable npm install so zero external network is needed for built-in node:test
    await dialog.getByLabel('Instalar dependências automaticamente').uncheck();
    await dialog.getByLabel('Incluir Dockerfile / docker-compose').check();

    // Preflight check must detect node and git
    await expect(dialog.getByText('node ✓')).toBeVisible();
    await expect(dialog.getByText('git ✓')).toBeVisible();

    await dialog.getByRole('button', { name: 'Criar Projeto' }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    const createdDir = path.join(projectsDir, 'e2e-runnable-cli');

    // Verify all expected generated artifacts on disk
    for (const rel of [
      'package.json',
      'src/index.js',
      'tests/index.test.mjs',
      '.gitignore',
      'README.md',
      'LICENSE',
      'biome.json',
      'Dockerfile',
      '.github/workflows/ci.yml'
    ]) {
      expect(fs.existsSync(path.join(createdDir, rel))).toBe(true);
    }

    // 1. Actually execute the created CLI project and verify stdout
    const cliOutput = execFileSync(process.execPath, ['src/index.js', '--name', 'NexusE2E'], {
      cwd: createdDir,
      encoding: 'utf-8'
    });
    expect(cliOutput.trim()).toBe('Hello, NexusE2E!');

    // 2. Actually run the generated unit test suite inside the created project
    const testOutput = execFileSync(process.execPath, ['--test'], {
      cwd: createdDir,
      encoding: 'utf-8'
    });
    expect(testOutput).toContain('greet returns personalized message');

    // 3. Verify git repository was initialized cleanly
    const gitCheck = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: createdDir,
      encoding: 'utf-8'
    });
    expect(gitCheck.trim()).toBe('true');

    // 4. Verify Nexus opened the project and can execute its "test" script right from the UI
    await expect(page.getByRole('heading', { name: 'e2e-runnable-cli' })).toBeVisible();
    await page
      .getByRole('row', { name: /\btest\b/i })
      .getByRole('button', { name: 'Rodar' })
      .click();
    await expect(page.getByText('greet returns personalized message')).toBeVisible({ timeout: 15_000 });
  });

  test('creates a Hono JS + SQLite + Prisma + ESLint/Prettier + Apache-2.0 project and validates JS syntax', async () => {
    await page.getByRole('button', { name: 'Novo Projeto' }).first().click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('button', { name: 'Backend / API' }).click();
    await dialog.getByRole('button', { name: 'JavaScript', exact: true }).click();
    await dialog.getByText('Hono', { exact: true }).click();

    const selects = dialog.locator('[role="combobox"]');
    await selects.nth(0).click();
    await page.getByRole('option', { name: 'SQLite' }).click();
    await selects.nth(1).click();
    await page.getByRole('option', { name: 'Prisma ORM' }).click();
    await selects.nth(6).click();
    await page.getByRole('option', { name: 'ESLint + Prettier' }).click();
    await selects.nth(7).click();
    await page.getByRole('option', { name: 'Apache 2.0' }).click();

    await dialog.getByLabel('Nome do projeto').fill('e2e-hono-js');
    await dialog.getByLabel('Pasta pai de destino').fill(projectsDir);
    await dialog.getByLabel('Instalar dependências automaticamente').uncheck();
    await dialog.getByLabel('Inicializar repositório Git').uncheck();

    await dialog.getByRole('button', { name: 'Criar Projeto' }).click();
    await expect(dialog).toBeHidden({ timeout: 25_000 });

    const createdDir = path.join(projectsDir, 'e2e-hono-js');
    expect(fs.existsSync(path.join(createdDir, '.prettierrc'))).toBe(true);
    expect(fs.readFileSync(path.join(createdDir, 'LICENSE'), 'utf-8')).toContain('Apache License');
    expect(fs.readFileSync(path.join(createdDir, 'prisma', 'schema.prisma'), 'utf-8')).toContain(
      'provider = "sqlite"'
    );

    // Validate generated JS entry syntax with node --check
    execFileSync(process.execPath, ['--check', 'src/index.js'], {
      cwd: createdDir,
      encoding: 'utf-8'
    });
  });
});
