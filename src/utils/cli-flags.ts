export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export function hasFlag(args: string[], ...flags: string[]) {
  return flags.some((flag) => args.includes(flag));
}

export function readFlagValue(args: string[], ...flags: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    if (!flags.includes(args[index])) {
      continue;
    }

    const nextValue = args[index + 1];

    if (!nextValue || nextValue.startsWith('--')) {
      return undefined;
    }

    return nextValue;
  }

  return undefined;
}

export function normalizePackageManager(
  value?: string
): PackageManager | undefined {
  if (
    value === 'npm' ||
    value === 'pnpm' ||
    value === 'yarn' ||
    value === 'bun'
  ) {
    return value;
  }

  return undefined;
}

export function inferPackageManager(
  args: string[]
): PackageManager | undefined {
  const explicitValue = normalizePackageManager(
    readFlagValue(args, '--package-manager', '--pm')
  );

  if (explicitValue) {
    return explicitValue;
  }

  if (hasFlag(args, '--npm')) {
    return 'npm';
  }

  if (hasFlag(args, '--pnpm')) {
    return 'pnpm';
  }

  if (hasFlag(args, '--yarn')) {
    return 'yarn';
  }

  if (hasFlag(args, '--bun')) {
    return 'bun';
  }

  return undefined;
}
