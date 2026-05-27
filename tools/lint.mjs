import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const excludedDirectories = new Set(['.git', 'dist', 'node_modules', 'qa-screenshots', 'tmp-epa']);
const sourceExtensions = new Set(['.js', '.jsx', '.mjs']);
const lintTargets = ['src', 'server', 'tests', 'tools', 'vite.config.mjs'];
const failures = [];

function normalizePath(path) {
  return relative(root, path).split(sep).join('/');
}

function extensionOf(path) {
  const match = path.match(/\.[^.]+$/);
  return match?.[0] || '';
}

async function collectFiles(path) {
  if (sourceExtensions.has(extensionOf(path))) return [path];

  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        files.push(...await collectFiles(join(path, entry.name)));
      }
      continue;
    }

    const filePath = join(path, entry.name);
    if (sourceExtensions.has(extensionOf(filePath))) files.push(filePath);
  }
  return files;
}

function report(file, message, line = 1, column = 1) {
  failures.push(`${normalizePath(file)}:${line}:${column} ${message}`);
}

function lineAndColumn(text, offset) {
  const prefix = text.slice(0, offset);
  const lines = prefix.split(/\r?\n/);
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function checkTextRules(file, text) {
  const rules = [
    { pattern: /^(<<<<<<<|=======|>>>>>>>) /m, message: 'contains unresolved merge conflict marker' },
    { pattern: new RegExp(`\\bdebug${'ger'}\\b`), message: 'contains debug breakpoint statement' },
    { pattern: /\b(?:test|describe|it)\.only\s*\(/, message: 'contains focused test' },
  ];

  for (const { pattern, message } of rules) {
    const match = pattern.exec(text);
    if (match) {
      const { line, column } = lineAndColumn(text, match.index);
      report(file, message, line, column);
    }
  }

  if (
    normalizePath(file) !== 'src/vehicleCatalog.js'
    && /\bimport\s+(?:[^'"]+\s+from\s+)?['"][^'"]*vehicleData\.js['"]/.test(text)
  ) {
    const match = /\bimport\s+(?:[^'"]+\s+from\s+)?['"][^'"]*vehicleData\.js['"]/.exec(text);
    const { line, column } = lineAndColumn(text, match.index);
    report(file, 'statically imports generated EPA vehicle data; use loadVehicleCatalog() instead', line, column);
  }
}

const files = (await Promise.all(lintTargets.map((target) => collectFiles(join(root, target))))).flat();
const program = ts.createProgram(files, {
  allowJs: true,
  checkJs: false,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
});

for (const diagnostic of program.getSyntacticDiagnostics()) {
  if (!diagnostic.file) {
    failures.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    continue;
  }

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start || 0);
  report(diagnostic.file.fileName, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), line + 1, character + 1);
}

for (const file of files) {
  checkTextRules(file, await readFile(file, 'utf8'));
}

if (failures.length) {
  console.error(`Lint failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lint passed for ${files.length} JavaScript files.`);
