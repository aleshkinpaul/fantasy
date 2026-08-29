import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

export function loadTypeScriptModule(entryPath) {
  const cache = new Map();

  function load(modulePath) {
    const resolvedPath = resolveTypeScriptPath(modulePath);
    if (cache.has(resolvedPath)) return cache.get(resolvedPath).exports;

    const source = readFileSync(resolvedPath, 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const loadedModule = { exports: {} };
    cache.set(resolvedPath, loadedModule);

    const localRequire = specifier => specifier.startsWith('.')
      ? load(resolve(dirname(resolvedPath), specifier))
      : require(specifier);
    const evaluate = new Function('require', 'module', 'exports', compiled);
    evaluate(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }

  return load(entryPath);
}

function resolveTypeScriptPath(modulePath) {
  const candidates = extname(modulePath)
    ? [modulePath]
    : [`${modulePath}.ts`, resolve(modulePath, 'index.ts')];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Cannot resolve TypeScript module: ${modulePath}`);
  return resolve(found);
}
