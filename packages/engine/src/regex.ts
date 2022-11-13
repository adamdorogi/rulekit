export function compileRegex(pattern: string): ((input: string) => boolean) | undefined {
  try {
    const regex = new RegExp(pattern);
    return input => regex.test(input);
  } catch {
    return;
  }
}
