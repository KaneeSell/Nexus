import type {
  AuthOptionId,
  DatabaseOptionId,
  FrameworkCatalogItem,
  LicenseOptionId,
  LinterOptionId,
  OrmOptionId,
  ProjectLanguage,
  ProjectPlatform,
  StackPresetItem,
  StackSelectionInput,
  StylingOptionId
} from './types';

export interface OptionMeta<T extends string> {
  id: T;
  label: string;
  description: string;
}

export const PLATFORM_OPTIONS: OptionMeta<ProjectPlatform>[] = [
  { id: 'web', label: 'Web', description: 'Aplicações web fullstack, SSR, SPA e sites estáticos' },
  { id: 'backend', label: 'Backend / API', description: 'APIs REST, GraphQL, microsserviços e workers' },
  { id: 'desktop', label: 'Desktop', description: 'Aplicativos nativos Windows, macOS e Linux' },
  { id: 'mobile', label: 'Mobile', description: 'Apps iOS e Android multiplataforma' },
  { id: 'cli', label: 'CLI / Ferramenta', description: 'Ferramentas de linha de comando e automação' }
];

export const LANGUAGE_OPTIONS: OptionMeta<ProjectLanguage>[] = [
  { id: 'typescript', label: 'TypeScript', description: 'JavaScript tipado para escala e segurança' },
  { id: 'javascript', label: 'JavaScript', description: 'ECMAScript moderno sem etapa de tipos' },
  { id: 'python', label: 'Python', description: 'Ecossistema robusto para APIs, IA e automação' },
  { id: 'rust', label: 'Rust', description: 'Alta performance e segurança de memória' },
  { id: 'go', label: 'Go', description: 'Binários rápidos e concorrência nativa' },
  { id: 'php', label: 'PHP', description: 'Web e APIs produtivas com Laravel' },
  { id: 'java', label: 'Java', description: 'Plataforma corporativa madura com Spring' },
  { id: 'csharp', label: 'C# (.NET)', description: 'Ecossistema .NET multiplataforma da Microsoft' },
  { id: 'dart', label: 'Dart', description: 'Linguagem otimizada para UI com Flutter' }
];

export const DATABASE_OPTIONS: OptionMeta<DatabaseOptionId>[] = [
  { id: 'none', label: 'Sem banco de dados', description: 'Projeto stateless ou apenas frontend' },
  { id: 'sqlite', label: 'SQLite', description: 'Banco em arquivo local, zero configuração' },
  { id: 'postgresql', label: 'PostgreSQL', description: 'Relacional robusto para produção' },
  { id: 'mysql', label: 'MySQL', description: 'Relacional clássico amplamente suportado' },
  { id: 'mongodb', label: 'MongoDB', description: 'Banco orientado a documentos NoSQL' },
  { id: 'supabase', label: 'Supabase (Postgres)', description: 'PostgreSQL gerenciado com Auth e Storage' }
];

export const ORM_OPTIONS: OptionMeta<OrmOptionId>[] = [
  { id: 'none', label: 'Sem ORM', description: 'Driver nativo ou sem persistência' },
  { id: 'prisma', label: 'Prisma ORM', description: 'Schema declarativo e client 100% tipado' },
  { id: 'drizzle', label: 'Drizzle ORM', description: 'SQL-first leve, rápido e type-safe' },
  { id: 'typeorm', label: 'TypeORM', description: 'ORM clássico com decorators para Node/Nest' },
  { id: 'mongoose', label: 'Mongoose', description: 'ODM oficial para MongoDB no Node.js' },
  { id: 'sqlalchemy', label: 'SQLAlchemy', description: 'Toolkit SQL padrão em Python' },
  { id: 'sqlmodel', label: 'SQLModel', description: 'ORM tipado com Pydantic para FastAPI' },
  { id: 'django-orm', label: 'Django ORM', description: 'ORM integrado ao ecossistema Django' },
  { id: 'eloquent', label: 'Eloquent', description: 'ActiveRecord nativo do Laravel' },
  { id: 'sqlx', label: 'SQLx', description: 'Queries SQL assíncronas validadas em compile-time' },
  { id: 'gorm', label: 'GORM', description: 'ORM completo e idiomático para Go' },
  { id: 'ef-core', label: 'Entity Framework Core', description: 'ORM oficial do .NET' }
];

export const STYLING_OPTIONS: OptionMeta<StylingOptionId>[] = [
  { id: 'none', label: 'Padrão / CSS', description: 'CSS puro ou padrão do framework' },
  { id: 'tailwind', label: 'Tailwind CSS', description: 'Utility-first CSS moderno e rápido' },
  { id: 'mui', label: 'Material UI (MUI)', description: 'Componentes React Material Design' },
  { id: 'css-modules', label: 'CSS Modules', description: 'Estilos escopados por componente' }
];

export const AUTH_OPTIONS: OptionMeta<AuthOptionId>[] = [
  { id: 'none', label: 'Sem autenticação', description: 'Adicionar autenticação depois se precisar' },
  { id: 'authjs', label: 'Auth.js (NextAuth)', description: 'OAuth, credenciais e sessões para Web' },
  { id: 'better-auth', label: 'Better Auth', description: 'Autenticação TypeScript moderna e extensível' },
  { id: 'jwt', label: 'JWT (JSON Web Token)', description: 'Autenticação stateless por token Bearer' }
];

export const LINTER_OPTIONS: OptionMeta<LinterOptionId>[] = [
  { id: 'none', label: 'Padrão do framework', description: 'Sem linter/formatter extra' },
  { id: 'biome', label: 'Biome', description: 'Linter e formatter ultrarrápido em arquivo único' },
  { id: 'eslint-prettier', label: 'ESLint + Prettier', description: 'Padrão clássico JS/TS' }
];

export const LICENSE_OPTIONS: OptionMeta<LicenseOptionId>[] = [
  { id: 'none', label: 'Sem licença', description: 'Não gerar arquivo LICENSE' },
  { id: 'mit', label: 'MIT License', description: 'Permissiva e amplamente adotada em open source' },
  { id: 'apache-2.0', label: 'Apache 2.0', description: 'Permissiva com proteção explícita de patentes' }
];

export const STACK_PRESETS: StackPresetItem[] = [
  {
    id: 'nextjs-fullstack',
    name: 'Next.js Fullstack',
    description: 'Next.js + TypeScript + SQLite + Prisma + Tailwind + Auth.js',
    badge: 'Web',
    stack: {
      platform: 'web',
      language: 'typescript',
      frameworkId: 'nextjs',
      database: 'sqlite',
      orm: 'prisma',
      styling: 'tailwind',
      auth: 'authjs',
      packageManager: 'pnpm',
      versionMode: 'latest',
      linter: 'biome',
      license: 'mit',
      includeTests: true,
      includeCi: true
    }
  },
  {
    id: 'hono-api',
    name: 'Hono API Moderna',
    description: 'Hono + TypeScript + SQLite + Drizzle + Vitest',
    badge: 'Backend',
    stack: {
      platform: 'backend',
      language: 'typescript',
      frameworkId: 'hono',
      database: 'sqlite',
      orm: 'drizzle',
      styling: 'none',
      auth: 'jwt',
      packageManager: 'npm',
      versionMode: 'latest',
      linter: 'biome',
      license: 'mit',
      includeTests: true,
      includeCi: true
    }
  },
  {
    id: 'nestjs-enterprise',
    name: 'NestJS Enterprise',
    description: 'NestJS + TypeScript + PostgreSQL + Prisma + Docker + CI',
    badge: 'Backend',
    stack: {
      platform: 'backend',
      language: 'typescript',
      frameworkId: 'nestjs',
      database: 'postgresql',
      orm: 'prisma',
      styling: 'none',
      auth: 'jwt',
      packageManager: 'npm',
      versionMode: 'latest',
      linter: 'eslint-prettier',
      license: 'mit',
      includeDocker: true,
      includeTests: true,
      includeCi: true
    }
  },
  {
    id: 'react-vite-spa',
    name: 'React + Vite SPA',
    description: 'React + TypeScript + Vite + Tailwind + Vitest',
    badge: 'Web',
    stack: {
      platform: 'web',
      language: 'typescript',
      frameworkId: 'vite-react',
      database: 'none',
      orm: 'none',
      styling: 'tailwind',
      auth: 'none',
      packageManager: 'npm',
      versionMode: 'latest',
      linter: 'biome',
      license: 'mit',
      includeTests: true
    }
  },
  {
    id: 'fastapi-python',
    name: 'FastAPI Python',
    description: 'FastAPI + Python + SQLite + SQLModel + Pytest + Docker',
    badge: 'Python',
    stack: {
      platform: 'backend',
      language: 'python',
      frameworkId: 'fastapi',
      database: 'sqlite',
      orm: 'sqlmodel',
      styling: 'none',
      auth: 'jwt',
      packageManager: 'npm',
      versionMode: 'latest',
      license: 'mit',
      includeDocker: true,
      includeTests: true,
      includeCi: true
    }
  },
  {
    id: 'node-cli-ready',
    name: 'Node CLI Pronto',
    description: 'CLI Node.js zero-dependência + node:test + Biome + MIT',
    badge: 'CLI',
    stack: {
      platform: 'cli',
      language: 'javascript',
      frameworkId: 'node-cli',
      database: 'none',
      orm: 'none',
      styling: 'none',
      auth: 'none',
      packageManager: 'npm',
      versionMode: 'latest',
      linter: 'biome',
      license: 'mit',
      includeTests: true,
      includeCi: true
    }
  }
];

export function getPresetById(id: string): StackPresetItem | undefined {
  return STACK_PRESETS.find((p) => p.id === id);
}

export const FRAMEWORK_CATALOG: FrameworkCatalogItem[] = [
  {
    id: 'nextjs',
    name: 'Next.js',
    tagline: 'Framework React fullstack com App Router, SSR e Server Actions',
    platforms: ['web'],
    languages: ['typescript', 'javascript'],
    category: 'Fullstack Web',
    popularityScore: 99,
    recommended: true,
    registrySource: { provider: 'npm', packageName: 'next' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql', 'mongodb', 'supabase'],
    supportedOrms: ['none', 'prisma', 'drizzle', 'mongoose'],
    supportedStyling: ['none', 'tailwind', 'mui', 'css-modules'],
    supportedAuth: ['none', 'authjs', 'better-auth', 'jwt'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['nextjs', 'next.js'],
    defaultPort: 3000
  },
  {
    id: 'vite-react',
    name: 'React + Vite',
    tagline: 'SPA ultrarrápida com React e bundler Vite',
    platforms: ['web'],
    languages: ['typescript', 'javascript'],
    category: 'Frontend SPA',
    popularityScore: 96,
    recommended: true,
    registrySource: { provider: 'npm', packageName: 'vite' },
    supportedDatabases: ['none', 'supabase'],
    supportedOrms: ['none'],
    supportedStyling: ['none', 'tailwind', 'mui', 'css-modules'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['react', 'vite'],
    defaultPort: 5173
  },
  {
    id: 'vite-vue',
    name: 'Vue + Vite',
    tagline: 'SPA progressiva com Vue 3 e Vite',
    platforms: ['web'],
    languages: ['typescript', 'javascript'],
    category: 'Frontend SPA',
    popularityScore: 86,
    registrySource: { provider: 'npm', packageName: 'vue' },
    supportedDatabases: ['none', 'supabase'],
    supportedOrms: ['none'],
    supportedStyling: ['none', 'tailwind', 'css-modules'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['vue', 'vite'],
    defaultPort: 5173
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    tagline: 'Framework Vue fullstack com SSR e auto-imports',
    platforms: ['web'],
    languages: ['typescript', 'javascript'],
    category: 'Fullstack Web',
    popularityScore: 84,
    registrySource: { provider: 'npm', packageName: 'nuxt' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql', 'supabase'],
    supportedOrms: ['none', 'prisma', 'drizzle'],
    supportedStyling: ['none', 'tailwind', 'css-modules'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['nuxt'],
    defaultPort: 3000
  },
  {
    id: 'astro',
    name: 'Astro',
    tagline: 'Web framework focado em conteúdo com zero JS por padrão',
    platforms: ['web'],
    languages: ['typescript', 'javascript'],
    category: 'Content & Static',
    popularityScore: 88,
    registrySource: { provider: 'npm', packageName: 'astro' },
    supportedDatabases: ['none', 'sqlite', 'postgresql'],
    supportedOrms: ['none', 'drizzle', 'prisma'],
    supportedStyling: ['none', 'tailwind', 'css-modules'],
    supportedAuth: ['none', 'better-auth'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['astro'],
    defaultPort: 4321
  },
  {
    id: 'sveltekit',
    name: 'SvelteKit',
    tagline: 'Framework fullstack compilado com Svelte',
    platforms: ['web'],
    languages: ['typescript', 'javascript'],
    category: 'Fullstack Web',
    popularityScore: 85,
    registrySource: { provider: 'npm', packageName: '@sveltejs/kit' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql', 'supabase'],
    supportedOrms: ['none', 'drizzle', 'prisma'],
    supportedStyling: ['none', 'tailwind', 'css-modules'],
    supportedAuth: ['none', 'better-auth', 'jwt'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['sveltekit'],
    defaultPort: 5173
  },
  {
    id: 'nestjs',
    name: 'NestJS',
    tagline: 'Framework backend modular e escalável com arquitetura inspirada em Angular',
    platforms: ['backend'],
    languages: ['typescript'],
    category: 'Enterprise API',
    popularityScore: 93,
    recommended: true,
    registrySource: { provider: 'npm', packageName: '@nestjs/core' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql', 'mongodb'],
    supportedOrms: ['none', 'prisma', 'typeorm', 'drizzle', 'mongoose'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn'],
    githubSearchKeywords: ['nestjs'],
    defaultPort: 3000
  },
  {
    id: 'fastify',
    name: 'Fastify',
    tagline: 'Servidor web Node.js de baixíssimo overhead e alta vazão',
    platforms: ['backend'],
    languages: ['typescript', 'javascript'],
    category: 'High-Speed API',
    popularityScore: 89,
    registrySource: { provider: 'npm', packageName: 'fastify' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql', 'mongodb'],
    supportedOrms: ['none', 'prisma', 'drizzle', 'mongoose'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt', 'better-auth'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['fastify'],
    defaultPort: 3000
  },
  {
    id: 'express',
    name: 'Express',
    tagline: 'Framework web minimalista e consolidado para Node.js',
    platforms: ['backend'],
    languages: ['typescript', 'javascript'],
    category: 'REST API',
    popularityScore: 91,
    registrySource: { provider: 'npm', packageName: 'express' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql', 'mongodb'],
    supportedOrms: ['none', 'prisma', 'drizzle', 'typeorm', 'mongoose'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['express'],
    defaultPort: 3000
  },
  {
    id: 'hono',
    name: 'Hono',
    tagline: 'Framework ultraleve baseado em Web Standards para Node, Bun e Edge',
    platforms: ['backend'],
    languages: ['typescript', 'javascript'],
    category: 'Edge & API',
    popularityScore: 90,
    recommended: true,
    registrySource: { provider: 'npm', packageName: 'hono' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql', 'supabase'],
    supportedOrms: ['none', 'drizzle', 'prisma'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt', 'better-auth'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['hono'],
    defaultPort: 3000
  },
  {
    id: 'fastapi',
    name: 'FastAPI',
    tagline: 'APIs Python assíncronas com validação Pydantic e OpenAPI automático',
    platforms: ['backend'],
    languages: ['python'],
    category: 'Python API',
    popularityScore: 95,
    recommended: true,
    registrySource: { provider: 'pypi', packageName: 'fastapi' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql', 'mongodb'],
    supportedOrms: ['none', 'sqlalchemy', 'sqlmodel'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['fastapi'],
    defaultPort: 8000
  },
  {
    id: 'django',
    name: 'Django',
    tagline: 'Framework Python completo ("batteries included") com Admin e ORM',
    platforms: ['backend', 'web'],
    languages: ['python'],
    category: 'Python Fullstack',
    popularityScore: 88,
    registrySource: { provider: 'pypi', packageName: 'django' },
    supportedDatabases: ['sqlite', 'postgresql', 'mysql'],
    supportedOrms: ['django-orm'],
    supportedStyling: ['none', 'tailwind'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['django'],
    defaultPort: 8000
  },
  {
    id: 'laravel',
    name: 'Laravel',
    tagline: 'Framework PHP elegante para web e APIs REST modernas',
    platforms: ['backend', 'web'],
    languages: ['php'],
    category: 'PHP Fullstack',
    popularityScore: 90,
    recommended: true,
    registrySource: { provider: 'packagist', packageName: 'laravel/framework' },
    supportedDatabases: ['sqlite', 'postgresql', 'mysql'],
    supportedOrms: ['eloquent'],
    supportedStyling: ['none', 'tailwind'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['laravel'],
    defaultPort: 8000
  },
  {
    id: 'go-gin',
    name: 'Gin',
    tagline: 'Framework HTTP Go minimalista e de altíssima performance',
    platforms: ['backend'],
    languages: ['go'],
    category: 'Go API',
    popularityScore: 87,
    recommended: true,
    registrySource: { provider: 'github', packageName: 'gin-gonic/gin' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql'],
    supportedOrms: ['none', 'gorm'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['gin', 'golang'],
    defaultPort: 8080
  },
  {
    id: 'rust-axum',
    name: 'Axum',
    tagline: 'Framework web ergonômico e modular construído sobre Tokio e Tower',
    platforms: ['backend'],
    languages: ['rust'],
    category: 'Rust API',
    popularityScore: 86,
    recommended: true,
    registrySource: { provider: 'crates', packageName: 'axum' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql'],
    supportedOrms: ['none', 'sqlx'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['axum', 'rust'],
    defaultPort: 3000
  },
  {
    id: 'spring-boot',
    name: 'Spring Boot',
    tagline: 'Padrão corporativo Java para microsserviços e APIs REST',
    platforms: ['backend'],
    languages: ['java'],
    category: 'Enterprise Java',
    popularityScore: 92,
    recommended: true,
    registrySource: { provider: 'github', packageName: 'spring-projects/spring-boot' },
    supportedDatabases: ['none', 'postgresql', 'mysql', 'mongodb'],
    supportedOrms: ['none'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['spring-boot'],
    defaultPort: 8080
  },
  {
    id: 'dotnet-webapi',
    name: 'ASP.NET Core',
    tagline: 'Framework web e API de alta performance da plataforma .NET',
    platforms: ['backend'],
    languages: ['csharp'],
    category: '.NET API',
    popularityScore: 89,
    recommended: true,
    registrySource: { provider: 'github', packageName: 'dotnet/aspnetcore' },
    supportedDatabases: ['none', 'sqlite', 'postgresql', 'mysql'],
    supportedOrms: ['none', 'ef-core'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['aspnetcore', 'dotnet'],
    defaultPort: 5000
  },
  {
    id: 'electron-vite',
    name: 'Electron + Vite',
    tagline: 'Apps desktop multiplataforma com React, TypeScript e Vite',
    platforms: ['desktop'],
    languages: ['typescript', 'javascript'],
    category: 'Desktop Cross-Platform',
    popularityScore: 90,
    recommended: true,
    registrySource: { provider: 'npm', packageName: 'electron' },
    supportedDatabases: ['none', 'sqlite'],
    supportedOrms: ['none', 'prisma', 'drizzle'],
    supportedStyling: ['none', 'tailwind', 'mui', 'css-modules'],
    supportedAuth: ['none'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn'],
    githubSearchKeywords: ['electron', 'vite']
  },
  {
    id: 'tauri',
    name: 'Tauri',
    tagline: 'Apps desktop leves com backend Rust e frontend web',
    platforms: ['desktop'],
    languages: ['rust', 'typescript'],
    category: 'Desktop Native-Light',
    popularityScore: 91,
    recommended: true,
    registrySource: { provider: 'crates', packageName: 'tauri' },
    supportedDatabases: ['none', 'sqlite'],
    supportedOrms: ['none', 'sqlx'],
    supportedStyling: ['none', 'tailwind', 'mui'],
    supportedAuth: ['none'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['tauri']
  },
  {
    id: 'expo',
    name: 'Expo (React Native)',
    tagline: 'Plataforma completa para apps React Native iOS, Android e Web',
    platforms: ['mobile'],
    languages: ['typescript', 'javascript'],
    category: 'Mobile Cross-Platform',
    popularityScore: 94,
    recommended: true,
    registrySource: { provider: 'npm', packageName: 'expo' },
    supportedDatabases: ['none', 'sqlite', 'supabase'],
    supportedOrms: ['none', 'drizzle'],
    supportedStyling: ['none', 'tailwind'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['expo', 'react-native']
  },
  {
    id: 'flutter',
    name: 'Flutter',
    tagline: 'SDK da Google para apps nativos iOS, Android e Desktop em Dart',
    platforms: ['mobile', 'desktop'],
    languages: ['dart'],
    category: 'Mobile & UI SDK',
    popularityScore: 92,
    recommended: true,
    registrySource: { provider: 'github', packageName: 'flutter/flutter' },
    supportedDatabases: ['none', 'sqlite', 'supabase'],
    supportedOrms: ['none'],
    supportedStyling: ['none'],
    supportedAuth: ['none', 'jwt'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['flutter']
  },
  {
    id: 'node-cli',
    name: 'Node / TS CLI',
    tagline: 'Ferramenta de terminal em TypeScript/JavaScript pronta para npm',
    platforms: ['cli'],
    languages: ['typescript', 'javascript'],
    category: 'CLI Tool',
    popularityScore: 88,
    recommended: true,
    registrySource: { provider: 'npm', packageName: 'commander' },
    supportedDatabases: ['none', 'sqlite'],
    supportedOrms: ['none', 'drizzle'],
    supportedStyling: ['none'],
    supportedAuth: ['none'],
    supportedPackageManagers: ['npm', 'pnpm', 'yarn', 'bun'],
    githubSearchKeywords: ['cli', 'typescript']
  },
  {
    id: 'python-cli',
    name: 'Python CLI (Typer)',
    tagline: 'CLIs modernas em Python com tipagem e ajuda automática',
    platforms: ['cli'],
    languages: ['python'],
    category: 'CLI Tool',
    popularityScore: 84,
    registrySource: { provider: 'pypi', packageName: 'typer' },
    supportedDatabases: ['none', 'sqlite'],
    supportedOrms: ['none', 'sqlmodel'],
    supportedStyling: ['none'],
    supportedAuth: ['none'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['typer', 'python-cli']
  },
  {
    id: 'rust-cli',
    name: 'Rust CLI (Clap)',
    tagline: 'Binário CLI nativo ultrarrápido com Clap',
    platforms: ['cli'],
    languages: ['rust'],
    category: 'CLI Tool',
    popularityScore: 85,
    registrySource: { provider: 'crates', packageName: 'clap' },
    supportedDatabases: ['none', 'sqlite'],
    supportedOrms: ['none', 'sqlx'],
    supportedStyling: ['none'],
    supportedAuth: ['none'],
    supportedPackageManagers: ['npm'],
    githubSearchKeywords: ['rust', 'clap', 'cli']
  }
];

export function sanitizeProjectName(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'my-nexus-app';
}

export function getFrameworkById(frameworkId: string): FrameworkCatalogItem | undefined {
  return FRAMEWORK_CATALOG.find((item) => item.id === frameworkId);
}

export function getAvailableLanguages(platform: ProjectPlatform): OptionMeta<ProjectLanguage>[] {
  const supported = new Set<ProjectLanguage>();
  for (const fw of FRAMEWORK_CATALOG) {
    if (fw.platforms.includes(platform)) {
      for (const lang of fw.languages) {
        supported.add(lang);
      }
    }
  }
  return LANGUAGE_OPTIONS.filter((opt) => supported.has(opt.id));
}

export function getAvailableFrameworks(
  platform: ProjectPlatform,
  language?: ProjectLanguage | null
): FrameworkCatalogItem[] {
  return FRAMEWORK_CATALOG.filter(
    (fw) => fw.platforms.includes(platform) && (!language || fw.languages.includes(language))
  ).sort((a, b) => b.popularityScore - a.popularityScore);
}

export function getAvailableDatabases(frameworkId: string): OptionMeta<DatabaseOptionId>[] {
  const fw = getFrameworkById(frameworkId);
  if (!fw) return [DATABASE_OPTIONS[0]];
  const allowed = new Set(fw.supportedDatabases);
  return DATABASE_OPTIONS.filter((db) => allowed.has(db.id));
}

const DATABASE_COMPATIBLE_ORMS: Record<DatabaseOptionId, OrmOptionId[]> = {
  none: ['none'],
  sqlite: ['none', 'prisma', 'drizzle', 'typeorm', 'sqlalchemy', 'sqlmodel', 'django-orm', 'eloquent', 'sqlx', 'gorm', 'ef-core'],
  postgresql: ['none', 'prisma', 'drizzle', 'typeorm', 'sqlalchemy', 'sqlmodel', 'django-orm', 'eloquent', 'sqlx', 'gorm', 'ef-core'],
  mysql: ['none', 'prisma', 'drizzle', 'typeorm', 'sqlalchemy', 'sqlmodel', 'django-orm', 'eloquent', 'sqlx', 'gorm', 'ef-core'],
  supabase: ['none', 'prisma', 'drizzle'],
  mongodb: ['none', 'prisma', 'mongoose']
};

export function getAvailableOrms(
  frameworkId: string,
  databaseId: DatabaseOptionId
): OptionMeta<OrmOptionId>[] {
  const fw = getFrameworkById(frameworkId);
  if (!fw || databaseId === 'none') {
    return [ORM_OPTIONS[0]];
  }
  const fwAllowed = new Set(fw.supportedOrms);
  const dbAllowed = new Set(DATABASE_COMPATIBLE_ORMS[databaseId]);
  const filtered = ORM_OPTIONS.filter((orm) => fwAllowed.has(orm.id) && dbAllowed.has(orm.id));
  return filtered.length > 0 ? filtered : [ORM_OPTIONS[0]];
}

export function getAvailableStyling(frameworkId: string): OptionMeta<StylingOptionId>[] {
  const fw = getFrameworkById(frameworkId);
  if (!fw) return [STYLING_OPTIONS[0]];
  const allowed = new Set(fw.supportedStyling);
  return STYLING_OPTIONS.filter((s) => allowed.has(s.id));
}

export function getAvailableAuth(frameworkId: string): OptionMeta<AuthOptionId>[] {
  const fw = getFrameworkById(frameworkId);
  if (!fw) return [AUTH_OPTIONS[0]];
  const allowed = new Set(fw.supportedAuth);
  return AUTH_OPTIONS.filter((a) => allowed.has(a.id));
}

export function buildGithubTemplateSearchQuery(selection: Partial<StackSelectionInput>): string {
  const parts: string[] = [];
  if (selection.frameworkId) {
    const fw = getFrameworkById(selection.frameworkId);
    if (fw) {
      parts.push(...fw.githubSearchKeywords);
    }
  } else if (selection.platform) {
    parts.push(selection.platform);
  }

  if (selection.language && !parts.includes(selection.language)) {
    parts.push(selection.language);
  }
  if (selection.database && selection.database !== 'none') {
    parts.push(selection.database);
  }
  if (selection.orm && selection.orm !== 'none') {
    parts.push(selection.orm);
  }
  if (selection.styling && selection.styling !== 'none') {
    parts.push(selection.styling);
  }
  if (selection.auth && selection.auth !== 'none') {
    parts.push(selection.auth);
  }

  return parts.join(' ').trim() || 'nextjs prisma typescript';
}
