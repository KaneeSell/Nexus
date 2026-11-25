import { execFileSync } from 'child_process';
import fs from 'fs';
import esbuild from 'esbuild';

function loadSemverHelper() {
  const built = esbuild.buildSync({
    entryPoints: ['src/shared/semverBump.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  });
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', built.outputFiles[0].text)(
    mod.exports,
    () => ({}),
    mod
  );
  return mod.exports;
}

function getCommitsSinceLastTag() {
  try {
    const latestTag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
    const raw = execFileSync('git', ['log', range, '--format=%B%x1e'], {
      encoding: 'utf-8'
    });
    return raw.split('\x1e').map((s) => s.trim()).filter(Boolean);
  } catch {
    const raw = execFileSync('git', ['log', '--format=%B%x1e'], { encoding: 'utf-8' });
    return raw.split('\x1e').map((s) => s.trim()).filter(Boolean);
  }
}

function formatLocalDateIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const requested = args.find((a) => !a.startsWith('-')) || 'auto';

  const { bumpSemver, detectBumpLevelFromCommits, promoteUnreleasedChangelog } =
    loadSemverHelper();

  const pkgRaw = fs.readFileSync('package.json', 'utf-8');
  const pkg = JSON.parse(pkgRaw);
  const currentVersion = pkg.version;

  let level = null;
  if (requested === 'patch' || requested === 'minor' || requested === 'major') {
    level = requested;
  } else if (requested === 'auto') {
    const commits = getCommitsSinceLastTag();
    level = detectBumpLevelFromCommits(commits);
  } else {
    console.error(`Nivel invalido: "${requested}". Use: auto | patch | minor | major`);
    process.exit(1);
  }

  if (!level) {
    console.log(
      `[Nexus Version] Nenhum commit feat/fix/perf/breaking desde a ultima tag. Versao mantida em v${currentVersion}.`
    );
    return;
  }

  const nextVersion = bumpSemver(currentVersion, level);
  console.log(`[Nexus Version] v${currentVersion} -> v${nextVersion} (${level})`);

  if (dryRun) {
    console.log('[Nexus Version] --dry-run ativo: nenhum arquivo foi alterado.');
    return;
  }

  const pkgEol = pkgRaw.includes('\r\n') ? '\r\n' : '\n';
  pkg.version = nextVersion;
  fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}${pkgEol}`.replace(/\n/g, pkgEol), 'utf-8');

  if (fs.existsSync('package-lock.json')) {
    const lockRaw = fs.readFileSync('package-lock.json', 'utf-8');
    const lockEol = lockRaw.includes('\r\n') ? '\r\n' : '\n';
    const lock = JSON.parse(lockRaw);
    lock.version = nextVersion;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = nextVersion;
    }
    fs.writeFileSync(
      'package-lock.json',
      `${JSON.stringify(lock, null, 2)}${lockEol}`.replace(/\n/g, lockEol),
      'utf-8'
    );
  }

  if (fs.existsSync('CHANGELOG.md')) {
    const changelogRaw = fs.readFileSync('CHANGELOG.md', 'utf-8');
    const updatedChangelog = promoteUnreleasedChangelog(
      changelogRaw,
      nextVersion,
      formatLocalDateIso()
    );
    fs.writeFileSync('CHANGELOG.md', updatedChangelog, 'utf-8');
  }

  console.log('✓ package.json, package-lock.json e CHANGELOG.md atualizados.');
}

main();
