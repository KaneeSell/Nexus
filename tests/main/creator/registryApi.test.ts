import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRegistryCache,
  fetchLiveStackMeta,
  fetchSinglePackageMeta,
  isDetectedTemplateRepo,
  listUserGitHubTemplates,
  searchPublicGitHubTemplates
} from '../../../src/main/creator/registryApi';
import { getFrameworkById } from '../../../src/shared/projectCatalog';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as unknown as Response;
}

describe('registryApi', () => {
  beforeEach(() => {
    clearRegistryCache();
  });

  it('detects template repositories by flag, name, description, or topics', () => {
    expect(isDetectedTemplateRepo({ name: 'foo', is_template: true })).toBe(true);
    expect(isDetectedTemplateRepo({ name: 'template-next-prisma-auth-mui' })).toBe(true);
    expect(isDetectedTemplateRepo({ name: 'my-app', description: 'A clean starter kit' })).toBe(
      true
    );
    expect(isDetectedTemplateRepo({ name: 'my-app', topics: ['boilerplate'] })).toBe(true);
    expect(isDetectedTemplateRepo({ name: 'Nexus', description: 'App', topics: ['electron'] })).toBe(
      false
    );
  });

  it('fetches npm metadata + monthly downloads and caches results', async () => {
    const nextFw = getFrameworkById('nextjs')!;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('registry.npmjs.org')) {
        return jsonResponse({ version: '15.2.0', description: 'The React Framework', homepage: 'https://nextjs.org' });
      }
      return jsonResponse({ downloads: 25000000 });
    }) as unknown as typeof fetch;

    const first = await fetchSinglePackageMeta(nextFw, { fetchFn: fetchMock, now: () => 1000 });
    expect(first).toMatchObject({
      frameworkId: 'nextjs',
      latestVersion: '15.2.0',
      monthlyDownloads: 25000000,
      source: 'live'
    });

    // Cached hit
    const cached = await fetchSinglePackageMeta(nextFw, { fetchFn: fetchMock, now: () => 2000 });
    expect(cached.latestVersion).toBe('15.2.0');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Expired cache hit
    const expired = await fetchSinglePackageMeta(nextFw, {
      fetchFn: fetchMock,
      now: () => 1000 + 20 * 60 * 1000
    });
    expect(expired.latestVersion).toBe('15.2.0');
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // Force refresh when downloads endpoint returns non-number
    const fetchMock2 = vi.fn(async (url: string) => {
      if (url.includes('registry.npmjs.org')) {
        return jsonResponse({ version: '15.2.1' });
      }
      return jsonResponse({}, false, 500);
    }) as unknown as typeof fetch;

    const refreshed = await fetchSinglePackageMeta(nextFw, {
      fetchFn: fetchMock2,
      forceRefresh: true,
      now: () => 3000
    });
    expect(refreshed.latestVersion).toBe('15.2.1');
    expect(refreshed.monthlyDownloads).toBeNull();

    // Default fetch & Date.now fallback branches
    clearRegistryCache();
    vi.stubGlobal('fetch', fetchMock);
    try {
      const viaGlobals = await fetchSinglePackageMeta(nextFw);
      expect(viaGlobals.latestVersion).toBe('15.2.0');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fetches pypi, crates, packagist, github and fallback metadata', async () => {
    const fastapi = getFrameworkById('fastapi')!;
    const axum = getFrameworkById('rust-axum')!;
    const laravel = getFrameworkById('laravel')!;
    const gin = getFrameworkById('go-gin')!;

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('pypi.org')) {
        return jsonResponse({ info: { version: '0.115.0', summary: 'FastAPI', home_page: '' } });
      }
      if (url.includes('crates.io')) {
        return jsonResponse({
          crate: { max_stable_version: '0.8.1', recent_downloads: 900000, description: 'Axum', homepage: 'https://tokio.rs' }
        });
      }
      if (url.includes('packagist.org')) {
        return jsonResponse({
          packages: {
            'laravel/framework': [
              { version: 'dev-master' },
              { version: 'v12.0.0', description: 'Laravel', homepage: 'https://laravel.com' }
            ]
          }
        });
      }
      if (url.includes('api.github.com')) {
        return jsonResponse({ tag_name: 'v1.10.0' });
      }
      return jsonResponse({}, false, 404);
    }) as unknown as typeof fetch;

    const meta = await fetchLiveStackMeta(['fastapi', 'rust-axum', 'laravel', 'go-gin', 'unknown'], {
      fetchFn: fetchMock,
      token: 'ghp_test',
      now: () => 5000
    });

    expect(meta.fastapi.latestVersion).toBe('0.115.0');
    expect(meta.fastapi.homepage).toBeNull();
    expect(meta['rust-axum'].latestVersion).toBe('0.8.1');
    expect(meta['rust-axum'].monthlyDownloads).toBe(900000);
    expect(meta.laravel.latestVersion).toBe('12.0.0');
    expect(meta['go-gin'].latestVersion).toBe('1.10.0');
    expect(meta.unknown).toBeUndefined();

    // Test crates newest_version without recent_downloads, packagist empty packages, and error fallback
    const fetchEdge = vi.fn(async (url: string) => {
      if (url.includes('registry.npmjs.org')) {
        return jsonResponse({});
      }
      if (url.includes('pypi.org')) {
        return jsonResponse({ info: {} });
      }
      if (url.includes('crates.io')) {
        return jsonResponse({ crate: {} });
      }
      if (url.includes('packagist.org')) {
        return jsonResponse({});
      }
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const nextFw = getFrameworkById('nextjs')!;
    const edgeMeta = await fetchLiveStackMeta([nextFw.id, fastapi.id, axum.id, laravel.id, gin.id], {
      fetchFn: fetchEdge,
      forceRefresh: true,
      now: () => 6000
    });
    expect(edgeMeta.nextjs.source).toBe('fallback');
    expect(edgeMeta.fastapi.source).toBe('fallback');
    expect(edgeMeta['rust-axum'].source).toBe('fallback');
    expect(edgeMeta.laravel.source).toBe('fallback');
    expect(edgeMeta['go-gin'].source).toBe('fallback');

    const fetchPypiNoSummary = vi.fn(async () =>
      jsonResponse({ info: { version: '0.116.0', home_page: 'https://fastapi.tiangolo.com' } })
    ) as unknown as typeof fetch;
    const pypiMeta = await fetchSinglePackageMeta(fastapi, {
      fetchFn: fetchPypiNoSummary,
      forceRefresh: true,
      now: () => 6200
    });
    expect(pypiMeta.description).toBeNull();
    expect(pypiMeta.homepage).toBe('https://fastapi.tiangolo.com');

    const fetchCratesNewest = vi.fn(async () =>
      jsonResponse({ crate: { newest_version: '0.9.0-alpha' } })
    ) as unknown as typeof fetch;
    const cratesNewest = await fetchSinglePackageMeta(axum, {
      fetchFn: fetchCratesNewest,
      forceRefresh: true,
      now: () => 6500
    });
    expect(cratesNewest.latestVersion).toBe('0.9.0-alpha');
    expect(cratesNewest.monthlyDownloads).toBeNull();

    const fetchPackagistDev = vi.fn(async () =>
      jsonResponse({ packages: { 'laravel/framework': [{ version: 'dev-main' }] } })
    ) as unknown as typeof fetch;
    const devMeta = await fetchSinglePackageMeta(laravel, {
      fetchFn: fetchPackagistDev,
      forceRefresh: true,
      now: () => 7000
    });
    expect(devMeta.latestVersion).toBe('dev-main');
  });

  it('lists user GitHub templates with sorting, filtering, caching and token auth', async () => {
    await expect(listUserGitHubTemplates('   ')).rejects.toThrow(/Informe um usuário/);

    const repos = [
      {
        id: 8,
        name: 'official-starter-0',
        full_name: 'KaneeSell/official-starter-0',
        html_url: 'https://github.com/KaneeSell/official-starter-0',
        clone_url: 'https://github.com/KaneeSell/official-starter-0.git',
        updated_at: '2026-04-01T00:00:00Z',
        is_template: true
      },
      {
        id: 1,
        name: 'Nexus',
        full_name: 'KaneeSell/Nexus',
        html_url: 'https://github.com/KaneeSell/Nexus',
        clone_url: 'https://github.com/KaneeSell/Nexus.git',
        updated_at: '2026-11-24T00:00:00Z',
        is_template: false
      },
      {
        id: 5,
        name: 'OtherRepo',
        full_name: '',
        html_url: 'https://github.com/KaneeSell/OtherRepo',
        clone_url: 'https://github.com/KaneeSell/OtherRepo.git',
        is_template: false
      },
      {
        id: 2,
        name: 'template-next-prisma-auth-mui',
        full_name: 'KaneeSell/template-next-prisma-auth-mui',
        description: 'Template: Next, Prisma, Authjs e MUI.',
        topics: ['nextjs', 'prisma'],
        html_url: 'https://github.com/KaneeSell/template-next-prisma-auth-mui',
        clone_url: 'https://github.com/KaneeSell/template-next-prisma-auth-mui.git',
        updated_at: '2026-01-11T00:00:00Z',
        is_template: false
      },
      {
        id: 4,
        name: 'starter-api',
        full_name: 'KaneeSell/starter-api',
        html_url: 'https://github.com/KaneeSell/starter-api',
        clone_url: 'https://github.com/KaneeSell/starter-api.git',
        updated_at: '2026-02-11T00:00:00Z',
        is_template: false
      },
      {
        id: 7,
        name: 'normal-repo-later',
        full_name: 'KaneeSell/normal-repo-later',
        html_url: 'https://github.com/KaneeSell/normal-repo-later',
        clone_url: 'https://github.com/KaneeSell/normal-repo-later.git',
        updated_at: '2026-12-01T00:00:00Z',
        is_template: false
      },
      {
        id: 3,
        name: 'official-starter',
        full_name: 'KaneeSell/official-starter',
        html_url: 'https://github.com/KaneeSell/official-starter',
        clone_url: 'https://github.com/KaneeSell/official-starter.git',
        updated_at: '2026-05-01T00:00:00Z',
        is_template: true,
        private: true
      },
      {
        id: 6,
        name: 'official-starter-2',
        full_name: 'KaneeSell/official-starter-2',
        html_url: 'https://github.com/KaneeSell/official-starter-2',
        clone_url: 'https://github.com/KaneeSell/official-starter-2.git',
        updated_at: '2026-06-01T00:00:00Z',
        is_template: true
      }
    ];

    const fetchMock = vi.fn(async () => jsonResponse(repos)) as unknown as typeof fetch;

    const detectedOnly = await listUserGitHubTemplates('KaneeSell', {
      fetchFn: fetchMock,
      now: () => 1000
    });
    expect(detectedOnly.map((r) => r.name)).toEqual([
      'official-starter-2',
      'official-starter',
      'official-starter-0',
      'starter-api',
      'template-next-prisma-auth-mui'
    ]);

    // Cache hit with includeAllRepos
    const allCached = await listUserGitHubTemplates('KaneeSell', {
      fetchFn: fetchMock,
      includeAllRepos: true,
      now: () => 2000
    });
    expect(allCached).toHaveLength(8);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Token-only /user/repos endpoint + HTTP error handling
    const fetchErr = vi.fn(async () => jsonResponse({}, false, 403)) as unknown as typeof fetch;
    await expect(
      listUserGitHubTemplates('', { fetchFn: fetchErr, token: 'ghp_123', forceRefresh: true })
    ).rejects.toThrow(/HTTP 403/);
  });

  it('searches public GitHub templates and handles empty/error/cache states', async () => {
    expect(await searchPublicGitHubTemplates('   ')).toEqual([]);

    const fetchMock = vi.fn(async () =>
      jsonResponse({
        items: [
          {
            id: 99,
            name: 't3-app',
            full_name: 't3-oss/create-t3-app',
            owner: { login: 't3-oss' },
            html_url: 'https://github.com/t3-oss/create-t3-app',
            clone_url: 'https://github.com/t3-oss/create-t3-app.git',
            stargazers_count: 25000,
            is_template: true
          }
        ]
      })
    ) as unknown as typeof fetch;

    const first = await searchPublicGitHubTemplates('nextjs prisma', {
      fetchFn: fetchMock,
      now: () => 1000
    });
    expect(first).toHaveLength(1);
    expect(first[0].stars).toBe(25000);

    const second = await searchPublicGitHubTemplates('nextjs prisma', {
      fetchFn: fetchMock,
      now: () => 2000
    });
    expect(second).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const fetchMockNoItems = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch;
    const emptyItems = await searchPublicGitHubTemplates('nextjs template', {
      fetchFn: fetchMockNoItems,
      forceRefresh: true
    });
    expect(emptyItems).toEqual([]);

    const fetchErr = vi.fn(async () => jsonResponse({}, false, 422)) as unknown as typeof fetch;
    await expect(
      searchPublicGitHubTemplates('rust axum', { fetchFn: fetchErr, forceRefresh: true })
    ).rejects.toThrow(/HTTP 422/);
  });
});
