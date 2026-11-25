import { describe, expect, it } from 'vitest';
import {
  bumpSemver,
  detectBumpLevelFromCommits,
  parseSemver,
  promoteUnreleasedChangelog
} from '../../src/shared/semverBump';

describe('parseSemver & bumpSemver', () => {
  it('parses standard, v-prefixed, and prerelease versions', () => {
    expect(parseSemver('0.1.0')).toEqual({ major: 0, minor: 1, patch: 0 });
    expect(parseSemver(' v2.10.3-beta.1 ')).toEqual({ major: 2, minor: 10, patch: 3 });
  });

  it('throws on invalid SemVer strings', () => {
    expect(() => parseSemver('1.2')).toThrow(/SemVer inválida/);
    expect(() => parseSemver('abc')).toThrow(/SemVer inválida/);
  });

  it('increments patch, minor, and major versions', () => {
    expect(bumpSemver('0.1.5', 'patch')).toBe('0.1.6');
    expect(bumpSemver('0.1.5', 'minor')).toBe('0.2.0');
    expect(bumpSemver('0.1.5', 'major')).toBe('1.0.0');
  });
});

describe('detectBumpLevelFromCommits', () => {
  it('returns null when there are no commits or only non-release commits', () => {
    expect(detectBumpLevelFromCommits([])).toBeNull();
    expect(detectBumpLevelFromCommits(['   ', 'docs: update readme', 'test: add unit tests', 'chore: tidy'])).toBeNull();
  });

  it('returns patch for fix and perf commits', () => {
    expect(detectBumpLevelFromCommits(['docs: note', 'fix(tui): crash on key'])).toBe('patch');
    expect(detectBumpLevelFromCommits(['perf(scanner): cache dir stats'])).toBe('patch');
  });

  it('returns minor for feat commits and does not downgrade to patch', () => {
    expect(detectBumpLevelFromCommits(['feat(export): add .bat export', 'fix(cli): typo'])).toBe(
      'minor'
    );
  });

  it('returns major for bang syntax or BREAKING CHANGE / BREAKING-CHANGE footers', () => {
    expect(detectBumpLevelFromCommits(['fix: small', 'feat!: drop legacy flag'])).toBe('major');
    expect(
      detectBumpLevelFromCommits(['feat(cli): change flag\n\nBREAKING CHANGE: renamed --foo'])
    ).toBe('major');
    expect(
      detectBumpLevelFromCommits(['refactor(db): schema\n\nBREAKING-CHANGE: reset db'])
    ).toBe('major');
  });
});

describe('promoteUnreleasedChangelog', () => {
  it('promotes populated Unreleased section preserving CRLF and existing releases', () => {
    const input = [
      '# Changelog',
      '',
      '## [Unreleased]',
      '',
      '### Adicionado',
      '- Nova feature X.',
      '',
      '## [0.1.0] - 2026-11-24',
      '',
      '### Adicionado',
      '- Release inicial.'
    ].join('\r\n');

    const out = promoteUnreleasedChangelog(input, '0.2.0', '2026-11-25');
    expect(out.includes('\r\n')).toBe(true);
    expect(out).toContain('## [Unreleased]\r\n\r\n## [0.2.0] - 2026-11-25\r\n\r\n### Adicionado\r\n- Nova feature X.');
    expect(out).toContain('## [0.1.0] - 2026-11-24');
  });

  it('uses fallback entry when Unreleased section is empty and at EOF', () => {
    const input = '# Changelog\n\n## [Unreleased]\n\n   \n';
    const out = promoteUnreleasedChangelog(input, '0.1.1', '2026-11-25');
    expect(out).toBe(
      '# Changelog\n\n## [Unreleased]\n\n## [0.1.1] - 2026-11-25\n\n### Alterado\n- Atualização para v0.1.1.\n'
    );
  });

  it('inserts Unreleased + release section when Unreleased header is missing', () => {
    const withOld = '# Changelog\n\n## [0.1.0] - 2026-11-24\n\n- Init\n';
    const out1 = promoteUnreleasedChangelog(withOld, '0.1.1', '2026-11-25');
    expect(out1).toContain('## [Unreleased]\n\n## [0.1.1] - 2026-11-25\n\n### Alterado\n- Atualização para v0.1.1.\n\n## [0.1.0]');

    const noHeadings = '# Changelog\n\nResumo';
    const out2 = promoteUnreleasedChangelog(noHeadings, '0.1.1', '2026-11-25');
    expect(out2).toBe(
      '# Changelog\n\nResumo\n\n## [Unreleased]\n\n## [0.1.1] - 2026-11-25\n\n### Alterado\n- Atualização para v0.1.1.\n'
    );
  });
});
