export function requireSelection<T>(value: T[]): true | string {
  return value.length > 0
    ? true
    : 'Select at least one option, or press Esc or Ctrl+C to exit.';
}
