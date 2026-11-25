export type SemverBumpLevel = 'major' | 'minor' | 'patch';

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parses a SemVer string (e.g. "0.1.0" or "v1.2.3-beta.1") into numeric parts.
 */
export function parseSemver(version: string): SemverParts {
  const clean = version.trim().replace(/^v/i, '').split('-')[0];
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(clean);
  if (!match) {
    throw new Error(`Versão SemVer inválida: "${version}"`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

/**
 * Increments a SemVer version by the requested bump level.
 */
export function bumpSemver(currentVersion: string, level: SemverBumpLevel): string {
  const { major, minor, patch } = parseSemver(currentVersion);
  if (level === 'major') {
    return `${major + 1}.0.0`;
  }
  if (level === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Determines the required SemVer bump level from a list of Conventional Commit messages.
 */
export function detectBumpLevelFromCommits(messages: string[]): SemverBumpLevel | null {
  let level: SemverBumpLevel | null = null;

  for (const raw of messages) {
    const msg = raw.trim();
    if (!msg) continue;

    const header = msg.split(/\r?\n/, 1)[0];
    if (/BREAKING[ -]CHANGE:/i.test(msg) || /^[a-z]+(\([^)]+\))?!:/i.test(header)) {
      return 'major';
    }
    if (/^feat(\([^)]+\))?:/i.test(header)) {
      level = 'minor';
    } else if (/^(fix|perf)(\([^)]+\))?:/i.test(header) && level === null) {
      level = 'patch';
    }
  }

  return level;
}

/**
 * Promotes the "## [Unreleased]" section in CHANGELOG.md into a dated release section.
 */
export function promoteUnreleasedChangelog(
  changelog: string,
  newVersion: string,
  dateIso: string
): string {
  const eol = changelog.includes('\r\n') ? '\r\n' : '\n';
  const normalized = changelog.replace(/\r\n/g, '\n');
  const unreleasedMatch = /^## \[Unreleased\][ \t]*$/m.exec(normalized);

  if (!unreleasedMatch) {
    const fallbackSection =
      `## [Unreleased]\n\n` +
      `## [${newVersion}] - ${dateIso}\n\n` +
      `### Alterado\n- Atualização para v${newVersion}.`;

    const firstHeading = /^## \[/m.exec(normalized);
    const updated = firstHeading
      ? normalized.slice(0, firstHeading.index) +
        fallbackSection +
        '\n\n' +
        normalized.slice(firstHeading.index)
      : `${normalized.trimEnd()}\n\n${fallbackSection}\n`;

    return updated.replace(/\n/g, eol);
  }

  const headerEnd = unreleasedMatch.index + unreleasedMatch[0].length;
  const afterHeader = normalized.slice(headerEnd);
  const nextSectionMatch = /\n## \[/.exec(afterHeader);

  const rawBody = nextSectionMatch
    ? afterHeader.slice(0, nextSectionMatch.index)
    : afterHeader;
  const rest = nextSectionMatch ? afterHeader.slice(nextSectionMatch.index) : '';

  const trimmedBody = rawBody.trim();
  const releaseBody = trimmedBody || `### Alterado\n- Atualização para v${newVersion}.`;

  const replacement =
    `## [Unreleased]\n\n` +
    `## [${newVersion}] - ${dateIso}\n\n` +
    releaseBody +
    (rest ? `\n${rest}` : '\n');

  const updated = normalized.slice(0, unreleasedMatch.index) + replacement;
  return updated.replace(/\n/g, eol);
}
