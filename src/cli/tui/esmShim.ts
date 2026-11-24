import path from 'path';
import { fileURLToPath } from 'url';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);

const globalTarget = globalThis as Record<string, unknown>;
if (typeof globalTarget.__filename !== 'string' || !path.isAbsolute(globalTarget.__filename)) {
  globalTarget.__filename = currentFilename;
}
if (typeof globalTarget.__dirname !== 'string' || !path.isAbsolute(globalTarget.__dirname)) {
  globalTarget.__dirname = currentDirname;
}
