import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;
let tempRoot: string;
let projectsDir: string;

test.describe('Nexus Desktop E2E', () => {
  test.beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-e2e-desktop-'));
    const userDataDir = path.join(tempRoot, 'userdata');
    projectsDir = path.join(tempRoot, 'projects');
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(projectsDir, { recursive: true });

    const dbPath = path.join(tempRoot, 'e2e.db').replace(/\\/g, '/');
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

  test('renders welcome screen and persists GitHub settings', async () => {
    await expect(page.getByText('Bem-vindo ao Nexus')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo Projeto' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Configurar Inicialização e CLI' }).click();
    const settingsDialog = page.getByRole('dialog');
    await expect(settingsDialog.getByText('Configurações do Nexus')).toBeVisible();
    await expect(settingsDialog.getByLabel('Usuário do GitHub')).toHaveValue('KaneeSell');

    await settingsDialog.getByRole('button', { name: 'Salvar Configurações' }).click();
    await expect(settingsDialog).toBeHidden();
  });

  test('creates a Hono + TypeScript + SQLite + Prisma project via Stack Wizard and opens it', async () => {
    await page.getByRole('button', { name: 'Novo Projeto' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Criar Novo Projeto')).toBeVisible();

    // Cascading filter check: switch to Backend / API -> TypeScript -> Hono
    await dialog.getByRole('button', { name: 'Backend / API' }).click();
    await dialog.getByRole('button', { name: 'TypeScript', exact: true }).click();
    await dialog.getByText('Hono', { exact: true }).click();

    // Select SQLite and Prisma ORM
    const selects = dialog.locator('[role="combobox"]');
    await selects.nth(0).click();
    await page.getByRole('option', { name: 'SQLite' }).click();

    await selects.nth(1).click();
    await page.getByRole('option', { name: 'Prisma ORM' }).click();

    // Fill project name and isolated parent dir
    await dialog.getByLabel('Nome do projeto').fill('E2E Hono App');
    await dialog.getByLabel('Pasta pai de destino').fill(projectsDir);

    // Disable slow external network/git commands for deterministic offline-capable E2E
    await dialog.getByLabel('Instalar dependências automaticamente').uncheck();
    await dialog.getByLabel('Inicializar repositório Git').uncheck();

    // Preview plan
    await dialog.getByRole('button', { name: 'Pré-visualizar plano' }).click();
    await expect(dialog.getByText('prisma/schema.prisma')).toBeVisible();

    // Create project and auto-open in Nexus
    await dialog.getByRole('button', { name: 'Criar Projeto' }).click();
    await expect(dialog).toBeHidden({ timeout: 25_000 });

    // Verify Nexus scanned and selected the created project
    await expect(page.getByRole('heading', { name: 'e2e-hono-app' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Scripts \(3\)/ })).toBeVisible();

    // Verify generated files on disk
    const targetDir = path.join(projectsDir, 'e2e-hono-app');
    expect(fs.existsSync(path.join(targetDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'src', 'index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'prisma', 'schema.prisma'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, '.env'))).toBe(true);

    const prismaSchema = fs.readFileSync(path.join(targetDir, 'prisma', 'schema.prisma'), 'utf-8');
    expect(prismaSchema).toContain('provider = "sqlite"');
  });

  test('creates a pipeline on the scaffolded project and previews its export script', async () => {
    await page.getByRole('tab', { name: 'Pipelines' }).click();
    await page.getByRole('button', { name: 'Novo Pipeline' }).click();

    const editorDialog = page.getByRole('dialog');
    await editorDialog.getByLabel('Nome do Pipeline').fill('E2E Build Check');
    await editorDialog.getByRole('button', { name: 'Salvar Pipeline' }).click();
    await expect(editorDialog).toBeHidden();

    await expect(page.getByText('E2E Build Check')).toBeVisible();

    await page.getByRole('button', { name: 'Exportar' }).first().click();
    const exportDialog = page.getByRole('dialog');
    await expect(exportDialog.getByText(/Exportar Pipeline/i)).toBeVisible();
    await expect(exportDialog.locator('pre, code, textarea').first()).toBeVisible();
    await exportDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(exportDialog).toBeHidden();
  });

  test('navigates GitHub template tabs without crashing', async () => {
    await page.getByRole('button', { name: 'Novo Projeto' }).first().click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('tab', { name: 'Meus Templates' }).click();
    await expect(dialog.getByLabel('Usuário do GitHub')).toHaveValue('KaneeSell');
    await expect(dialog.getByLabel('Mostrar todos os repositórios')).toBeVisible();

    await dialog.getByRole('tab', { name: 'Templates Públicos' }).click();
    await expect(dialog.getByRole('button', { name: 'Buscar' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Fechar' }).click();
    await expect(dialog).toBeHidden();
  });
});
