import { getFrameworkById } from '../../shared/projectCatalog';
import type {
  FrameworkCatalogItem,
  GitHubTemplateDTO,
  LivePackageMeta
} from '../../shared/types';

const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const packageCache = new Map<string, CacheEntry<LivePackageMeta>>();
const userTemplatesCache = new Map<string, CacheEntry<GitHubTemplateDTO[]>>();
const publicSearchCache = new Map<string, CacheEntry<GitHubTemplateDTO[]>>();

export function clearRegistryCache(): void {
  packageCache.clear();
  userTemplatesCache.clear();
  publicSearchCache.clear();
}

export interface ApiCallDeps {
  fetchFn?: typeof fetch;
  token?: string | null;
  forceRefresh?: boolean;
  now?: () => number;
}

interface RawGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner?: { login?: string };
  description?: string | null;
  html_url: string;
  clone_url: string;
  default_branch?: string;
  language?: string | null;
  stargazers_count?: number;
  topics?: string[];
  updated_at?: string;
  is_template?: boolean;
  private?: boolean;
}

const TEMPLATE_KEYWORD_RE = /\b(template|starter|boilerplate|scaffold)\b/i;
const TEMPLATE_PREFIX_SUFFIX_RE = /(^template-|[-_]template$|^starter-|[-_]starter$)/i;

export function isDetectedTemplateRepo(repo: {
  name: string;
  description?: string | null;
  topics?: string[];
  is_template?: boolean;
}): boolean {
  if (repo.is_template) return true;
  if (TEMPLATE_KEYWORD_RE.test(repo.name) || TEMPLATE_PREFIX_SUFFIX_RE.test(repo.name)) {
    return true;
  }
  if (repo.description && TEMPLATE_KEYWORD_RE.test(repo.description)) {
    return true;
  }
  if (repo.topics && repo.topics.some((t) => TEMPLATE_KEYWORD_RE.test(t))) {
    return true;
  }
  return false;
}

function mapGitHubRepo(repo: RawGitHubRepo): GitHubTemplateDTO {
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner?.login ?? repo.full_name.split('/')[0],
    description: repo.description ?? null,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    defaultBranch: repo.default_branch ?? 'main',
    language: repo.language ?? null,
    stars: repo.stargazers_count ?? 0,
    topics,
    updatedAt: repo.updated_at ?? '',
    isTemplate: Boolean(repo.is_template),
    isDetectedTemplate: isDetectedTemplateRepo({
      name: repo.name,
      description: repo.description,
      topics,
      is_template: repo.is_template
    }),
    isPrivate: Boolean(repo.private)
  };
}

function buildGitHubHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Nexus-Project-Creator'
  };
  const trimmed = token?.trim();
  if (trimmed) {
    headers.Authorization = `Bearer ${trimmed}`;
  }
  return headers;
}

function makeFallbackMeta(item: FrameworkCatalogItem, nowMs: number): LivePackageMeta {
  return {
    frameworkId: item.id,
    packageName: item.registrySource.packageName,
    provider: item.registrySource.provider,
    latestVersion: null,
    monthlyDownloads: null,
    description: null,
    homepage: null,
    source: 'fallback',
    fetchedAt: new Date(nowMs).toISOString()
  };
}

async function safeFetchJson<T>(
  fetchFn: typeof fetch,
  url: string,
  headers?: Record<string, string>
): Promise<T | null> {
  try {
    const res = await fetchFn(url, {
      headers: {
        'User-Agent': 'Nexus-Project-Creator',
        ...headers
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchSinglePackageMeta(
  item: FrameworkCatalogItem,
  deps: ApiCallDeps = {}
): Promise<LivePackageMeta> {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? Date.now;
  const nowMs = now();
  const cacheKey = `${item.id}:${item.registrySource.provider}:${item.registrySource.packageName}`;

  if (!deps.forceRefresh) {
    const cached = packageCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      return cached.value;
    }
  }

  const pkg = item.registrySource.packageName;
  const provider = item.registrySource.provider;
  let result: LivePackageMeta | null = null;

  if (provider === 'npm') {
    const [latestData, downloadsData] = await Promise.all([
      safeFetchJson<{ version?: string; description?: string; homepage?: string }>(
        fetchFn,
        `https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`
      ),
      safeFetchJson<{ downloads?: number }>(
        fetchFn,
        `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`
      )
    ]);

    if (latestData?.version) {
      result = {
        frameworkId: item.id,
        packageName: pkg,
        provider,
        latestVersion: latestData.version,
        monthlyDownloads:
          typeof downloadsData?.downloads === 'number' ? downloadsData.downloads : null,
        description: latestData.description ?? null,
        homepage: latestData.homepage ?? null,
        source: 'live',
        fetchedAt: new Date(nowMs).toISOString()
      };
    }
  } else if (provider === 'pypi') {
    const data = await safeFetchJson<{
      info?: { version?: string; summary?: string; home_page?: string };
    }>(fetchFn, `https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`);
    if (data?.info?.version) {
      result = {
        frameworkId: item.id,
        packageName: pkg,
        provider,
        latestVersion: data.info.version,
        monthlyDownloads: null,
        description: data.info.summary ?? null,
        homepage: data.info.home_page || null,
        source: 'live',
        fetchedAt: new Date(nowMs).toISOString()
      };
    }
  } else if (provider === 'crates') {
    const data = await safeFetchJson<{
      crate?: {
        max_stable_version?: string;
        newest_version?: string;
        recent_downloads?: number;
        description?: string;
        homepage?: string;
      };
    }>(fetchFn, `https://crates.io/api/v1/crates/${encodeURIComponent(pkg)}`);
    const ver = data?.crate?.max_stable_version || data?.crate?.newest_version;
    if (ver) {
      result = {
        frameworkId: item.id,
        packageName: pkg,
        provider,
        latestVersion: ver,
        monthlyDownloads:
          typeof data?.crate?.recent_downloads === 'number' ? data.crate.recent_downloads : null,
        description: data?.crate?.description ?? null,
        homepage: data?.crate?.homepage ?? null,
        source: 'live',
        fetchedAt: new Date(nowMs).toISOString()
      };
    }
  } else if (provider === 'packagist') {
    const data = await safeFetchJson<{
      packages?: Record<string, Array<{ version?: string; description?: string; homepage?: string }>>;
    }>(fetchFn, `https://repo.packagist.org/p2/${pkg}.json`);
    const versions = data?.packages?.[pkg] ?? [];
    const stable = versions.find((v) => v.version && !/dev|alpha|beta|rc/i.test(v.version));
    const chosen = stable ?? versions[0];
    if (chosen?.version) {
      result = {
        frameworkId: item.id,
        packageName: pkg,
        provider,
        latestVersion: chosen.version.replace(/^v/i, ''),
        monthlyDownloads: null,
        description: chosen.description ?? null,
        homepage: chosen.homepage ?? null,
        source: 'live',
        fetchedAt: new Date(nowMs).toISOString()
      };
    }
  } else {
    const data = await safeFetchJson<{
      tag_name?: string;
      html_url?: string;
      name?: string;
    }>(
      fetchFn,
      `https://api.github.com/repos/${pkg}/releases/latest`,
      buildGitHubHeaders(deps.token)
    );
    if (data?.tag_name) {
      result = {
        frameworkId: item.id,
        packageName: pkg,
        provider,
        latestVersion: data.tag_name.replace(/^v/i, ''),
        monthlyDownloads: null,
        description: data.name ?? null,
        homepage: data.html_url ?? null,
        source: 'live',
        fetchedAt: new Date(nowMs).toISOString()
      };
    }
  }

  const finalMeta = result ?? makeFallbackMeta(item, nowMs);
  packageCache.set(cacheKey, { value: finalMeta, expiresAt: nowMs + CACHE_TTL_MS });
  return finalMeta;
}

export async function fetchLiveStackMeta(
  frameworkIds: string[],
  deps: ApiCallDeps = {}
): Promise<Record<string, LivePackageMeta>> {
  const items = frameworkIds
    .map((id) => getFrameworkById(id))
    .filter((item): item is FrameworkCatalogItem => Boolean(item));

  const entries = await Promise.all(
    items.map(async (item) => [item.id, await fetchSinglePackageMeta(item, deps)] as const)
  );
  return Object.fromEntries(entries);
}

export async function listUserGitHubTemplates(
  username: string,
  options: ApiCallDeps & { includeAllRepos?: boolean } = {}
): Promise<GitHubTemplateDTO[]> {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const nowMs = now();
  const cleanUser = username.trim();
  const hasToken = Boolean(options.token?.trim());

  if (!cleanUser && !hasToken) {
    throw new Error('Informe um usuário do GitHub ou configure um token.');
  }

  const cacheKey = `user:${cleanUser.toLowerCase()}:${hasToken ? 'auth' : 'pub'}`;
  let allMapped: GitHubTemplateDTO[] | null = null;

  if (!options.forceRefresh) {
    const cached = userTemplatesCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      allMapped = cached.value;
    }
  }

  if (!allMapped) {
    const url =
      hasToken && !cleanUser
        ? 'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner'
        : `https://api.github.com/users/${encodeURIComponent(cleanUser)}/repos?per_page=100&sort=updated`;

    const res = await fetchFn(url, {
      headers: buildGitHubHeaders(options.token),
      signal: AbortSignal.timeout(9000)
    });

    if (!res.ok) {
      throw new Error(`Falha ao consultar repositórios do GitHub (HTTP ${res.status}).`);
    }

    const rawRepos = (await res.json()) as RawGitHubRepo[];
    allMapped = rawRepos.map(mapGitHubRepo).sort((a, b) => {
      if (a.isTemplate !== b.isTemplate) return a.isTemplate ? -1 : 1;
      if (a.isDetectedTemplate !== b.isDetectedTemplate) return a.isDetectedTemplate ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    userTemplatesCache.set(cacheKey, { value: allMapped, expiresAt: nowMs + CACHE_TTL_MS });
  }

  return options.includeAllRepos
    ? allMapped
    : allMapped.filter((repo) => repo.isDetectedTemplate);
}

export async function searchPublicGitHubTemplates(
  query: string,
  options: ApiCallDeps = {}
): Promise<GitHubTemplateDTO[]> {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const nowMs = now();
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    return [];
  }

  const normalizedQuery = TEMPLATE_KEYWORD_RE.test(cleanQuery)
    ? cleanQuery
    : `${cleanQuery} (template OR starter OR boilerplate)`;
  const cacheKey = `search:${normalizedQuery.toLowerCase()}`;

  if (!options.forceRefresh) {
    const cached = publicSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      return cached.value;
    }
  }

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(normalizedQuery)}&sort=stars&order=desc&per_page=12`;
  const res = await fetchFn(url, {
    headers: buildGitHubHeaders(options.token),
    signal: AbortSignal.timeout(9000)
  });

  if (!res.ok) {
    throw new Error(`Falha na busca de templates públicos no GitHub (HTTP ${res.status}).`);
  }

  const payload = (await res.json()) as { items?: RawGitHubRepo[] };
  const mapped = (payload.items ?? []).map(mapGitHubRepo);
  publicSearchCache.set(cacheKey, { value: mapped, expiresAt: nowMs + CACHE_TTL_MS });
  return mapped;
}
