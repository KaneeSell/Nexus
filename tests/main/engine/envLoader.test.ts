import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadEnvProfile } from '../../../src/main/engine/envLoader';

const createdDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-env-test-'));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('loadEnvProfile', () => {
  it('returns empty vars when profile is omitted or blank', () => {
    const dir = makeTempDir();
    expect(loadEnvProfile(dir)).toEqual({ loadedFile: null, vars: {} });
    expect(loadEnvProfile(dir, null)).toEqual({ loadedFile: null, vars: {} });
    expect(loadEnvProfile(dir, '   ')).toEqual({ loadedFile: null, vars: {} });
  });

  it('loads .env.<profile> first and parses comments, quotes, export, and malformed lines', () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, '.env.staging'),
      [
        '# comment line',
        '',
        'export API_URL="https://staging.example.com"',
        "TOKEN='abc123'",
        'PLAIN=value=with=equals',
        'INVALID_LINE_WITHOUT_EQ',
        '=MISSING_KEY',
        '   =BLANK_KEY',
        'EMPTY_VAL='
      ].join('\n'),
      'utf-8'
    );
    fs.writeFileSync(path.join(dir, '.env'), 'API_URL=https://fallback.example.com\n', 'utf-8');

    expect(loadEnvProfile(dir, ' staging ')).toEqual({
      loadedFile: '.env.staging',
      vars: {
        API_URL: 'https://staging.example.com',
        TOKEN: 'abc123',
        PLAIN: 'value=with=equals',
        EMPTY_VAL: ''
      }
    });
  });

  it('falls back to .env when profile file does not exist', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, '.env'), 'PORT=4000\r\n', 'utf-8');

    expect(loadEnvProfile(dir, 'prod')).toEqual({
      loadedFile: '.env',
      vars: { PORT: '4000' }
    });
  });

  it('returns null when neither profile file nor .env exists', () => {
    const dir = makeTempDir();
    expect(loadEnvProfile(dir, 'prod')).toEqual({ loadedFile: null, vars: {} });
  });

  it('handles read errors gracefully when target .env path is unreadable', () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, '.env.broken'));

    expect(loadEnvProfile(dir, 'broken')).toEqual({ loadedFile: null, vars: {} });
  });
});
