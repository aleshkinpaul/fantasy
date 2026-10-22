import { access } from 'node:fs/promises';

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.(?:[cm]?[jt]s|json)$/i.test(specifier)) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    try {
      await access(candidate);
      return nextResolve(candidate.href, context);
    } catch {
      // Let Node report the original unresolved module below.
    }
  }
  return nextResolve(specifier, context);
}
