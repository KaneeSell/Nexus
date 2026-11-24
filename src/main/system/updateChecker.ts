import fs from 'fs';
import path from 'path';
import { app, shell } from 'electron';
import type { UpdateInfoDTO } from '../../shared/types';
import { getPrisma } from '../db/prisma';

const GITHUB_OWNER = 'KaneeSell';
const GITHUB_REPO = 'Nexus';
const RELEASES_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubReleaseResponse {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  assets?: GitHubAsset[];
}

function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, '');
}

function parseSemverParts(version: string): [number, number, number] {
  const clean = normalizeVersion(version).split('-')[0];
  const [maj = '0', min = '0', pat = '0'] = clean.split('.');
  return [
    Number.parseInt(maj, 10) || 0,
    Number.parseInt(min, 10) || 0,
    Number.parseInt(pat, 10) || 0
  ];
}

export function compareSemver(latest: string, current: string): number {
  const a = parseSemverParts(latest);
  const b = parseSemverParts(current);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

function pickInstallerAsset(assets: GitHubAsset[]): GitHubAsset | null {
  if (process.platform === 'win32') {
    const exe = assets.find(
      (a) =>
        a.name.toLowerCase().endsWith('.exe') &&
        !a.name.toLowerCase().includes('uninstaller')
    );
    if (exe) return exe;
    const msi = assets.find((a) => a.name.toLowerCase().endsWith('.msi'));
    return msi ?? null;
  }

  if (process.platform === 'linux') {
    const appImage = assets.find((a) => a.name.toLowerCase().endsWith('.appimage'));
    if (appImage) return appImage;
    const deb = assets.find((a) => a.name.toLowerCase().endsWith('.deb'));
    if (deb) return deb;
    const rpm = assets.find((a) => a.name.toLowerCase().endsWith('.rpm'));
    if (rpm) return rpm;
    const tar = assets.find((a) => a.name.toLowerCase().endsWith('.tar.gz'));
    return tar ?? null;
  }

  return null;
}

export async function checkForUpdates(force = false): Promise<UpdateInfoDTO> {
  const currentVersion = normalizeVersion(app.getVersion());

  const response = await fetch(LATEST_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Nexus-Desktop'
    },
    signal: AbortSignal.timeout(8000)
  });

  if (response.status === 404) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseName: '',
      releaseNotes: '',
      releaseUrl: RELEASES_PAGE_URL,
      downloadUrl: null,
      assetName: null,
      publishedAt: null,
      dismissedUntil: null,
      shouldNotify: false
    };
  }

  if (!response.ok) {
    throw new Error(`Falha ao consultar GitHub Releases (HTTP ${response.status}).`);
  }

  const release = (await response.json()) as GitHubReleaseResponse;
  const latestVersion = normalizeVersion(release.tag_name || currentVersion);
  const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;
  const asset = pickInstallerAsset(release.assets ?? []);

  const prisma = getPrisma();
  const [dismissedVersionRow, dismissedUntilRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: 'updateDismissedVersion' } }),
    prisma.appSetting.findUnique({ where: { key: 'updateDismissedUntil' } })
  ]);

  const dismissedUntil = dismissedUntilRow?.value ?? null;
  const dismissedUntilMs = dismissedUntil ? Date.parse(dismissedUntil) : 0;
  const isSnoozed =
    !force &&
    dismissedVersionRow?.value === latestVersion &&
    Number.isFinite(dismissedUntilMs) &&
    dismissedUntilMs > Date.now();

  return {
    currentVersion,
    latestVersion,
    hasUpdate,
    releaseName: release.name?.trim() || `v${latestVersion}`,
    releaseNotes: release.body?.trim() || '',
    releaseUrl: release.html_url || RELEASES_PAGE_URL,
    downloadUrl: asset?.browser_download_url ?? null,
    assetName: asset?.name ?? null,
    publishedAt: release.published_at ?? null,
    dismissedUntil: isSnoozed ? dismissedUntil : null,
    shouldNotify: hasUpdate && !isSnoozed
  };
}

export async function dismissUpdateNotice(version: string, hours: number): Promise<void> {
  const prisma = getPrisma();
  const safeHours = Math.max(1, hours);
  const untilIso = new Date(Date.now() + safeHours * 60 * 60 * 1000).toISOString();
  const normalized = normalizeVersion(version);

  await Promise.all([
    prisma.appSetting.upsert({
      where: { key: 'updateDismissedVersion' },
      update: { value: normalized },
      create: { key: 'updateDismissedVersion', value: normalized }
    }),
    prisma.appSetting.upsert({
      where: { key: 'updateDismissedUntil' },
      update: { value: untilIso },
      create: { key: 'updateDismissedUntil', value: untilIso }
    })
  ]);
}

export async function downloadAndInstallUpdate(
  downloadUrl: string,
  assetName?: string | null
): Promise<{ ok: boolean; filePath?: string; error?: string }> {
  try {
    const response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Nexus-Desktop'
      }
    });
    if (!response.ok) {
      return { ok: false, error: `Falha ao baixar instalador (HTTP ${response.status}).` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const safeName = path.basename(assetName || 'Nexus-Update-Installer.exe');
    const targetPath = path.join(app.getPath('temp'), safeName);
    await fs.promises.writeFile(targetPath, Buffer.from(arrayBuffer));

    if (process.platform === 'linux' && targetPath.toLowerCase().endsWith('.appimage')) {
      await fs.promises.chmod(targetPath, 0o755);
    }

    const openError = await shell.openPath(targetPath);
    if (openError) {
      return { ok: false, filePath: targetPath, error: openError };
    }
    return { ok: true, filePath: targetPath };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
