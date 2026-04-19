import fs from 'fs-extra';
import path from 'path';

export function resolveTemplateRoot(
  candidates: string[],
  label: string
): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`${label} not found. Checked: ${candidates.join(', ')}`);
}

export async function validateTemplateDirectory(
  templatePath: string,
  requiredFiles: string[],
  label: string
) {
  if (!(await fs.pathExists(templatePath))) {
    throw new Error(`${label} not found at ${templatePath}`);
  }

  for (const requiredFile of requiredFiles) {
    const absolutePath = path.join(templatePath, requiredFile);

    if (!(await fs.pathExists(absolutePath))) {
      throw new Error(
        `${label} is invalid. Missing required file: ${requiredFile}`
      );
    }
  }
}
