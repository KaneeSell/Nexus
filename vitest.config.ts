import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: [
        'src/cli/tui/NexusTuiApp.tsx',
        'src/shared/cliArgs.ts',
        'src/shared/semverBump.ts',
        'src/shared/version.ts',
        'src/main/engine/envLoader.ts',
        'src/main/engine/pipelineExporter.ts',
        'src/main/adapters/nodeAdapter.ts'
      ],
      thresholds: {
        perFile: true,
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 100
      }
    }
  }
});
