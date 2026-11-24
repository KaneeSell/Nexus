import fs from 'fs';
import path from 'path';

export interface LoadedEnvProfile {
  loadedFile: string | null;
  vars: Record<string, string>;
}

function parseDotEnvContent(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = withoutExport.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = withoutExport.slice(0, eqIndex).trim();
    let value = withoutExport.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      vars[key] = value;
    }
  }

  return vars;
}

export function loadEnvProfile(
  projectPath: string,
  envProfile?: string | null
): LoadedEnvProfile {
  if (!envProfile || !envProfile.trim()) {
    return { loadedFile: null, vars: {} };
  }

  const profileName = envProfile.trim();
  const candidates = [`.env.${profileName}`, '.env'];

  for (const fileName of candidates) {
    const fullPath = path.join(projectPath, fileName);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return {
          loadedFile: fileName,
          vars: parseDotEnvContent(content)
        };
      } catch {
        return { loadedFile: null, vars: {} };
      }
    }
  }

  return { loadedFile: null, vars: {} };
}
