import { COMPILE_BEGIN, COMPILE_END, COMPILE_ERROR_EXIT, quoted } from "./launcher-protocol";
import type { IdeFile } from "./types";

/**
 * Piston's `typescript` package appends ".ts" to every file it receives and
 * runs a bare `tsc *.ts`: default target ES5 (no Map/Set/includes in the
 * types, no string spread) and file names like `main.ts.ts`, which breaks
 * every relative `import "./utils"`. Neither can be configured per request.
 *
 * So we send a single file named `main` (compiled to `main.js` by that bare
 * tsc, so it must be ES5-safe and need no Node typings) that embeds the
 * student's files as JSON. When it runs, it writes them to a subfolder,
 * compiles them with the bundled TypeScript compiler API using sane options
 * (ES2022, CommonJS, inline source maps), reports diagnostics with the shared
 * compile-error protocol, and finally requires the compiled entry, with
 * source maps enabled so stack traces point at the .ts lines.
 */
export const TS_LAUNCHER_FILE = "main";

export function buildTypeScriptLauncher(files: IdeFile[]): IdeFile {
  const entry = files[0].name;
  const payload = files.map((f) => ({ name: f.name, content: f.content }));

  const content = `declare var require: any;
declare var process: any;
var fs = require("fs");
var path = require("path");
var ts = require(path.join(path.dirname(process.execPath), "..", "lib", "node_modules", "typescript"));

var files: { name: string; content: string }[] = ${JSON.stringify(payload)};
var entry = ${quoted(entry)};
var dir = path.resolve("ide_src__");
var outDir = path.join(dir, "out");
fs.mkdirSync(dir, { recursive: true });

// Ambient declarations so student code can use process/require/module
// without @types/node (not installed in the Piston package).
var globalsFile = path.join(dir, "ide_globals__.d.ts");
fs.writeFileSync(globalsFile, "declare var process: any;\\ndeclare var require: any;\\ndeclare var module: any;\\ndeclare var exports: any;\\ndeclare var __dirname: string;\\ndeclare var __filename: string;\\n");

var roots: string[] = [globalsFile];
for (var i = 0; i < files.length; i++) {
  var target = path.join(dir, files[i].name);
  fs.writeFileSync(target, files[i].content);
  if (/\\.ts$/i.test(files[i].name)) roots.push(target);
}

var options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  types: [],
  esModuleInterop: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  inlineSourceMap: true,
  inlineSources: true,
  outDir: outDir,
  rootDir: dir,
  noEmitOnError: true
};
var program = ts.createProgram(roots, options);
var diagnostics = ts.getPreEmitDiagnostics(program).filter(function (d: any) {
  return d.category === ts.DiagnosticCategory.Error;
});
if (diagnostics.length > 0) {
  var host = {
    getCanonicalFileName: function (f: string) { return f; },
    getCurrentDirectory: function () { return dir; },
    getNewLine: function () { return "\\n"; }
  };
  process.stderr.write(${quoted(COMPILE_BEGIN)} + ts.formatDiagnostics(diagnostics, host) + ${quoted(COMPILE_END)});
  process.exit(${COMPILE_ERROR_EXIT});
}
program.emit();

if (process.setSourceMapsEnabled) process.setSourceMapsEnabled(true);
var compiledEntry = path.join(outDir, entry.replace(/\\.ts$/i, ".js"));
try {
  require(compiledEntry);
} catch (e) {
  // Same shape as a plain \`node main.js\` crash, minus launcher/internal frames and our folder prefix.
  var err: any = e;
  var stack = String((err && err.stack) || err);
  var lines = stack.split("\\n").filter(function (line: string) {
    return line.indexOf("node:internal") === -1 && line.indexOf(${quoted(`/${TS_LAUNCHER_FILE}.js`)}) === -1;
  });
  process.stderr.write(lines.join("\\n").split(dir + path.sep).join("").split(outDir + path.sep).join("") + "\\n");
  process.exit(1);
}
`;
  return { name: TS_LAUNCHER_FILE, content };
}
