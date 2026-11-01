/**
 * Read `--flag value` or `--flag=value` from process.argv.
 * Equals form alone is common with npm (`--range=10y`); space form is preferred in docs.
 */
export function readArg(
  flag: string,
  argv: string[] = process.argv,
): string | undefined {
  const eqPrefix = `${flag}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (token === flag) {
      if (i + 1 >= argv.length) return undefined;
      return argv[i + 1];
    }
    if (token.startsWith(eqPrefix)) {
      return token.slice(eqPrefix.length);
    }
  }
  return undefined;
}
