import { describe, expect, it } from 'vitest';
import {
  buildGithubTemplateSearchQuery,
  FRAMEWORK_CATALOG,
  getAvailableAuth,
  getAvailableDatabases,
  getAvailableFrameworks,
  getAvailableLanguages,
  getAvailableOrms,
  getAvailableStyling,
  getFrameworkById,
  getPresetById,
  sanitizeProjectName,
  STACK_PRESETS
} from '../../src/shared/projectCatalog';

describe('projectCatalog', () => {
  it('sanitizes project names into valid folder/package slugs', () => {
    expect(sanitizeProjectName('Meu Projeto Next!')).toBe('meu-projeto-next');
    expect(sanitizeProjectName('---My_App.2---')).toBe('my_app.2');
    expect(sanitizeProjectName('   !!!   ')).toBe('my-nexus-app');
  });

  it('finds framework by id or returns undefined', () => {
    expect(getFrameworkById('nextjs')?.name).toBe('Next.js');
    expect(getFrameworkById('unknown-fw')).toBeUndefined();
  });

  it('filters available languages and frameworks by platform and language', () => {
    const webLangs = getAvailableLanguages('web').map((l) => l.id);
    expect(webLangs).toContain('typescript');
    expect(webLangs).toContain('python');

    const backendRust = getAvailableFrameworks('backend', 'rust');
    expect(backendRust.map((f) => f.id)).toEqual(['rust-axum']);

    const allMobile = getAvailableFrameworks('mobile');
    expect(allMobile[0].popularityScore).toBeGreaterThanOrEqual(allMobile[1].popularityScore);
  });

  it('filters databases, ORMs, styling and auth progressively', () => {
    expect(getAvailableDatabases('unknown').map((d) => d.id)).toEqual(['none']);
    expect(getAvailableDatabases('nextjs').map((d) => d.id)).toContain('sqlite');

    expect(getAvailableOrms('nextjs', 'none').map((o) => o.id)).toEqual(['none']);
    expect(getAvailableOrms('unknown', 'sqlite').map((o) => o.id)).toEqual(['none']);
    expect(getAvailableOrms('nextjs', 'sqlite').map((o) => o.id)).toEqual([
      'none',
      'prisma',
      'drizzle'
    ]);
    expect(getAvailableOrms('nextjs', 'mongodb').map((o) => o.id)).toEqual([
      'none',
      'prisma',
      'mongoose'
    ]);
    // Force empty intersection fallback branch (django + supabase)
    expect(getAvailableOrms('django', 'supabase').map((o) => o.id)).toEqual(['none']);

    // Force empty intersection fallback branch by testing a framework with no matching ORM for supabase
    expect(getAvailableOrms('nestjs', 'supabase').map((o) => o.id)).toEqual([
      'none',
      'prisma',
      'drizzle'
    ]);
    expect(getAvailableOrms('fastapi', 'supabase').map((o) => o.id)).toEqual(['none']);

    expect(getAvailableStyling('unknown').map((s) => s.id)).toEqual(['none']);
    expect(getAvailableStyling('nextjs').map((s) => s.id)).toContain('mui');

    expect(getAvailableAuth('unknown').map((a) => a.id)).toEqual(['none']);
    expect(getAvailableAuth('nextjs').map((a) => a.id)).toContain('authjs');
  });

  it('builds GitHub template search queries from stack selections', () => {
    expect(
      buildGithubTemplateSearchQuery({
        frameworkId: 'nextjs',
        language: 'typescript',
        database: 'sqlite',
        orm: 'prisma',
        styling: 'mui',
        auth: 'authjs'
      })
    ).toBe('nextjs next.js typescript sqlite prisma mui authjs');

    expect(
      buildGithubTemplateSearchQuery({
        frameworkId: 'rust-axum',
        language: 'rust',
        database: 'none',
        orm: 'none',
        styling: 'none',
        auth: 'none'
      })
    ).toBe('axum rust');

    expect(buildGithubTemplateSearchQuery({ platform: 'web' })).toBe('web');
    expect(buildGithubTemplateSearchQuery({})).toBe('nextjs prisma typescript');
    expect(buildGithubTemplateSearchQuery({ frameworkId: 'missing' })).toBe(
      'nextjs prisma typescript'
    );
    expect(FRAMEWORK_CATALOG.length).toBeGreaterThan(15);
    expect(STACK_PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(getPresetById('nextjs-fullstack')?.name).toBe('Next.js Fullstack');
    expect(getPresetById('unknown-preset')).toBeUndefined();
  });
});
