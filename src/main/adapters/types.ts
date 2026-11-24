import type { PackageManager, ProjectScript } from '../../shared/types';

export interface InspectedProjectInfo {
  name: string;
  path: string;
  adapterType: string;
  packageManager: PackageManager;
  version?: string;
  description?: string;
  hasNodeModules: boolean;
  scripts: ProjectScript[];
}

export interface ProjectAdapter {
  readonly id: string;
  readonly label: string;
  detect(dirPath: string): Promise<boolean>;
  inspect(dirPath: string): Promise<InspectedProjectInfo | null>;
}
