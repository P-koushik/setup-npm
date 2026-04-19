import fs from 'fs-extra';
import path from 'path';

export async function ensureJsonFile<T extends object>(
  filePath: string,
  fallback: T
): Promise<T> {
  if (!(await fs.pathExists(filePath))) {
    return fallback;
  }

  return (await fs.readJson(filePath)) as T;
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, value, { spaces: 2 });
}
