import fs from 'fs';
import esbuild from 'esbuild';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const pkgVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0';

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length) : null;

async function buildCli() {
  await esbuild.build({
    entryPoints: ['src/cli/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: 'out/cli/index.js',
    define: {
      __NEXUS_VERSION__: JSON.stringify(pkgVersion)
    },
    external: ['@prisma/client', 'electron']
  });
  console.log(`✓ out/cli/index.js built (v${pkgVersion})`);
}

const stubDevtoolsPlugin = {
  name: 'stub-react-devtools-core',
  setup(build) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
      path: 'react-devtools-core',
      namespace: 'stub-devtools'
    }));
    build.onLoad({ filter: /.*/, namespace: 'stub-devtools' }, () => ({
      contents: 'export default { connectToDevTools() {} };',
      loader: 'js'
    }));
  }
};

async function buildTui() {
  await esbuild.build({
    entryPoints: ['src/cli/tui/index.tsx'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    outfile: 'out/cli/tui.mjs',
    plugins: [stubDevtoolsPlugin],
    define: {
      'process.env.NODE_ENV': '"production"',
      __NEXUS_VERSION__: JSON.stringify(pkgVersion)
    },
    banner: {
      js: "import { createRequire as __nexusCreateRequire } from 'module'; const require = __nexusCreateRequire(import.meta.url);"
    },
    external: ['@prisma/client', 'electron']
  });
  console.log('✓ out/cli/tui.mjs built (self-contained)');
}

async function main() {
  if (!only || only === 'cli') {
    await buildCli();
  }
  if (!only || only === 'tui') {
    await buildTui();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
