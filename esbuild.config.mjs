import esbuild from "esbuild";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";

const prod = process.argv[2] === "production";
const outDir = "dist/local-plantuml";

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const file of ["manifest.json", "styles.css"]) {
  copyFileSync(file, `${outDir}/${file}`);
}
// Engine, layout runtime, themes and the standard library are inlined into
// main.js by scripts/embed-assets.mjs: the community installer only downloads
// main.js, manifest.json and styles.css.

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    "builtin-modules",
  ],
  format: "cjs",
  alias: {
    url: "./scripts/url-stub.mjs",
  },
  define: {
    __filename: '"/viz-global.js"',
  },
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: prod,
  outfile: `${outDir}/main.js`,
});

if (prod) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
